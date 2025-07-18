import * as t from "./tools"
import * as comm from "../comm"
import * as ModbusRtu from "../modbus/modebusRtu"
const app = getApp();

/**
 * 蓝牙工具类
 * 封装小程序蓝牙流程方法
 * 处理事件通信
 */
class BLEHandler {
  constructor(regName) {
    this.regName = regName
    this.foundDevList = [];
    this.readCharacteristicId = "";
    this.writeCharacteristicId = "0000FFE2-0000-1000-8000-00805F9B34FB";
    this.notifyCharacteristicId = "0000FFE1-0000-1000-8000-00805F9B34FB";
    this.deviceId = null;
    this.dev = null
    this.serviceUId = "0000FFE0-0000-1000-8000-00805F9B34FB";
  }
  async openAdapter() {
    var that = this;
    let [err, res] = await t._openAdapter.call(this);
    if (err != null) {
      console.error("openAdapter", err)

      // setTimeout(() => {
      //   that.openAdapter();
      // }, 1000);
/*       setTimeout(() => {
        wx.showModal({
          title: '请检查蓝牙是否开启',
          showCancel: false,
          success(res) {
            if (res.confirm) {
              that.openAdapter()
            } else if (res.cancel) {

            }
          }
        })
      }, 1500); */

      return false;
    }
    return true;
  }
  async startSearch() {
    wx.showLoading({
      title: '正在扫描',
    })
    let [err, res] = await t._startSearch.call(this);
    return [err, res]
  }
  async onBluetoothFound() {

    t._onBluetoothFound.call(this, (devices) => {
      this.setNotIndexData();

      wx.hideLoading()

      console.log("onBluetoothFound-devices", devices);

      devices.map(item => {
        console.log("!this.foundDevList.find(e=>e.deviceId==item.deviceId)", !this.foundDevList.find(e => e.deviceId == item.deviceId))
        console.log("找到设备", item.deviceId)
        // this.appendToDevList(item)
        if (!this.foundDevList.find(e => e.deviceId == item.deviceId)) {
          this.foundDevList.push({
            ...item,
            isConnect: false
          })
        }
      })

      this.setNotIndexData();
    })


  }

  appendToDevList(dev, isConnect = false) {
    let d = this.foundDevList.find(e => e.deviceId == dev.deviceId)
    if (d) {
      d.isConnect = isConnect
    } else {
      this.foundDevList.push({
        ...dev,
        isConnect: false
      })
    }

  }

  async stopSearchBluetooth() {
    let [err, res] = await t._stopSearchBluetooth.call(this);
    if (err != null) {
      return;
    }
  }
  async connectBlue(dev) {

    let [err, res] = await t._connectBlue.call(this, dev);

    return [err, res]
  }



  async getBLEServices() {
    let [err, res] = await t._getBLEServices.call(this);
    if (err != null) {
      return;
    }

    return res.services
  }
  async getCharacteristics() {
    let [err, res] = await t._getCharacteristics.call(this);
    if (err != null) {

      // 取消连接
      this.closeBLEConnection()
      this.closeBLEAdapter()
      return;
    }

    wx.setStorageSync("bluestatus", "on");
    return res.characteristics
  }
  async notifyBLECharacteristicValueChange() {
    let [err, res] = await t._notifyBLECharacteristicValueChange.call(this);
    if (err != null) {
      return;
    }
  }
  async closeBLEConnection() {
    let [err, res] = await t._closeBLEConnection.call(this);
    return [err, res]
  }
  async closeBLEAdapter() {
    let [err, res] = await t._closeBLEAdapter.call(this);

    if (err != null) {
      return;
    }
  }
  /**
   * 
   * @param {ArrayBuffer} frame 
   * @example let data = [0x01,0x06,0x02,0x04,0x0B,0xB8,0xF1,0xCE]
              let arrayBuffer = new Uint8Array(data).buffer
   */
  async sentMoubusFrame(frame) {
    console.log("sendData:", frame)
    // await this.notifyBLECharacteristicValueChange()
    // this.onBLECharacteristicValueChange()
    await t._writeBLECharacteristicValue.call(this, frame)
    return true

  }




  changeConnectStatus(deviceId) {
    this.foundDevList.map(element => {
      if (element.deviceId == deviceId) {
        console.log("changeConnectStatus-foudDev", this.foundDevList);
        console.log("changeConnectStatus-dev", element);

        element.isConnect = !element.isConnect
        console.log("changeConnectStatus", element.isConnect);
      }
    });



  }

  getDevById(id) {
    return this.foundDevList.find(element => {
      return element.deviceId == id
    });
  }

  // 收到设备推送的notification
  onBLECharacteristicValueChange() {
    wx.onBLECharacteristicValueChange(res => {
      let arrbf = new Uint8Array(res.value)
      console.log('response:', comm.ab2hex(arrbf))
      let resp = ModbusRtu.parseModbusResponse(arrbf)
      let modbusHandler = app.globalData.modbusHandler
      modbusHandler.receiveAndParseResponse(resp)
    })

  }

  setNotIndexData() {
    let pages = getCurrentPages()
    let currentPage = pages[pages.length - 1]

    currentPage.setData({
      devList: this.foundDevList,
      currentDev: this.dev
    })
  }

  setData() {
    let pages = getCurrentPages()
    let currentPage = pages[pages.length - 1]

    if (currentPage.__route__ == "pages/index/index") {
      currentPage.resetInfo()
    }
    currentPage.setData({
      devList: this.foundDevList,
      currentDev: this.dev
    })
  }

}
export default BLEHandler