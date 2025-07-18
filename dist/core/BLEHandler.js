var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import BluetoothManager from "./BluetoothManager";
/**
 * 蓝牙工具类
 * 封装小程序蓝牙流程方法
 * 处理事件通信
 */
var BLEHandler = /** @class */ (function () {
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
    function BLEHandler(options) {
        this.filterKey = []; // 过滤关键字
        this.isReConnect = false; // 设备异常断开是否自动重连
        this.reconnectDelay = 1000; // 自动重连延时，单位毫秒
        this.foundDevList = []; // 已找到的设备列表
        this.historyDevList = []; // 已找到的设备的历史列表
        this.connectedDevList = []; // 已连接的设备列表
        // 蓝牙默认配置
        this.config = {
            serviceUId: "", // 蓝牙服务的UUID
            writeCharacteristicId: "", // 写特征值的UUID
            notifyCharacteristicId: "", // 通知特征值的UUID
        };
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
    Object.defineProperty(BLEHandler.prototype, "connectedDev", {
        // 当前连接的设备
        // 注意：如果是单设备模式，这个属性会被覆盖为当前连接的设备
        // 如果是多设备模式，这个属性会返回第一个设备
        get: function () {
            return this.connectedDevList[0];
        },
        enumerable: false,
        configurable: true
    });
    /**
     * 初始化并打开蓝牙适配器
     * @returns {Promise<boolean>} 是否成功打开适配器
     */
    BLEHandler.prototype.openBLEAdapter = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.openAdapter()];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        if (err != null) {
                            console.error("openAdapter", err);
                            return [2 /*return*/, false];
                        }
                        return [2 /*return*/, true];
                }
            });
        });
    };
    /**
     * 开始搜索蓝牙设备
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    BLEHandler.prototype.startSearchBLE = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.startSearch()];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        return [2 /*return*/, [err, res]];
                }
            });
        });
    };
    /**
     * 监听发现新蓝牙设备事件
     * @param {function} [callback] 发现实时设备时的回调函数
     */
    BLEHandler.prototype.onBluetoothFound = function (callback) {
        var _this = this;
        wx.onBluetoothDeviceFound(function (res) {
            // console.log("this.filterKey", this.filterKey);
            // console.log("res.devices", res.devices);
            res.devices.forEach(function (device) {
                var isTarget = true;
                if (_this.filterKey && _this.filterKey.length > 0) {
                    isTarget = _this.filterKey.some(function (key) { return device.name.includes(key); });
                }
                if (isTarget &&
                    !_this.historyDevList.find(function (d) { return d.deviceId === device.deviceId; })) {
                    _this.historyDevList.push(__assign(__assign({}, device), { isReConnect: _this.isReConnect, isConnect: false }));
                }
                if (isTarget &&
                    !_this.foundDevList.find(function (d) { return d.deviceId === device.deviceId; })) {
                    // console.log("找到设备", device);
                    _this.foundDevList.push(__assign(__assign({}, device), { isReConnect: _this.isReConnect, isConnect: false }));
                }
            });
            if (callback) {
                // 先进行过滤，然后再转换设备信息
                var filteredDevices = res.devices.filter(function (device) {
                    if (!_this.filterKey || _this.filterKey.length === 0) {
                        return true;
                    }
                    return _this.filterKey.some(function (key) { return device.name.includes(key); });
                });
                var realTimeDevices = filteredDevices.map(function (device) { return (__assign(__assign({}, device), { isReConnect: _this.isReConnect, isConnect: false })); });
                callback(realTimeDevices);
            }
        });
    };
    /**
     * 停止搜索蓝牙设备
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    BLEHandler.prototype.stopSearchBLE = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.stopSearch()];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        if (!err) {
                            this.foundDevList = [];
                        }
                        return [2 /*return*/, [err, res]];
                }
            });
        });
    };
    /**
     * 连接指定的蓝牙设备
     * @param {Device} dev 要连接的蓝牙设备对象
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    BLEHandler.prototype.connectBLE = function (dev) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, disErr, disRes, _b, err, res, index;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!(this.mode === "single" && this.connectedDevList.length > 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.disconnectBLE(((_c = this.connectedDev) === null || _c === void 0 ? void 0 : _c.deviceId) || "")];
                    case 1:
                        _a = _d.sent(), disErr = _a[0], disRes = _a[1];
                        // 如果断开连接失败，返回错误
                        if (disErr || !disRes) {
                            return [2 /*return*/, [disErr, null]];
                        }
                        _d.label = 2;
                    case 2: return [4 /*yield*/, this.bluetoothManager.connect(dev.deviceId)];
                    case 3:
                        _b = _d.sent(), err = _b[0], res = _b[1];
                        if (!err) {
                            if (this.mode === "single") {
                                // 如果是单设备模式，清空已连接设备列表
                                this.connectedDevList = [];
                                this.connectedDevList.push(dev);
                            }
                            else {
                                index = this.connectedDevList.findIndex(function (d) { return d.deviceId === dev.deviceId; });
                                if (index === -1) {
                                    this.connectedDevList.push(dev);
                                }
                            }
                        }
                        return [2 /*return*/, [err, res]];
                }
            });
        });
    };
    /**
     * 蓝牙适配器连接状态监听
     * @param {ConnectionStateCallbacks} [callbacks] 设备状态变化时的回调函数
     */
    BLEHandler.prototype.onBLEConnectionStateChange = function (callbacks) {
        var _this = this;
        wx.onBLEConnectionStateChange(function (res) {
            var _a, _b, _c;
            console.log("onBLEConnectionStateChange", res);
            // 自动重连
            if (!res.connected) {
                var index = _this.connectedDevList.findIndex(function (d) { return d.deviceId === res.deviceId; });
                if (index === -1) {
                    console.warn("Device ".concat(res.deviceId, " not found in connected list"));
                    return;
                }
                var curDev_1 = _this.connectedDevList[index];
                // 如果是异常断开的设备，尝试重新连接
                if (curDev_1 === null || curDev_1 === void 0 ? void 0 : curDev_1.isReConnect) {
                    setTimeout(function () {
                        _this.connectBLE(curDev_1);
                    }, _this.reconnectDelay);
                }
                else {
                    _this.connectedDevList.splice(index, 1);
                }
            }
            if (callbacks) {
                // 使用可选链操作符进行安全调用
                if (res.connected) {
                    (_a = callbacks === null || callbacks === void 0 ? void 0 : callbacks.connected) === null || _a === void 0 ? void 0 : _a.call(callbacks, res.deviceId);
                }
                else {
                    (_b = callbacks === null || callbacks === void 0 ? void 0 : callbacks.disconnected) === null || _b === void 0 ? void 0 : _b.call(callbacks, res.deviceId);
                }
                (_c = callbacks === null || callbacks === void 0 ? void 0 : callbacks.callback) === null || _c === void 0 ? void 0 : _c.call(callbacks, res);
            }
        });
    };
    /**
     * 断开与指定设备的蓝牙连接
     * @param {string} deviceId 设备ID
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    BLEHandler.prototype.disconnectBLE = function (deviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var index, _a, err, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        index = this.connectedDevList.findIndex(function (d) { return d.deviceId === deviceId; });
                        if (index === -1) {
                            console.warn("Device ".concat(deviceId, " not found in connected list"));
                            return [2 /*return*/, [
                                    new Error("Device ".concat(deviceId, " not found in connected list")),
                                    null,
                                ]];
                        }
                        this.connectedDevList[index].isReConnect = false; // 取消自动连接
                        return [4 /*yield*/, this.bluetoothManager.disconnect(deviceId)];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        // 如果是单设备模式，清空已连接设备列表
                        if (this.mode === "single" && !err) {
                            this.connectedDevList = [];
                        }
                        return [2 /*return*/, [err, res]];
                }
            });
        });
    };
    /**
     * 获取蓝牙设备的所有服务
     * @param {string} deviceId 设备ID
     * @returns {Promise<WechatMiniprogram.BLEService[] | undefined>} 服务列表
     */
    BLEHandler.prototype.getBLEServices = function (deviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.getServices(deviceId)];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        return [2 /*return*/, [err, res]];
                }
            });
        });
    };
    /**
     * 获取蓝牙设备某个服务的所有特征值
     * @param {string} deviceId 设备ID
     * @returns {Promise<WechatMiniprogram.BLECharacteristic[] | undefined>} 特征值列表
     */
    BLEHandler.prototype.getCharacteristics = function (deviceId, serviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.getCharacteristics(deviceId, serviceId)];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        return [2 /*return*/, [err, res]];
                }
            });
        });
    };
    /**
     * 检查蓝牙设备的服务是否拥有已设置的特征值
     * @param {string} deviceId 设备ID
     * @returns {Promise<WechatMiniprogram.BLECharacteristic[] | undefined>} 特征值列表
     */
    BLEHandler.prototype.checkCharacteristics = function (deviceId, serviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err, res, missingCharacteristics, result;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.getCharacteristics(deviceId, serviceId)];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        missingCharacteristics = [];
                        // 检查写特征值
                        if (!this.config.writeCharacteristicId ||
                            !(res === null || res === void 0 ? void 0 : res.characteristics.some(function (c) { return c.uuid === _this.config.writeCharacteristicId; }))) {
                            missingCharacteristics.push("writeCharacteristicId");
                        }
                        // 检查通知特征值
                        if (!this.config.notifyCharacteristicId ||
                            !(res === null || res === void 0 ? void 0 : res.characteristics.some(function (c) { return c.uuid === _this.config.notifyCharacteristicId; }))) {
                            missingCharacteristics.push("notifyCharacteristicId");
                        }
                        result = {
                            success: missingCharacteristics.length === 0,
                        };
                        // 如果有缺失的特征值，添加到结果中
                        if (missingCharacteristics.length > 0) {
                            result.missingCharacteristics = missingCharacteristics;
                            console.warn("\u7F3A\u5931\u4EE5\u4E0B\u7279\u5F81\u503C: ".concat(missingCharacteristics.join(", ")));
                        }
                        return [2 /*return*/, [err, result]];
                }
            });
        });
    };
    /**
     * 启用蓝牙设备特征值变化的通知功能
     * @param {string} deviceId 设备ID
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    BLEHandler.prototype.notifyBLECharacteristicValueChange = function (deviceId, serviceId, characteristicId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.notifyCharacteristicValueChange(deviceId, serviceId, characteristicId)];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        return [2 /*return*/, [err, res]];
                }
            });
        });
    };
    /**
     * 监听蓝牙设备特征值变化
     * @param {function} callback 特征值变化时的回调函数
     * @param {Object} callback.result 特征值变化结果
     * @param {string} callback.result.deviceId 发生特征值变化的设备ID
     * @param {string} callback.result.serviceId 服务UUID
     * @param {string} callback.result.characteristicId 特征值UUID
     * @param {ArrayBuffer} callback.result.value 特征值最新的值
     */
    BLEHandler.prototype.onBLECharacteristicValueChange = function (callback) {
        wx.onBLECharacteristicValueChange(function (res) {
            // 将 ArrayBuffer 转换为 Uint8Array，方便处理二进制数据
            var buffer = new Uint8Array(res.value);
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
    };
    /**
     * 关闭蓝牙适配器
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    BLEHandler.prototype.closeBLEAdapter = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.closeAdapter()];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        return [2 /*return*/, [err, res]];
                }
            });
        });
    };
    /**
     * 发送Modbus协议数据帧
     * @param {string} deviceId 设备ID
     * @param {ArrayBuffer} frame 数据帧
     * @returns {Promise<boolean>} 是否发送成功
     * @example
     * let data = [0x01,0x06,0x02,0x04,0x0B,0xB8,0xF1,0xCE]
     * let arrayBuffer = new Uint8Array(data).buffer
     */
    BLEHandler.prototype.sentMoubusFrame = function (deviceId, frame) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.writeCharacteristicValue(deviceId, frame)];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        return [2 /*return*/, [err, res]];
                }
            });
        });
    };
    BLEHandler.prototype.release = function (callback) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, dev, _b, disErr, disRes;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _i = 0, _a = this.connectedDevList;
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        dev = _a[_i];
                        return [4 /*yield*/, this.disconnectBLE(dev.deviceId)];
                    case 2:
                        _b = _c.sent(), disErr = _b[0], disRes = _b[1];
                        // 如果断开连接失败，返回错误
                        if (disErr || !disRes) {
                            console.error("Failed to disconnect device ".concat(dev.deviceId, ":"), disErr);
                        }
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        wx.offBLEConnectionStateChange();
                        wx.offBLECharacteristicValueChange();
                        return [4 /*yield*/, this.closeBLEAdapter()];
                    case 5:
                        _c.sent();
                        if (callback)
                            callback();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 初始化蓝牙功能
     * @param {function} [bleFoundCallback] 发现设备时的回调函数
     */
    BLEHandler.prototype.init = function (bleFoundCallback
    // callback?: (devices: { deviceId: string; connected: boolean }) => void
    ) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // 蓝牙适配器初始化
                    return [4 /*yield*/, this.openBLEAdapter()];
                    case 1:
                        // 蓝牙适配器初始化
                        _a.sent();
                        if (!bleFoundCallback) return [3 /*break*/, 4];
                        // 搜索蓝牙设备
                        return [4 /*yield*/, this.startSearchBLE()];
                    case 2:
                        // 搜索蓝牙设备
                        _a.sent();
                        // 获取设备ID
                        return [4 /*yield*/, this.onBluetoothFound(bleFoundCallback)];
                    case 3:
                        // 获取设备ID
                        _a.sent();
                        this.onBLEConnectionStateChange();
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return BLEHandler;
}());
export { BLEHandler };
// export default BLEHandler;
