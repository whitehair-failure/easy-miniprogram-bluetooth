/**
 * IOManager - 输入输出管理模块
 * 负责读写操作、请求队列管理、特征值变化监听
 */
import type {
  writeCharacteristicOption,
  readCharacteristicOption,
  BLEHandlerConfig,
  CharacteristicValueResult,
} from "../../types/ble";
import { shouldSkipBLEApiCall } from "../../utils/runtime";
import { convertConfigUUIDs } from "../../utils/uuid";
import { validateBLEHandlerConfig } from "../../utils/config";
import { debugLog, debugError } from "../../utils/logger";

export class IOManager {
  // 请求队列：存储待响应的请求信息，用于精确匹配
  private pendingRequests: Map<
    string,
    {
      deviceId: string;
      characteristicId: string;
      resolve: (result: any) => void;
      reject: (error: Error) => void;
      timeoutId: any;
    }
  > = new Map();
  private requestCounter = 0; // 用于生成唯一的请求ID

  // 存储多个特征值变化的回调函数
  private characteristicValueChangeCallbacks: Set<
    (result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult) => void
  > = new Set();

  // 标记是否已经注册了平台的全局监听器（私有实现）
  private isCharacteristicListenerRegistered = false;

  public readonly config: BLEHandlerConfig;

  constructor(config: BLEHandlerConfig) {
    // 自动将短UUID转换为标准128位UUID
    const convertedConfig = convertConfigUUIDs(config);
    validateBLEHandlerConfig(convertedConfig);
    this.config = convertedConfig;
  }

  /**
   * 运行时更新配置
   * 接受部分配置项：serviceUId / writeCharacteristicId / notifyCharacteristicId
   * @throws {Error}
   */
  setBLEHandlerConfig(cfg: Partial<BLEHandlerConfig>): BLEHandlerConfig {
    if (!cfg || typeof cfg !== "object") {
      throw new Error("配置对象无效");
    }

    // 验证传入的字段类型
    const allowedKeys: Array<keyof BLEHandlerConfig> = [
      "serviceUId",
      "writeCharacteristicId",
      "notifyCharacteristicId",
      "readCharacteristicId",
      "notifyType",
    ];

    for (const key of Object.keys(cfg) as Array<string>) {
      if (!allowedKeys.includes(key as any)) {
        throw new Error(`未知的配置项: ${key}`);
      }
      const val = (cfg as any)[key];
      if (val != null && typeof val !== "string") {
        throw new Error(`配置项 ${key} 类型无效，应为字符串`);
      }
    }

    // 自动将短UUID转换为标准128位UUID
    const convertedCfg = convertConfigUUIDs(cfg);

    // 创建新配置对象进行验证
    const newConfig = { ...this.config, ...convertedCfg };
    validateBLEHandlerConfig(newConfig);

    // 验证通过后，更新配置
    if (convertedCfg.serviceUId) this.config.serviceUId = convertedCfg.serviceUId;
    if (convertedCfg.writeCharacteristicId)
      this.config.writeCharacteristicId = convertedCfg.writeCharacteristicId;
    if (convertedCfg.notifyCharacteristicId)
      this.config.notifyCharacteristicId = convertedCfg.notifyCharacteristicId;
    if (convertedCfg.readCharacteristicId)
      this.config.readCharacteristicId = convertedCfg.readCharacteristicId;
    if (convertedCfg.notifyType) this.config.notifyType = convertedCfg.notifyType;

    return this.config;
  }

