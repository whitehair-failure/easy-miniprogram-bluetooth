/**
 * AdapterManager - 蓝牙适配器管理模块
 * 负责适配器的初始化、状态检查、关闭等操作
 */
import { shouldSkipBLEApiCall } from "../../utils/runtime";
import { debugLog, debugError } from "../../utils/logger";

export class AdapterManager {
  /**
   * 检查蓝牙开启状态和权限授予状态
   * @returns {Promise<any>} 检查结果
   * @throws {Error} 权限未授予或蓝牙未开启等其他适配器错误
   */
  async getAdapterStatus() {
    try {
      debugLog(`查看蓝牙适配器状态...`);
      if (shouldSkipBLEApiCall("getBluetoothAdapterState")) {
        return {
          available: true,
          discovering: false,
        } as WechatMiniprogram.GetBluetoothAdapterStateSuccessCallbackResult;
      }
      const res = await wx.getBluetoothAdapterState();
      debugLog(`✔ 适配器状态获取成功！`);
      return res;
    } catch (err: any) {
      if (err?.errno === 103 || err?.errCode === 103) {
        throw new Error("请检查是否已授权小程序蓝牙权限");
      }
      if (err?.errno === 1500102 || err?.errCode === 10001) {
        throw new Error("请检查蓝牙是否开启");
      }
      // 如果获取适配器状态失败，直接抛出原始错误，由调用方判断权限或蓝牙状态
      throw err;
    }
  }

  /**
   * 初始化并打开蓝牙适配器
   * @returns {Promise<any>} 结果
   * @throws {Error} 适配器错误
   */
  async openAdapter() {
    try {
      debugLog(`准备初始化蓝牙适配器...`);
      if (shouldSkipBLEApiCall("openBluetoothAdapter")) {
        return { success: true };
      }
      const res = await wx.openBluetoothAdapter({ mode: "central" });
      debugLog(`✔ 适配器初始化成功！`);
      return res;
    } catch (err) {
      debugError(`✘ 初始化失败！`, err);
      throw err;
    }
  }

  /**
   * 关闭蓝牙适配器
   * @returns {Promise<any>} 结果
   * @throws {Error} 适配器错误
   */
  async closeAdapter() {
    try {
      debugLog(`释放蓝牙适配器...`);
      if (shouldSkipBLEApiCall("closeBluetoothAdapter")) {
        return { success: true };
      }
      const res = await wx.closeBluetoothAdapter();
      debugLog(`✔ 释放适配器成功！`);
      return res;
    } catch (err) {
      debugError(`✘ 释放适配器失败！`, err);
      throw err;
    }
  }

  /**
   * 获取蓝牙设备信号强度
   * @param {string} deviceId 设备ID
   * @returns {Promise<any>} RSSI 结果
   * @throws {Error} 获取失败
   */
  async getDeviceRSSI(deviceId: string): Promise<any> {
    try {
      if (shouldSkipBLEApiCall("getBLEDeviceRSSI")) {
        return { RSSI: 0 };
      }
      const res = await wx.getBLEDeviceRSSI({ deviceId });
      debugLog(`✔ 获取信号强度成功!`);
      return res;
    } catch (err: any) {
      debugError(`✘ 获取信号强度失败！${err}`);
      throw err;
    }
  }
}
