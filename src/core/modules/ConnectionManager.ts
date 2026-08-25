/**
 * ConnectionManager - 连接管理模块
 * 负责设备连接、断开、重连、状态监听。
 */
import type { Device } from "../../types/ble";
import { shouldSkipBLEApiCall } from "../../utils/runtime";

export class ConnectionManager {
  private _connectedDevices: Device[] = []; // 已连接的设备列表（私有）
  private _historyConnectedDevices: Device[] = []; // 连接过的设备的历史列表（私有）

  private processingConnections: Set<string> = new Set(); // 正在处理的连接
  private readonly mode: "single" | "multiple";
  private readonly connectTimeout: number;
  private readonly reconnect: boolean;
  private readonly maxRetries: number;
  private readonly reconnectDelay: number;
  // 单设备模式：当前用户期望连接/保持的目标设备，用于抑制其他设备的自动重连
  private activeTargetDeviceId?: string;
  // 为每个设备维护一个“重连代次”标识，递增以取消既有重连循环
  private reconnectGenerations: Map<string, number> = new Map();
  // 连接状态监听：只注册一次平台监听器，多个用户回调存入 Set
  private connectionStateCallbacks: Set<
    (res: WechatMiniprogram.OnBLEConnectionStateChangeListenerResult) => void
  > = new Set();
  private isConnectionStateListenerRegistered = false;
  private _onReconnect?: (device: Device) => Promise<void>;
  constructor({
    mode = "single",
    connectTimeout = 5000,
    reconnect = false,
    maxRetries = 3,
    reconnectDelay = 500,
  }: {
    mode?: "single" | "multiple";
    connectTimeout?: number;
    reconnect?: boolean;
    maxRetries?: number;
    reconnectDelay?: number;
  }) {
    this.mode = mode;
    this.connectTimeout = connectTimeout;
    this.reconnect = reconnect;
    this.maxRetries = maxRetries;
    this.reconnectDelay = reconnectDelay;
  }

  /**
   * 获取已连接设备列表（深拷贝，防止外部修改）
   */
  get connectedDevices(): Device[] {
    return this._connectedDevices.map((d) => ({ ...d }));
  }

  /**
   * 获取历史连接设备列表（深拷贝，防止外部修改）
   */
  get historyConnectedDevices(): Device[] {
    return this._historyConnectedDevices.map((d) => ({ ...d }));
  }

  /**
   * 获取当前连接的设备（单设备模式，深拷贝）
   */
  get singleConnectedDevice(): Device | undefined {
    return this._connectedDevices[0] ? { ...this._connectedDevices[0] } : undefined;
  }

  /**
   * 获取设备当前的重连代次
   */
  private getReconnectGenerationForDevice(deviceId: string): number {
    return this.reconnectGenerations.get(deviceId) ?? 0;
  }

  /**
   * 使某设备的重连代次递增，从而让已在进行中的重连任务在下一次检查时自我终止
   */
  private cancelReconnectForDevice(deviceId: string): void {
    const cur = this.getReconnectGenerationForDevice(deviceId);
    this.reconnectGenerations.set(deviceId, cur + 1);
  }

  /**
   * 取消除特定设备外的所有重连任务（用于单设备模式在切换连接目标时）
   */
  private cancelReconnectsExcept(deviceIdToKeep?: string): void {
    // 取消所有在重连中的设备（通过提升 generation 来取消）
    const keys = Array.from(this.reconnectGenerations.keys());
    for (const id of keys) {
      if (!deviceIdToKeep || id !== deviceIdToKeep) {
        this.cancelReconnectForDevice(id);
      }
    }
  }

