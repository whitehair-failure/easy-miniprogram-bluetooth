/**
 * DiscoveryManager - 设备发现管理模块
 * 负责搜索、发现、过滤蓝牙设备
 */
import type { Device, SearchOption } from "../../types/ble";
import { shouldSkipBLEApiCall } from "../../utils/runtime";

export class DiscoveryManager {
  private _foundDevList: Device[] = []; // 当前已找到的设备列表（私有）
  private _historyDevList: Device[] = []; // 已找到的设备的历史列表（私有）

  private searchOption: SearchOption; // 搜索选项（有动态更新）
  private readonly reconnect: boolean; // 设备异常断开是否自动重连

  // 存储多个设备发现的回调函数
  private deviceFoundCallbacks: Set<(devices: Device[]) => void> = new Set();

  // 标记是否已经注册了平台的全局监听器（私有实现）
  private isDeviceFoundListenerRegistered = false;

  constructor(searchOption: SearchOption = {}, reconnect: boolean = false) {
    this.searchOption = searchOption;
    this.reconnect = reconnect;
  }

  /**
   * 更新设备过滤选项（运行时动态更新）
   */
  updateSearchOption(searchOption: Partial<SearchOption>): void {
    this.searchOption = { ...this.searchOption, ...searchOption };
  }

  /**
   * 获取当前过滤选项
   */
  getSearchOption(): Partial<SearchOption> {
    return {
      includeKeys: this.searchOption.includeKeys,
      excludeKeys: this.searchOption.excludeKeys,
    };
  }

  /**
   * 获取当前已找到的设备列表（深拷贝，防止外部修改）
   */
  get foundDevList(): Device[] {
    return this._foundDevList.map((d) => ({ ...d }));
  }

  /**
   * 获取已找到的设备的历史列表（深拷贝，防止外部修改）
   */
  get historyDevList(): Device[] {
    return this._historyDevList.map((d) => ({ ...d }));
  }

  /**
   * 判断设备是否匹配过滤条件
   * 白名单逻辑（includeKeys）：如果配置了，设备名必须包含其中至少一个
   * 黑名单逻辑（excludeKeys）：如果配置了，设备名不能包含任何一个
   * @returns {boolean} true 表示设备通过过滤条件
   */
  private isDeviceMatched(deviceName: string, localName?: string): boolean {
    const name = deviceName || localName || "";
    if (!name) return false;

    // 检查黑名单：如果设备名包含任何排除关键字，则过滤掉
    if (this.searchOption.excludeKeys && this.searchOption.excludeKeys.length > 0) {
      if (this.searchOption.excludeKeys.some((key: string) => name.includes(key))) {
        return false;
      }
    }

    // 检查白名单：如果配置了，设备名必须包含其中至少一个
    if (this.searchOption.includeKeys && this.searchOption.includeKeys.length > 0) {
      return this.searchOption.includeKeys.some((key: string) => name.includes(key));
    }

    // 如果没有配置任何过滤，接受所有设备
    return true;
  }

  /**
   * 开始搜索蓝牙设备?
   * @returns {Promise<any>} 结果
   * @throws {Error} 搜索失败
   */
  async startDeviceDiscovery(
    searchOption: WechatMiniprogram.StartBluetoothDevicesDiscoveryOption = this.searchOption,
  ) {
    try {
      console.log(`准备搜寻附近的蓝牙外围设备...`);
      if (shouldSkipBLEApiCall("startBluetoothDevicesDiscovery")) {
        return { success: true };
      }
      const res = await wx.startBluetoothDevicesDiscovery(searchOption);
      console.log(`搜索成功！`);
      return res;
    } catch (err) {
      console.error(`搜索蓝牙设备失败！`, err);
      throw err;
    }
  }

  /**
   * 注册微信的全局设备发现监听器（只注册一次）
   */
  private ensureDeviceFoundListenerRegistered(): void {
    if (this.isDeviceFoundListenerRegistered) {
      return;
    }

    if (shouldSkipBLEApiCall("onBluetoothDeviceFound")) {
      this.isDeviceFoundListenerRegistered = true;
      return;
    }

    wx.onBluetoothDeviceFound((res) => {
      console.log("res.devices", res.devices);

      res.devices.forEach((device) => {
        // 使用新的过滤逻辑（同时检查 name 和 localName）
        const isTarget = this.isDeviceMatched(device.name, device.localName);

        if (isTarget && !this._historyDevList.find((d) => d.deviceId === device.deviceId)) {
          this._historyDevList.push({
            ...device,
            reconnect: this.reconnect,
            isConnect: false,
          });
        }

        if (isTarget && !this._foundDevList.find((d) => d.deviceId === device.deviceId)) {
          this._foundDevList.push({
            ...device,
            reconnect: this.reconnect,
            isConnect: false,
          });
        }
      });

      // 先进行过滤，然后再转换设备信息
      const filteredDevices = res.devices.filter((device) =>
        this.isDeviceMatched(device.name, device.localName),
      );

      const realTimeDevices = filteredDevices.map((device) => ({
        ...device,
        reconnect: this.reconnect,
        isConnect: false, // 初始状态为未连接
      }));

      // 执行所有已注册的回调函数
      this.deviceFoundCallbacks.forEach((callback) => {
        try {
          callback(realTimeDevices);
        } catch (error) {
          console.error("设备发现回调执行出错:", error);
        }
      });
    });

    this.isDeviceFoundListenerRegistered = true;
  }

  /**
   * 添加蓝牙设备发现的监听回调
   * @param {function} callback 发现设备时的回调函数
   * @returns {function} 返回一个用于取消该回调的函数
   */
  addDeviceFoundListener(callback: (devices: Device[]) => void): () => void {
    // 确保平台的全局监听器已注册
    this.ensureDeviceFoundListenerRegistered();

    // 添加回调到集合中
    this.deviceFoundCallbacks.add(callback);

    // 返回一个解绑函数
    return () => {
      this.removeDeviceFoundListener(callback);
    };
  }

  /**
   * 删除特定的设备发现监听回调
   * @param {function} callback 要删除的回调函数
   * @returns {boolean} 是否成功删除
   */
  removeDeviceFoundListener(callback: (devices: Device[]) => void): boolean {
    return this.deviceFoundCallbacks.delete(callback);
  }

  /**
   * 删除所有设备发现监听回调
   */
  removeAllDeviceFoundListeners(): void {
    this.deviceFoundCallbacks.clear();
  }

  /**
   * 解绑设备发现监听器（重置标志位，允许下次重新注册）
   * 仅在释放资源时调用
   */
  offDeviceFoundListener(): void {
    this.deviceFoundCallbacks.clear();
    this.isDeviceFoundListenerRegistered = false;
  }

  /**
   * 停止搜索蓝牙设备
   * @returns {Promise<any>} 结果
   * @throws {Error} 停止失败
   */
  async stopDeviceDiscovery() {
    try {
      console.log(`停止查找新设备...`);
      if (shouldSkipBLEApiCall("stopBluetoothDevicesDiscovery")) {
        this._foundDevList = [];
        return { success: true };
      }
      const res = await wx.stopBluetoothDevicesDiscovery();
      console.log(`停止查找设备成功！`);
      this._foundDevList = [];
      return res;
    } catch (err) {
      console.error(`停止查询设备失败！`, err);
      throw err;
    }
  }
}