  /**
   * 注册微信的全局特征值变化监听器（只注册一次）
   */
  ensureCharacteristicListenerRegistered(): void {
    if (this.isCharacteristicListenerRegistered) {
      return;
    }

    if (shouldSkipBLEApiCall("onBLECharacteristicValueChange")) {
      this.isCharacteristicListenerRegistered = true;
      return;
    }

    wx.onBLECharacteristicValueChange((res) => {
      // 将 ArrayBuffer 转换为 Uint8Array，方便处理二进制数据
      const buffer = new Uint8Array(res.value);

      const newRes = {
        deviceId: res.deviceId,
        serviceId: res.serviceId,
        characteristicId: res.characteristicId,
        value: Array.from(buffer), // 转换为普通数组以便打印
      };
      debugLog("onBLECharacteristicValueChange event received:", newRes);

      // 精确匹配：根据 deviceId 和 characteristicId 找到对应的请求
      if (this.pendingRequests.size > 0) {
        let matchedRequestId: string | null = null;

        // 遍历所有待处理的请求，找到第一个匹配的（ES5 兼容方式）
        this.pendingRequests.forEach((request, requestId) => {
          if (
            !matchedRequestId &&
            request.deviceId === res.deviceId &&
            request.characteristicId === res.characteristicId
          ) {
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
            debugLog("newRes", newRes);

            // 解析 Promise
            request.resolve(newRes);
            // 从队列中删除
            this.pendingRequests.delete(matchedRequestId);
            debugLog(`请求 ${matchedRequestId} 已匹配并完成`);
          }
        } else {
          debugLog(
            `未找到匹配的请求: deviceId=${res.deviceId}, characteristicId=${res.characteristicId}`,
          );
        }
      }

      // 执行所有已注册的回调函数
      this.characteristicValueChangeCallbacks.forEach((callback) => {
        try {
          callback(res);
        } catch (error) {
          debugError("特征值变化回调执行出错:", error);
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
    callback: (result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult) => void,
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
    callback: (result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult) => void,
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

  /**
   * 解绑特征值变化监听器（重置标志位，允许下次重新注册）
   * 仅在释放资源时调用
   */
  offCharacteristicListener(): void {
    this.characteristicValueChangeCallbacks.clear();
    this.pendingRequests.clear();
    this.isCharacteristicListenerRegistered = false;
  }

  // Removed deprecated delAllCharacteristicValueChangeCallback alias; use removeAllCharacteristicValueChangeListeners

  /**
   * 发送数据帧（使用 writeCharacteristic 类型）
   * @param options 写入选项，包含小程序原生字段以及额外的 hasResponse/timeoutMs
   * @param mode 单设备/多设备模式
   * @param connectedSingleDeviceId 单设备模式下的默认设备ID
   * @returns Promise with result
   * @throws {Error} 写入失败时抛出
   * @throws {Error} 超时时抛出
   * @throws {Error} 配置错误时抛出
   */
  async writeCharacteristicValue(
    options: writeCharacteristicOption,
    mode: "single" | "multiple",
    connectedSingleDeviceId?: string,
  ): Promise<any> {
    const {
      value: frame,
      deviceId: optDeviceId,
      serviceId: writeServiceId,
      characteristicId: writeCharId,
      writeType,
      responseConfig,
    } = options;

    // 从 responseConfig 中读取响应匹配相关配置
    const hasResponse = responseConfig?.hasResponse;
    const timeoutMs = responseConfig?.timeoutMs;
    const respCharacteristicId = responseConfig?.characteristicId;

    let targetDeviceId: string | undefined;

    if (mode === "single") {
      // 单设备模式下，优先使用传入的 deviceId，否则使用已连接的设备ID
      targetDeviceId = optDeviceId || connectedSingleDeviceId;
      if (!targetDeviceId) {
        throw new Error("单设备模式下未连接任何设备，也未提供设备ID");
      }
    } else {
      // 多设备模式下，必须提供 deviceId
      if (!optDeviceId) {
        throw new Error("多设备模式下必须提供设备ID");
      }
      targetDeviceId = optDeviceId;
    }

    // 写入操作使用的 serviceId/characteristicId（来自 WriteBLECharacteristicValueOption 顶层字段）
    const writeServiceIdFinal = writeServiceId || this.config.serviceUId || "";
    const writeCharIdFinal = writeCharId || this.config.writeCharacteristicId || "";

    // pendingRequests 响应匹配使用的 characteristicId（来自 responseConfig，默认使用 config 中配置的参数）
    const respCharIdFinal = respCharacteristicId || this.config.notifyCharacteristicId || "";

    if (shouldSkipBLEApiCall("writeBLECharacteristicValue")) {
      return { success: true };
    }

    if (hasResponse) {
      debugLog("hasResponse");

      // 生成一个唯一的请求ID
      const requestId = `req_${this.requestCounter++}`;

      return new Promise<any>((resolve, reject) => {
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
          reject(
            new Error(
              `写入响应超时 - 请求ID: ${requestId}, 设备: ${targetDeviceId}, 特征值: ${respCharIdFinal}`,
            ),
          );
        }, timeoutMs || 1000);

        // 将请求信息存入 Map（包含设备和特征值以便精确匹配）
        this.pendingRequests.set(requestId, {
          deviceId: targetDeviceId!,
          characteristicId: respCharIdFinal,
          resolve: (result) => {
            debugLog("newResResult", result);
            cleanup();
            resolve(result);
          },
          reject: (error) => {
            cleanup();
            reject(error);
          },
          timeoutId,
        });

        debugLog(
          `发送写入请求 - 请求ID: ${requestId}, 设备: ${targetDeviceId}, 服务: ${writeServiceIdFinal}, 特征值: ${writeCharIdFinal}`,
        );

        // 发起底层写入（异步，避免 async executor 反模式）
        void (async () => {
          try {
            const WriteBLECharacteristicValueOption =
              {} as WechatMiniprogram.WriteBLECharacteristicValueOption;
            WriteBLECharacteristicValueOption.deviceId = targetDeviceId;
            WriteBLECharacteristicValueOption.serviceId = writeServiceIdFinal;
            WriteBLECharacteristicValueOption.characteristicId = writeCharIdFinal;
            WriteBLECharacteristicValueOption.value = frame;
            if (writeType) {
              WriteBLECharacteristicValueOption.writeType = writeType;
            }

            await wx.writeBLECharacteristicValue(WriteBLECharacteristicValueOption);
            debugLog(`✔ 写入数据成功 - 请求ID: ${requestId}`);
            // 等待设备响应（通过特征值变化事件）
          } catch (error) {
            cleanup();
            reject(error);
          }
        })();
      });
    } else {
      const WriteBLECharacteristicValueOption =
        {} as WechatMiniprogram.WriteBLECharacteristicValueOption;
      WriteBLECharacteristicValueOption.deviceId = targetDeviceId;
      WriteBLECharacteristicValueOption.serviceId = writeServiceIdFinal;
      WriteBLECharacteristicValueOption.characteristicId = writeCharIdFinal;
      WriteBLECharacteristicValueOption.value = frame;
      if (writeType) {
        WriteBLECharacteristicValueOption.writeType = writeType;
      }

      await wx.writeBLECharacteristicValue(WriteBLECharacteristicValueOption);
      debugLog(`✔ 写入数据成功（无需响应）`);
      return { success: true };
    }
  }

  // Removed deprecated writeCharacteristic alias; use writeCharacteristicValue

  /**
   * 读取数据帧（使用 readCharacteristic 类型）
   * @param options 读取选项，包含小程序原生字段以及额外的 timeoutMs
   * @param mode 单设备/多设备模式
   * @param connectedSingleDeviceId 单设备模式下的默认设备ID
   * @returns Promise with result
   * @throws {Error} 读取失败时抛出
   * @throws {Error} 超时时抛出
   * @throws {Error} 配置错误时抛出
   */
  async readCharacteristicValue(
    options: readCharacteristicOption,
    mode: "single" | "multiple",
    connectedSingleDeviceId?: string,
  ): Promise<CharacteristicValueResult> {
    const { deviceId: optDeviceId, timeoutMs, serviceId, characteristicId } = options;

    let targetDeviceId: string | undefined;

    if (mode === "single") {
      // 单设备模式下，优先使用传入的 deviceId，否则使用已连接的设备ID
      targetDeviceId = optDeviceId || connectedSingleDeviceId;
      if (!targetDeviceId) {
        throw new Error("单设备模式下未连接任何设备，也未提供设备ID");
      }
    } else {
      // 多设备模式下，必须提供 deviceId
      if (!optDeviceId) {
        throw new Error("多设备模式下必须提供设备ID");
      }
      targetDeviceId = optDeviceId;
    }

    const serviceIdFinal = serviceId || this.config.serviceUId || "";
    const characteristicIdFinal = characteristicId || this.config.readCharacteristicId || "";

    if (shouldSkipBLEApiCall("readBLECharacteristicValue")) {
      return {
        deviceId: targetDeviceId,
        serviceId: serviceIdFinal,
        characteristicId: characteristicIdFinal,
        value: [0], // 返回一个默认的 ArrayBuffer（Uint8Array）表示空数据
      };
    }

    // 生成一个唯一的请求ID
    const requestId = `req_${this.requestCounter++}`;

    return new Promise<any>((resolve, reject) => {
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
        reject(
          new Error(
            `读取响应超时 - 请求ID: ${requestId}, 设备: ${targetDeviceId}, 特征值: ${characteristicIdFinal}`,
          ),
        );
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
        timeoutId,
      });

      // 发起底层读取（异步，避免 async executor 反模式）
      void (async () => {
        try {
          await wx.readBLECharacteristicValue({
            deviceId: targetDeviceId,
            serviceId: serviceIdFinal,
            characteristicId: characteristicIdFinal,
          });
          debugLog(`✔ 读取数据成功 - 请求ID: ${requestId}`);
          // 等待设备通过特征值变化事件返回数据
        } catch (error) {
          cleanup();
          reject(error);
        }
      })();
    });
  }

  // Removed deprecated readCharacteristic alias; use readCharacteristicValue
}
