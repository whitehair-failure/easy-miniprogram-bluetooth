/**
 * IOManager - 输入输出管理模块
 * 负责读写操作、请求队列管理、特征值变化监听
 */
import type {
  writeCharacteristicOption,
  readCharacteristicOption,
  BLEHandlerConfig,
} from "../../types/ble";
import { BLEIOError, BLETimeoutError, BLEConfigError, convertWxErrorToBLEError } from "../../utils/error";

export class IOManager {
  // 请求队列：存储待响应的请求信息，用于精确匹配
  private pendingRequests: Map<string, {
    deviceId: string;
    characteristicId: string;
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    timeoutId: any;
  }> = new Map();
  private requestCounter = 0; // 用于生成唯一的请求ID

  // 存储多个特征值变化的回调函数
  private characteristicValueChangeCallbacks: Set<
    (result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult) => void
  > = new Set();

  // 标记是否已经注册了平台的全局监听器（私有实现）
  private isCharacteristicListenerRegistered = false;

  private readonly config: BLEHandlerConfig;

  constructor(config: BLEHandlerConfig) {
    this.config = config;
  }

  /**
   * 注册微信的全局特征值变化监听器（只注册一次）
   */
  private ensureCharacteristicListenerRegistered(): void {
    if (this.isCharacteristicListenerRegistered) {
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

      // 精确匹配：根据 deviceId 和 characteristicId 找到对应的请求
      if (this.pendingRequests.size > 0) {
        let matchedRequestId: string | null = null;
        
        // 遍历所有待处理的请求，找到第一个匹配的（ES5 兼容方式）
        this.pendingRequests.forEach((request, requestId) => {
          if (!matchedRequestId && 
              request.deviceId === res.deviceId && 
              request.characteristicId === res.characteristicId) {
            matchedRequestId = requestId;
          }
        });

        if (matchedRequestId) {
          const request = this.pendingRequests.get(matchedRequestId);
          if (request) {
            // 清理超时定时器
            if (request.timeoutId) {
              clearTimeout(request.timeoutId);
            }
            // 解析 Promise
            request.resolve(newRes);
            // 从队列中删除
            this.pendingRequests.delete(matchedRequestId);
            console.log(`请求 ${matchedRequestId} 已匹配并完成`);
          }
        } else {
          console.log(`未找到匹配的请求: deviceId=${res.deviceId}, characteristicId=${res.characteristicId}`);
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

    this.isCharacteristicListenerRegistered = true;
  }

  // 兼容旧名：ensureWxListenerRegistered -> ensureCharacteristicListenerRegistered
  // Removed deprecated ensureWxListenerRegistered alias; use ensureCharacteristicListenerRegistered

  /**
   * 添加蓝牙设备特征值变化的监听回调
   * @param {function} callback 特征值变化时的回调函数
   * @returns {function} 返回一个用于取消该回调的函数
   */
  addCharacteristicValueChangeListener(
    callback: (
      result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult
    ) => void
  ): () => void {
    // 确保平台的全局监听器已注册
    this.ensureCharacteristicListenerRegistered();

    // 添加回调到集合中
    this.characteristicValueChangeCallbacks.add(callback);

    // 返回一个解绑函数
    return () => {
      this.removeCharacteristicValueChangeListener(callback);
    };
  }

  // Removed deprecated addCharacteristicValueChangeCallback alias; use addCharacteristicValueChangeListener

  /**
   * 删除特定的特征值变化监听回调
   * @param {function} callback 要删除的回调函数
   * @returns {boolean} 是否成功删除
   */
  removeCharacteristicValueChangeListener(
    callback: (
      result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult
    ) => void
  ): boolean {
    return this.characteristicValueChangeCallbacks.delete(callback);
  }

  // Removed deprecated delCharacteristicValueChangeCallback alias; use removeCharacteristicValueChangeListener

  /**
   * 删除所有特征值变化监听回调
   */
  removeAllCharacteristicValueChangeListeners(): void {
    this.characteristicValueChangeCallbacks.clear();
  }

  // Removed deprecated delAllCharacteristicValueChangeCallback alias; use removeAllCharacteristicValueChangeListeners

  /**
   * 发送数据帧（使用 writeCharacteristic 类型）
   * @param options 写入选项，包含小程序原生字段以及额外的 hasResponse/timeoutMs
   * @param mode 单设备/多设备模式
   * @param connectedSingleDeviceId 单设备模式下的默认设备ID
   * @returns Promise with result
   * @throws {BLEIOError} 写入失败时抛出
   * @throws {BLETimeoutError} 超时时抛出
   * @throws {BLEConfigError} 配置错误时抛出
   */
  async writeCharacteristicValue(
    options: writeCharacteristicOption,
    mode: "single" | "multiple",
    connectedSingleDeviceId?: string
  ): Promise<any> {
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
        throw new BLEConfigError("单设备模式下未连接任何设备，也未提供设备ID");
      }
    } else {
      // 多设备模式下，必须提供 deviceId
      if (!optDeviceId) {
        throw new BLEConfigError("多设备模式下必须提供设备ID");
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

      return new Promise<any>(async (resolve, reject) => {
        const cleanup = () => {
          const request = this.pendingRequests.get(requestId);
          if (request?.timeoutId) {
            clearTimeout(request.timeoutId);
          }
          this.pendingRequests.delete(requestId);
        };

        // 创建超时定时器
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new BLETimeoutError(
            `写入响应超时 - 请求ID: ${requestId}, 设备: ${targetDeviceId}, 特征值: ${characteristicIdFinal}`,
            "write",
            timeoutMs || 1000
          ));
        }, timeoutMs || 1000);

        // 将请求信息存入 Map（包含设备和特征值以便精确匹配）
        this.pendingRequests.set(requestId, {
          deviceId: targetDeviceId!,
          characteristicId: characteristicIdFinal,
          resolve: (result) => {
            cleanup();
            resolve(result);
          },
          reject: (error) => {
            cleanup();
            reject(error);
          },
          timeoutId
        });

        try {
          await wx.writeBLECharacteristicValue({
            deviceId: targetDeviceId,
            serviceId: serviceIdFinal,
            characteristicId: characteristicIdFinal,
            value: frame,
            writeType: hasResponse ? "write" : "writeNoResponse"
          });
          console.log(`✔ 写入数据成功 - 请求ID: ${requestId}`);
          // 等待设备响应（通过特征值变化事件）
        } catch (error) {
          cleanup();
          reject(convertWxErrorToBLEError(error));
        }
      });
    } else {
      try {
        await wx.writeBLECharacteristicValue({
          deviceId: targetDeviceId,
          serviceId: serviceIdFinal,
          characteristicId: characteristicIdFinal,
          value: frame,
          writeType: "writeNoResponse"
        });
        console.log(`✔ 写入数据成功（无需响应）`);
        return { success: true };
      } catch (error) {
        throw convertWxErrorToBLEError(error);
      }
    }
  }

  // Removed deprecated writeCharacteristic alias; use writeCharacteristicValue

  /**
   * 读取数据帧（使用 readCharacteristic 类型）
   * @param options 读取选项，包含小程序原生字段以及额外的 timeoutMs
   * @param mode 单设备/多设备模式
   * @param connectedSingleDeviceId 单设备模式下的默认设备ID
   * @returns Promise with result
   * @throws {BLEIOError} 读取失败时抛出
   * @throws {BLETimeoutError} 超时时抛出
   * @throws {BLEConfigError} 配置错误时抛出
   */
  async readCharacteristicValue(
    options: readCharacteristicOption,
    mode: "single" | "multiple",
    connectedSingleDeviceId?: string
  ): Promise<any> {
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
        throw new BLEConfigError("单设备模式下未连接任何设备，也未提供设备ID");
      }
    } else {
      // 多设备模式下，必须提供 deviceId
      if (!optDeviceId) {
        throw new BLEConfigError("多设备模式下必须提供设备ID");
      }
      targetDeviceId = optDeviceId;
    }

    const serviceIdFinal = serviceId || this.config.serviceUId || "";
    const characteristicIdFinal =
      characteristicId || this.config.readCharacteristicId || "";

    // 生成一个唯一的请求ID
    const requestId = `req_${this.requestCounter++}`;

    return new Promise<any>(async (resolve, reject) => {
      const cleanup = () => {
        const request = this.pendingRequests.get(requestId);
        if (request?.timeoutId) {
          clearTimeout(request.timeoutId);
        }
        this.pendingRequests.delete(requestId);
      };

      // 创建超时定时器
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new BLETimeoutError(
          `读取响应超时 - 请求ID: ${requestId}, 设备: ${targetDeviceId}, 特征值: ${characteristicIdFinal}`,
          "read",
          timeoutMs || 1000
        ));
      }, timeoutMs || 1000);

      // 将请求信息存入 Map（包含设备和特征值以便精确匹配）
      this.pendingRequests.set(requestId, {
        deviceId: targetDeviceId!,
        characteristicId: characteristicIdFinal,
        resolve: (result) => {
          cleanup();
          resolve(result);
        },
        reject: (error) => {
          cleanup();
          reject(error);
        },
        timeoutId
      });

      try {
        await wx.readBLECharacteristicValue({
          deviceId: targetDeviceId,
          serviceId: serviceIdFinal,
          characteristicId: characteristicIdFinal,
        });
        console.log(`✔ 读取数据成功 - 请求ID: ${requestId}`);
        // 等待设备通过特征值变化事件返回数据
      } catch (error) {
        cleanup();
        reject(convertWxErrorToBLEError(error));
      }
    });
  }

  // Removed deprecated readCharacteristic alias; use readCharacteristicValue
}
