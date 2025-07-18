'use strict';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
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
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

function errToString (err) {
    console.log('微信原始错误码:', err);
    if (err && err.errCode) {
        // 微信BLE蓝牙错误码
        switch (err.errCode) {
            case 10001:
                return err.errCode + "：当前蓝牙适配器不可用";
            case 10002:
                return err.errCode + "：没有找到指定设备";
            case 10003:
                return err.errCode + "：连接失败";
            case 10004:
                return err.errCode + "：没有找到指定服务";
            case 10005:
                return err.errCode + "：没有找到指定特征值";
            case 10006:
                return err.errCode + "：当前连接已断开";
            case 10007:
                return err.errCode + "：当前特征值不支持此操作";
            case 10008:
                return err.errCode + "：其余所有系统上报的异常";
            case 10009:
                return err.errCode + "：Android 系统特有，系统版本低于 4.3 不支持 BLE";
            case 10012:
                return err.errCode + "：连接超时";
            case 10013:
                return err.errCode + "：连接 deviceId 为空或者是格式不正确";
            default:
                return err.errCode + ":其他蓝牙功能暂不支持";
        }
    }
    else {
        // 自定义错误码
        if (typeof err === 'string') {
            switch (err) {
                case 'device not found':
                    return "找不到该设备";
            }
        }
        else {
            return "蓝牙功能暂不支持";
        }
    }
    return "未知错误"; // Default return statement to handle all cases
}

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
            var _this = this;
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
                        res.characteristics.forEach(function (item) {
                            if (item.properties.read) {
                                _this.readCharacteristicId = item.uuid;
                                console.log("readCharacteristicId:".concat(item.uuid));
                            }
                            if (item.properties.write && !item.properties.read) {
                                _this.writeCharacteristicId = item.uuid;
                                console.log("writeCharacteristicId:".concat(item.uuid));
                            }
                            if (item.properties.notify || item.properties.indicate) {
                                _this.notifyCharacteristicId = item.uuid;
                                console.log("notifyCharacteristicId:".concat(item.uuid));
                            }
                        });
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

/* import * as comm from "./utils/comm"
import * as ModbusRtu from "./utils/modbus/modebusRtu" */
getApp();
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
        this.mode = options.mode || "single"; // 默认单设备模式
        this.filterKey = options.filterKey;
        this.isReConnect = options.isReConnect || false; // 默认不自动重连
        this.reconnectDelay = options.reconnectDelay || 1000; // 默认1秒重连
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
    BLEHandler.prototype.openBLEAdapter = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.openAdapter()];
                    case 1:
                        _a = _b.sent(), err = _a[0], _a[1];
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
            var _a, err, res, index;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.connect(dev.deviceId)];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        if (!err) {
                            if (this.mode === "single") {
                                this.disconnectBLE;
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
                // 如果是自动连接的设备，尝试重新连接
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
                        this.connectedDevList[index].isReConnect = false; // 取消自动连接
                        return [4 /*yield*/, this.bluetoothManager.disconnect(deviceId)];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
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
                        if (!err) {
                            return [2 /*return*/];
                        }
                        return [2 /*return*/, res === null || res === void 0 ? void 0 : res.services];
                }
            });
        });
    };
    /**
     * 获取蓝牙设备某个服务的所有特征值
     * @param {string} deviceId 设备ID
     * @returns {Promise<WechatMiniprogram.BLECharacteristic[] | undefined>} 特征值列表
     */
    BLEHandler.prototype.getCharacteristics = function (deviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.getCharacteristics(deviceId)];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        if (err || !res) {
                            // 取消连接
                            // this.closeBLEConnection();
                            this.closeBLEAdapter();
                            return [2 /*return*/];
                        }
                        wx.setStorageSync("bluestatus", "on");
                        return [2 /*return*/, res.characteristics];
                }
            });
        });
    };
    /**
     * 启用蓝牙设备特征值变化的通知功能
     * @param {string} deviceId 设备ID
     * @returns {Promise<[Error | null, any]>} 错误对象和结果
     */
    BLEHandler.prototype.notifyBLECharacteristicValueChange = function (deviceId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, err, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.bluetoothManager.notifyCharacteristicValueChange(deviceId)];
                    case 1:
                        _a = _b.sent(), err = _a[0], res = _a[1];
                        return [2 /*return*/, [err, res]];
                }
            });
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
            return __generator(this, function (_a) {
                console.log("sendData:", frame);
                return [2 /*return*/, this.bluetoothManager.writeCharacteristicValue(deviceId, frame)];
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
// export default BLEHandler;

exports.BLEHandler = BLEHandler;
exports.BluetoothManager = BluetoothManager;
