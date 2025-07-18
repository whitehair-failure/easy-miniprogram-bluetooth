interface BluetoothManagerConfig {
    serviceUId?: string;
    writeCharacteristicId?: string;
    notifyCharacteristicId?: string;
}
/**
 * 蓝牙管理器类
 * 封装微信小程序蓝牙API，提供更简单的调用方式
 * 包含蓝牙设备的搜索、连接、数据通信等功能
 */
export declare class BluetoothManager {
    private readCharacteristicId;
    private writeCharacteristicId;
    private notifyCharacteristicId;
    private serviceUId;
    /**
     * 初始化蓝牙管理器
     * @param {BluetoothManagerConfig} config 配置对象
     * @param {string} [config.serviceUId] 服务UUID，默认为"0000FFE0-0000-1000-8000-00805F9B34FB"
     * @param {string} [config.writeCharacteristicId] 写特征值UUID，默认为"0000FFE2-0000-1000-8000-00805F9B34FB"
     * @param {string} [config.notifyCharacteristicId] 通知特征值UUID，默认为"0000FFE1-0000-1000-8000-00805F9B34FB"
     */
    constructor(config: BluetoothManagerConfig);
    /**
     * 将微信API转换为Promise形式
     * @param {Function} fn 要转换的微信API函数
     * @param {Record<string, any>} [args] 函数参数
     * @returns {Promise<WechatMiniprogram.GeneralCallbackResult>} Promise化的API调用结果
     * @private
     */
    private promisify;
    /**
     * 初始化并打开蓝牙适配器
     * 如果蓝牙未开启或未授权，会显示对应的提示框
     * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
     * @returns {Error} 如果初始化失败，返回错误对象
     * @returns {object} 如果初始化成功，返回初始化结果
     */
    openAdapter(): Promise<[Error | null, object | null]>;
    /**
     * 开始搜索附近的蓝牙设备
     * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
     * @returns {Error} 如果搜索失败，返回错误对象
     * @returns {object} 如果搜索成功，返回搜索结果
     */
    startSearch(): Promise<[Error | null, object | null]>;
    /**
     * 监听发现新的蓝牙设备事件
     * @param {Function} callback 发现新设备时的回调函数
     * @param {WechatMiniprogram.BlueToothDevice[]} callback.devices 发现的蓝牙设备列表
     */
    onBluetoothFound(callback: (devices: WechatMiniprogram.BlueToothDevice[]) => void): void;
    /**
     * 停止搜索蓝牙设备
     * @returns {Promise<[Error | null, WechatMiniprogram.BluetoothError | null]>} 返回错误对象和结果
     * @returns {Error} 如果停止搜索失败，返回错误对象
     * @returns {WechatMiniprogram.BluetoothError} 如果停止搜索成功，返回结果对象
     */
    stopSearch(): Promise<[
        Error | null,
        WechatMiniprogram.BluetoothError | null
    ]>;
    /**
     * 连接指定的蓝牙设备
     * 连接成功后会自动设置最大传输单元(MTU)为71字节(仅安卓有效)
     * @param {string} deviceId 要连接的设备ID
     * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
     * @returns {Error} 如果连接失败，返回错误对象
     * @returns {object} 如果连接成功，返回连接结果
     */
    connect(deviceId: string): Promise<[Error | null, object | null]>;
    /**
     * 断开与指定蓝牙设备的连接
     * @param {string} deviceId 要断开连接的设备ID
     * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
     * @returns {Error} 如果断开失败，返回错误对象
     * @returns {object} 如果断开成功，返回操作结果
     */
    disconnect(deviceId: string): Promise<[Error | null, object | null]>;
    /**
     * 关闭蓝牙适配器，释放资源
     * @returns {Promise<[Error | null, WechatMiniprogram.BluetoothError | null]>} 返回错误对象和结果
     * @returns {Error} 如果关闭失败，返回错误对象
     * @returns {WechatMiniprogram.BluetoothError} 如果关闭成功，返回操作结果
     */
    closeAdapter(): Promise<[
        Error | null,
        WechatMiniprogram.BluetoothError | null
    ]>;
    /**
     * 蓝牙适配器连接状态监听
     * @param {Function} callback 连接状态变化的回调函数
     * @param {Object} callback.devices 连接状态信息
     * @param {string} callback.devices.deviceId 发生连接状态变化的设备ID
     * @param {boolean} callback.devices.connected 当前的连接状态
     */
    onBLEConnectionStateChange(callback: (devices: {
        deviceId: string;
        connected: boolean;
    }) => void): void;
    /**
     * 蓝牙适配器特征值变化状态监听
     * @param {Function} callback 特征值变化的回调函数
     * @param {Object} callback.devices 特征值信息
     * @param {string} callback.devices.deviceId 发生特征值变化的设备ID
     * @param {string} callback.devices.serviceId 服务UUID
     * @param {string} callback.devices.characteristicId 特征值UUID
     * @param {ArrayBuffer} callback.devices.value 特征值最新的值
     */
    onBLECharacteristicValueChange(callback: (devices: {
        deviceId: string;
        serviceId: string;
        characteristicId: string;
        value: ArrayBuffer;
    }) => void): void;
    /**
     * 获取蓝牙设备的所有服务
     * @param {string} deviceId 蓝牙设备ID
     * @returns {Promise<[Error | null, WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult | null]>} 返回错误对象和服务列表
     * @returns {Error} 如果获取失败，返回错误对象
     * @returns {WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult} 如果获取成功，返回服务列表
     */
    getServices(deviceId: string): Promise<[
        Error | null,
        WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult | null
    ]>;
    /**
     * 获取蓝牙设备某个服务下的所有特征值
     * @param {string} deviceId 蓝牙设备ID
     * @param {string} [serviceId] 服务UUID，默认使用初始化时配置的serviceUId
     * @returns {Promise<[Error | null, WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult | null]>} 返回错误对象和特征值列表
     * @returns {Error} 如果获取失败，返回错误对象
     * @returns {WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult} 如果获取成功，返回特征值列表
     */
    getCharacteristics(deviceId: string, serviceId?: string): Promise<[
        Error | null,
        WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult | null
    ]>;
    /**
     * 启用低功耗蓝牙设备特征值变化时的notify功能
     * @param {string} deviceId 蓝牙设备ID
     * @param {string} [serviceId] 服务UUID，默认使用初始化时配置的serviceUId
     * @param {string} [characteristicId] 特征值UUID，默认使用初始化时配置的notifyCharacteristicId
     * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
     * @returns {Error} 如果启用失败，返回错误对象
     * @returns {object} 如果启用成功，返回操作结果
     */
    notifyCharacteristicValueChange(deviceId: string, serviceId?: string, characteristicId?: string): Promise<[Error | null, object | null]>;
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
    writeCharacteristicValue(deviceId: string, value: ArrayBuffer, serviceId?: string, characteristicId?: string): Promise<[Error | null, object | null]>;
}
export {};