  /**
   * 连接指定的蓝牙设备
   * @param {Device | string} devOrDeviceId 要连接的蓝牙设备对象或设备ID字符串
   * @param {number} [connectTimeout] 连接超时时间
   * @param {Function} onServicesReady 获取服务和特征值的回调
   * @throws {Error} 连接失败
   */
  async connectDevice(
    devOrDeviceId: Device | string,
    connectTimeout: number = 5000,
    onServicesReady?: (deviceId: string) => Promise<void>,
  ): Promise<void> {
    // 如果传入的是字符串 deviceId，则创建一个新的 Device 对象
    let dev: Device;
    if (typeof devOrDeviceId === "string") {
      dev = {
        deviceId: devOrDeviceId,
        name: devOrDeviceId, // 使用 deviceId 作为默认名称
        RSSI: 0,
        advertisData: new ArrayBuffer(0),
        advertisServiceUUIDs: [],
        connectable: true,
        localName: devOrDeviceId,
        serviceData: {},
        isConnect: false,
        reconnect: this.reconnect, // 使用全局配置，不强制为 true
      };
    } else {
      dev = devOrDeviceId;
    }

    // 单设备模式：准备连接新的目标设备时，取消其他设备的重连任务，避免干扰
    if (this.mode === "single") {
      this.activeTargetDeviceId = dev.deviceId;
      this.cancelReconnectsExcept(dev.deviceId);
    }
    if (
      this.mode === "single" &&
      this.singleConnectedDevice?.deviceId != dev.deviceId &&
      this.singleConnectedDevice?.isConnect == true
    ) {
      // 如果是单设备模式，先断开当前连接的设备
      await this.disconnectDevice(this.singleConnectedDevice?.deviceId || "");
    }

    try {
      // 连接设备
      console.log(`准备连接设备...`);
      if (shouldSkipBLEApiCall("createBLEConnection")) {
        console.log(`当前为 devtools，模拟连接成功`);
      } else {
        await wx.createBLEConnection({
          deviceId: dev.deviceId,
          timeout: connectTimeout,
        });
      }
      console.log(`连接蓝牙设备成功！`);

      dev.isConnect = true; // 更新设备状态为已连接
      if (this.mode === "single") {
        // 如果是单设备模式，清空已连接设备列表
        this._connectedDevices = [];
        this._connectedDevices.push(dev);
        // 成功连接后，声明当前目标为该设备，同时取消其他设备未完成的重连任务
        this.activeTargetDeviceId = dev.deviceId;
        this.cancelReconnectsExcept(dev.deviceId);
      } else {
        const index = this._connectedDevices.findIndex((d) => d.deviceId === dev.deviceId);
        if (index === -1) {
          this._connectedDevices.push(dev);
        }
      }

      // 添加历史上已连接过的设备到列表
      const index = this._historyConnectedDevices.findIndex((d) => d.deviceId === dev.deviceId);
      if (index === -1) {
        this._historyConnectedDevices.push(dev);
      }

      // 调用回调来获取服务和特征值
      if (onServicesReady) {
        await onServicesReady(dev.deviceId);
      }
    } catch (err) {
      console.error(`连接蓝牙设备失败！`, err);
      throw err;
    }
  }

  /**
   * 处理设备重连
   * @param device 需要重连的设备
   * @param {Function} onReconnect 重连时的回调
   * @returns Promise<boolean> 重连是否成功
   */
  async attemptReconnect(
    device: Device,
    onReconnect: (device: Device) => Promise<void>,
  ): Promise<boolean> {
    const maxRetries = this.maxRetries;
    let retryCount = 0;
    // 捕获开始时的重连“代次”，若期间被取消则终止循环
    const localGeneration = this.getReconnectGenerationForDevice(device.deviceId);

    while (retryCount < maxRetries) {
      // 若在单设备模式下，且当前用户指定的目标设备并非该设备，则立即停止该设备的重连
      if (
        this.mode === "single" &&
        this.activeTargetDeviceId &&
        this.activeTargetDeviceId !== device.deviceId
      ) {
        console.log(
          `跳过设备 ${device.name}(${device.deviceId}) 的重连：当前目标为${this.activeTargetDeviceId}`,
        );
        return false;
      }

      // 若重连代次发生变化，说明被取消了
      if (localGeneration !== this.getReconnectGenerationForDevice(device.deviceId)) {
        console.log(`设备 ${device.name}(${device.deviceId}) 重连已被取消（generation 变化）`);
        return false;
      }
      try {
        console.log(`开始第 ${retryCount + 1} 次重连..`);

        // 等待重连延时(连接超时时间+重连延时)，以避免频繁重连导致的资源占用和冲突
        await new Promise((resolve) =>
          setTimeout(resolve, this.connectTimeout + this.reconnectDelay),
        );

        // 再次在延时后检查是否被取消或被切换目标
        if (
          this.mode === "single" &&
          this.activeTargetDeviceId &&
          this.activeTargetDeviceId !== device.deviceId
        ) {
          console.log(
            `在延时后停止设备 ${device.name}(${device.deviceId}) 的重连：当前目标为${this.activeTargetDeviceId}`,
          );
          return false;
        }
        if (localGeneration !== this.getReconnectGenerationForDevice(device.deviceId)) {
          console.log(
            `设备 ${device.name}(${device.deviceId}) 重连在延时后被取消（generation 变化）`,
          );
          return false;
        }

        // 尝试重新连接
        try {
          await onReconnect(device);
          console.log(`设备 ${device.name}(${device.deviceId}) 重连成功`);
          // 单设备模式，成功重连后更新目标并取消其他设备的重连任务
          if (this.mode === "single") {
            this.activeTargetDeviceId = device.deviceId;
            this.cancelReconnectsExcept(device.deviceId);
          }
          return true;
        } catch (err) {
          // 重连失败，继续重试
          retryCount++;
          console.log(`第 ${retryCount} 次重连失败`, err);
        }
      } catch (error) {
        retryCount++;
        console.error(`第 ${retryCount} 次重连发生错误`, error);
      }
    }

    console.error(`设备 ${device.name}(${device.deviceId}) 重连失败,已达到最大重试次数`);
    return false;
  }

