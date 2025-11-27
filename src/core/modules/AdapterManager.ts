/**
 * AdapterManager - 蓝牙适配器管理模块
 * 负责适配器的初始化、状态检查、关闭等操作
 */
import BluetoothManager from "../BluetoothManager";

export class AdapterManager {
  /**
   * 超时控制 Promise
   * @param promise 原始 Promise
   * @param timeout 超时时间（默认 6000ms）
   */
  withTimeout<T>(promise: Promise<T>, timeout = 6000): Promise<T> {
    let timeoutId: number;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timeout")), timeout);
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
   */
  async getAdapterStatus() {
    let [err, res] = await BluetoothManager.openBluetoothAdapter();

    if (err != null) {
      // 如果打开适配器失败，提示用户检查权限或蓝牙状态
      if (err?.errno === 103) {
        return {
          errno: err.errno,
          errMsg: "请检查是否已授权小程序蓝牙权限",
        };
      }
      if (err?.errno === 1500102) {
        return {
          errno: err.errno,
          errMsg: "请检查蓝牙是否开启",
        };
      }
      return err; // 其他错误直接返回
    }
    // {errno:0,errMsg:"openBLuetoothAdapter:ok"}
    return res;
  }

  /**
   * 初始化并打开蓝牙适配器
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async openAdapter() {
    let [err, res] = await BluetoothManager.openBluetoothAdapter();

    if (err != null) {
      console.error(err);
      return [err, res]; // 打开适配器失败
    }
    return [err, res];
  }

  /**
   * 关闭蓝牙适配器
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async closeAdapter() {
    let [err, res] = await BluetoothManager.closeBluetoothAdapter();
    return [err, res];
  }

  /**
   * 获取蓝牙设备信号强度
   * @param {string} deviceId 设备ID
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async getDeviceRSSI(deviceId: string): Promise<[Error | null, any]> {
    return await BluetoothManager.getBLEDeviceRSSI(deviceId);
  }
}
