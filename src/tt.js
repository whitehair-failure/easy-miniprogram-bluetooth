class a {
  constructor() {}

  _onBluetoothFound(callback) {
    let devices = [];

    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach((element) => {
        let isTarget = element.name.indexOf(this.regName) != -1;

        if (
          isTarget &&
          !devices.some((device) => device.deviceId === element.deviceId)
        ) {
          devices.push(element);
        }
      });

      console.log(`已嗅探蓝牙设备数：${devices.length}...`);

      if (callback) {
        callback(devices);
      }
    });
  }
}

class b {
  constructor() {
    this.a = new a();
  }

  d() {
    this.a._onBluetoothFound((devices) => {
      console.log("this", this);

      console.log("发现设备：", devices);
    });
    return this.a;
  }
}

class BLEHandler {}

let ble = new BLEHandler({
  mode: "single",
  filterKey: ["TT", "TTS", "TT-S", "TT-S2", "TT-S3", "TT-S4"],
});

ble.init();

ble.startBlueSearch();

let foundDevices = [];

ble.onBluetoothFound((devices) => {
  console.log("发现设备：", devices);
  foundDevices = devices;

  if (foundDevices.length > 0) {
    console.log("找到设备，停止搜索");
    ble.stopBlueSearch();
  }
});

ble.onBLEConnectionStateChange((device) => {
  console.log("状态改变：", device);
});

let devices = ble.getFoundDevices();
let connectedDevices = ble.getConnectedDevices();

let dev = devices[0];

ble.connectBlue(dev);
ble.disconnect(dev);

ble.closeAdapter(dev);
