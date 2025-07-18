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
import errToString from "./error";
var PRINT_SHOW = true; //是否开启蓝牙调试
function _getSetting() {
    return promisify(wx.getSetting).then(function (res) {
        return [null, res];
    }, function (err) {
        return [err, null];
    });
}
function _authorizeBle() {
    return promisify(wx.authorize, ['scope.bluetooth']).then(function (res) {
        return [null, res];
    }, function (err) {
        return [err, null];
    });
}
;
/**
 * 初始化蓝牙适配器
 * @returns Promise<[Error | null, object | null]>
 */
function _openAdapter() {
    print("\u51C6\u5907\u521D\u59CB\u5316\u84DD\u7259\u9002\u914D\u5668...");
    return promisify(wx.openBluetoothAdapter, {
        refreshCache: false
    }).then(function (res) {
        print("\u2714 \u9002\u914D\u5668\u521D\u59CB\u5316\u6210\u529F\uFF01");
        return [null, res];
    }, function (err) {
        setTimeout(function () {
            if (err.errno === 103) {
                wx.showModal({
                    title: '请检查是否已授权小程序蓝牙权限',
                    showCancel: false,
                    success: function (res) {
                        if (res.confirm) {
                            _openAdapter();
                        }
                    }
                });
            }
            if (err.errno === 1500102) {
                wx.showModal({
                    title: '请检查蓝牙是否开启',
                    showCancel: false,
                    success: function (res) {
                        if (res.confirm) {
                            _openAdapter();
                        }
                    }
                });
            }
        }, 1000);
        print("\u2718 \u521D\u59CB\u5316\u5931\u8D25\uFF01".concat(errToString(err)));
        return [errToString(err), null];
    });
}
/**
 * @param {Array<string>} services
 * @param { Int } interval
 */
function _startSearch() {
    print("\u51C6\u5907\u641C\u5BFB\u9644\u8FD1\u7684\u84DD\u7259\u5916\u56F4\u8BBE\u5907...");
    return promisify(wx.startBluetoothDevicesDiscovery, {
        interval: 1000,
        allowDuplicatesKey: true,
    }).then(function (res) {
        print("\u2714 \u641C\u7D22\u6210\u529F!");
        return [null, res];
    }, function (err) {
        print("\u2718 \u641C\u7D22\u84DD\u7259\u8BBE\u5907\u5931\u8D25\uFF01".concat(errToString(err)));
        return [errToString(err), null];
    });
}
/**
 *@param {Array<string>} devices
 *@deviceId 设备ID
 */
