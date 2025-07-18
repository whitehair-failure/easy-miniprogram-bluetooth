import errToString from "./error";

let PRINT_SHOW = true //是否开启蓝牙调试

function _getSetting() {
  return promisify(wx.getSetting).then(res => {
    return [null, res]
  }, err => {
    return [err, null]
  });
}

function _authorizeBle() {
  return promisify(wx.authorize, ['scope.bluetooth']).then(res => {
    return [null, res]
  }, err => {
    return [err, null]
  })
}

interface device {
  deviceId: string;
  serviceUId: string;
  writeCharacteristicId: string;
  [property: string]: any;
};

/**
 * 初始化蓝牙适配器
 * @returns Promise<[Error | null, object | null]>
 */
function _openAdapter(): Promise<[string | null, object | null]> {
  print(`准备初始化蓝牙适配器...`);
  return promisify(wx.openBluetoothAdapter, {
    refreshCache: false
  }).then(
    (res) => {
      print(`✔ 适配器初始化成功！`);
      return [null, res];
    },
    (err) => {
      setTimeout(() => {
        if (err.errno === 103) {
          wx.showModal({
            title: '请检查是否已授权小程序蓝牙权限',
            showCancel: false,
            success(res) {
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
            success(res) {
              if (res.confirm) {
                _openAdapter();
              }
            }
          });
        }
      }, 1000);
      print(`✘ 初始化失败！${errToString(err)}`);
      return [errToString(err), null];
    }
  );
}

/**
 * @param {Array<string>} services
 * @param { Int } interval
 */
function _startSearch() {
  print(`准备搜寻附近的蓝牙外围设备...`);
  return promisify(wx.startBluetoothDevicesDiscovery, {
    interval: 1000,
    allowDuplicatesKey: true,
  }).then(
    (res) => {
      print(`✔ 搜索成功!`);
      return [null, res]

    },
    (err) => {
      print(`✘ 搜索蓝牙设备失败！${errToString(err)}`);
      return [errToString(err), null]
    }
  );
}

/**
 *@param {Array<string>} devices
 *@deviceId 设备ID
 */
function _onBluetoothFound(this: device, callback: Function) {
  print(`监听搜寻新设备事件...`);

  let devices:WechatMiniprogram.BlueToothDevice[] = [];

  wx.onBluetoothDeviceFound(res => {
    res.devices.forEach(element => {
      let isTarget = element.name.indexOf(this.regName) != -1;

      if (isTarget && !devices.some(device => device.deviceId === element.deviceId)) {
        devices.push(element);
      }
    });

    console.log(`已嗅探蓝牙设备数：${devices.length}...`);

    if (callback) {
      callback(devices);
    }
  });

}

function _stopSearchBluetooth() {
  print(`停止查找新设备...`);
  return wx.stopBluetoothDevicesDiscovery().then(
    (res) => {
      print(`✔ 停止查找设备成功！`);
      return [null, res]
    },
    (err) => {
      print(`✘ 停止查询设备失败！${errToString(err)}`);
      return [errToString(err), null]
    }
  );
}

function _connectBlue(dev: device) {
  print(`准备连接设备...`);
  return promisify(wx.createBLEConnection, {
    deviceId: dev.deviceId,
  }).then(
    (res) => {
      print(`✔ 连接蓝牙成功！`);
      wx.setBLEMTU({ //仅安卓有效
        deviceId: dev.deviceId,
        mtu: 71,
        success: (res) => {
          print(`setBLEMTU success ${res}`);

        },
        fail: (err) => {
          console.log("setBLEMTU fial ", err)

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
      })

      return [null, res]
    },
    (err) => {
      print(`✘ 连接蓝牙失败！${errToString(err)}`);
      return [err, null]
    }
  );
}

function _closeBLEConnection(this: device): Promise<(object | null)[] | (string | null)[]> {
  print(`断开蓝牙连接...`)
  return promisify(wx.closeBLEConnection, {
    deviceId: this.dev.deviceId,
  }).then(
    (res) => {
      print(`✔ 断开蓝牙成功！`);
      return [null, res]
    },
    (err) => {
      print(`✘ 断开蓝牙连接失败！${errToString(err)}`);
      return [errToString(err), null]
    }
  );
}

function _closeBLEAdapter() {
  print(`释放蓝牙适配器...`)
  return wx.closeBluetoothAdapter().then(res => {
    print(`✔ 释放适配器成功！`)
    return [null, res]
  }, err => {
    print(`✘ 释放适配器失败！${errToString(err)}`)
    return [errToString(err), null]
  })
}

function _getBLEServices(this: device) {
  print(`获取蓝牙设备所有服务...`)
  return promisify(wx.getBLEDeviceServices, {
    deviceId: this.dev.deviceId
  }).then(res => {
    print(`✔ 获取service成功！`)


    return [null, res]
  }, err => {
    print(`✘ 获取service失败！${errToString(err)}`)
    return [errToString(err), null]
  })
}

function _getCharacteristics(this: device) {
  print(`开始获取特征值...`);
  return promisify(wx.getBLEDeviceCharacteristics, {
    deviceId: this.dev.deviceId,
    serviceId: this.serviceUId,
  }).then(
    (res: any) => {
      print(`✔ 获取特征值成功！`);
      for (let i = 0; i < res.characteristics.length; i++) {
        let item = res.characteristics[i];
        if (item.properties.read) {
          this.readCharacteristicId = item.uuid;
          print(`readCharacteristicId:${item.uuid}`)
        }
        if (item.properties.write && !item.properties.read) {
          this.writeCharacteristicId = item.uuid;
          print(`writeCharacteristicId:${item.uuid}`)
        }
        if (item.properties.notify || item.properties.indicate) {
          this.notifyCharacteristicId = item.uuid;
          print(`notifyCharacteristicId:${item.uuid}`)
        }
      }
      return [null, res]
    },
    (err) => {
      print(`✘ 获取特征值失败！${errToString(err)}`);
      return [errToString(err), null]
    }
  );
}

// 订阅特征值
function _notifyBLECharacteristicValueChange(this: device) {
  return promisify(wx.notifyBLECharacteristicValueChange, {
    deviceId: this.dev.deviceId,
    serviceId: this.serviceUId,
    characteristicId: this.notifyCharacteristicId,
    state: true
  }).then(res => {
    print(`✔ 订阅notify成功！`)
    return [null, res]
  }, err => {
    print(`✘ 订阅notify失败！${errToString(err)}`)
    return [errToString(err), null]
  })
}

interface BLEWriteCharacteristicValue extends WechatMiniprogram.WriteBLECharacteristicValueOption {
  deviceId: string;
  serviceId: string;
  characteristicId: string;
  value: ArrayBuffer;
}

/**
 * 写入蓝牙特征值
 * @param arrayBuffer 要写入的二进制数据
 * @returns Promise<[Error | null, WechatMiniprogram.BluetoothError | null]>
 */
function _writeBLECharacteristicValue(this: device, arrayBuffer: ArrayBuffer): Promise<[Error | null, object | null]> {
  return promisify(wx.writeBLECharacteristicValue, {
    deviceId: this.deviceId,
    serviceId: this.serviceUId,
    characteristicId: this.writeCharacteristicId,
    value: arrayBuffer,
  }).then(
    (res) => {
      print(`✔ 写入数据成功！`);
      return [null, res];
    },
    (err: object) => {
      print(`✘ 写入数据失败！${errToString(err)}`);
      return [new Error(errToString(err)), null];
    }
  );
}

/**
 * 微信API通用回调选项接口
 */
interface WxApiCallback extends Partial<WechatMiniprogram.WriteBLECharacteristicValueOption> {
  success?: (res: WechatMiniprogram.GeneralCallbackResult) => void;
  fail?: (err: WechatMiniprogram.GeneralCallbackResult) => void;
  complete?: () => void;
  [key: string]: any;
}

/**
 * 对微信接口的promise封装
 * @param fn 微信API函数
 * @param args 调用参数
 * @returns Promise 包装后的Promise对象
 */
function promisify(
  fn: (options: any) => void, 
  args?: Record<string, any>
): Promise<object> {
  return new Promise((resolve, reject) => {
    fn({
      ...(args || {}),
      success: (res: object) => resolve(res),
      fail: (err: object) => reject(err),
    });
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

function delay(method: Function, delay: number = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        method();
        resolve();
      } catch (error) {
        reject(error);
      }
    }, delay);
  });
}

function print(str: string) {
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

export {
  print,
  _getSetting,
  _authorizeBle,
  _getCharacteristics,
  _connectBlue,
  _getBLEServices,
  _closeBLEConnection,
  _closeBLEAdapter,
  _stopSearchBluetooth,
  _notifyBLECharacteristicValueChange,
  _onBluetoothFound,
  _startSearch,
  _openAdapter,
  _writeBLECharacteristicValue,
  promisify,
  // promisify_callback,
  delay
};