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
  get historyConnectedDevList(): Device[] {
    return this.connectionManager.historyConnectedDevList;
  }
  get connectedDevList(): Device[] {
    return this.connectionManager.connectedDevList;
  }
  get reconnectedDevList(): Device[] {
    return this.connectionManager.reconnectedDevList;
  }
  get config(): BLEHandlerConfig {
    return this.serviceManager.config;
  }
  get connectedSingleDev(): Device | undefined {
    return this.connectionManager.connectedSingleDev;
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
  setBLEHandlerConfig(
    cfg: Partial<BLEHandlerConfig>
  ): [Error | null, BLEHandlerConfig] {
    return this.serviceManager.setBLEHandlerConfig(cfg, async () => {
      // 配置更新后重新订阅通知
      await this.notifyBLECharacteristicValueChange(
        this.connectedSingleDev?.deviceId || ""
      );
    });
  }

  /**
   * 检查蓝牙开启状态和权限授予状态
   */
  async checkBLEAdapter() {
    return await this.adapterManager.checkBLEAdapter();
  }

  /**
   * 初始化并打开蓝牙适配器
   */
  async openBLEAdapter() {
    return await this.adapterManager.openBLEAdapter();
  }

  /**
   * 开始搜索蓝牙设备
   */
  async startSearchBLE(
    searchOption: WechatMiniprogram.StartBluetoothDevicesDiscoveryOption = this
      .searchOption
  ) {
    return await this.discoveryManager.startSearchBLE(searchOption);
  }

  /**
   * 监听发现新蓝牙设备事件
   */
  onBluetoothFound(callback?: (devices: Device[]) => void) {
    this.discoveryManager.onBluetoothFound(callback);
  }

  /**
   * 停止搜索蓝牙设备
   */
  async stopSearchBLE() {
    return await this.discoveryManager.stopSearchBLE();
  }

  /**
   * 连接指定的蓝牙设备
   */
  async connectBLE(dev: Device) {
    return await this.connectionManager.connectBLE(
      dev,
      this.connectTimeout,
      async (deviceId: string) => {
        // 连接成功后的回调：获取服务和特征值
        await this.getBLEServices(deviceId);
        await this.checkCharacteristics(deviceId);
        await this.notifyBLECharacteristicValueChange(deviceId);
      }
    );
  }

  /**
   * 蓝牙适配器连接状态监听
   */
  onBLEConnectionStateChange(callbacks?: ConnectionStateCallbacks): void {
    this.connectionManager.onBLEConnectionStateChange(
      callbacks,
      // 重连回调
      async (device: Device) => {
        return await this.connectBLE(device);
      }
    );
  }

  /**
   * 断开蓝牙连接（支持单设备和多设备模式）
   */
  async disconnectBLE(): Promise<[Error | null, any]>;
  async disconnectBLE(deviceId: string): Promise<[Error | null, any]>;
  async disconnectBLE(deviceId?: string) {
    if (this.mode === "single") {
      let singleDeviceId = deviceId || this.connectedSingleDev?.deviceId;
      if (!singleDeviceId) {
        return [new Error("单设备模式下未连接任何设备"), null];
      }
      return await this.connectionManager.disconnectBLE(singleDeviceId);
    } else {
      if (!deviceId) {
        return [new Error("多设备模式下必须提供设备ID"), null];
      }
      return await this.connectionManager.disconnectBLE(deviceId);
    }
  }

  /**
   * 获取蓝牙设备信号强度
   */
  async getBLEDeviceRSSI(): Promise<[Error | null, any]>;
  async getBLEDeviceRSSI(deviceId: string): Promise<[Error | null, any]>;
  async getBLEDeviceRSSI(deviceId?: string) {
    if (this.mode === "single") {
      let singleDeviceId = this.connectedSingleDev?.deviceId;
      if (deviceId) singleDeviceId = deviceId;
      if (!singleDeviceId) {
        return [new Error("单设备模式下未连接任何设备"), null];
      }
      return await this.adapterManager.getBLEDeviceRSSI(singleDeviceId);
    } else {
      if (!deviceId) {
        return [new Error("多设备模式下必须提供设备ID"), null];
      }
      return await this.adapterManager.getBLEDeviceRSSI(deviceId);
    }
  }

  /**
   * 获取蓝牙设备的所有服务
   */
  async getBLEServices(deviceId?: string) {
    if (this.mode === "single") {
      let singleDeviceId = this.connectedSingleDev?.deviceId;
      if (deviceId) singleDeviceId = deviceId;
      if (!singleDeviceId) {
        return [new Error("单设备模式下未连接任何设备"), null];
      }
      return await this.serviceManager.getBLEServices(singleDeviceId);
    } else {
      if (!deviceId) {
        return [new Error("多设备模式下必须提供设备ID"), null];
      }
      return await this.serviceManager.getBLEServices(deviceId);
    }
  }

  /**
   * 检查蓝牙设备的服务是否拥有已设置的特征值
   */
  async checkCharacteristics(
    deviceId: string,
    serviceId?: string
  ): Promise<[Error | null, CharacteristicCheckResult]> {
    return await this.serviceManager.checkCharacteristics(deviceId, serviceId);
  }

  /**
   * 启用蓝牙设备特征值变化的通知功能
   */
  async notifyBLECharacteristicValueChange(
    deviceId: string,
    serviceId?: string,
    characteristicId?: string
  ) {
    if (this.mode === "single") {
      let singleDeviceId = this.connectedSingleDev?.deviceId;
      if (deviceId) singleDeviceId = deviceId;
      if (!singleDeviceId) {
        return [new Error("单设备模式下未连接任何设备"), null];
      }
      return await this.serviceManager.notifyBLECharacteristicValueChange(
        singleDeviceId,
        serviceId,
        characteristicId
      );
    } else {
      if (!deviceId) {
        return [new Error("多设备模式下必须提供设备ID"), null];
      }
      return await this.serviceManager.notifyBLECharacteristicValueChange(
        deviceId,
        serviceId,
        characteristicId
      );
    }
  }

  /**
   * 注册特征值变化回调，返回解绑函数
   */
  addCharacteristicValueChangeCallback(
    callback: (
      result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult
    ) => void
  ): () => void {
    return this.ioManager.addCharacteristicValueChangeCallback(callback);
  }

  /**
   * 删除特定的特征值变化回调
   */
  delCharacteristicValueChangeCallback(
    callback: (
      result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult
    ) => void
  ): boolean {
    return this.ioManager.delCharacteristicValueChangeCallback(callback);
  }

  /**
   * 删除所有特征值变化回调
   */
  delAllCharacteristicValueChangeCallback(): void {
    this.ioManager.delAllCharacteristicValueChangeCallback();
  }

  /**
   * 发送数据帧（使用 writeCharacteristic 类型）
   */
  async writeCharacteristic(
    options: writeCharacteristicOption
  ): Promise<[Error | null, any]> {
    return await this.ioManager.writeCharacteristic(
      options,
      this.mode,
      this.connectedSingleDev?.deviceId
    );
  }

  /**
   * 读取数据帧（使用 readCharacteristic 类型）
   */
  async readCharacteristic(
    options: readCharacteristicOption
  ): Promise<[Error | null, any]> {
    return await this.ioManager.readCharacteristic(
      options,
      this.mode,
      this.connectedSingleDev?.deviceId
    );
  }

  /**
   * 关闭蓝牙适配器
   */
  async closeBLEAdapter() {
    return await this.adapterManager.closeBLEAdapter();
  }

  /**
   * 释放所有资源
   */
  async release(callback?: () => void) {
    if (this.connectedDevList.length !== 0) {
      // 断开所有连接的设备
      for (let dev of this.connectedDevList) {
        if (dev?.deviceId) {
          let [disErr, disRes] = await this.disconnectBLE(dev.deviceId);
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
    await this.closeBLEAdapter();
    if (callback) callback();
  }

  /**
   * 初始化蓝牙功能
   */
  async init(bleFoundCallback?: (devices: Device[]) => void) {
    // 蓝牙适配器初始化
    let [err, res] = await this.openBLEAdapter();
    if (err && !res) return err;
    this.onBLEConnectionStateChange();
    // 注意：不再在 init 中自动注册特征值监听，用户需要手动调用 addCharacteristicValueChangeCallback
    this.addCharacteristicValueChangeCallback(() => {});

    if (bleFoundCallback) {
      // 搜索蓝牙设备
      await this.startSearchBLE();
      // 获取设备ID
      await this.onBluetoothFound(bleFoundCallback);
    }
  }
}
