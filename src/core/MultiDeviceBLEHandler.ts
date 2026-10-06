import type {
  Device,
  BLEHandlerConstructor,
  DeviceRSSIResult,
  writeCharacteristicOption,
  readCharacteristicOption,
} from "../types/ble";

import { BLEHandlerBase } from "./BLEHandler.base";
import { ConnectionManager } from "./modules/ConnectionManager";

/**
 * 多设备蓝牙工具类
 * 支持同时连接多个设备，所有操作需要明确指定 deviceId
 */
export class MultiDeviceBLEHandler extends BLEHandlerBase {
  constructor(options: BLEHandlerConstructor) {
    super(options);
  }

  protected createConnectionManager(): ConnectionManager {
    return new ConnectionManager({
      mode: "multiple",
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
      async (connectedDeviceId: string) => {
        // 连接成功后的回调：获取服务和特征值
        await this.getDeviceServices(connectedDeviceId);
        await this.validateCharacteristics(connectedDeviceId);
        await this.enableCharacteristicNotification(connectedDeviceId);
      },
    );
  }

  /**
   * 断开蓝牙连接
   * @param {string} deviceId 设备ID（必需）
   * @throws {Error}
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    if (!deviceId) {
      throw new Error("多设备模式下必须提供设备ID");
    }
    await this.connectionManager.disconnectDevice(deviceId);
  }

  /**
   * 获取蓝牙设备信号强度
   * @param {string} deviceId 设备ID（必需）
   * @returns 结果对象，信号强度取 `res.RSSI`
   * @throws {Error}
   */
  async getDeviceRSSI(deviceId: string): Promise<DeviceRSSIResult> {
    if (!deviceId) {
      throw new Error("多设备模式下必须提供设备ID");
    }
    return await this.adapterManager.getDeviceRSSI(deviceId);
  }

  /**
   * 获取蓝牙设备的所有服务
   * @param {string} deviceId 设备ID（必需）
   * @throws {Error}
   */
  async getDeviceServices(deviceId: string): Promise<WechatMiniprogram.BLEService[]> {
    if (!deviceId) {
      throw new Error("多设备模式下必须提供设备ID");
    }
    return await this.serviceManager.getDeviceServices(deviceId);
  }

  /**
   * 启用蓝牙设备特征值变化的通知功能
   * @param {string} deviceId 设备ID（必需）
   * @throws {Error}
   */
  async enableCharacteristicNotification(
    deviceId: string,
    serviceId?: string,
    characteristicId?: string,
  ): Promise<void> {
    if (!deviceId) {
      throw new Error("多设备模式下必须提供设备ID");
    }
    await this.serviceManager.enableCharacteristicNotification(
      deviceId,
      serviceId,
      characteristicId,
    );
  }

  /**
   * 发送数据帧
   * @param {writeCharacteristicOption} options 写入选项（必须包含 deviceId）
   * @throws {Error}
   */
  async writeCharacteristicValue(options: writeCharacteristicOption): Promise<any> {
    if (!options.deviceId) {
      throw new Error("多设备模式下必须提供设备ID");
    }
    return this.ioManager.writeCharacteristicValue(options, "multiple");
  }

  /**
   * 读取数据帧
   * @param {readCharacteristicOption} options 读取选项（必须包含 deviceId）
   * @throws {Error}
   */
  async readCharacteristicValue(options: readCharacteristicOption): Promise<number[]> {
    if (!options.deviceId) {
      throw new Error("多设备模式下必须提供设备ID");
    }
    const result = await this.ioManager.readCharacteristicValue(options, "multiple");
    return result?.value || [];
  }
}
