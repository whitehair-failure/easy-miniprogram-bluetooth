import errToString from "../utils/error";

/**
 * 蓝牙管理器类
 * 封装微信小程序蓝牙API，提供更简单的调用方式
 * 包含蓝牙设备的搜索、连接、数据通信等功能
 */
// No module-scoped UUID defaults: all service/characteristic ids must be
// provided by callers (BLEHandler) to keep BluetoothManager a pure utility layer.

// Helper to promisify wx APIs when needed
function promisify(fn: Function, args?: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      ...(args || {}),
      success: (res: any) => resolve(res),
      fail: (err: any) => reject(err),
    };
    fn(options);
  });
}

export async function getBLEDeviceRSSI(
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

export async function openBluetoothAdapter(
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

export async function startBluetoothDevicesDiscovery(
  options: WechatMiniprogram.StartBluetoothDevicesDiscoveryOption = {}
): Promise<[Error | null, object | null]> {
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

export function onBluetoothDeviceFound(
  callback: (devices: WechatMiniprogram.BlueToothDevice[]) => void
): void {
  console.log(`监听搜寻新设备事件...`);
  wx.onBluetoothDeviceFound((res) => {
    console.log(`已嗅探蓝牙设备数：${res.devices.length}...`);
    callback(res.devices);
  });
}

export async function stopBluetoothDevicesDiscovery(): Promise<[
  Error | null,
  WechatMiniprogram.BluetoothError | null
]> {
  console.log(`停止查找新设备...`);
  try {
    const res = (await wx.stopBluetoothDevicesDiscovery()) as WechatMiniprogram.BluetoothError;
    console.log(`✔ 停止查找设备成功！`);
    return [null, res];
  } catch (err: any) {
    console.log(`✘ 停止查询设备失败！${err}`);
    return [new Error(errToString(err)), null];
  }
}

export async function createBLEConnection(
  deviceId: string,
  timeout?: number
): Promise<[any | null, object | null]> {
  console.log(`准备连接设备...`);
  try {
    const res = await wx.createBLEConnection({ deviceId, timeout });
    console.log(`✔ 连接蓝牙成功！`);
    return [null, res];
  } catch (err) {
    console.log(`✘ 连接蓝牙失败！${errToString(err)}`);
    return [err, null];
  }
}

export async function closeBLEConnection(
  deviceId: string
): Promise<[Error | null, object | null]> {
  console.log(`断开蓝牙连接...`);
  try {
    const res = await wx.closeBLEConnection({ deviceId });
    console.log(`✔ 断开蓝牙成功！`);
    return [null, res];
  } catch (err) {
    console.log(`✘ 断开蓝牙连接失败！${errToString(err)}`);
    return [new Error(errToString(err)), null];
  }
}

export async function closeBluetoothAdapter(): Promise<[
  Error | null,
  WechatMiniprogram.BluetoothError | null
]> {
  console.log(`释放蓝牙适配器...`);
  try {
    const res = (await wx.closeBluetoothAdapter()) as WechatMiniprogram.BluetoothError;
    console.log(`✔ 释放适配器成功！`);
    return [null, res];
  } catch (err) {
    console.log(`✘ 释放适配器失败！${errToString(err)}`);
    return [new Error(errToString(err)), null];
  }
}

export function onBLEConnectionStateChange(
  callback: (devices: { deviceId: string; connected: boolean }) => void
): void {
  wx.onBLEConnectionStateChange((res) => {
    console.log("onBLEConnectionStateChange", res);
    callback(res);
  });
}

export function onBLECharacteristicValueChange(
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

export async function getBLEDeviceServices(
  deviceId: string
): Promise<[
  Error | null,
  WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult | null
]> {
  console.log(`获取蓝牙设备所有服务...`);
  try {
    const res = (await wx.getBLEDeviceServices({ deviceId })) as WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult;
    console.log(`✔ 获取service成功！`);
    console.log("service-res", res);
    return [null, res];
  } catch (err) {
    console.log(`✘ 获取service失败！${errToString(err)}`);
    return [new Error(errToString(err)), null];
  }
}

export async function getBLEDeviceCharacteristics(
  deviceId: string,
  serviceId: string
): Promise<[
  Error | null,
  WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult | null
]> {
  console.log(`开始获取特征值...`);
  try {
    const res = (await wx.getBLEDeviceCharacteristics({ deviceId, serviceId })) as WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult;
    console.log(`✔ 获取特征值成功！`);
    return [null, res];
  } catch (err) {
    console.log(`✘ 获取特征值失败！${errToString(err)}`);
    return [new Error(errToString(err)), null];
  }
}

export async function notifyBLECharacteristicValueChange(
  deviceId: string,
  serviceId: string,
  characteristicId: string,
  state: boolean = true,
  type: "notify" | "indicate" = "indicate"
): Promise<[Error | null, object | null]> {
  console.log(`准备订阅特征值变化...`);
  try {
    const res = await wx.notifyBLECharacteristicValueChange({ deviceId, serviceId, characteristicId, state, type });
    console.log(`✔ 订阅特征值成功！`);
    return [null, res];
  } catch (err) {
    console.log(`✘ 订阅特征值失败！${errToString(err)}`);
    return [new Error(errToString(err)), null];
  }
}

export async function writeBLECharacteristicValue({
  deviceId,
  value,
  serviceId,
  characteristicId,
  writeType,
}: WechatMiniprogram.WriteBLECharacteristicValueOption): Promise<[
  Error | null,
  object | null
]> {
  try {
    const res = await wx.writeBLECharacteristicValue({ deviceId, serviceId, characteristicId, value, writeType });
    console.log(`✔ 写入数据成功！`);
    return [null, res];
  } catch (err) {
    console.log(`✘ 写入数据失败！${errToString(err)}`);
    return [new Error(errToString(err)), null];
  }
}

export async function readBLECharacteristicValue({
  deviceId,
  serviceId,
  characteristicId,
}: WechatMiniprogram.ReadBLECharacteristicValueOption): Promise<[
  Error | null,
  object | null
]> {
  try {
    const res = await wx.readBLECharacteristicValue({ deviceId, serviceId, characteristicId });
    console.log(`✔ 读取数据成功！`);
    return [null, res];
  } catch (err) {
    console.log(`✘ 读取数据失败！${errToString(err)}`);
    return [new Error(errToString(err)), null];
  }
}

const BluetoothManager = {
  promisify,
  getBLEDeviceRSSI,
  openBluetoothAdapter,
  startBluetoothDevicesDiscovery,
  onBluetoothDeviceFound,
  stopBluetoothDevicesDiscovery,
  createBLEConnection,
  closeBLEConnection,
  closeBluetoothAdapter,
  onBLEConnectionStateChange,
  onBLECharacteristicValueChange,
  getBLEDeviceServices,
  getBLEDeviceCharacteristics,
  notifyBLECharacteristicValueChange,
  writeBLECharacteristicValue,
  readBLECharacteristicValue,
};

export default BluetoothManager;
