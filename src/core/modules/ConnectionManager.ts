/**
 * ConnectionManager - 连接管理模块
 * 负责设备连接、断开、重连、状态监听
 */
import BluetoothManager from "../BluetoothManager";
import type { Device, ConnectionStateCallbacks } from "../../types/ble";

export class ConnectionManager {
  public connectedDevices: Device[] = []; // 已连接的设备列表
  public historyConnectedDevices: Device[] = []; // 连接过的设备的历史列表
  public reconnectingDevices: Device[] = []; // 正在重连的设备列表

  private processingConnections: Set<string> = new Set(); // 正在处理的连接
  private readonly mode: "single" | "multiple";
  private readonly maxRetries: number;
  private readonly reconnectDelay: number;
  // 单设备模式：当前用户期望连接/保持的目标设备，用于抑制其他设备的自动重连
  private activeTargetDeviceId?: string;
  // 为每个设备维护一个“重连代次”标识，递增以取消既有重连循环
  private reconnectGenerations: Map<string, number> = new Map();

  constructor(
    mode: "single" | "multiple" = "single",
    maxRetries: number = 3,
    reconnectDelay: number = 3000
  ) {
    this.mode = mode;
    this.maxRetries = maxRetries;
    this.reconnectDelay = reconnectDelay;
  }

  /**
   * 获取当前连接的设备（单设备模式）
   */
  get singleConnectedDevice(): Device | undefined {
    return this.connectedDevices[0];
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
    // 取消所有在重连中的设备（通过提升 generation）
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
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async connectDevice(
    devOrDeviceId: Device | string,
    connectTimeout: number = 6000,
    onServicesReady?: (deviceId: string) => Promise<void>
  ): Promise<[Error | null, any]> {
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
        reconnect: true, // 默认启用自动重连
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
      let [disErr, disRes] = await this.disconnectDevice(
        this.singleConnectedDevice?.deviceId || ""
      );
      // 如果断开连接失败，返回错误
      if (disErr || !disRes) {
        return [disErr, null];
      }
    }

  try {
      // 连接设备
      const connResult = (await this.withTimeout(
        BluetoothManager.createBLEConnection(dev.deviceId, connectTimeout),
        connectTimeout
      )) as [any, any];
      let [err, res] = connResult;

      if (res || err.errCode == -1) {
        dev.isConnect = true; // 更新设备状态为已连接
        if (this.mode === "single") {
          // 如果是单设备模式，清空已连接设备列表
          this.connectedDevices = [];
          this.connectedDevices.push(dev);
          // 成功连接后，声明当前目标为该设备，同时取消其他设备未完成的重连
          this.activeTargetDeviceId = dev.deviceId;
          this.cancelReconnectsExcept(dev.deviceId);
        } else {
          let index = this.connectedDevices.findIndex(
            (d) => d.deviceId === dev.deviceId
          );
          if (index === -1) {
            this.connectedDevices.push(dev);
          }
        }

        // 添加历史上已连接过的设备到列表
        let index = this.historyConnectedDevices.findIndex(
          (d) => d.deviceId === dev.deviceId
        );
        if (index === -1) {
          this.historyConnectedDevices.push(dev);
        }

        // 调用回调来获取服务和特征值
        if (onServicesReady) {
          await onServicesReady(dev.deviceId);
        }
      }
      return [err, res];
    } catch (error) {
      console.error(`连接设备 ${dev.name}(${dev.deviceId}) 超时失败:`, error);
      return [error as Error, null];
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
    onReconnect: (device: Device) => Promise<[Error | null, any]>
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
          `跳过设备 ${device.name}(${device.deviceId}) 的重连：当前目标为 ${this.activeTargetDeviceId}`
        );
        return false;
      }

