import type {
  Device,
  SearchOption,
  BLEHandlerConfig,
  BLEHandlerConstructor,
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
import { shouldSkipBLEApiCall } from "../utils/runtime";
import { debugError, setDebugEnabled } from "../utils/logger";

/**
 * 蓝牙工具类基类（抽象）
 * 提供公共的蓝牙功能，单/多设备模式通过子类实现
 */
/**
 * BLEHandlerBase 是一个抽象基类，提供了蓝牙设备管理的核心功能。
 * 它定义了蓝牙适配器、设备发现、连接管理、服务管理和数据传输的基本操作。
 * 子类需要实现特定的蓝牙连接管理器和设备操作方法。
 *
 * @abstract
 * @class BLEHandlerBase
 *
 * @template BLEHandlerBase
 * @property {AdapterManager} adapterManager - 蓝牙适配器管理器实例。
 * @property {DiscoveryManager} discoveryManager - 蓝牙设备发现管理器实例。
 * @property {ConnectionManager} connectionManager - 蓝牙连接管理器实例。
 * @property {ServiceManager} serviceManager - 蓝牙服务管理器实例。
 * @property {IOManager} ioManager - 蓝牙数据传输管理器实例。
 * @property {boolean} reconnect - 是否启用自动重连。
 * @property {number} [connectTimeout] - 蓝牙连接超时时间。
 * @property {number} maxRetries - 最大重试次数。
 * @property {number} reconnectDelay - 自动重连延迟时间。
 * @property {SearchOption} searchOption - 蓝牙设备搜索选项（包含过滤选项）。
 *
 * @method updateDeviceFilterOptions - 运行时更新设备过滤选项（includeKeys 和 excludeKeys）。
 * @method getDeviceFilterOptions - 获取当前设备过滤选项。
 * @method updateBLEHandlerConfig - 更新 BLEHandler 的配置。
 * @method getAdapterStatus - 检查蓝牙适配器状态。
 * @method openAdapter - 初始化并打开蓝牙适配器。
 * @method startDeviceDiscovery - 开始搜索蓝牙设备。
 * @method addDeviceFoundListener - 添加设备发现监听回调。
 * @method stopDeviceDiscovery - 停止搜索蓝牙设备。
 * @method connectDevice - 连接指定蓝牙设备（由子类实现）。
 * @method addConnectionStateChangeListener - 添加连接状态变化的用户回调，返回解绑函数。
 * @method disconnectDevice - 断开蓝牙连接（由子类实现）。
 * @method getDeviceRSSI - 获取蓝牙设备信号强度（由子类实现）。
 * @method getDeviceServices - 获取蓝牙设备的所有服务（由子类实现）。
 * @method validateCharacteristics - 检查蓝牙设备的服务是否拥有已设置的特征值。
 * @method enableCharacteristicNotification - 启用蓝牙设备特征值变化的通知功能（由子类实现）。
 * @method addCharacteristicValueChangeListener - 注册特征值变化回调。
 * @method removeCharacteristicValueChangeListener - 删除特定的特征值变化回调。
 * @method removeAllCharacteristicValueChangeListeners - 删除所有特征值变化回调。
 * @method writeCharacteristicValue - 发送数据帧（由子类实现）。
 * @method readCharacteristicValue - 读取数据帧（由子类实现）。
 * @method closeAdapter - 关闭蓝牙适配器。
 * @method release - 释放所有资源。
 * @method init - 初始化蓝牙功能。
 */
export abstract class BLEHandlerBase {
  // 各个管理器实例
  protected adapterManager: AdapterManager;
  protected discoveryManager: DiscoveryManager;
  protected connectionManager: ConnectionManager;
  protected serviceManager: ServiceManager;
  protected ioManager: IOManager;

  // 配置项（对外只读）
  public readonly reconnect: boolean;
  public readonly connectTimeout?: number;
  public readonly maxRetries: number;
  public readonly reconnectDelay: number;
  public readonly searchOption: SearchOption;

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
  get config(): BLEHandlerConfig {
    return { ...this.serviceManager.config };
  }
  get singleConnectedDevice(): Device | undefined {
    return this.connectionManager.singleConnectedDevice;
  }

  /**
   * 初始化蓝牙工具类实例
   * @param {BLEHandlerConstructor} options 配置选项
   */
  constructor(options: BLEHandlerConstructor) {
    // 根据配置开启/关闭调试日志（仅显式传入 debug 时生效，默认静默）
    if (options.debug !== undefined) {
      setDebugEnabled(options.debug);
    }

    this.connectTimeout = options.connectTimeout;
    this.reconnect = options.reconnect || false;
    this.maxRetries = options.maxRetries || 3;
    this.reconnectDelay = options.reconnectDelay || 3000;
    this.searchOption = options.searchOption || {};

    // 初始化各个管理器
    // 注意：ServiceManager 与 IOManager 各自持有经 UUID 转换后的 config 副本；
    // updateBLEHandlerConfig 会同步更新两者，保持一致性
    const config = options.config ?? {};
    this.adapterManager = new AdapterManager();
    this.discoveryManager = new DiscoveryManager(this.searchOption, this.reconnect);
    this.connectionManager = this.createConnectionManager();
    this.serviceManager = new ServiceManager(config);
    this.ioManager = new IOManager(config);
  }

  /**
   * 子类实现：创建对应的 ConnectionManager
   */
  protected abstract createConnectionManager(): ConnectionManager;

  /**
   * 运行时更新设备过滤选项
   * 支持包含关键字（白名单）和排除关键字（黑名单）的灵活过滤
   */
  updateDeviceFilterOptions(filterOptions: {
    includeKeys?: string[];
    excludeKeys?: string[];
  }): void {
    this.discoveryManager.updateSearchOption(filterOptions);
  }

  /**
   * 获取当前设备过滤选项
   */
  getDeviceFilterOptions(): { includeKeys?: string[]; excludeKeys?: string[] } {
    return this.discoveryManager.getSearchOption();
  }

  /**
   * 运行时更新 BLEHandler 的配置
   * @throws {Error}
   */
  async updateBLEHandlerConfig(cfg: Partial<BLEHandlerConfig>): Promise<BLEHandlerConfig> {
    this.ioManager.setBLEHandlerConfig(cfg);
    const result = this.serviceManager.setBLEHandlerConfig(cfg);
    // 配置更新后重新订阅通知（遍历所有已连接设备，多设备模式下也全部生效）
    for (const dev of this.connectedDevices) {
      if (dev?.deviceId) {
        await this.enableCharacteristicNotification(dev.deviceId);
      }
    }
    return result;
  }

  /**
   * 检查蓝牙开启状态和权限授予状态
   * @throws {Error}
   */
  async getAdapterStatus(): Promise<WechatMiniprogram.GetBluetoothAdapterStateSuccessCallbackResult> {
    return await this.adapterManager.getAdapterStatus();
  }

  /**
   * 初始化并打开蓝牙适配器
   * @throws {Error}
   */
  async openAdapter(): Promise<void> {
    await this.adapterManager.openAdapter();
  }

  /**
   * 开始搜索蓝牙设备
   * @throws {Error}
   */
  async startDeviceDiscovery(
    searchOption: WechatMiniprogram.StartBluetoothDevicesDiscoveryOption = this.searchOption,
  ): Promise<void> {
    await this.discoveryManager.startDeviceDiscovery(searchOption);
  }

  /**
   * 添加设备发现监听回调
   * @param {function} callback 发现设备时的回调函数
   * @returns {function} 返回一个用于取消该回调的函数
   */
  addDeviceFoundListener(callback: (devices: Device[]) => void): () => void {
    return this.discoveryManager.addDeviceFoundListener(callback);
  }

  /**
   * 停止搜索蓝牙设备
   * @throws {Error}
   */
  async stopDeviceDiscovery(): Promise<void> {
    await this.discoveryManager.stopDeviceDiscovery();
  }

  /**
   * 连接指定的蓝牙设备（由子类实现）
   * @throws {Error}
   */
  abstract connectDevice(devOrDeviceId: Device | string): Promise<void>;

  /**
   * 添加连接状态变化的用户回调，返回解绑函数
   * @param {function} callback 状态变化时的回调，接收原始 res 参数
   * @returns {function} 解绑函数
   */
  addConnectionStateChangeListener(
    callback: (res: WechatMiniprogram.OnBLEConnectionStateChangeListenerResult) => void,
  ): () => void {
    return this.connectionManager.addConnectionStateChangeListener(callback);
  }

  /**
   * 断开蓝牙连接（由子类实现）
   * @throws {Error}
   */
  abstract disconnectDevice(deviceId?: string): Promise<void>;

  /**
   * 获取蓝牙设备信号强度（由子类实现）
   * @throws {Error}
   */
  abstract getDeviceRSSI(deviceId?: string): Promise<number>;

  /**
   * 获取蓝牙设备的所有服务（由子类实现）
   * @throws {Error}
   */
  abstract getDeviceServices(deviceId?: string): Promise<WechatMiniprogram.BLEService[]>;

  /**
   * 检查蓝牙设备的服务是否拥有已设置的特征值
   * @throws {Error}
   */
  async validateCharacteristics(
    deviceId: string,
    serviceId?: string,
  ): Promise<CharacteristicCheckResult> {
    return await this.serviceManager.validateCharacteristics(deviceId, serviceId);
  }

  /**
   * 启用蓝牙设备特征值变化的通知功能（由子类实现）
   * @throws {Error}
   */
  abstract enableCharacteristicNotification(
    deviceId: string,
    serviceId?: string,
    characteristicId?: string,
  ): Promise<void>;

  /**
   * 注册特征值变化回调，返回解绑函数
   */
  addCharacteristicValueChangeListener(
    callback: (result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult) => void,
  ): () => void {
    return this.ioManager.addCharacteristicValueChangeListener(callback);
  }

  /**
   * 删除特定的特征值变化回调
   */
  removeCharacteristicValueChangeListener(
    callback: (result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult) => void,
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
   * @throws {Error}
   */
  abstract writeCharacteristicValue(options: writeCharacteristicOption): Promise<any>;

  /**
   * 读取数据帧（由子类实现）
   * @throws {Error}
   */
  abstract readCharacteristicValue(options: readCharacteristicOption): Promise<number[]>;

  /**
   * 关闭蓝牙适配器
   * @throws {Error}
   */
  async closeAdapter(): Promise<void> {
    await this.adapterManager.closeAdapter();
  }

  /**
   * 释放所有资源
   * 断开连接、解绑所有监听、关闭适配器
   * 释放后可再次调用 init() 重新初始化
   */
  async release(): Promise<void> {
    if (this.connectedDevices.length !== 0) {
      // 断开所有连接的设备
      for (const dev of this.connectedDevices) {
        if (dev?.deviceId) {
          try {
            await this.disconnectDevice(dev.deviceId);
          } catch (disErr) {
            debugError(`断开设备 ${dev.deviceId} 失败:`, disErr);
          }
        }
      }
    }

    // 解绑全局监听器 + 重置 Manager 的标志位
    if (!shouldSkipBLEApiCall("offBLECharacteristicValueChange")) {
      wx.offBLECharacteristicValueChange();
    }
    if (!shouldSkipBLEApiCall("offBLEConnectionStateChange")) {
      wx.offBLEConnectionStateChange();
    }
    if (!shouldSkipBLEApiCall("offBluetoothDeviceFound")) {
      wx.offBluetoothDeviceFound();
    }
    this.connectionManager.offConnectionStateListener();
    this.ioManager.offCharacteristicListener();
    this.discoveryManager.offDeviceFoundListener();

    await this.closeAdapter();
  }

  /**
   * 初始化蓝牙功能
   * 必须在构造后调用，确保蓝牙适配器初始化并注册全局监听器
   * @throws {Error}
   */
  async init(): Promise<void> {
    // 1. 打开蓝牙适配器
    await this.openAdapter();

    // 2. 注册全局监听器（只注册一次）
    // 连接状态监听：重连回调 + WeChat 自动重连后恢复 notify 订阅
    this.connectionManager.ensureConnectionStateListenerRegistered(async (device: Device) =>
      this.connectDevice(device),
    );
    // 特征值变化监听
    this.ioManager.ensureCharacteristicListenerRegistered();
  }
}