  /**
   * 蓝牙适配器连接状态监听（全局只注册一次 wx 监听器）
   * @param onReconnect 连接异常断开时的重连回调
   */
  ensureConnectionStateListenerRegistered(onReconnect: (device: Device) => Promise<void>): void {
    this._onReconnect = onReconnect;

    if (this.isConnectionStateListenerRegistered) {
      return;
    }

    if (shouldSkipBLEApiCall("onBLEConnectionStateChange")) {
      this.isConnectionStateListenerRegistered = true;
      return;
    }

    wx.onBLEConnectionStateChange(async (res) => {
      console.log("onBLEConnectionStateChange", res);

      // 自动重连
      if (!res.connected) {
        const index = this._connectedDevices.findIndex((d) => d.deviceId === res.deviceId);

        if (index === -1) {
          console.warn(`Device ${res.deviceId} not found in connected list`);
          return;
        }

        this._connectedDevices[index].isConnect = false; // 更新设备状态为未连接
        const device = this._connectedDevices[index];
        // 如果是异常断开的设备，尝试重新连接
        if (device?.reconnect && this._onReconnect) {
          // 单设备模式下：若当前目标设备不是该设备，则不进行该设备的自动重连
          if (
            this.mode === "single" &&
            this.activeTargetDeviceId &&
            this.activeTargetDeviceId !== device.deviceId
          ) {
            console.log(
              `跳过设备 ${device.name}(${device.deviceId}) 的自动重连，当前目标为${this.activeTargetDeviceId}`,
            );
            // 明确取消该设备的任何在进行中的重连任务
            this.cancelReconnectForDevice(device.deviceId);
          } else {
            const success = await this.attemptReconnect(device, this._onReconnect);
            if (!success) {
              // 重连失败,从已连接列表中移除
              this._connectedDevices.splice(index, 1);
              console.log(`设备 ${device.name} 已从已连接列表中移除`);
            }
          }
        } else {
          // 不需要重连，直接移除
          this._connectedDevices.splice(index, 1);
          console.log(`设备 ${device.name} 断开连接`);
        }
      } else {
        // 如果该设备已在处理中，则忽略本次回调，防止重复执行
        if (this.processingConnections.has(res.deviceId)) {
          return;
        }

        // 添加标记，表示开始处理该设备的连接事件
        this.processingConnections.add(res.deviceId);

        // 设置一个 500 毫秒的延时，并只执行一次
        setTimeout(async () => {
          try {
            // 检查设备是否已在当前连接列表
            const isAlreadyConnected = this._connectedDevices.some(
              (d) => d.deviceId === res.deviceId,
            );

            // 如果设备不在当前连接列表，则从历史记录中恢复
            if (!isAlreadyConnected) {
              const deviceFromHistory = this._historyConnectedDevices.find(
                (d) => d.deviceId === res.deviceId,
              );

              if (deviceFromHistory) {
                // 从历史记录中找到，添加到当前连接列表
                console.log(`微信自动重连成功，恢复设备 ${res.deviceId}`);
                this._connectedDevices.push(deviceFromHistory);
              } else {
                // 这是一个未知的、不在历史记录中的设备，强制断开
                console.warn(`发现未知设备自动重连: ${res.deviceId}，将强制断开。`);
                await this.disconnectDevice(res.deviceId);
              }
            }
          } finally {
            // 无论成功与否，最终都释放标记
            this.processingConnections.delete(res.deviceId);
          }
        }, 500); // 延时 500 毫秒
      }

      // 通知所有已注册的用户回调
      this.connectionStateCallbacks.forEach((callback) => {
        callback(res);
      });
    });

    this.isConnectionStateListenerRegistered = true;
  }

  /**
   * 添加连接状态变化的用户回调，返回解绑函数
   * @param {function} callback 状态变化时的回调，接收原始 res 参数
   * @returns {function} 解绑函数
   */
  addConnectionStateChangeListener(
    callback: (res: WechatMiniprogram.OnBLEConnectionStateChangeListenerResult) => void,
  ): () => void {
    this.connectionStateCallbacks.add(callback);
    return () => {
      this.connectionStateCallbacks.delete(callback);
    };
  }

  /**
   * 解绑连接状态监听器（重置标志位，允许下次重新注册）
   * 仅在释放资源时调用
   */
  offConnectionStateListener(): void {
    this.connectionStateCallbacks.clear();
    this.isConnectionStateListenerRegistered = false;
  }

  /**
   * 断开蓝牙连接
   * @param {string} deviceId 设备ID
   * @throws {Error}
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    if (!deviceId) {
      throw new Error("必须提供设备ID");
    }

    const index = this._connectedDevices.findIndex((d) => d.deviceId === deviceId);

    if (index !== -1) {
      this._connectedDevices[index].reconnect = false; // 取消自动连接
    }

    // 断开前取消该设备的任何重连循环
    this.cancelReconnectForDevice(deviceId);

    console.log(`断开蓝牙连接...`);
    if (shouldSkipBLEApiCall("closeBLEConnection")) {
      console.log(`当前为 devtools，模拟断开成功`);
    } else {
      await wx.closeBLEConnection({ deviceId });
    }
    console.log(`断开蓝牙成功！`);

    if (this.mode === "single") {
      this._connectedDevices = []; // 清空已连接设备列表
      if (this.activeTargetDeviceId === deviceId) {
        this.activeTargetDeviceId = undefined;
      }
    } else {
      // 多设备模式：从已连接列表中移除该设备
      this._connectedDevices = this._connectedDevices.filter((d) => d.deviceId !== deviceId);
    }
  }
}
