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
    isReConnect?: boolean;
    reconnectDelay?: number;
    mode?: "single" | "multiple";
}
interface ConnectionStateCallbacks {
    callback?: (devices: WechatMiniprogram.OnBLEConnectionStateChangeListenerResult) => void;
    connected?: (deviceId: string) => void;
    disconnected?: (deviceId: string) => void;
}
interface CharacteristicCheckResult {
    success: boolean;
    missingCharacteristics?: string[];
}
/**
 * 蓝牙工具类
 * 封装小程序蓝牙流程方法
 * 处理事件通信
 */
export declare class BLEHandler {
    private readonly mode;
    private readonly bluetoothManager;
    readonly filterKey?: string[];
    readonly isReConnect: boolean;
    readonly reconnectDelay: number;
    foundDevList: Device[];
    historyDevList: Device[];
    connectedDevList: Device[];
    readonly config: BLEHandlerConfig;
    get connectedDev(): Device | undefined;
    /**
     * 初始化蓝牙工具类实例
     * @param {BLEHandlerConstructor} options 配置选项
     * @param {BLEHandlerConfig} options.config 蓝牙特征值配置
     * @param {string[]} [options.filterKey] 设备名称过滤关键字
     * @param {boolean} [options.isReConnect] 设备断开是否自动重连
     * @param {number} [options.reconnectDelay] 自动重连延时(毫秒)
     * @param {"single" | "multiple"} [options.mode] 连接模式：单设备/多设备
     */
    constructor(options: BLEHandlerConstructor);
    /**
     * 初始化并打开蓝牙适配器
     * @returns {Promise<boolean>} 是否成功打开适配器
     */
    openBLEAdapter(): Promise<boolean>;
    /**
     * 开始搜索蓝牙设备
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    startSearchBLE(): Promise<(object | null)[]>;
    /**
     * 监听发现新蓝牙设备事件
     * @param {function} [callback] 发现实时设备时的回调函数
     */
    onBluetoothFound(callback?: (devices: Device[]) => void): void;
    /**
     * 停止搜索蓝牙设备
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    stopSearchBLE(): Promise<(Error | WechatMiniprogram.BluetoothError | null)[]>;
    /**
     * 连接指定的蓝牙设备
     * @param {Device} dev 要连接的蓝牙设备对象
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    connectBLE(dev: Device): Promise<(object | null)[]>;
    /**
     * 蓝牙适配器连接状态监听
     * @param {ConnectionStateCallbacks} [callbacks] 设备状态变化时的回调函数
     */
    onBLEConnectionStateChange(callbacks?: ConnectionStateCallbacks): void;
    /**
     * 断开与指定设备的蓝牙连接
     * @param {string} deviceId 设备ID
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    disconnectBLE(deviceId: string): Promise<(object | null)[]>;
    /**
     * 获取蓝牙设备的所有服务
     * @param {string} deviceId 设备ID
     * @returns {Promise<WechatMiniprogram.BLEService[] | undefined>} 服务列表
     */
    getBLEServices(deviceId: string): Promise<(Error | WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult | null)[]>;
    /**
     * 获取蓝牙设备某个服务的所有特征值
     * @param {string} deviceId 设备ID
     * @returns {Promise<WechatMiniprogram.BLECharacteristic[] | undefined>} 特征值列表
     */
    getCharacteristics(deviceId: string, serviceId?: string): Promise<(Error | WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult | null)[]>;
    /**
     * 检查蓝牙设备的服务是否拥有已设置的特征值
     * @param {string} deviceId 设备ID
     * @returns {Promise<WechatMiniprogram.BLECharacteristic[] | undefined>} 特征值列表
     */
    checkCharacteristics(deviceId: string, serviceId?: string): Promise<(CharacteristicCheckResult | Error | null)[]>;
    /**
     * 启用蓝牙设备特征值变化的通知功能
     * @param {string} deviceId 设备ID
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    notifyBLECharacteristicValueChange(deviceId: string, serviceId?: string, characteristicId?: string): Promise<(object | null)[]>;
    /**
     * 监听蓝牙设备特征值变化
     * @param {function} callback 特征值变化时的回调函数
     * @param {Object} callback.result 特征值变化结果
     * @param {string} callback.result.deviceId 发生特征值变化的设备ID
     * @param {string} callback.result.serviceId 服务UUID
     * @param {string} callback.result.characteristicId 特征值UUID
     * @param {ArrayBuffer} callback.result.value 特征值最新的值
     */
    onBLECharacteristicValueChange(callback?: (result: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult) => void): void;
    /**
     * 关闭蓝牙适配器
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    closeBLEAdapter(): Promise<(Error | WechatMiniprogram.BluetoothError | null)[]>;
    /**
     * 发送Modbus协议数据帧
     * @param {string} deviceId 设备ID
     * @param {ArrayBuffer} frame 数据帧
     * @returns {Promise<boolean>} 是否发送成功
     * @example
     * let data = [0x01,0x06,0x02,0x04,0x0B,0xB8,0xF1,0xCE]
     * let arrayBuffer = new Uint8Array(data).buffer
     */
    sentMoubusFrame(deviceId: string, frame: ArrayBuffer): Promise<(object | null)[]>;
    release(callback?: () => void): Promise<void>;
    /**
     * 初始化蓝牙功能
     * @param {function} [bleFoundCallback] 发现设备时的回调函数
     */
    init(bleFoundCallback?: (devices: Device[]) => void): Promise<void>;
}
export {};
