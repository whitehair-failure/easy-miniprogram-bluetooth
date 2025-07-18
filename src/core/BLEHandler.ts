import BluetoothManager from "./BluetoothManager";
/* import * as comm from "./utils/comm"
import * as ModbusRtu from "./utils/modbus/modebusRtu" */

interface Device extends WechatMiniprogram.BlueToothDevice {
  isConnect: boolean;
  isReConnect?: boolean;
}

interface BLEHandlerConfig {
  writeCharacteristicId?: string;
  notifyCharacteristicId?: string;
  serviceUId?: string;
}

interface BLEHandlerConstructor {
  config: BLEHandlerConfig;
  filterKey?: string[];
  isReConnect?: boolean; // 设备异常断开是否自动重连
  reconnectDelay?: number; // 自动重连延时，单位毫秒
  mode?: "single" | "multiple";
}
interface ConnectionStateCallbacks {
  callback?: (
    devices: WechatMiniprogram.OnBLEConnectionStateChangeListenerResult
  ) => void;
  connected?: (deviceId: string) => void;
  disconnected?: (deviceId: string) => void;
}

// 首先添加一个类型定义来描述检查结果
interface CharacteristicCheckResult {
  success: boolean;
  missingCharacteristics?: string[];
}
/**
 * 蓝牙工具类
 * 封装小程序蓝牙流程方法
 * 处理事件通信
 */
export class BLEHandler {
  private readonly mode: "single" | "multiple";

  private readonly bluetoothManager: BluetoothManager;

  public readonly filterKey?: string[] = []; // 过滤关键字
  public readonly isReConnect: boolean = false; // 设备异常断开是否自动重连
  public readonly reconnectDelay: number = 1000; // 自动重连延时，单位毫秒

  public foundDevList: Device[] = []; // 已找到的设备列表
  public historyDevList: Device[] = []; // 已找到的设备的历史列表
  public connectedDevList: Device[] = []; // 已连接的设备列表

  // 蓝牙默认配置
  public readonly config: BLEHandlerConfig = {
    serviceUId: "", // 蓝牙服务的UUID
    writeCharacteristicId: "", // 写特征值的UUID
    notifyCharacteristicId: "", // 通知特征值的UUID
  };

  // 当前连接的设备
  // 注意：如果是单设备模式，这个属性会被覆盖为当前连接的设备
  // 如果是多设备模式，这个属性会返回第一个设备
  get connectedDev(): Device | undefined {
    return this.connectedDevList[0];
  }

  // private deviceId: string | null;
  // private dev: Device | null;

  /**
   * 初始化蓝牙工具类实例
   * @param {BLEHandlerConstructor} options 配置选项
   * @param {BLEHandlerConfig} options.config 蓝牙特征值配置
   * @param {string[]} [options.filterKey] 设备名称过滤关键字
   * @param {boolean} [options.isReConnect] 设备断开是否自动重连
   * @param {number} [options.reconnectDelay] 自动重连延时(毫秒)
   * @param {"single" | "multiple"} [options.mode] 连接模式：单设备/多设备
   */
  constructor(options: BLEHandlerConstructor) {
    this.mode = options.mode || "single"; // 默认单设备模式
    this.filterKey = options.filterKey;
    this.isReConnect = options.isReConnect || false; // 默认不自动重连
    this.reconnectDelay = options.reconnectDelay || 1000; // 默认1秒重连

    this.config = options.config;

    this.bluetoothManager = new BluetoothManager({
      writeCharacteristicId: options.config.writeCharacteristicId,
      notifyCharacteristicId: options.config.notifyCharacteristicId,
      serviceUId: options.config.serviceUId,
    });
  }

  /**
   * 初始化并打开蓝牙适配器
   * @returns {Promise<boolean>} 是否成功打开适配器
   */
  async openBLEAdapter() {
    let [err, res] = await this.bluetoothManager.openAdapter();

    if (err != null) {
      // 如果打开适配器失败，提示用户检查权限或蓝牙状态
      setTimeout(() => {
        if (err?.errno === 103) {
          wx.showModal({
            title: "请检查是否已授权小程序蓝牙权限",
            showCancel: false,
            success: (res) => {
              if (res.confirm) {
                this.openBLEAdapter();
              }
            },
          });
        }
        if (err?.errno === 1500102) {
          wx.showModal({
            title: "请检查蓝牙是否开启",
            showCancel: false,
            success: (res) => {
              if (res.confirm) {
                this.openBLEAdapter();
              }
            },
          });
        }
      }, 1000);

      console.error("openAdapter", err);
      return false;
    }
    return true;
  }

