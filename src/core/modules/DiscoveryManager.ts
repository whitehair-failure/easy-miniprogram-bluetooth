/**
 * DiscoveryManager - 设备发现管理模块
 * 负责搜索、发现、过滤蓝牙设备
 */
import type { Device } from "../../types/ble";
import { convertWxErrorToBLEError } from "../../utils/error";

export class DiscoveryManager {
  public foundDevList: Device[] = []; // 当前已找到的设备列表
  public historyDevList: Device[] = []; // 已找到的设备的历史列表

  private readonly filterKey?: string[]; // 过滤关键字
  private readonly reconnect: boolean; // 设备异常断开是否自动重连
  private readonly searchOption: WechatMiniprogram.StartBluetoothDevicesDiscoveryOption;

  constructor(
    filterKey?: string[],
    reconnect: boolean = false,
    searchOption: WechatMiniprogram.StartBluetoothDevicesDiscoveryOption = {}
  ) {
    this.filterKey = filterKey;
    this.reconnect = reconnect;
    this.searchOption = searchOption;
  }

  /**
   * 开始搜索蓝牙设备
   * @returns {Promise<any>} 结果
   * @throws {BLEError} 搜索失败
   */
  async startDeviceDiscovery(
    searchOption: WechatMiniprogram.StartBluetoothDevicesDiscoveryOption = this
      .searchOption
  ) {
    try {
      console.log(`准备搜寻附近的蓝牙外围设备...`);
      const res = await wx.startBluetoothDevicesDiscovery(searchOption);
      console.log(`✔ 搜索成功!`);
      return res;
    } catch (err) {
      console.error(`✘ 搜索蓝牙设备失败！`, err);
      throw convertWxErrorToBLEError(err);
    }
  }

  /**
   * 监听发现新蓝牙设备事件
   * @param {function} [callback] 发现实时设备时的回调函数
   */
  onDeviceFound(callback?: (devices: Device[]) => void) {
    wx.onBluetoothDeviceFound((res) => {
      console.log("res.devices", res.devices);

      res.devices.forEach((device) => {
        let isTarget = true;

        if (this.filterKey && this.filterKey.length > 0) {
          isTarget = this.filterKey.some((key) => device.name.includes(key));
        }

        if (
          isTarget &&
          !this.historyDevList.find((d) => d.deviceId === device.deviceId)
        ) {
          this.historyDevList.push({
            ...device,
            reconnect: this.reconnect,
            isConnect: false,
          });
        }

        if (
          isTarget &&
          !this.foundDevList.find((d) => d.deviceId === device.deviceId)
        ) {
          this.foundDevList.push({
            ...device,
            reconnect: this.reconnect,
            isConnect: false,
          });
        }
      });

      if (callback) {
        // 先进行过滤，然后再转换设备信息
        const filteredDevices = res.devices.filter((device) => {
          if (!this.filterKey || this.filterKey.length === 0) {
            return true;
          }
          return this.filterKey.some((key) => device.name.includes(key));
        });

        const realTimeDevices = filteredDevices.map((device) => ({
          ...device,
          reconnect: this.reconnect,
          isConnect: false, // 初始状态为未连接
        }));

        callback(realTimeDevices);
      }
    });
  }

  /**
   * 停止搜索蓝牙设备
   * @returns {Promise<any>} 结果
   * @throws {BLEError} 停止失败
   */
  async stopDeviceDiscovery() {
    try {
      console.log(`停止查找新设备...`);
      const res = await wx.stopBluetoothDevicesDiscovery();
      console.log(`✔ 停止查找设备成功！`);
      this.foundDevList = [];
      return res;
    } catch (err) {
      console.error(`✘ 停止查询设备失败！`, err);
      throw convertWxErrorToBLEError(err);
    }
  }
}
