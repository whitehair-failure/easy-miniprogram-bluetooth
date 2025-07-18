import BLEHandler from "./bleHandler"
import * as ModbusRtu from "../modbus/modebusRtu"
import * as comm from "../comm"
import * as t from "./tools"
const app = getApp()
import {
  StatusInfo
} from "../../pages/index/indexModBusLogic"
import {
  InputParam,
  SwitchParam,
} from "../../utils/modbus/modbusLogic"
import {
  ModbusHandler
} from "../../utils/modbus/modBusHandle"
let timerId;

class BLE extends BLEHandler {
  constructor() {
    super()
    super.regName = 'CH9141';
    // super.regName = 'Bule';
    this.BleResolve = null;
    this.BleReject = null;
    this.connectCount = 0;
    this.isAutoReConnect = true;
    this.notifySuccessFn = null;
  }

  async init(isSearch = false) {
    let [err, res] = await t._getSetting()

    if (res.authSetting['scope.bluetooth']) {
      console.log("ble-init-已授权")
      let [err, res] = await t._authorizeBle()
      console.log("ble-init-t.authorizeBle", [err, res])

      if (res != null) {
        // 打开蓝牙适配器状态监听
        this.onBLEConnectionStateChange()
        // 蓝牙适配器初始化
        await this.openAdapter();


      }
    }
    // 打开蓝牙适配器状态监听
    this.onBLEConnectionStateChange()
    // 蓝牙适配器初始化
    await this.openAdapter();

    if (isSearch) {
      // 搜索蓝牙设备
      await this.startSearch()
      // 获取设备ID
      await this.onBluetoothFound()
    }

  }
  // 打开蓝牙适配器状态监听
  onBLEConnectionStateChange() {
    const that = this
    wx.onBLEConnectionStateChange(async function (res) {

      console.log("onBLEConnectionStateChange", res)

      if (!res.connected) {

        if (that.isAutoReConnect) {
          console.log("蓝牙已断开，尝试自动重连", res)
          wx.setStorageSync("bluestatus", "");
          let [
            [disconnectErr, disconnectRes],
            [connectErr, concectRes]
          ] = await withTimeout(that.connectBlue(that.dev, true), 3000).catch(error => {
            console.log("自动重连超时")
            wx.showToast({
              title: '蓝牙已断开',
            })
            that.dev.isConnect = false
            that.setData()

            return
          })


          if (connectErr) {
            // console.log("蓝牙已断开，尝试自动重连失败", res)
            that.setData()

            wx.showToast({
              title: '蓝牙已断开',
            })
          }
        }
        that.dev.isConnect = false
        // that.appendToDevList(that.dev,false)

        console.log("蓝牙已断开", that.foundDevList)
        wx.showToast({
          title: '蓝牙已断开'
        })
        that.setData()
      } else {
        wx.setStorageSync('savedDevice', that.dev);
        // that.appendToDevList(that.dev,true)
        that.dev.isConnect = true
        console.log("foundDevList", that.foundDevList);
        console.log("currentDev", that.dev);
        await that.stopSearchBluetooth()
        await that.getBLEServices()
        await that.getCharacteristics()
        await that.notifyBLECharacteristicValueChange()
        that.onBLECharacteristicValueChange()
        let mtu = await wx.getBLEMTU({
          deviceId: that.dev.deviceId,
          writeType: 'write',
        })
        console.log("MTU:", mtu)

        wx.onBLEMTUChange(function (res) {
          console.log('onBLEMTUChange mtu is', res.mtu)
        })

        app.globalData.connectBlueNotify = true;

        passwordVerify().then(res => {
          console.log('res 127', res);

          if (!res.passwordSwitchStatus) {
            startTimer([new StatusInfo()], 100);
          }

          that.triggerNotifySuccess(res); // 安全调用回调
        }).catch(err => {
          console.error("Password verification failed:", err);
        });


      }

      that.setData()


    })
  }