function _onBluetoothFound(callback) {
    var _this = this;
    print("\u76D1\u542C\u641C\u5BFB\u65B0\u8BBE\u5907\u4E8B\u4EF6...");
    var devices = [];
    wx.onBluetoothDeviceFound(function (res) {
        res.devices.forEach(function (element) {
            var isTarget = element.name.indexOf(_this.regName) != -1;
            if (isTarget && !devices.some(function (device) { return device.deviceId === element.deviceId; })) {
                devices.push(element);
            }
        });
        console.log("\u5DF2\u55C5\u63A2\u84DD\u7259\u8BBE\u5907\u6570\uFF1A".concat(devices.length, "..."));
        if (callback) {
            callback(devices);
        }
    });
}
function _stopSearchBluetooth() {
    print("\u505C\u6B62\u67E5\u627E\u65B0\u8BBE\u5907...");
    return wx.stopBluetoothDevicesDiscovery().then(function (res) {
        print("\u2714 \u505C\u6B62\u67E5\u627E\u8BBE\u5907\u6210\u529F\uFF01");
        return [null, res];
    }, function (err) {
        print("\u2718 \u505C\u6B62\u67E5\u8BE2\u8BBE\u5907\u5931\u8D25\uFF01".concat(errToString(err)));
        return [errToString(err), null];
    });
}
function _connectBlue(dev) {
    print("\u51C6\u5907\u8FDE\u63A5\u8BBE\u5907...");
    return promisify(wx.createBLEConnection, {
        deviceId: dev.deviceId,
    }).then(function (res) {
        print("\u2714 \u8FDE\u63A5\u84DD\u7259\u6210\u529F\uFF01");
        wx.setBLEMTU({
            deviceId: dev.deviceId,
            mtu: 71,
            success: function (res) {
                print("setBLEMTU success ".concat(res));
            },
            fail: function (err) {
                console.log("setBLEMTU fial ", err);
            },
            // complete:()=>{
            //     setInterval(()=>{
            //         wx.setBLEMTU({
            //             deviceId:dev.deviceId, 
            //             mtu:110,
            //             success:(res)=>{
            //                 console.log("setBLEMTU success ",res)
            //             },
            //             fail:(err)=>{
            //                 console.log("setBLEMTU fial ",err)
            //             },
            //         })
            //     },500)
            // }
        });
        return [null, res];
    }, function (err) {
        print("\u2718 \u8FDE\u63A5\u84DD\u7259\u5931\u8D25\uFF01".concat(errToString(err)));
        return [err, null];
    });
}
function _closeBLEConnection() {
    print("\u65AD\u5F00\u84DD\u7259\u8FDE\u63A5...");
    return promisify(wx.closeBLEConnection, {
        deviceId: this.dev.deviceId,
    }).then(function (res) {
        print("\u2714 \u65AD\u5F00\u84DD\u7259\u6210\u529F\uFF01");
        return [null, res];
    }, function (err) {
        print("\u2718 \u65AD\u5F00\u84DD\u7259\u8FDE\u63A5\u5931\u8D25\uFF01".concat(errToString(err)));
        return [errToString(err), null];
    });
}
function _closeBLEAdapter() {
    print("\u91CA\u653E\u84DD\u7259\u9002\u914D\u5668...");
    return wx.closeBluetoothAdapter().then(function (res) {
        print("\u2714 \u91CA\u653E\u9002\u914D\u5668\u6210\u529F\uFF01");
        return [null, res];
    }, function (err) {
        print("\u2718 \u91CA\u653E\u9002\u914D\u5668\u5931\u8D25\uFF01".concat(errToString(err)));
        return [errToString(err), null];
    });
}
function _getBLEServices() {
    print("\u83B7\u53D6\u84DD\u7259\u8BBE\u5907\u6240\u6709\u670D\u52A1...");
    return promisify(wx.getBLEDeviceServices, {
        deviceId: this.dev.deviceId
    }).then(function (res) {
        print("\u2714 \u83B7\u53D6service\u6210\u529F\uFF01");
        return [null, res];
    }, function (err) {
        print("\u2718 \u83B7\u53D6service\u5931\u8D25\uFF01".concat(errToString(err)));
        return [errToString(err), null];
    });
}
function _getCharacteristics() {
    var _this = this;
    print("\u5F00\u59CB\u83B7\u53D6\u7279\u5F81\u503C...");
    return promisify(wx.getBLEDeviceCharacteristics, {
        deviceId: this.dev.deviceId,
        serviceId: this.serviceUId,
    }).then(function (res) {
        print("\u2714 \u83B7\u53D6\u7279\u5F81\u503C\u6210\u529F\uFF01");
        for (var i = 0; i < res.characteristics.length; i++) {
            var item = res.characteristics[i];
            if (item.properties.read) {
                _this.readCharacteristicId = item.uuid;
                print("readCharacteristicId:".concat(item.uuid));
            }
            if (item.properties.write && !item.properties.read) {
                _this.writeCharacteristicId = item.uuid;
                print("writeCharacteristicId:".concat(item.uuid));
            }
            if (item.properties.notify || item.properties.indicate) {
                _this.notifyCharacteristicId = item.uuid;
                print("notifyCharacteristicId:".concat(item.uuid));
            }
        }
        return [null, res];
    }, function (err) {
        print("\u2718 \u83B7\u53D6\u7279\u5F81\u503C\u5931\u8D25\uFF01".concat(errToString(err)));
        return [errToString(err), null];
    });
}
// 订阅特征值
function _notifyBLECharacteristicValueChange() {
    return promisify(wx.notifyBLECharacteristicValueChange, {
        deviceId: this.dev.deviceId,
        serviceId: this.serviceUId,
        characteristicId: this.notifyCharacteristicId,
        state: true
    }).then(function (res) {
        print("\u2714 \u8BA2\u9605notify\u6210\u529F\uFF01");
        return [null, res];
    }, function (err) {
        print("\u2718 \u8BA2\u9605notify\u5931\u8D25\uFF01".concat(errToString(err)));
        return [errToString(err), null];
    });
}
/**
 * 写入蓝牙特征值
 * @param arrayBuffer 要写入的二进制数据
 * @returns Promise<[Error | null, WechatMiniprogram.BluetoothError | null]>
 */
function _writeBLECharacteristicValue(arrayBuffer) {
    return promisify(wx.writeBLECharacteristicValue, {
        deviceId: this.deviceId,
        serviceId: this.serviceUId,
        characteristicId: this.writeCharacteristicId,
        value: arrayBuffer,
    }).then(function (res) {
        print("\u2714 \u5199\u5165\u6570\u636E\u6210\u529F\uFF01");
        return [null, res];
    }, function (err) {
        print("\u2718 \u5199\u5165\u6570\u636E\u5931\u8D25\uFF01".concat(errToString(err)));
        return [new Error(errToString(err)), null];
    });
}
/**
 * 对微信接口的promise封装
 * @param fn 微信API函数
 * @param args 调用参数
 * @returns Promise 包装后的Promise对象
 */
function promisify(fn, args) {
    return new Promise(function (resolve, reject) {
        fn(__assign(__assign({}, (args || {})), { success: function (res) { return resolve(res); }, fail: function (err) { return reject(err); } }));
    });
}
/**
 * 对微信接口回调函数的封装
 * @param {function} fn
 */
/* function promisify_callback(fn) {
  return new Promise((resolve, reject) => {
    fn(
      (res) => {
        resolve(res);
      },
      (rej) => {
        reject(rej);
      }
    );
  });
} */
function delay(method, delay) {
    if (delay === void 0) { delay = 1000; }
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            try {
                method();
                resolve();
            }
            catch (error) {
                reject(error);
            }
        }, delay);
    });
}
function print(str) {
    PRINT_SHOW ? console.log(str) : null;
}
/**
 * 观察者模式的封装函数
 * @param {function} fn
 * @param {callback} fn
 */
/* function watchFunctionReturn(fn, callback) {
  let lastReturnValue = null; // 存储上一次的返回值

  return function (...args) {
    const currentReturnValue = fn(...args); // 调用原函数并获取返回值

    if (currentReturnValue !== lastReturnValue) {
      lastReturnValue = currentReturnValue; // 更新上一次的返回值
      callback(currentReturnValue); // 触发回调
    }

    return currentReturnValue; // 返回当前值
  };
} */
export { print, _getSetting, _authorizeBle, _getCharacteristics, _connectBlue, _getBLEServices, _closeBLEConnection, _closeBLEAdapter, _stopSearchBluetooth, _notifyBLECharacteristicValueChange, _onBluetoothFound, _startSearch, _openAdapter, _writeBLECharacteristicValue, promisify, 
// promisify_callback,
delay };
