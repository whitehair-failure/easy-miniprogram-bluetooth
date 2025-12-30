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
 * 蓝牙工具类基类（抽象）
 * 提供公共的蓝牙功能，单/多设备模式通过子类实现
 */
export abstract class BLEHandlerBase {
  // 各个管理器实例
  protected adapterManager: AdapterManager;
  protected discoveryManager: DiscoveryManager;
  protected connectionManager: ConnectionManager;
  protected serviceManager: ServiceManager;
  protected ioManager: IOManager;

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
    this.connectionManager = this.createConnectionManager();
    this.serviceManager = new ServiceManager(options.config);
    this.ioManager = new IOManager(options.config);
  }

  /**
   * 子类实现：创建对应的 ConnectionManager
   */
  protected abstract createConnectionManager(): ConnectionManager;

  /**
   * 运行时更新 BLEHandler 的配置
   * @throws {BLEConfigError}
   */
  updateBLEHandlerConfig(cfg: Partial<BLEHandlerConfig>): BLEHandlerConfig {
    return this.serviceManager.setBLEHandlerConfig(cfg, async () => {
      // 配置更新后重新订阅通知
      await this.enableCharacteristicNotification(
        this.singleConnectedDevice?.deviceId || ""
      );
    });
  }

  /**
   * 检查蓝牙开启状态和权限授予状态
   * @throws {BLEAdapterError | BLEPermissionError}
   */
  async getAdapterStatus(): Promise<void> {
    await this.adapterManager.getAdapterStatus();
  }

  /**
   * 初始化并打开蓝牙适配器
   * @throws {BLEAdapterError}
   */
  async openAdapter(): Promise<void> {
    await this.adapterManager.openAdapter();
  }

  /**
   * 开始搜索蓝牙设备
   * @throws {BLEAdapterError}
   */
  async startDeviceDiscovery(
    searchOption: WechatMiniprogram.StartBluetoothDevicesDiscoveryOption = this.searchOption
  ): Promise<void> {
    await this.discoveryManager.startDeviceDiscovery(searchOption);
  }

  /**
   * 监听发现新蓝牙设备事件
   */
  onDeviceFound(callback?: (devices: Device[]) => void): void {
    this.discoveryManager.onDeviceFound(callback);
  }

  /**
   * 停止搜索蓝牙设备
   * @throws {BLEAdapterError}
   */
  async stopDeviceDiscovery(): Promise<void> {
    await this.discoveryManager.stopDeviceDiscovery();
  }

  /**
   * 连接指定的蓝牙设备（由子类实现）
   * @throws {BLEConnectionError | BLETimeoutError}
   */
  abstract connectDevice(devOrDeviceId: Device | string): Promise<void>;

  /**
   * 蓝牙适配器连接状态监听
   */
  onConnectionStateChange(callbacks?: ConnectionStateCallbacks): void {
    this.connectionManager.onConnectionStateChange(
      callbacks,
      // 重连回调
      async (device: Device) => {
        await this.connectDevice(device);
      }
    );
  }

  /**
   * 断开蓝牙连接（由子类实现）
   * @throws {BLEConnectionError}
   */
  abstract disconnectDevice(deviceId?: string): Promise<void>;

  /**
   * 获取蓝牙设备信号强度（由子类实现）
   * @throws {BLEAdapterError}
   */
  abstract getDeviceRSSI(deviceId?: string): Promise<number>;

  /**
   * 获取蓝牙设备的所有服务（由子类实现）
   * @throws {BLEServiceError}
   */
  abstract getDeviceServices(deviceId?: string): Promise<WechatMiniprogram.BLEService[]>;

  /**
   * 检查蓝牙设备的服务是否拥有已设置的特征值
   * @throws {BLEServiceError | BLEConfigError}
   */
  async validateCharacteristics(
    deviceId: string,
    serviceId?: string
  ): Promise<CharacteristicCheckResult> {
    return await this.serviceManager.validateCharacteristics(deviceId, serviceId);
  }

  /**
   * 启用蓝牙设备特征值变化的通知功能（由子类实现）
   * @throws {BLEServiceError | BLEConfigError}
   */
  abstract enableCharacteristicNotification(
    deviceId: string,
    serviceId?: string,
    characteristicId?: string
  ): Promise<void>;

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
   * 发送数据帧（由子类实现）
   * @throws {BLEIOError | BLETimeoutError | BLEConfigError}
   */
  abstract writeCharacteristicValue(options: writeCharacteristicOption): Promise<void>;

  /**
   * 读取数据帧（由子类实现）
   * @throws {BLEIOError | BLETimeoutError | BLEConfigError}
   */
  abstract readCharacteristicValue(options: readCharacteristicOption): Promise<ArrayBuffer>;

  /**
   * 关闭蓝牙适配器
   * @throws {BLEAdapterError}
   */
  async closeAdapter(): Promise<void> {
    await this.adapterManager.closeAdapter();
  }

  /**
   * 释放所有资源
   */
  async release(callback?: () => void): Promise<void> {
    if (this.connectedDevices.length !== 0) {
      // 断开所有连接的设备
      for (let dev of this.connectedDevices) {
        if (dev?.deviceId) {
          try {
            await this.disconnectDevice(dev.deviceId);
          } catch (disErr) {
            console.error(`Failed to disconnect device ${dev.deviceId}:`, disErr);
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
   * @throws {BLEAdapterError | BLEConnectionError}
   */
  async init(bleFoundCallback?: (devices: Device[]) => void): Promise<void> {
    // 蓝牙适配器初始化
    await this.openAdapter();
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