  /**
   * 开始搜索蓝牙设备
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async startSearchBLE() {
    let [err, res] = await this.bluetoothManager.startSearch();
    return [err, res];
  }

  /**
   * 监听发现新蓝牙设备事件
   * @param {function} [callback] 发现实时设备时的回调函数
   */
  onBluetoothFound(callback?: (devices: Device[]) => void) {
    wx.onBluetoothDeviceFound((res) => {
      // console.log("this.filterKey", this.filterKey);
      // console.log("res.devices", res.devices);

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
            isReConnect: this.isReConnect,
            isConnect: false,
          });
        }

        if (
          isTarget &&
          !this.foundDevList.find((d) => d.deviceId === device.deviceId)
        ) {
          // console.log("找到设备", device);

          this.foundDevList.push({
            ...device,
            isReConnect: this.isReConnect,
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
          isReConnect: this.isReConnect,
          isConnect: false, // 初始状态为未连接
        }));

        callback(realTimeDevices);
      }
    });
  }

  /**
   * 停止搜索蓝牙设备
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async stopSearchBLE() {
    let [err, res] = await this.bluetoothManager.stopSearch();

    if (!err) {
      this.foundDevList = [];
    }

    return [err, res];
  }

  /**
   * 连接指定的蓝牙设备
   * @param {Device} dev 要连接的蓝牙设备对象
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async connectBLE(dev: Device) {
    if (this.mode === "single" && this.connectedDevList.length > 0) {
      // 如果是单设备模式，先断开当前连接的设备
      let [disErr, disRes] = await this.disconnectBLE(
        this.connectedDev?.deviceId || ""
      ); // 断开当前连接的设备
      // 如果断开连接失败，返回错误
      if (disErr || !disRes) {
        return [disErr, null];
      }
    }

    let [err, res] = await this.bluetoothManager.connect(dev.deviceId);
    if (!err) {
      if (this.mode === "single") {
        // 如果是单设备模式，清空已连接设备列表
        this.connectedDevList = [];
        this.connectedDevList.push(dev);
      } else {
        let index = this.connectedDevList.findIndex(
          (d) => d.deviceId === dev.deviceId
        );
        if (index === -1) {
          this.connectedDevList.push(dev);
        }
      }
    }
    return [err, res];
  }

  /**
   * 蓝牙适配器连接状态监听
   * @param {ConnectionStateCallbacks} [callbacks] 设备状态变化时的回调函数
   */
  onBLEConnectionStateChange(callbacks?: ConnectionStateCallbacks): void {
    wx.onBLEConnectionStateChange((res) => {
      console.log("onBLEConnectionStateChange", res);

      // 自动重连
      if (!res.connected) {
        let index = this.connectedDevList.findIndex(
          (d) => d.deviceId === res.deviceId
        );

        if (index === -1) {
          console.warn(`Device ${res.deviceId} not found in connected list`);
          return;
        }

        let curDev = this.connectedDevList[index];

        // 如果是异常断开的设备，尝试重新连接
        if (curDev?.isReConnect) {
          setTimeout(() => {
            this.connectBLE(curDev);
          }, this.reconnectDelay);
        } else {
          this.connectedDevList.splice(index, 1);
        }
      }

      if (callbacks) {
        // 使用可选链操作符进行安全调用
        if (res.connected) {
          callbacks?.connected?.(res.deviceId);
        } else {
          callbacks?.disconnected?.(res.deviceId);
        }

        callbacks?.callback?.(res);
      }
    });
  }

  /**
   * 断开与指定设备的蓝牙连接
   * @param {string} deviceId 设备ID
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async disconnectBLE(deviceId: string) {
    let index = this.connectedDevList.findIndex((d) => d.deviceId === deviceId);
    if (index === -1) {
      console.warn(`Device ${deviceId} not found in connected list`);
      return [
        new Error(`Device ${deviceId} not found in connected list`),
        null,
      ];
    }
    this.connectedDevList[index].isReConnect = false; // 取消自动连接

    let [err, res] = await this.bluetoothManager.disconnect(deviceId);

    // 如果是单设备模式，清空已连接设备列表
    if (this.mode === "single" && !err) {
      this.connectedDevList = [];
    }

    return [err, res];
  }

  /**
   * 获取蓝牙设备的所有服务
   * @param {string} deviceId 设备ID
   * @returns {Promise<WechatMiniprogram.BLEService[] | undefined>} 服务列表
   */
  async getBLEServices(deviceId: string) {
    let [err, res] = await this.bluetoothManager.getServices(deviceId);
    return [err, res];
  }

  /**
   * 获取蓝牙设备某个服务的所有特征值
   * @param {string} deviceId 设备ID
   * @returns {Promise<WechatMiniprogram.BLECharacteristic[] | undefined>} 特征值列表
   */
  async getCharacteristics(deviceId: string, serviceId?: string) {
    let [err, res] = await this.bluetoothManager.getCharacteristics(
      deviceId,
      serviceId
    );
    return [err, res];
  }

  /**
   * 检查蓝牙设备的服务是否拥有已设置的特征值
   * @param {string} deviceId 设备ID
   * @returns {Promise<WechatMiniprogram.BLECharacteristic[] | undefined>} 特征值列表
   */
  async checkCharacteristics(deviceId: string, serviceId?: string) {
    let [err, res] = await this.bluetoothManager.getCharacteristics(
      deviceId,
      serviceId
    );

    // 存储缺失的特征值ID
    const missingCharacteristics: string[] = [];

    // 检查写特征值
    if (
      !this.config.writeCharacteristicId ||
      !res?.characteristics.some(
        (c) => c.uuid === this.config.writeCharacteristicId
      )
    ) {
      missingCharacteristics.push("writeCharacteristicId");
    }

    // 检查通知特征值
    if (
      !this.config.notifyCharacteristicId ||
      !res?.characteristics.some(
        (c) => c.uuid === this.config.notifyCharacteristicId
      )
    ) {
      missingCharacteristics.push("notifyCharacteristicId");
    }

    // 构造返回结果
    const result: CharacteristicCheckResult = {
      success: missingCharacteristics.length === 0,
    };

    // 如果有缺失的特征值，添加到结果中
    if (missingCharacteristics.length > 0) {
      result.missingCharacteristics = missingCharacteristics;
      console.warn(`缺失以下特征值: ${missingCharacteristics.join(", ")}`);
    }

    return [err, result];
  }

  /**
   * 启用蓝牙设备特征值变化的通知功能
   * @param {string} deviceId 设备ID
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async notifyBLECharacteristicValueChange(
    deviceId: string,
    serviceId?: string,
    characteristicId?: string
  ) {
    let [err, res] =
      await this.bluetoothManager.notifyCharacteristicValueChange(
        deviceId,
        serviceId,
        characteristicId
      );
    return [err, res];
  }

  /**
   * 监听蓝牙设备特征值变化
   * @param {function} callback 特征值变化时的回调函数
   * @param {Object} callback.result 特征值变化结果
   * @param {string} callback.result.deviceId 发生特征值变化的设备ID
   * @param {string} callback.result.serviceId 服务UUID
   * @param {string} callback.result.characteristicId 特征值UUID
   * @param {ArrayBuffer} callback.result.value 特征值最新的值
   */
  onBLECharacteristicValueChange(
    callback?: (
      result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult
    ) => void
  ): void {
    wx.onBLECharacteristicValueChange((res) => {
      // 将 ArrayBuffer 转换为 Uint8Array，方便处理二进制数据
      const buffer = new Uint8Array(res.value);
      console.log("Characteristic value changed:", {
        deviceId: res.deviceId,
        serviceId: res.serviceId,
        characteristicId: res.characteristicId,
        value: Array.from(buffer), // 转换为普通数组以便打印
      });

      if (callback) {
        callback(res);
      }
    });
  }

  /**
   * 关闭蓝牙适配器
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async closeBLEAdapter() {
    let [err, res] = await this.bluetoothManager.closeAdapter();
    return [err, res];
  }

  /**
   * 发送Modbus协议数据帧
   * @param {string} deviceId 设备ID
   * @param {ArrayBuffer} frame 数据帧
   * @returns {Promise<boolean>} 是否发送成功
   * @example
   * let data = [0x01,0x06,0x02,0x04,0x0B,0xB8,0xF1,0xCE]
   * let arrayBuffer = new Uint8Array(data).buffer
   */
  async sentFrame(deviceId: string, frame: ArrayBuffer) {
    let [err, res] = await this.bluetoothManager.writeCharacteristicValue(
      deviceId,
      frame
    );  
    return [err, res];
  }

  async release(callback?: () => void) {
    // 断开所有连接的设备
    for (let dev of this.connectedDevList) {
      let [disErr, disRes] = await this.disconnectBLE(dev.deviceId);
      // 如果断开连接失败，返回错误
      if (disErr || !disRes) {
        console.error(`Failed to disconnect device ${dev.deviceId}:`, disErr);
      }
    }
    wx.offBLEConnectionStateChange();
    wx.offBLECharacteristicValueChange();
    await this.closeBLEAdapter();
    if (callback) callback();
  }

  /**
   * 初始化蓝牙功能
   * @param {function} [bleFoundCallback] 发现设备时的回调函数
   */
  async init(
    bleFoundCallback?: (devices: Device[]) => void
    // callback?: (devices: { deviceId: string; connected: boolean }) => void
  ) {
    // 蓝牙适配器初始化
    await this.openBLEAdapter();
    this.onBLEConnectionStateChange();

    if (bleFoundCallback) {
      // 搜索蓝牙设备
      await this.startSearchBLE();
      // 获取设备ID
      await this.onBluetoothFound(bleFoundCallback);

      // this.onBLEConnectionStateChange();
    }

    // if (callback) {
    //   this.bluetoothManager.onBLEConnectionStateChange(callback);
    // }
  }
}

// export default BLEHandler;
