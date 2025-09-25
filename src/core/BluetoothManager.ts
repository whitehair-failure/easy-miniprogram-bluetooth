import errToString from "../utils/error";

interface Device extends WechatMiniprogram.BlueToothDevice {
  isConnect: boolean;
}

interface BluetoothManagerConfig {
  serviceUId?: string;
  writeCharacteristicId?: string;
  notifyCharacteristicId?: string;
}

interface WxApiCallback {
  success?: (res: WechatMiniprogram.GeneralCallbackResult) => void;
  fail?: (err: WechatMiniprogram.GeneralCallbackResult) => void;
  complete?: () => void;
  [key: string]: any;
}
// 首先添加一个类型定义来描述检查结果
interface CharacteristicCheckResult {
  success: boolean;
  missingCharacteristics?: string[];
}
/**
 * 蓝牙管理器类
 * 封装微信小程序蓝牙API，提供更简单的调用方式
 * 包含蓝牙设备的搜索、连接、数据通信等功能
 */
class BluetoothManager {
  private readCharacteristicId: string = "";
  private writeCharacteristicId: string;
  private notifyCharacteristicId: string;
  private serviceUId: string;

  /**
   * 初始化蓝牙管理器
   * @param {BluetoothManagerConfig} config 配置对象
   * @param {string} [config.serviceUId] 服务UUID，默认为"0000FFE0-0000-1000-8000-00805F9B34FB"
   * @param {string} [config.writeCharacteristicId] 写特征值UUID，默认为"0000FFE2-0000-1000-8000-00805F9B34FB"
   * @param {string} [config.notifyCharacteristicId] 通知特征值UUID，默认为"0000FFE1-0000-1000-8000-00805F9B34FB"
   */
  constructor(config: BluetoothManagerConfig) {
    this.serviceUId =
      config.serviceUId || "0000FFE0-0000-1000-8000-00805F9B34FB";
    this.writeCharacteristicId =
      config.writeCharacteristicId || "0000FFE2-0000-1000-8000-00805F9B34FB";
    this.notifyCharacteristicId =
      config.notifyCharacteristicId || "0000FFE1-0000-1000-8000-00805F9B34FB";
  }