  // 设置回调函数
  setNotifySuccessCallback(fn) {
    if (typeof fn === 'function') {
      this.notifySuccessFn = fn;
    } else {
      console.error("notifySuccessFn must be a function");
    }
  }

  // 调用回调函数
  triggerNotifySuccess(res) {
    if (typeof this.notifySuccessFn === 'function') {
      this.notifySuccessFn(res);
    }
  }

  async connectBlue(dev, isAutoConnect = false) {
    // let dev = this.getDevById(deviceId)
    console.log('connectBlue', dev)

    let resp = null
    if (isAutoConnect) {
      // super.deviceId = dev.deviceId
      this.dev = dev
      console.log("connectBlue", this.dev);

      resp = await super.connectBlue(dev)
    } else {
      //当前设备如果已连接 先关闭当前设备；

      if (this.dev && this.dev.isConnect) {
        this.isAutoReConnect = false;
        console.log("手动connectBlue 先关闭", this.dev);
        resp = await this.closeBLEConnection()
        clearTimer()
      }

      super.dev = dev

      wx.showLoading({
        title: '正在连接'
      })
      // super.deviceId = dev.deviceId
      resp = await super.connectBlue(dev)
    }

    if (resp[0] == null) {


      t.delay(() => {
        wx.showToast({
          title: '连接成功'
        })
        // let savedDeviceTem = this.getDevById(this.deviceId);
        this.isAutoReConnect = true
        this.dev.isConnect = true

        console.log("dev", dev);

        this.setData()

      }, 400)

    }

    return [
      [null, null],
      resp
    ]
  }






  sentMoubusFrame(frame) {
    var asyncOperationPromise = new Promise((resolve, reject) => {
      this.BleResolve = resolve
      this.BleReject = reject
      console.log('sendCommand', comm.ab2hex(new Uint8Array(frame)))
      t._writeBLECharacteristicValue.call(this, frame).then(res => {
        console.log('wait response...')
      }).catch(err => {
        console.log('出错')
        reject(err);
      })

    });
    return withTimeout(asyncOperationPromise)
  }

  sendFrameNoResp(frame) {
    t._writeBLECharacteristicValue.call(this, frame).then(res => {
      console.log('sendFrameNoResp success')
    }).catch(err => {
      console.log('出错')
      reject(err);
    })
  }



  onBLECharacteristicValueChange() {
    wx.onBLECharacteristicValueChange(res => {
      let arrbf = new Uint8Array(res.value)
      console.log('response:', comm.ab2hex(arrbf))

      if (this.dFUProgressCallback) {
        this.dFUProgressCallback(arrbf)
        return
      }


      let modbusHandler = app.globalData.modbusHandler


      try {
        var resp = ModbusRtu.parseModbusResponse(arrbf)
      } catch (error) {
        console.log("resp解析异常", error)
        if (this.BleReject) this.BleReject(error)
        return
      }
      this.BleResolve(resp)
    });
  }


  registerDFUProgressCallback(callBack) {
    console.log('回调已注册')
    this.dFUProgressCallback = callBack
  }
  delDFUProgressCallback() {
    this.dFUProgressCallback = null
  }


  async release() {
    this.isAutoReConnect = false
    await super.closeBLEConnection()
    wx.offBLEConnectionStateChange()
    wx.offBLECharacteristicValueChange()

    this.delDFUProgressCallback()
    await super.closeBLEAdapter()
    clearTimer()

  }

}

