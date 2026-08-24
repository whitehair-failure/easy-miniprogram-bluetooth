import type {
  Device,
  BLEHandlerConstructor,
  writeCharacteristicOption,
  readCharacteristicOption,
} from "../types/ble";

import { BLEHandlerBase } from "./BLEHandler.base";
import { ConnectionManager } from "./modules/ConnectionManager";

/**
 * 单设备蓝牙工具类
 * 简化的 API：自动使用当前连接的设备，无需指定 deviceId
 */
export class SingleDeviceBLEHandler extends BLEHandlerBase {
  constructor(options: BLEHandlerConstructor) {
    super(options);
  }

  protected createConnectionManager(): ConnectionManager {
    return new ConnectionManager({
      mode: "single",
      connectTimeout: this.connectTimeout,
      reconnect: this.reconnect,
      maxRetries: this.maxRetries,
      reconnectDelay: this.reconnectDelay,
    });
  }

  /**
   * 连接指定的蓝牙设备
   * @param {Device | string} devOrDeviceId 蓝牙设备对象或设备ID字符串
   * @throws {Error}
   */
  async connectDevice(devOrDeviceId: Device | string): Promise<void> {
    await this.connectionManager.connectDevice(
      devOrDeviceId,
      this.connectTimeout,
      async (deviceId: string) => {
        // 连接成功后的回调：获取服务和特征值
        await this.getDeviceServices();
        await this.validateCharacteristics(deviceId);
        await this.enableCharacteristicNotification();
      },
    );
  }

  /**
   * 断开蓝牙连接
   * @throws {Error}
   */
  async disconnectDevice(): Promise<void> {
    const singleDeviceId = this.singleConnectedDevice?.deviceId;
    if (!singleDeviceId) {
      throw new Error("断开蓝牙连接失败，单设备模式下未连接任何设备");
    }
    await this.connectionManager.disconnectDevice(singleDeviceId);
  }

  /**
   * 获取蓝牙设备信号强度
   * @throws {Error}
   */
  async getDeviceRSSI(): Promise<number> {
    const singleDeviceId = this.singleConnectedDevice?.deviceId;
    if (!singleDeviceId) {
      throw new Error("获取蓝牙设备信号强度失败，单设备模式下未连接任何设备");
    }
    return await this.adapterManager.getDeviceRSSI(singleDeviceId);
  }

  /**
   * 获取蓝牙设备的所有服务
   * @throws {Error}
   */
  async getDeviceServices(): Promise<WechatMiniprogram.BLEService[]> {
    const singleDeviceId = this.singleConnectedDevice?.deviceId;
    if (!singleDeviceId) {
      throw new Error("获取蓝牙设备服务失败，单设备模式下未连接任何设备");
    }
    return await this.serviceManager.getDeviceServices(singleDeviceId);
  }

  /**
   * 启用蓝牙设备特征值变化的通知功能
   * @throws {Error}
   */
  async enableCharacteristicNotification(
    deviceId?: string,
    serviceId?: string,
    characteristicId?: string,
  ): Promise<void> {
    const targetDeviceId = deviceId || this.singleConnectedDevice?.deviceId;
    if (!targetDeviceId) {
      throw new Error("启用蓝牙设备特征值变化通知失败，单设备模式下未连接任何设备");
    }
    await this.serviceManager.enableCharacteristicNotification(
      targetDeviceId,
      serviceId,
      characteristicId,
    );
  }

  /**
   * 发送数据帧
   * @throws {Error}
   */
  async writeCharacteristicValue(
    options: writeCharacteristicOption,
  ): Promise<any> {
    return this.ioManager.writeCharacteristicValue(
      options,
      "single",
      this.singleConnectedDevice?.deviceId,
    );
  }

  /**
   * 读取数据帧
   * @throws {Error}
   */
  async readCharacteristicValue(
    options: readCharacteristicOption,
  ): Promise<ArrayBuffer> {
    const result = await this.ioManager.readCharacteristicValue(
      options,
      "single",
      this.singleConnectedDevice?.deviceId,
    );
    return result?.value || new ArrayBuffer(0);
  }
}
