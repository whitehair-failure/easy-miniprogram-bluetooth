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
import errToString from "../utils/error";
/**
 * 蓝牙管理器类
 * 封装微信小程序蓝牙API，提供更简单的调用方式
 * 包含蓝牙设备的搜索、连接、数据通信等功能
 */
var BluetoothManager = /** @class */ (function () {
    /**
     * 初始化蓝牙管理器
     * @param {BluetoothManagerConfig} config 配置对象
     * @param {string} [config.serviceUId] 服务UUID，默认为"0000FFE0-0000-1000-8000-00805F9B34FB"
     * @param {string} [config.writeCharacteristicId] 写特征值UUID，默认为"0000FFE2-0000-1000-8000-00805F9B34FB"
     * @param {string} [config.notifyCharacteristicId] 通知特征值UUID，默认为"0000FFE1-0000-1000-8000-00805F9B34FB"
     */
    function BluetoothManager(config) {
        this.readCharacteristicId = "";
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
    BluetoothManager.prototype.promisify = function (fn, args) {
        return new Promise(function (resolve, reject) {
            var options = __assign(__assign({}, (args || {})), { success: function (res) { return resolve(res); }, fail: function (err) { return reject(err); } });
            fn(options);
        });
    };
    /**
     * 初始化并打开蓝牙适配器
     * 如果蓝牙未开启或未授权，会显示对应的提示框
     * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
     * @returns {Error} 如果初始化失败，返回错误对象
     * @returns {object} 如果初始化成功，返回初始化结果
     */
    BluetoothManager.prototype.openAdapter = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res, err_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\u51C6\u5907\u521D\u59CB\u5316\u84DD\u7259\u9002\u914D\u5668...");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.promisify(wx.openBluetoothAdapter, {
                                refreshCache: false,
                            })];
                    case 2:
                        res = _a.sent();
                        console.log("\u2714 \u9002\u914D\u5668\u521D\u59CB\u5316\u6210\u529F\uFF01");
                        return [2 /*return*/, [null, res]];
                    case 3:
                        err_1 = _a.sent();
                        setTimeout(function () {
                            if (err_1.errno === 103) {
                                wx.showModal({
                                    title: "请检查是否已授权小程序蓝牙权限",
                                    showCancel: false,
                                    success: function (res) {
                                        if (res.confirm) {
                                            _this.openAdapter();
                                        }
                                    },
                                });
                            }
                            if (err_1.errno === 1500102) {
                                wx.showModal({
                                    title: "请检查蓝牙是否开启",
                                    showCancel: false,
                                    success: function (res) {
                                        if (res.confirm) {
                                            _this.openAdapter();
                                        }
                                    },
                                });
                            }
                        }, 1000);
                        console.log("\u2718 \u521D\u59CB\u5316\u5931\u8D25\uFF01".concat(errToString(err_1)));
                        return [2 /*return*/, [new Error(errToString(err_1)), null]];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 开始搜索附近的蓝牙设备
     * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
     * @returns {Error} 如果搜索失败，返回错误对象
     * @returns {object} 如果搜索成功，返回搜索结果
     */
    BluetoothManager.prototype.startSearch = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res, err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\u51C6\u5907\u641C\u5BFB\u9644\u8FD1\u7684\u84DD\u7259\u5916\u56F4\u8BBE\u5907...");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.promisify(wx.startBluetoothDevicesDiscovery, {
                                interval: 1000,
                                allowDuplicatesKey: true,
                            })];
                    case 2:
                        res = _a.sent();
                        console.log("\u2714 \u641C\u7D22\u6210\u529F!");
                        return [2 /*return*/, [null, res]];
                    case 3:
                        err_2 = _a.sent();
                        console.log("\u2718 \u641C\u7D22\u84DD\u7259\u8BBE\u5907\u5931\u8D25\uFF01".concat(err_2));
                        return [2 /*return*/, [new Error(errToString(err_2)), null]];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 监听发现新的蓝牙设备事件
     * @param {Function} callback 发现新设备时的回调函数
     * @param {WechatMiniprogram.BlueToothDevice[]} callback.devices 发现的蓝牙设备列表
     */
    BluetoothManager.prototype.onBluetoothFound = function (callback) {
        console.log("\u76D1\u542C\u641C\u5BFB\u65B0\u8BBE\u5907\u4E8B\u4EF6...");
        wx.onBluetoothDeviceFound(function (res) {
            console.log("\u5DF2\u55C5\u63A2\u84DD\u7259\u8BBE\u5907\u6570\uFF1A".concat(res.devices.length, "..."));
            callback(res.devices);
        });
    };
    /**
     * 停止搜索蓝牙设备
     * @returns {Promise<[Error | null, WechatMiniprogram.BluetoothError | null]>} 返回错误对象和结果
     * @returns {Error} 如果停止搜索失败，返回错误对象
     * @returns {WechatMiniprogram.BluetoothError} 如果停止搜索成功，返回结果对象
     */
    BluetoothManager.prototype.stopSearch = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res, err_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\u505C\u6B62\u67E5\u627E\u65B0\u8BBE\u5907...");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, wx.stopBluetoothDevicesDiscovery()];
                    case 2:
                        res = (_a.sent());
                        console.log("\u2714 \u505C\u6B62\u67E5\u627E\u8BBE\u5907\u6210\u529F\uFF01");
                        return [2 /*return*/, [null, res]];
                    case 3:
                        err_3 = _a.sent();
                        console.log("\u2718 \u505C\u6B62\u67E5\u8BE2\u8BBE\u5907\u5931\u8D25\uFF01".concat(err_3));
                        return [2 /*return*/, [new Error(errToString(err_3)), null]];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 连接指定的蓝牙设备
     * 连接成功后会自动设置最大传输单元(MTU)为71字节(仅安卓有效)
     * @param {string} deviceId 要连接的设备ID
     * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
     * @returns {Error} 如果连接失败，返回错误对象
     * @returns {object} 如果连接成功，返回连接结果
     */
    BluetoothManager.prototype.connect = function (deviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var res, err_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\u51C6\u5907\u8FDE\u63A5\u8BBE\u5907...");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.promisify(wx.createBLEConnection, {
                                deviceId: deviceId,
                            })];
                    case 2:
                        res = _a.sent();
                        console.log("\u2714 \u8FDE\u63A5\u84DD\u7259\u6210\u529F\uFF01");
                        // 设置MTU (仅安卓有效)
                        wx.setBLEMTU({
                            deviceId: deviceId,
                            mtu: 71,
                            success: function (res) {
                                return console.log("setBLEMTU success ".concat(JSON.stringify(res)));
                            },
                            fail: function (err) { return console.log("setBLEMTU fail ".concat(errToString(err))); },
                        });
                        return [2 /*return*/, [null, res]];
                    case 3:
                        err_4 = _a.sent();
                        console.log("\u2718 \u8FDE\u63A5\u84DD\u7259\u5931\u8D25\uFF01".concat(errToString(err_4)));
                        return [2 /*return*/, [new Error(errToString(err_4)), null]];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 断开与指定蓝牙设备的连接
     * @param {string} deviceId 要断开连接的设备ID
     * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
     * @returns {Error} 如果断开失败，返回错误对象
     * @returns {object} 如果断开成功，返回操作结果
     */
    BluetoothManager.prototype.disconnect = function (deviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var res, err_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\u65AD\u5F00\u84DD\u7259\u8FDE\u63A5...");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.promisify(wx.closeBLEConnection, {
                                deviceId: deviceId,
                            })];
                    case 2:
                        res = _a.sent();
                        console.log("\u2714 \u65AD\u5F00\u84DD\u7259\u6210\u529F\uFF01");
                        return [2 /*return*/, [null, res]];
                    case 3:
                        err_5 = _a.sent();
                        console.log("\u2718 \u65AD\u5F00\u84DD\u7259\u8FDE\u63A5\u5931\u8D25\uFF01".concat(errToString(err_5)));
                        return [2 /*return*/, [new Error(errToString(err_5)), null]];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 关闭蓝牙适配器，释放资源
     * @returns {Promise<[Error | null, WechatMiniprogram.BluetoothError | null]>} 返回错误对象和结果
     * @returns {Error} 如果关闭失败，返回错误对象
     * @returns {WechatMiniprogram.BluetoothError} 如果关闭成功，返回操作结果
     */
    BluetoothManager.prototype.closeAdapter = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res, err_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\u91CA\u653E\u84DD\u7259\u9002\u914D\u5668...");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, wx.closeBluetoothAdapter()];
                    case 2:
                        res = (_a.sent());
                        console.log("\u2714 \u91CA\u653E\u9002\u914D\u5668\u6210\u529F\uFF01");
                        return [2 /*return*/, [null, res]];
                    case 3:
                        err_6 = _a.sent();
                        console.log("\u2718 \u91CA\u653E\u9002\u914D\u5668\u5931\u8D25\uFF01".concat(errToString(err_6)));
                        return [2 /*return*/, [new Error(errToString(err_6)), null]];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 蓝牙适配器连接状态监听
     * @param {Function} callback 连接状态变化的回调函数
     * @param {Object} callback.devices 连接状态信息
     * @param {string} callback.devices.deviceId 发生连接状态变化的设备ID
     * @param {boolean} callback.devices.connected 当前的连接状态
     */
    BluetoothManager.prototype.onBLEConnectionStateChange = function (callback) {
        wx.onBLEConnectionStateChange(function (res) {
            console.log("onBLEConnectionStateChange", res);
            callback(res);
        });
    };
    /**
     * 蓝牙适配器特征值变化状态监听
     * @param {Function} callback 特征值变化的回调函数
     * @param {Object} callback.devices 特征值信息
     * @param {string} callback.devices.deviceId 发生特征值变化的设备ID
     * @param {string} callback.devices.serviceId 服务UUID
     * @param {string} callback.devices.characteristicId 特征值UUID
     * @param {ArrayBuffer} callback.devices.value 特征值最新的值
     */
    BluetoothManager.prototype.onBLECharacteristicValueChange = function (callback) {
        wx.onBLECharacteristicValueChange(function (res) {
            console.log("onBLECharacteristicValueChange", res);
            callback(res);
        });
    };
    /**
     * 获取蓝牙设备的所有服务
     * @param {string} deviceId 蓝牙设备ID
     * @returns {Promise<[Error | null, WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult | null]>} 返回错误对象和服务列表
     * @returns {Error} 如果获取失败，返回错误对象
     * @returns {WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult} 如果获取成功，返回服务列表
     */
    BluetoothManager.prototype.getServices = function (deviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var res, err_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\u83B7\u53D6\u84DD\u7259\u8BBE\u5907\u6240\u6709\u670D\u52A1...");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.promisify(wx.getBLEDeviceServices, {
                                deviceId: deviceId,
                            })];
                    case 2:
                        res = (_a.sent());
                        console.log("\u2714 \u83B7\u53D6service\u6210\u529F\uFF01");
                        return [2 /*return*/, [null, res]];
                    case 3:
                        err_7 = _a.sent();
                        console.log("\u2718 \u83B7\u53D6service\u5931\u8D25\uFF01".concat(errToString(err_7)));
                        return [2 /*return*/, [new Error(errToString(err_7)), null]];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 获取蓝牙设备某个服务下的所有特征值
     * @param {string} deviceId 蓝牙设备ID
     * @param {string} [serviceId] 服务UUID，默认使用初始化时配置的serviceUId
     * @returns {Promise<[Error | null, WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult | null]>} 返回错误对象和特征值列表
     * @returns {Error} 如果获取失败，返回错误对象
     * @returns {WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult} 如果获取成功，返回特征值列表
     */
    BluetoothManager.prototype.getCharacteristics = function (deviceId_1) {
        return __awaiter(this, arguments, void 0, function (deviceId, serviceId) {
            var res, err_8;
            if (serviceId === void 0) { serviceId = this.serviceUId; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\u5F00\u59CB\u83B7\u53D6\u7279\u5F81\u503C...");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.promisify(wx.getBLEDeviceCharacteristics, {
                                deviceId: deviceId,
                                serviceId: serviceId,
                            })];
                    case 2:
                        res = (_a.sent());
                        console.log("\u2714 \u83B7\u53D6\u7279\u5F81\u503C\u6210\u529F\uFF01");
                        return [2 /*return*/, [null, res]];
                    case 3:
                        err_8 = _a.sent();
                        console.log("\u2718 \u83B7\u53D6\u7279\u5F81\u503C\u5931\u8D25\uFF01".concat(errToString(err_8)));
                        return [2 /*return*/, [new Error(errToString(err_8)), null]];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 启用低功耗蓝牙设备特征值变化时的notify功能
     * @param {string} deviceId 蓝牙设备ID
     * @param {string} [serviceId] 服务UUID，默认使用初始化时配置的serviceUId
     * @param {string} [characteristicId] 特征值UUID，默认使用初始化时配置的notifyCharacteristicId
     * @returns {Promise<[Error | null, object | null]>} 返回错误对象和结果
     * @returns {Error} 如果启用失败，返回错误对象
     * @returns {object} 如果启用成功，返回操作结果
     */
    BluetoothManager.prototype.notifyCharacteristicValueChange = function (deviceId_1) {
        return __awaiter(this, arguments, void 0, function (deviceId, serviceId, characteristicId) {
            var res, err_9;
            if (serviceId === void 0) { serviceId = this.serviceUId; }
            if (characteristicId === void 0) { characteristicId = this.notifyCharacteristicId; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\u51C6\u5907\u8BA2\u9605\u7279\u5F81\u503C\u53D8\u5316...");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.promisify(wx.notifyBLECharacteristicValueChange, {
                                deviceId: deviceId,
                                serviceId: serviceId,
                                characteristicId: characteristicId,
                                state: true,
                            })];
                    case 2:
                        res = _a.sent();
                        console.log("\u2714 \u8BA2\u9605notify\u6210\u529F\uFF01");
                        return [2 /*return*/, [null, res]];
                    case 3:
                        err_9 = _a.sent();
                        console.log("\u2718 \u8BA2\u9605notify\u5931\u8D25\uFF01".concat(errToString(err_9)));
                        return [2 /*return*/, [new Error(errToString(err_9)), null]];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
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
    BluetoothManager.prototype.writeCharacteristicValue = function (deviceId_1, value_1) {
        return __awaiter(this, arguments, void 0, function (deviceId, value, serviceId, characteristicId) {
            var res, err_10;
            if (serviceId === void 0) { serviceId = this.serviceUId; }
            if (characteristicId === void 0) { characteristicId = this.writeCharacteristicId; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.promisify(wx.writeBLECharacteristicValue, {
                                deviceId: deviceId,
                                serviceId: serviceId,
                                characteristicId: characteristicId,
                                value: value,
                            })];
                    case 1:
                        res = _a.sent();
                        console.log("\u2714 \u5199\u5165\u6570\u636E\u6210\u529F\uFF01");
                        return [2 /*return*/, [null, res]];
                    case 2:
                        err_10 = _a.sent();
                        console.log("\u2718 \u5199\u5165\u6570\u636E\u5931\u8D25\uFF01".concat(errToString(err_10)));
                        return [2 /*return*/, [new Error(errToString(err_10)), null]];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return BluetoothManager;
}());
export default BluetoothManager;