async function passwordVerify() {
  console.log(114514);
  let modbusHandler = app.globalData.modbusHandler;

  let passwordSwitchParam = new SwitchParam({
    value: 0,
    registerAddress: [97, 29],
  });

  console.log('modbusHandler', modbusHandler);
  console.log('passwordSwitchParam', passwordSwitchParam);
  // 密码启用
  let [err, res] = await modbusHandler.batchReadParam([passwordSwitchParam]);

  console.log('passwordSwitchParam err', err);
  console.log('passwordSwitchParam res', res);

  if(res[0] == 768) {
    return {
      passwordSwitchStatus: false,
      password: -1,
      upgradeFailed: true
    }
  }

  // 兼容未升级无密码地址的设备
  if (err || res.length == 0) {
    return {
      passwordSwitchStatus: false,
      password: -1
    }
  }

  let passwordSwitchStatus = Boolean(res[0]);
  let password = -1;

  console.log('passwordSwitchStatus', passwordSwitchStatus);
  // 判断密码是否已开启
  if (passwordSwitchStatus) {
    let passwordParam = new InputParam({
      registerAddress: [97, 24],
      value: 0,
      commandCode: ModbusRtu.commandCodes.WRITE_PERSISTENT.code
    });
    // 密码设置 
    let [err, res] = await modbusHandler.batchReadParam([passwordParam]);
    password = res[0];
    console.log('passwordParam err', err);
    console.log('passwordParam res', res);

  }

  return {
    passwordSwitchStatus,
    password
  }


  /* await modbusHandler.insertToQueueHead(passwordSwitchParam);
  if (passwordSwitchParam.value) {
    let passwordParam = new InputParam({
      registerAddress: [97, 24],
      value: 0,
      commandCode: ModbusRtu.commandCodes.WRITE_NON_PERSISTENT.code
    });
    // 密码设置 
    await modbusHandler.insertToQueueHead(passwordParam);
    console.log('passwordParam 293', passwordParam);
  } */


}

async function autoConnect(callBack) {
  app.globalData.ble = new BLE();
  app.globalData.modbusHandler = new ModbusHandler();
  /* var ble = app.globalData.ble
  await ble.init(); */

  app.globalData.ble.setNotifySuccessCallback(callBack);
  // 自动连接的逻辑
  /* let savedDevice = wx.getStorageSync('savedDevice');
  savedDevice.isConnect = false;
  console.log('savedDevice', savedDevice)
  console.log('ble.deviceId', ble.dev)

  if (savedDevice && !ble.isConnect) {

    wx.showToast({
      title: '自动连接中...',
      icon: 'loading'
    });



    let [
      [disconnectErr, disconnectRes],
      [connectErr, concectRes]
    ] = await ble.connectBlue(savedDevice, true);

    console.log('disconnectRes', disconnectRes);
    console.log('concectRes', concectRes);
    console.log("autoConnect-foundDevList", ble.foundDevList)

    ble.setData()

  } */
}

function startTimer(paramBeans, interval = 2000) {
  clearTimer()
  timerId = setInterval(() => {
    let ble = app.globalData.ble
    let modbusHandler = app.globalData.modbusHandler
    // let currentDev = ble.getDevById(ble.deviceId)
    if (!ble.dev || !ble.dev.isConnect) {
      clearTimer()
      return
    }

    paramBeans.forEach(element => {
      modbusHandler.addToSendQueue(element)
    });
  }, interval);

}

function clearTimer() {
  if (timerId != null) {
    console.log("clearInterval")
    clearInterval(timerId); // 清除定时器
    app.globalData.modbusHandler.clearSendQueue()

    timerId = null;
  }
}

/**
 * 超时控制函数
 * @param {Promise} promise 回调函数
 * @param {number} timeout 超时时间, 默认6s
 */
function withTimeout(promise, timeout = 6000) {
  let timeoutEvent = null
  const logicPromise = new Promise((resolve, reject) => {
    promise.then((data) => {
      if (timeoutEvent) {
        // 清理超时
        clearTimeout(timeoutEvent)
        timeoutEvent = null
      }
      resolve(data)
    }).catch((err) => {
      console.log('withTimeout-promise', "异常");
      reject(err)
    })
  })
  // 创建一个新的 Promise 对象，用于处理超时情况
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutEvent = setTimeout(() => {
      reject(new Error("Timeout"));
    }, timeout);
  });

  return Promise.race([logicPromise, timeoutPromise]);
}

export {
  BLE,
  startTimer,
  clearTimer,
  autoConnect,
  withTimeout
};