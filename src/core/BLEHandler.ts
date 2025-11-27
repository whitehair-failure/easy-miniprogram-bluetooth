import type {
  Device,
  BLEHandlerConfig,
  BLEHandlerConstructor,
  ConnectionStateCallbacks,
  CharacteristicCheckResult,
  writeCharacteristicOption,
  readCharacteristicOption,
} from "../types/ble";

// 导入各个管理模块
import { AdapterManager } from "./modules/AdapterManager";
import { DiscoveryManager } from "./modules/DiscoveryManager";
import { ConnectionManager } from "./modules/ConnectionManager";
import { ServiceManager } from "./modules/ServiceManager";
import { IOManager } from "./modules/IOManager";

/**
 * 蓝牙工具类（重构版）
 * 封装小程序蓝牙流程方法，委托给各个专门的管理器模块
 * 处理事件通信
 */
export class BLEHandler {
  private readonly mode: "single" | "multiple";

  // 各个管理器实例
  private adapterManager: AdapterManager;
  private discoveryManager: DiscoveryManager;
  private connectionManager: ConnectionManager;
  private serviceManager: ServiceManager;
  private ioManager: IOManager;

  // 配置项（对外只读）
  public readonly filterKey?: string[];
  public readonly reconnect: boolean;
  public readonly connectTimeout?: number;
  public readonly maxRetries: number;
  public readonly reconnectDelay: number;
  public readonly searchOption: WechatMiniprogram.StartBluetoothDevicesDiscoveryOption;

  // 委托属性（从各个管理器中暴露）
  get foundDevList(): Device[] {
    return this.discoveryManager.foundDevList;
  }
  get historyDevList(): Device[] {
    return this.discoveryManager.historyDevList;
  }
  get historyConnectedDevices(): Device[] {
    return this.connectionManager.historyConnectedDevices;
  }
  get connectedDevices(): Device[] {
    return this.connectionManager.connectedDevices;
  }
  get reconnectingDevices(): Device[] {
    return this.connectionManager.reconnectingDevices;
  }
  get config(): BLEHandlerConfig {
    return this.serviceManager.config;
  }
  get singleConnectedDevice(): Device | undefined {
    return this.connectionManager.singleConnectedDevice;
  }

  /**
   * 初始化蓝牙工具类实例
   * @param {BLEHandlerConstructor} options 配置选项
   */
  constructor(options: BLEHandlerConstructor) {
    this.mode = options.mode || "single";
    this.filterKey = options.filterKey;
    this.reconnect = options.reconnect || false;
    this.connectTimeout = options.connectTimeout;
    this.maxRetries = options.maxRetries || 3;
    this.reconnectDelay = options.reconnectDelay || 3000;
    this.searchOption = options.searchOption || {};

    // 初始化各个管理器
    this.adapterManager = new AdapterManager();
    this.discoveryManager = new DiscoveryManager(
      this.filterKey,
      this.reconnect,
      this.searchOption
    );
    this.connectionManager = new ConnectionManager(
      this.mode,
      this.maxRetries,
      this.reconnectDelay
    );
    this.serviceManager = new ServiceManager(options.config);
    this.ioManager = new IOManager(options.config);
  }

  /**
   * 运行时更新 BLEHandler 的配置
   */
  updateBLEHandlerConfig(
    cfg: Partial<BLEHandlerConfig>
  ): [Error | null, BLEHandlerConfig] {
    return this.serviceManager.setBLEHandlerConfig(cfg, async () => {
      // 配置更新后重新订阅通知
      await this.enableCharacteristicNotification(
        this.singleConnectedDevice?.deviceId || ""
      );
    });
  }

  /**
   * 检查蓝牙开启状态和权限授予状态
   */
  async getAdapterStatus() {
    return await this.adapterManager.getAdapterStatus();
  }

  /**
   * 初始化并打开蓝牙适配器
   */
  async openAdapter() {
    return await this.adapterManager.openAdapter();
  }

