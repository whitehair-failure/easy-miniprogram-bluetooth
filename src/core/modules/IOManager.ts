/**
 * IOManager - 输入输出管理模块
 * 负责读写操作、请求队列管理、特征值变化监听
 */
import BluetoothManager from "../BluetoothManager";
import type {
  writeCharacteristicOption,
  readCharacteristicOption,
  BLEHandlerConfig,
} from "../../types/ble";

export class IOManager {
  // 将 sendResolve 从单个函数改为一个 Map
  private pendingRequests: Map<string, (result: [Error | null, any]) => void> =
    new Map();
  private requestCounter = 0; // 用于生成唯一的请求ID

  // 存储多个特征值变化的回调函数
  private characteristicValueChangeCallbacks: Set<
    (result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult) => void
  > = new Set();
  
  // 标记是否已经注册了微信的全局监听器
  private isWxListenerRegistered = false;

  private readonly config: BLEHandlerConfig;

  constructor(config: BLEHandlerConfig) {
    this.config = config;
  }

  /**
   * 注册微信的全局特征值变化监听器（只注册一次）
   */
  private ensureWxListenerRegistered(): void {
    if (this.isWxListenerRegistered) {
      return;
    }

    wx.onBLECharacteristicValueChange((res) => {
      // 将 ArrayBuffer 转换为 Uint8Array，方便处理二进制数据
      const buffer = new Uint8Array(res.value);

      let newRes = {
        deviceId: res.deviceId,
        serviceId: res.serviceId,
        characteristicId: res.characteristicId,
        value: Array.from(buffer), // 转换为普通数组以便打印
      };
      console.log("onBLECharacteristicValueChange event received:", newRes);

      // 如果有等待处理的请求
      if (this.pendingRequests.size > 0) {
        // 获取 Map 中第一个请求的 key 和 resolve 函数
        const nextEntry = this.pendingRequests.entries().next();

        // 判断迭代器是否还有值
        if (!nextEntry.done) {
          // 如果有值，才进行解构
          const [requestId, resolveCallback] = nextEntry.value;

          if (resolveCallback) {
            // 调用回调来解析对应的 Promise
            resolveCallback([null, newRes]);
            // 注意：resolveCallback 内部已经包含了从 Map 中删除的逻辑，所以这里不需要再删
          }
        } else {
          // Map 为空时的处理
          console.log("当前没有待处理的请求了哟~");
        }
      }

      // 执行所有已注册的回调函数
      this.characteristicValueChangeCallbacks.forEach((callback) => {
        try {
          callback(res);
        } catch (error) {
          console.error("特征值变化回调执行出错:", error);
        }
      });
    });

    this.isWxListenerRegistered = true;
  }

  /**
   * 添加蓝牙设备特征值变化的监听回调
   * @param {function} callback 特征值变化时的回调函数
   * @returns {function} 返回一个用于取消该回调的函数
   */
  addCharacteristicValueChangeCallback(
    callback: (
      result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult
    ) => void
  ): () => void {
    // 确保微信的全局监听器已注册
    this.ensureWxListenerRegistered();

    // 添加回调到集合中
    this.characteristicValueChangeCallbacks.add(callback);

    // 返回一个解绑函数
    return () => {
      this.delCharacteristicValueChangeCallback(callback);
    };
  }

  /**
   * 删除特定的特征值变化监听回调
   * @param {function} callback 要删除的回调函数
   * @returns {boolean} 是否成功删除
   */
  delCharacteristicValueChangeCallback(
    callback: (
      result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult
    ) => void
  ): boolean {
    return this.characteristicValueChangeCallbacks.delete(callback);
  }

  /**
   * 删除所有特征值变化监听回调
   */
  delAllCharacteristicValueChangeCallback(): void {
    this.characteristicValueChangeCallbacks.clear();
  }

