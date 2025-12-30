/**
 * AdapterManager - 蓝牙适配器管理模块
 * 负责适配器的初始化、状态检查、关闭等操作
 */
import { BLEAdapterError, BLEPermissionError, BLETimeoutError, convertWxErrorToBLEError } from "../../utils/error";

export class AdapterManager {
  /**
   * 超时控制 Promise
   * @param promise 原始 Promise
   * @param timeout 超时时间（默认 6000ms）
   */
  withTimeout<T>(promise: Promise<T>, timeout = 6000): Promise<T> {
    let timeoutId: number;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new BLETimeoutError("操作超时", "adapter", timeout)), timeout);
    });

    // 保证清理定时器
    return Promise.race([
      Promise.resolve(promise).finally(() => clearTimeout(timeoutId)),
      timeoutPromise,
    ]);
  }

  /**
   * 检查蓝牙开启状态和权限授予状态
   * @returns {Promise<any>} 检查结果
   * @throws {BLEPermissionError} 权限未授予
   * @throws {BLEAdapterError} 蓝牙未开启或其他适配器错误
   */
  async getAdapterStatus() {
    try {
      console.log(`准备初始化蓝牙适配器...`);
      const res = await wx.openBluetoothAdapter({ mode: "central" });
      console.log(`✔ 适配器初始化成功！`);
      return res;
    } catch (err: any) {
      // 如果打开适配器失败，提示用户检查权限或蓝牙状态
      if (err?.errno === 103 || err?.errCode === 103) {
        throw new BLEPermissionError("请检查是否已授权小程序蓝牙权限", 103, err);
      }
      if (err?.errno === 1500102 || err?.errCode === 10001) {
        throw new BLEAdapterError("请检查蓝牙是否开启", err?.errno || err?.errCode, err);
      }
      throw convertWxErrorToBLEError(err);
    }
  }

  /**
   * 初始化并打开蓝牙适配器
   * @returns {Promise<any>} 结果
   * @throws {BLEAdapterError} 适配器错误
   */
  async openAdapter() {
    try {
      console.log(`准备初始化蓝牙适配器...`);
      const res = await wx.openBluetoothAdapter({ mode: "central" });
      console.log(`✔ 适配器初始化成功！`);
      return res;
    } catch (err) {
      console.error(`✘ 初始化失败！`, err);
      throw convertWxErrorToBLEError(err);
    }
  }

  /**
   * 关闭蓝牙适配器
   * @returns {Promise<any>} 结果
   * @throws {BLEAdapterError} 适配器错误
   */
  async closeAdapter() {
    try {
      console.log(`释放蓝牙适配器...`);
      const res = await wx.closeBluetoothAdapter();
      console.log(`✔ 释放适配器成功！`);
      return res;
    } catch (err) {
      console.error(`✘ 释放适配器失败！`, err);
      throw convertWxErrorToBLEError(err);
    }
  }

  /**
   * 获取蓝牙设备信号强度
   * @param {string} deviceId 设备ID
   * @returns {Promise<any>} RSSI 结果
   * @throws {BLEError} 获取失败
   */
  async getDeviceRSSI(deviceId: string): Promise<any> {
    try {
      const res = await wx.getBLEDeviceRSSI({ deviceId });
      console.log(`✔ 获取信号强度成功!`);
      return res;
    } catch (err: any) {
      console.error(`✘ 获取信号强度失败！${err}`);
      throw convertWxErrorToBLEError(err);
    }
  }
}