  /**
   * 将微信API转换为Promise形式
   * @param {Function} fn 要转换的微信API函数
   * @param {Record<string, any>} [args] 函数参数
   * @returns {Promise<WechatMiniprogram.GeneralCallbackResult>} Promise化的API调用结果
   * @private
   */
  private promisify(fn: Function, args?: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        ...(args || {}),
        success: (res: any) => resolve(res),
        fail: (err: any) => reject(err),
      };
      fn(options);
    });
  }

  /**
   * 获取蓝牙设备信号强度
   * @param {string} deviceId 要获取信号强度的设备ID
   */
  public async getBLEDeviceRSSI(
    deviceId: string
  ): Promise<[Error | null, object | null]> {
    try {
      const res = await wx.getBLEDeviceRSSI({
        deviceId,
      });
      console.log(`✔ 获取信号强度成功!`);
      return [null, res];
    } catch (err: any) {
      console.log(`✘ 获取信号强度失败！${err}`);
      return [new Error(errToString(err)), null];
    }
  }

  /**
   * 初始化并打开蓝牙适配器
   * 如果蓝牙未开启或未授权，会显示对应的提示框
   * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
   * @returns {Error} 如果初始化失败，返回错误对象
   * @returns {object} 如果初始化成功，返回初始化结果
   */
  public async openAdapter(
    mode?: "central" | "peripheral"
  ): Promise<[any, object | null]> {
    console.log(`准备初始化蓝牙适配器...`);
    try {
      const res = await wx.openBluetoothAdapter({ mode });
      console.log(`✔ 适配器初始化成功！`);
      return [null, res];
    } catch (err: any) {
      console.log(`✘ 初始化失败！${errToString(err)}`);
      return [err, null];
    }
  }

  /**
   * 开始搜索附近的蓝牙设备
   * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
   * @returns {Error} 如果搜索失败，返回错误对象
   * @returns {object} 如果搜索成功，返回搜索结果
   */
  public async startSearch(options: WechatMiniprogram.StartBluetoothDevicesDiscoveryOption = {}): Promise<[Error | null, object | null]> {
    console.log(`准备搜寻附近的蓝牙外围设备...`);
    try {
      const res = await wx.startBluetoothDevicesDiscovery(options);
      console.log(`✔ 搜索成功!`);
      return [null, res];
    } catch (err: any) {
      console.log(`✘ 搜索蓝牙设备失败！${err}`);
      return [new Error(errToString(err)), null];
    }
  }

  /**
   * 监听发现新的蓝牙设备事件
   * @param {Function} callback 发现新设备时的回调函数
   * @param {WechatMiniprogram.BlueToothDevice[]} callback.devices 发现的蓝牙设备列表
   */
  public onBluetoothFound(
    callback: (devices: WechatMiniprogram.BlueToothDevice[]) => void
  ): void {
    console.log(`监听搜寻新设备事件...`);
    wx.onBluetoothDeviceFound((res) => {
      console.log(`已嗅探蓝牙设备数：${res.devices.length}...`);
      callback(res.devices);
    });
  }

  /**
   * 停止搜索蓝牙设备
   * @returns {Promise<[Error | null, WechatMiniprogram.BluetoothError | null]>} 返回错误对象和结果
   * @returns {Error} 如果停止搜索失败，返回错误对象
   * @returns {WechatMiniprogram.BluetoothError} 如果停止搜索成功，返回结果对象
   */
  public async stopSearch(): Promise<
    [Error | null, WechatMiniprogram.BluetoothError | null]
  > {
    console.log(`停止查找新设备...`);
    try {
      const res =
        (await wx.stopBluetoothDevicesDiscovery()) as WechatMiniprogram.BluetoothError;
      console.log(`✔ 停止查找设备成功！`);
      return [null, res];
    } catch (err: any) {
      console.log(`✘ 停止查询设备失败！${err}`);
      return [new Error(errToString(err)), null];
    }
  }

  /**
   * 连接指定的蓝牙设备
   * 连接成功后会自动设置最大传输单元(MTU)为71字节(仅安卓有效)
   * @param {string} deviceId 要连接的设备ID
   * @param {number} timeout 超时时间，单位 ms，不填表示不会超时
   * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
   * @returns {Error} 如果连接失败，返回错误对象
   * @returns {object} 如果连接成功，返回连接结果
   */
  public async connect(
    deviceId: string,
    timeout?: number
  ): Promise<[any | null, object | null]> {
    console.log(`准备连接设备...`);
    try {
      const res = await wx.createBLEConnection({ deviceId, timeout });

      console.log(`✔ 连接蓝牙成功！`);

      // 设置MTU (仅安卓有效)
      // wx.setBLEMTU({
      //   deviceId,
      //   mtu: 71,
      //   success: (res) =>
      //     console.log(`setBLEMTU success ${JSON.stringify(res)}`),
      //   fail: (err) => console.log(`setBLEMTU fail ${errToString(err)}`),
      // });

      return [null, res];
    } catch (err) {
      console.log(`✘ 连接蓝牙失败！${errToString(err)}`);
      return [err, null];
    }
  }

  /**
   * 断开与指定蓝牙设备的连接
   * @param {string} deviceId 要断开连接的设备ID
   * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
   * @returns {Error} 如果断开失败，返回错误对象
   * @returns {object} 如果断开成功，返回操作结果
   */
  public async disconnect(
    deviceId: string
  ): Promise<[Error | null, object | null]> {
    console.log(`断开蓝牙连接...`);
    try {
      const res = await wx.closeBLEConnection({
        deviceId,
      });
      console.log(`✔ 断开蓝牙成功！`);
      return [null, res];
    } catch (err) {
      console.log(`✘ 断开蓝牙连接失败！${errToString(err)}`);
      return [new Error(errToString(err)), null];
    }
  }

  /**
   * 关闭蓝牙适配器，释放资源
   * @returns {Promise<[Error | null, WechatMiniprogram.BluetoothError | null]>} 返回错误对象和结果
   * @returns {Error} 如果关闭失败，返回错误对象
   * @returns {WechatMiniprogram.BluetoothError} 如果关闭成功，返回操作结果
   */
  public async closeAdapter(): Promise<
    [Error | null, WechatMiniprogram.BluetoothError | null]
  > {
    console.log(`释放蓝牙适配器...`);
    try {
      const res =
        (await wx.closeBluetoothAdapter()) as WechatMiniprogram.BluetoothError;
      console.log(`✔ 释放适配器成功！`);
      return [null, res];
    } catch (err) {
      console.log(`✘ 释放适配器失败！${errToString(err)}`);
      return [new Error(errToString(err)), null];
    }
  }

  /**
   * 蓝牙适配器连接状态监听
   * @param {Function} callback 连接状态变化的回调函数
   * @param {Object} callback.devices 连接状态信息
   * @param {string} callback.devices.deviceId 发生连接状态变化的设备ID
   * @param {boolean} callback.devices.connected 当前的连接状态
   */
  public onBLEConnectionStateChange(
    callback: (devices: { deviceId: string; connected: boolean }) => void
  ): void {
    wx.onBLEConnectionStateChange((res) => {
      console.log("onBLEConnectionStateChange", res);
      callback(res);
    });
  }

  /**
   * 蓝牙适配器特征值变化状态监听
   * @param {Function} callback 特征值变化的回调函数
   * @param {Object} callback.devices 特征值信息
   * @param {string} callback.devices.deviceId 发生特征值变化的设备ID
   * @param {string} callback.devices.serviceId 服务UUID
   * @param {string} callback.devices.characteristicId 特征值UUID
   * @param {ArrayBuffer} callback.devices.value 特征值最新的值
   */
  public onBLECharacteristicValueChange(
    callback: (devices: {
      deviceId: string;
      serviceId: string;
      characteristicId: string;
      value: ArrayBuffer;
    }) => void
  ): void {
    wx.onBLECharacteristicValueChange((res) => {
      console.log("onBLECharacteristicValueChange", res);
      callback(res);
    });
  }

  /**
   * 获取蓝牙设备的所有服务
   * @param {string} deviceId 蓝牙设备ID
   * @returns {Promise<[Error | null, WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult | null]>} 返回错误对象和服务列表
   * @returns {Error} 如果获取失败，返回错误对象
   * @returns {WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult} 如果获取成功，返回服务列表
   */
  public async getServices(
    deviceId: string
  ): Promise<
    [
      Error | null,
      WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult | null
    ]
  > {
    console.log(`获取蓝牙设备所有服务...`);
    try {
      const res = (await wx.getBLEDeviceServices({
        deviceId,
      })) as WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult;
      console.log(`✔ 获取service成功！`);
      console.log("service-res", res);
      console.log("this.serviceUId", this.serviceUId);

      return [null, res];
    } catch (err) {
      console.log(`✘ 获取service失败！${errToString(err)}`);
      return [new Error(errToString(err)), null];
    }
  }

  /**
   * 获取蓝牙设备某个服务下的所有特征值
   * @param {string} deviceId 蓝牙设备ID
   * @param {string} [serviceId] 服务UUID，默认使用初始化时配置的serviceUId
   * @returns {Promise<[Error | null, WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult | null]>} 返回错误对象和特征值列表
   * @returns {Error} 如果获取失败，返回错误对象
   * @returns {WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult} 如果获取成功，返回特征值列表
   */
  public async getCharacteristics(
    deviceId: string,
    serviceId: string = this.serviceUId
  ): Promise<
    [
      Error | null,
      WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult | null
    ]
  > {
    console.log(`开始获取特征值...`);
    try {
      const res = (await wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
      })) as WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult;

      console.log(`✔ 获取特征值成功！`);

      return [null, res];
    } catch (err) {
      console.log(`✘ 获取特征值失败！${errToString(err)}`);
      return [new Error(errToString(err)), null];
    }
  }

  /**
   * 启用低功耗蓝牙设备特征值变化时的notify功能
   * @param {string} deviceId 蓝牙设备ID
   * @param {string} [serviceId] 服务UUID，默认使用初始化时配置的serviceUId
   * @param {string} [characteristicId] 特征值UUID，默认使用初始化时配置的notifyCharacteristicId
   * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
   * @returns {Error} 如果启用失败，返回错误对象
   * @returns {object} 如果启用成功，返回操作结果
   */
  public async notifyCharacteristicValueChange(
    deviceId: string,
    serviceId: string = this.serviceUId,
    characteristicId: string = this.notifyCharacteristicId
  ): Promise<[Error | null, object | null]> {
    console.log(`准备订阅特征值变化...`);
    try {
      const res = await wx.notifyBLECharacteristicValueChange({
        deviceId,
        serviceId,
        characteristicId,
        state: true,
      });
      console.log(`✔ 订阅特征值成功！`);
      return [null, res];
    } catch (err) {
      console.log(`✘ 订阅特征值失败！${errToString(err)}`);
      return [new Error(errToString(err)), null];
    }
  }

  /**
   * 向蓝牙设备特征值写入数据
   * @param {string} deviceId 蓝牙设备ID
   * @param {ArrayBuffer} value 要写入的数据
   * @param {string} [serviceId] 服务UUID，默认使用初始化时配置的serviceUId
   * @param {string} [characteristicId] 特征值UUID，默认使用初始化时配置的writeCharacteristicId
   * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
   * @returns {Error} 如果写入失败，返回错误对象
   * @returns {object} 如果写入成功，返回操作结果
   */
  public async writeCharacteristicValue(
    deviceId: string,
    value: ArrayBuffer,
    serviceId: string = this.serviceUId,
    characteristicId: string = this.writeCharacteristicId,
    writeType?: "write" | "writeNoResponse"
  ): Promise<[Error | null, object | null]> {
    try {
      const res = await wx.writeBLECharacteristicValue({
        deviceId,
        serviceId,
        characteristicId,
        value,
        writeType,
      });
      console.log(`✔ 写入数据成功！`);
      return [null, res];
    } catch (err) {
      console.log(`✘ 写入数据失败！${errToString(err)}`);
      return [new Error(errToString(err)), null];
    }
  }
}

export default BluetoothManager;