  /**
   * 发送数据帧（使用 writeCharacteristic 类型）
   * @param options 写入选项，包含小程序原生字段以及额外的 hasResponse/timeoutMs
   * @param mode 单设备/多设备模式
   * @param connectedSingleDeviceId 单设备模式下的默认设备ID
   * @returns Promise with error and result
   */
  async writeCharacteristic(
    options: writeCharacteristicOption,
    mode: "single" | "multiple",
    connectedSingleDeviceId?: string
  ): Promise<[Error | null, any]> {
    const {
      value: frame,
      deviceId: optDeviceId,
      hasResponse,
      timeoutMs,
      serviceId,
      characteristicId,
    } = options;

    let targetDeviceId: string | undefined;

    if (mode === "single") {
      // 单设备模式下，优先使用传入的 deviceId，否则使用已连接的设备ID
      targetDeviceId = optDeviceId || connectedSingleDeviceId;
      if (!targetDeviceId) {
        return [new Error("单设备模式下未连接任何设备，也未提供设备ID"), null];
      }
    } else {
      // 多设备模式下，必须提供 deviceId
      if (!optDeviceId) {
        return [new Error("多设备模式下必须提供设备ID"), null];
      }
      targetDeviceId = optDeviceId;
    }

    const serviceIdFinal = serviceId || this.config.serviceUId || "";
    const characteristicIdFinal =
      characteristicId || this.config.writeCharacteristicId || "";

    if (hasResponse) {
      console.log("hasResponse");

      // 生成一个唯一的请求ID
      const requestId = `req_${this.requestCounter++}`;

      return new Promise<[Error | null, any]>(async (resolve) => {
        let timeoutId: any;

        const cleanupAndResolve = (result: [Error | null, any]) => {
          if (timeoutId) clearTimeout(timeoutId);
          // 从 Map 中删除此请求
          this.pendingRequests.delete(requestId);
          resolve(result);
        };

        // 将 resolve 函数存入 Map
        this.pendingRequests.set(requestId, cleanupAndResolve);

        timeoutId = setTimeout(() => {
          // 超时后，也需要调用 cleanupAndResolve 来确保从 Map 中删除
          cleanupAndResolve([
            new Error(`响应超时 (${timeoutMs}ms) for request ${requestId}`),
            null,
          ]);
        }, timeoutMs || 1000);

        try {
          const [err] = await BluetoothManager.writeBLECharacteristicValue({
            deviceId: targetDeviceId,
            serviceId: serviceIdFinal,
            characteristicId: characteristicIdFinal,
            value: frame,
            writeType: hasResponse ? "write" : "writeNoResponse"
          });
          if (err) {
            cleanupAndResolve([err, null]);
          }
        } catch (error) {
          cleanupAndResolve([error as Error, null]);
        }
      });
    } else {
      return await BluetoothManager.writeBLECharacteristicValue({
        deviceId: targetDeviceId,
        serviceId: serviceIdFinal,
        characteristicId: characteristicIdFinal,
        value: frame,
        writeType: hasResponse ? "write" : "writeNoResponse"
      });
    }
  }

  /**
   * 读取数据帧（使用 readCharacteristic 类型）
   * @param options 读取选项，包含小程序原生字段以及额外的 timeoutMs
   * @param mode 单设备/多设备模式
   * @param connectedSingleDeviceId 单设备模式下的默认设备ID
   * @returns Promise with error and result
   */
  async readCharacteristic(
    options: readCharacteristicOption,
    mode: "single" | "multiple",
    connectedSingleDeviceId?: string
  ): Promise<[Error | null, any]> {
    const {
      deviceId: optDeviceId,
      timeoutMs,
      serviceId,
      characteristicId,
    } = options;

    let targetDeviceId: string | undefined;

    if (mode === "single") {
      // 单设备模式下，优先使用传入的 deviceId，否则使用已连接的设备ID
      targetDeviceId = optDeviceId || connectedSingleDeviceId;
      if (!targetDeviceId) {
        return [new Error("单设备模式下未连接任何设备，也未提供设备ID"), null];
      }
    } else {
      // 多设备模式下，必须提供 deviceId
      if (!optDeviceId) {
        return [new Error("多设备模式下必须提供设备ID"), null];
      }
      targetDeviceId = optDeviceId;
    }

    const serviceIdFinal = serviceId || this.config.serviceUId || "";
    const characteristicIdFinal =
      characteristicId || this.config.readCharacteristicId || "";

    // 生成一个唯一的请求ID
    const requestId = `req_${this.requestCounter++}`;

    return new Promise<[Error | null, any]>(async (resolve) => {
      let timeoutId: any;

      const cleanupAndResolve = (result: [Error | null, any]) => {
        if (timeoutId) clearTimeout(timeoutId);
        // 从 Map 中删除此请求
        this.pendingRequests.delete(requestId);
        resolve(result);
      };

      // 将 resolve 函数存入 Map
      this.pendingRequests.set(requestId, cleanupAndResolve);

      timeoutId = setTimeout(() => {
        // 超时后，也需要调用 cleanupAndResolve 来确保从 Map 中删除
        cleanupAndResolve([
          new Error(`响应超时 (${timeoutMs}ms) for request ${requestId}`),
          null,
        ]);
      }, timeoutMs || 1000);

      try {
        const [err] = await BluetoothManager.readBLECharacteristicValue({
          deviceId: targetDeviceId,
          serviceId: serviceIdFinal,
          characteristicId: characteristicIdFinal,
        });
        if (err) {
          cleanupAndResolve([err, null]);
        }
      } catch (error) {
        cleanupAndResolve([error as Error, null]);
      }
    });
  }
}