      // 若重连代次发生变化，说明被取消了
      if (localGeneration !== this.getReconnectGenerationForDevice(device.deviceId)) {
        console.log(
          `设备 ${device.name}(${device.deviceId}) 重连已被取消（generation 变化）`
        );
        return false;
      }
      try {
  console.log(`开始第 ${retryCount + 1} 次重连...`);

        // 等待重连延时
        await new Promise((resolve) =>
          setTimeout(resolve, this.reconnectDelay)
        );

        // 再次在延时后检查是否被取消或被切换目标
        if (
          this.mode === "single" &&
          this.activeTargetDeviceId &&
          this.activeTargetDeviceId !== device.deviceId
        ) {
          console.log(
            `在延时后停止设备 ${device.name}(${device.deviceId}) 的重连：当前目标为 ${this.activeTargetDeviceId}`
          );
          return false;
        }
        if (localGeneration !== this.getReconnectGenerationForDevice(device.deviceId)) {
          console.log(
            `设备 ${device.name}(${device.deviceId}) 重连在延时后被取消（generation 变化）`
          );
          return false;
        }

        // 尝试重新连接
  const [err, res] = await onReconnect(device);

        if (res || (err as any)?.errCode == -1) {
          console.log(`设备 ${device.name}(${device.deviceId}) 重连成功`);
          // 单设备模式，成功重连后更新目标并取消其他设备的重连
          if (this.mode === "single") {
            this.activeTargetDeviceId = device.deviceId;
            this.cancelReconnectsExcept(device.deviceId);
          }
          return true;
        }

        retryCount++;
        console.log(`第 ${retryCount} 次重连失败`);
      } catch (error) {
        retryCount++;
        console.error(`第 ${retryCount} 次重连发生错误:`, error);
      }
    }

    console.error(
      `设备 ${device.name}(${device.deviceId}) 重连失败,已达到最大重试次数`
    );
    return false;
  }

  /**
   * 蓝牙适配器连接状态监听
   * @param {ConnectionStateCallbacks} [callbacks] 设备状态变化时的回调函数
   * @param {Function} onReconnect 重连时的回调
   */
  onConnectionStateChange(
    callbacks?: ConnectionStateCallbacks,
    onReconnect?: (device: Device) => Promise<[Error | null, any]>
  ): void {
    wx.onBLEConnectionStateChange(async (res) => {
      console.log("onBLEConnectionStateChange", res);

      // 自动重连
      if (!res.connected) {
        let index = this.connectedDevices.findIndex(
          (d) => d.deviceId === res.deviceId
        );

        if (index === -1) {
          console.warn(`Device ${res.deviceId} not found in connected list`);
          return;
        }

  this.connectedDevices[index].isConnect = false; // 更新设备状态为未连接
  const device = this.connectedDevices[index];
        // 如果是异常断开的设备，尝试重新连接
        if (device?.reconnect && onReconnect) {
          // 单设备模式下：若当前目标设备不是该设备，则不进行该设备的自动重连
          if (
            this.mode === "single" &&
            this.activeTargetDeviceId &&
            this.activeTargetDeviceId !== device.deviceId
          ) {
            console.log(
              `跳过设备 ${device.name}(${device.deviceId}) 的自动重连，当前目标为 ${this.activeTargetDeviceId}`
            );
            // 明确取消该设备的任何在进行中的重连
            this.cancelReconnectForDevice(device.deviceId);
          } else {
            const success = await this.attemptReconnect(device, onReconnect);
            if (!success) {
              // 重连失败,从已连接列表中移除
              this.connectedDevices.splice(index, 1);
              console.log(`设备 ${device.name} 已从已连接列表中移除`);
            }
          }
        } else {
          // 不需要重连,直接移除
          this.connectedDevices.splice(index, 1);
          console.log(`设备 ${device.name} 断开连接`);
        }
      } else {
        // 如果该设备已在处理中，则忽略本次回调，防止重复执行
        if (this.processingConnections.has(res.deviceId)) {
          return;
        }

        // 添加"锁"，表示开始处理该设备的连接事件
        this.processingConnections.add(res.deviceId);

        // 设置一个 500 毫秒的延时，并只执行一次
        setTimeout(async () => {
          try {
            // 检查设备是否已在当前连接列表
            const isAlreadyConnected = this.connectedDevices.some(
              (d) => d.deviceId === res.deviceId
            );

            // 如果设备不在当前连接列表，则从历史记录中恢复
            if (!isAlreadyConnected) {
              const deviceFromHistory = this.historyConnectedDevices.find(
                (d) => d.deviceId === res.deviceId
              );

              if (deviceFromHistory) {
                // 从历史记录中找到，添加到当前连接列表
                console.log(`微信自动重连成功，恢复设备: ${res.deviceId}`);
                this.connectedDevices.push(deviceFromHistory);
              } else {
                // 这是一个未知的、不在历史记录中的设备，强制断开
                console.warn(
                  `发现未知设备自动重连: ${res.deviceId}，将强制断开。`
                );
                await this.disconnectDevice(res.deviceId);
              }
            }
          } finally {
            // 无论成功与否，最终都释放"锁"
            this.processingConnections.delete(res.deviceId);
          }
        }, 500); // 延时 500 毫秒
      }

      if (callbacks) {
        // 使用可选链操作符进行安全调用
        if (res.connected) {
          callbacks?.connected?.(res.deviceId);
        } else {
          callbacks?.disconnected?.(res.deviceId);
        }

        callbacks?.callback?.(res);
      }
    });
  }

  /**
   * 断开蓝牙连接
   * @param {string} deviceId 设备ID
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async disconnectDevice(deviceId: string): Promise<[Error | null, any]> {
    if (!deviceId) {
      return [new Error("必须提供设备ID"), null];
    }

    let index = this.connectedDevices.findIndex((d) => d.deviceId === deviceId);

    if (index !== -1) {
      this.connectedDevices[index].reconnect = false; // 取消自动连接
    }

    // 断开前取消该设备的任何重连循环
    this.cancelReconnectForDevice(deviceId);

    let [err, res] = await BluetoothManager.closeBLEConnection(deviceId);

    if (!err && this.mode === "single") {
      this.connectedDevices = []; // 清空已连接设备列表
      // 若断开的正是当前目标设备，则清空目标
      if (this.activeTargetDeviceId === deviceId) {
        this.activeTargetDeviceId = undefined;
      }
    }

    return [err, res];
  }

  /**
   * 超时控制 Promise
   */
  private withTimeout<T>(promise: Promise<T>, timeout = 6000): Promise<T> {
    let timeoutId: number;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timeout")), timeout);
    });

    return Promise.race([
      Promise.resolve(promise).finally(() => clearTimeout(timeoutId)),
      timeoutPromise,
    ]);
  }
  // New public aliases (single canonical names kept above).
  // Note: old names removed; use the methods and properties defined in this class.
}