  /**
   * 开始搜索蓝牙设备
   */
  async startDeviceDiscovery(
    searchOption: WechatMiniprogram.StartBluetoothDevicesDiscoveryOption = this
      .searchOption
  ) {
    return await this.discoveryManager.startDeviceDiscovery(searchOption);
  }

  /**
   * 监听发现新蓝牙设备事件
   */
  onDeviceFound(callback?: (devices: Device[]) => void) {
    this.discoveryManager.onDeviceFound(callback);
  }

  /**
   * 停止搜索蓝牙设备
   */
  async stopDeviceDiscovery() {
    return await this.discoveryManager.stopDeviceDiscovery();
  }

  /**
   * 连接指定的蓝牙设备
   * @param {Device | string} devOrDeviceId 蓝牙设备对象或设备ID字符串
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async connectDevice(devOrDeviceId: Device | string) {
    return await this.connectionManager.connectDevice(
      devOrDeviceId,
      this.connectTimeout,
      async (deviceId: string) => {
        // 连接成功后的回调：获取服务和特征值
        await this.getDeviceServices(deviceId);
        await this.validateCharacteristics(deviceId);
        await this.enableCharacteristicNotification(deviceId);
      }
    );
  }

  /**
   * 蓝牙适配器连接状态监听
   */
  onConnectionStateChange(callbacks?: ConnectionStateCallbacks): void {
    this.connectionManager.onConnectionStateChange(
      callbacks,
      // 重连回调
      async (device: Device) => {
        return await this.connectDevice(device);
      }
    );
  }

  /**
   * 断开蓝牙连接（支持单设备和多设备模式）
   */
  async disconnectDevice(): Promise<[Error | null, any]>;
  async disconnectDevice(deviceId: string): Promise<[Error | null, any]>;
  async disconnectDevice(deviceId?: string) {
    if (this.mode === "single") {
      let singleDeviceId = deviceId || this.singleConnectedDevice?.deviceId;
      if (!singleDeviceId) {
        return [new Error("单设备模式下未连接任何设备"), null];
      }
      return await this.connectionManager.disconnectDevice(singleDeviceId);
    } else {
      if (!deviceId) {
        return [new Error("多设备模式下必须提供设备ID"), null];
      }
      return await this.connectionManager.disconnectDevice(deviceId);
    }
  }

  /**
   * 获取蓝牙设备信号强度
   */
  async getDeviceRSSI(): Promise<[Error | null, any]>;
  async getDeviceRSSI(deviceId: string): Promise<[Error | null, any]>;
  async getDeviceRSSI(deviceId?: string) {
    if (this.mode === "single") {
      let singleDeviceId = this.singleConnectedDevice?.deviceId;
      if (deviceId) singleDeviceId = deviceId;
      if (!singleDeviceId) {
        return [new Error("单设备模式下未连接任何设备"), null];
      }
      return await this.adapterManager.getDeviceRSSI(singleDeviceId);
    } else {
      if (!deviceId) {
        return [new Error("多设备模式下必须提供设备ID"), null];
      }
      return await this.adapterManager.getDeviceRSSI(deviceId);
    }
  }

  /**
   * 获取蓝牙设备的所有服务
   */
  async getDeviceServices(deviceId?: string) {
    if (this.mode === "single") {
      let singleDeviceId = this.singleConnectedDevice?.deviceId;
      if (deviceId) singleDeviceId = deviceId;
      if (!singleDeviceId) {
        return [new Error("单设备模式下未连接任何设备"), null];
      }
      return await this.serviceManager.getDeviceServices(singleDeviceId);
    } else {
      if (!deviceId) {
        return [new Error("多设备模式下必须提供设备ID"), null];
      }
      return await this.serviceManager.getDeviceServices(deviceId);
    }
  }

