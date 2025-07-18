declare function _getSetting(): Promise<any[] | (object | null)[]>;
declare function _authorizeBle(): Promise<any[] | (object | null)[]>;
interface device {
    deviceId: string;
    serviceUId: string;
    writeCharacteristicId: string;
    [property: string]: any;
}
/**
 * 初始化蓝牙适配器
 * @returns Promise<[Error | null, object | null]>
 */
declare function _openAdapter(): Promise<[string | null, object | null]>;
/**
 * @param {Array<string>} services
 * @param { Int } interval
 */
declare function _startSearch(): Promise<(object | null)[] | (string | null)[]>;
/**
 *@param {Array<string>} devices
 *@deviceId 设备ID
 */
declare function _onBluetoothFound(this: device, callback: Function): void;
declare function _stopSearchBluetooth(): Promise<(string | null)[] | (WechatMiniprogram.BluetoothError | null)[]>;
declare function _connectBlue(dev: device): Promise<any[] | (object | null)[]>;
declare function _closeBLEConnection(this: device): Promise<(object | null)[] | (string | null)[]>;
declare function _closeBLEAdapter(): Promise<(string | null)[] | (WechatMiniprogram.BluetoothError | null)[]>;
declare function _getBLEServices(this: device): Promise<(object | null)[] | (string | null)[]>;
declare function _getCharacteristics(this: device): Promise<any[] | (string | null)[]>;
declare function _notifyBLECharacteristicValueChange(this: device): Promise<(object | null)[] | (string | null)[]>;
/**
 * 写入蓝牙特征值
 * @param arrayBuffer 要写入的二进制数据
 * @returns Promise<[Error | null, WechatMiniprogram.BluetoothError | null]>
 */
declare function _writeBLECharacteristicValue(this: device, arrayBuffer: ArrayBuffer): Promise<[Error | null, object | null]>;
/**
 * 对微信接口的promise封装
 * @param fn 微信API函数
 * @param args 调用参数
 * @returns Promise 包装后的Promise对象
 */
declare function promisify(fn: (options: any) => void, args?: Record<string, any>): Promise<object>;
/**
 * 对微信接口回调函数的封装
 * @param {function} fn
 */
declare function delay(method: Function, delay?: number): Promise<void>;
declare function print(str: string): void;
/**
 * 观察者模式的封装函数
 * @param {function} fn
 * @param {callback} fn
 */
export { print, _getSetting, _authorizeBle, _getCharacteristics, _connectBlue, _getBLEServices, _closeBLEConnection, _closeBLEAdapter, _stopSearchBluetooth, _notifyBLECharacteristicValueChange, _onBluetoothFound, _startSearch, _openAdapter, _writeBLECharacteristicValue, promisify, delay };