  /**
   * 检查蓝牙设备的服务是否拥有已设置的特征值
   */
  async validateCharacteristics(
    deviceId: string,
    serviceId?: string
  ): Promise<[Error | null, CharacteristicCheckResult]> {
    return await this.serviceManager.validateCharacteristics(deviceId, serviceId);
  }

  /**
   * 启用蓝牙设备特征值变化的通知功能
   */
  async enableCharacteristicNotification(
    deviceId: string,
    serviceId?: string,
    characteristicId?: string
  ) {
    if (this.mode === "single") {
      let singleDeviceId = this.singleConnectedDevice?.deviceId;
      if (deviceId) singleDeviceId = deviceId;
      if (!singleDeviceId) {
        return [new Error("单设备模式下未连接任何设备"), null];
      }
      return await this.serviceManager.enableCharacteristicNotification(
        singleDeviceId,
        serviceId,
        characteristicId
      );
    } else {
      if (!deviceId) {
        return [new Error("多设备模式下必须提供设备ID"), null];
      }
      return await this.serviceManager.enableCharacteristicNotification(
        deviceId,
        serviceId,
        characteristicId
      );
    }
  }

  /**
   * 注册特征值变化回调，返回解绑函数
   */
  addCharacteristicValueChangeListener(
    callback: (
      result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult
    ) => void
  ): () => void {
    return this.ioManager.addCharacteristicValueChangeListener(callback);
  }

  /**
   * 删除特定的特征值变化回调
   */
  removeCharacteristicValueChangeListener(
    callback: (
      result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult
    ) => void
  ): boolean {
    return this.ioManager.removeCharacteristicValueChangeListener(callback);
  }

  /**
   * 删除所有特征值变化回调
   */
  removeAllCharacteristicValueChangeListeners(): void {
    this.ioManager.removeAllCharacteristicValueChangeListeners();
  }

  /**
   * 发送数据帧（使用 writeCharacteristic 类型）
   */
  async writeCharacteristicValue(
    options: writeCharacteristicOption
  ): Promise<[Error | null, any]> {
    return await this.ioManager.writeCharacteristicValue(
      options,
      this.mode,
      this.singleConnectedDevice?.deviceId
    );
  }

  /**
   * 读取数据帧（使用 readCharacteristic 类型）
   */
  async readCharacteristicValue(
    options: readCharacteristicOption
  ): Promise<[Error | null, any]> {
    return await this.ioManager.readCharacteristicValue(
      options,
      this.mode,
      this.singleConnectedDevice?.deviceId
    );
  }

  /**
   * 关闭蓝牙适配器
   */
  async closeAdapter() {
    return await this.adapterManager.closeAdapter();
  }

  /**
   * 释放所有资源
   */
  async release(callback?: () => void) {
    if (this.connectedDevices.length !== 0) {
      // 断开所有连接的设备
      for (let dev of this.connectedDevices) {
        if (dev?.deviceId) {
          let [disErr, disRes] = await this.disconnectDevice(dev.deviceId);
          // 如果断开连接失败，返回错误
          if (disErr || !disRes) {
            console.error(
              `Failed to disconnect device ${dev.deviceId}:`,
              disErr
            );
          }
        }
      }
    }
    await wx.offBLECharacteristicValueChange();
    await wx.offBLEConnectionStateChange();
    await this.closeAdapter();
    if (callback) callback();
  }

  /**
   * 初始化蓝牙功能
   */
  async init(bleFoundCallback?: (devices: Device[]) => void) {
    // 蓝牙适配器初始化
    let [err, res] = await this.openAdapter();
    if (err && !res) return err;
    this.onConnectionStateChange();
  // 注意：不再在 init 中自动注册特征值监听，用户需要手动调用 addCharacteristicValueChangeListener
    this.addCharacteristicValueChangeListener(() => {});

    if (bleFoundCallback) {
      // 搜索蓝牙设备
      await this.startDeviceDiscovery();
      // 获取设备ID
      await this.onDeviceFound(bleFoundCallback);
    }
  }
}
