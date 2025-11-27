# 使用示例

这里提供一些常见场景的完整代码示例。

## 示例 1: 基础连接和数据通信

```typescript
import { BLEHandler } from 'miniprogram-bluetooth-utils';

Page({
  data: {
    deviceList: [],
    connected: false,
  },

  bleHandler: null,

  onLoad() {
    // 初始化蓝牙处理器
    this.bleHandler = new BLEHandler({
      mode: 'single',
      config: {
        serviceUId: 'FFF0',
        writeCharacteristicId: 'FFF1',
        notifyCharacteristicId: 'FFF2',
      },
      filterKey: ['MyDevice'], // 只显示包含 'MyDevice' 的设备
      reconnect: true,
      maxRetries: 3,
      reconnectDelay: 3000,
      connectTimeout: 10000,
    });

    this.initBluetooth();
  },

  async initBluetooth() {
  // 检查蓝牙状态
  const checkResult = await this.bleHandler.getAdapterStatus();
    if (checkResult.errno) {
      wx.showToast({
        title: checkResult.errMsg,
        icon: 'none',
      });
      return;
    }

    // 初始化并搜索设备
    await this.bleHandler.init((devices) => {
      console.log('发现设备:', devices);
      this.setData({ deviceList: devices });
    });

  // 监听连接状态变化
  this.bleHandler.onConnectionStateChange({
      connected: (deviceId) => {
        console.log('设备已连接:', deviceId);
        this.setData({ connected: true });
        wx.showToast({ title: '连接成功' });
      },
      disconnected: (deviceId) => {
        console.log('设备已断开:', deviceId);
        this.setData({ connected: false });
        wx.showToast({ title: '设备已断开', icon: 'none' });
      },
    });

    // 监听数据接收
    // addCharacteristicValueChangeListener 会返回一个用于取消订阅的函数
    const unsubscribe = this.bleHandler.addCharacteristicValueChangeListener((result) => {
      const data = new Uint8Array(result.value);
      console.log('收到数据:', Array.from(data));
      // 处理接收到的数据...
    });
  },

  // 连接设备
  async connectDevice(e) {
    const index = e.currentTarget.dataset.index;
    const device = this.data.deviceList[index];

  wx.showLoading({ title: '连接中...' });
  const [err, res] = await this.bleHandler.connectDevice(device);
    wx.hideLoading();

    if (err) {
      wx.showToast({
        title: '连接失败',
        icon: 'none',
      });
      console.error('连接失败:', err);
    }
  },

  // 发送数据
  async sendData() {
    // 构造要发送的数据
    const buffer = new ArrayBuffer(4);
    const dataView = new DataView(buffer);
    dataView.setUint8(0, 0x01); // 命令字节
    dataView.setUint8(1, 0x02);
    dataView.setUint8(2, 0x03);
    dataView.setUint8(3, 0x04);

    const [err, res] = await this.bleHandler.writeCharacteristicValue({
      value: buffer,
      hasResponse: true, // 等待设备响应
      timeoutMs: 3000,
    });

    if (err) {
      console.error('发送失败:', err);
      wx.showToast({ title: '发送失败', icon: 'none' });
    } else {
      console.log('发送成功, 收到响应:', res);
      wx.showToast({ title: '发送成功' });
    }
  },

  // 断开连接
  async disconnect() {
    const [err, res] = await this.bleHandler.disconnectDevice();
    if (err) {
      console.error('断开失败:', err);
    }
  },

  onUnload() {
    // 页面卸载时释放资源
    if (this.bleHandler) {
      this.bleHandler.release(() => {
        console.log('蓝牙资源已释放');
      });
    }
  },
});
```

## 示例 2: 多设备连接

```typescript
import { BLEHandler } from 'miniprogram-bluetooth-utils';

Page({
  data: {
    deviceList: [],
    connectedDevices: [],
  },

  bleHandler: null,

  onLoad() {
    this.bleHandler = new BLEHandler({
      mode: 'multiple', // 多设备模式
      config: {
        serviceUId: 'FFF0',
        writeCharacteristicId: 'FFF1',
        notifyCharacteristicId: 'FFF2',
      },
      reconnect: true,
    });

    this.initBluetooth();
  },

  async initBluetooth() {
    await this.bleHandler.init((devices) => {
      this.setData({ deviceList: devices });
    });

    this.bleHandler.onConnectionStateChange({
      connected: (deviceId) => {
        this.updateConnectedList();
      },
      disconnected: (deviceId) => {
        this.updateConnectedList();
      },
    });
  },

  updateConnectedList() {
    this.setData({
      connectedDevices: this.bleHandler.connectedDevices,
    });
  },

  // 连接多个设备
  async connectDevice(e) {
    const index = e.currentTarget.dataset.index;
    const device = this.data.deviceList[index];

    const [err, res] = await this.bleHandler.connectDevice(device);
    if (!err) {
      this.updateConnectedList();
    }
  },

  // 向指定设备发送数据
  async sendToDevice(deviceId, data) {
    const [err, res] = await this.bleHandler.writeCharacteristicValue({
      deviceId: deviceId, // 指定设备ID
      value: data,
      hasResponse: true,
      timeoutMs: 3000,
    });

    return [err, res];
  },

  // 断开指定设备
  async disconnectDevice(e) {
    const deviceId = e.currentTarget.dataset.deviceId;
  await this.bleHandler.disconnectDevice(deviceId);
    this.updateConnectedList();
  },

  onUnload() {
    if (this.bleHandler) {
      this.bleHandler.release();
    }
  },
});
```

## 示例 3: 运行时更新配置

```typescript
import { BLEHandler } from 'miniprogram-bluetooth-utils';

Page({
  bleHandler: null,

  onLoad() {
    this.bleHandler = new BLEHandler({
      mode: 'single',
      config: {
        serviceUId: 'FFF0',
        writeCharacteristicId: 'FFF1',
        notifyCharacteristicId: 'FFF2',
      },
    });

    this.bleHandler.init();
  },

  // 运行时切换到不同的服务和特征值
  async switchToNewService() {
    const [err, newConfig] = this.bleHandler.updateBLEHandlerConfig({
      serviceUId: 'AAA0',
      writeCharacteristicId: 'AAA1',
      notifyCharacteristicId: 'AAA2',
    });

    if (err) {
      console.error('配置更新失败:', err);
      return;
    }

    console.log('新配置:', newConfig);
    // 配置更新后会自动重新订阅通知
  },
});
```

## 示例 4: 获取设备信号强度

```typescript
import { BLEHandler } from 'miniprogram-bluetooth-utils';

Page({
  bleHandler: null,

  onLoad() {
    this.bleHandler = new BLEHandler({
      mode: 'single',
      config: { /* ... */ },
    });
  },

  // 定期检查信号强度
  async monitorRSSI() {
    setInterval(async () => {
      const [err, res] = await this.bleHandler.getDeviceRSSI();
      if (!err && res) {
        console.log('当前信号强度:', res.RSSI);
        // 根据信号强度做出相应处理...
        if (res.RSSI < -80) {
          wx.showToast({
            title: '信号较弱',
            icon: 'none',
          });
        }
      }
    }, 5000); // 每5秒检查一次
  },
});
```

## 示例 5: 错误处理最佳实践

```typescript
import { BLEHandler } from 'miniprogram-bluetooth-utils';

Page({
  bleHandler: null,

  onLoad() {
    this.bleHandler = new BLEHandler({
      mode: 'single',
      config: { /* ... */ },
      reconnect: true,
      maxRetries: 3,
    });
  },

  async connectWithRetry(device, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`连接尝试 ${attempt}/${maxAttempts}`);

  const [err, res] = await this.bleHandler.connectDevice(device);

      if (!err) {
        console.log('连接成功');
        return [null, res];
      }

      console.error(`第 ${attempt} 次连接失败:`, err);

      if (attempt < maxAttempts) {
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return [new Error('连接失败，已达到最大重试次数'), null];
  },

  async sendDataWithErrorHandling(data) {
    try {
      const [err, res] = await this.bleHandler.writeCharacteristicValue({
        value: data,
        hasResponse: true,
        timeoutMs: 3000,
      });

      if (err) {
        // 处理不同类型的错误
        if (err.message.includes('Timeout')) {
          wx.showToast({ title: '发送超时', icon: 'none' });
        } else if (err.message.includes('未连接')) {
          wx.showToast({ title: '设备未连接', icon: 'none' });
          // 尝试重新连接...
        } else {
          wx.showToast({ title: '发送失败', icon: 'none' });
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('发送数据异常:', error);
      return false;
    }
  },
});
```

## 示例 6: 数据帧解析和编码

```typescript
// 工具函数：将字符串转为 ArrayBuffer
function stringToBuffer(str: string): ArrayBuffer {
  const buffer = new ArrayBuffer(str.length);
  const dataView = new Uint8Array(buffer);
  for (let i = 0; i < str.length; i++) {
    dataView[i] = str.charCodeAt(i);
  }
  return buffer;
}

// 工具函数：将 ArrayBuffer 转为十六进制字符串
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

Page({
  bleHandler: null,

  async sendCommand(command: number, params: number[]) {
    // 构造命令帧
    const buffer = new ArrayBuffer(2 + params.length);
    const dataView = new DataView(buffer);
    
    dataView.setUint8(0, 0xAA); // 帧头
    dataView.setUint8(1, command); // 命令字节
    
    // 参数
    params.forEach((param, index) => {
      dataView.setUint8(2 + index, param);
    });

    console.log('发送帧:', bufferToHex(buffer));

    const [err, res] = await this.bleHandler.writeCharacteristicValue({
      value: buffer,
      hasResponse: true,
      timeoutMs: 3000,
    });

    return [err, res];
  },

  // 如果使用自定义页面方法处理通知，可使用 addCharacteristicValueChangeListener 注册
  onBLECharacteristicValueChange(result) {
    const buffer = new Uint8Array(result.value);
    console.log('收到帧:', bufferToHex(result.value));

    // 解析帧
    if (buffer[0] === 0xBB) { // 响应帧头
      const command = buffer[1];
      const status = buffer[2];
      const data = buffer.slice(3);

      console.log('命令:', command, '状态:', status, '数据:', Array.from(data));
      
      // 根据命令类型处理数据...
    }
  },
});
```

## 小程序配置示例

### app.json
```json
{
  "permission": {
    "scope.bluetooth": {
      "desc": "你的位置信息将用于蓝牙设备搜索"
    }
  },
  "requiredPrivateInfos": ["bluetooth"]
}
```

### project.config.json
```json
{
  "setting": {
    "es6": true,
    "enhance": true,
    "minified": true,
    "babelSetting": {
      "ignore": [],
      "disablePlugins": [],
      "outputPath": ""
    }
  }
}
```

## 常见问题

### Q: 连接后无法写入数据？
A: 确保已调用 `enableCharacteristicNotification` 订阅特征值通知，这通常在连接成功后自动完成。

### Q: 如何判断是否已连接？
A: 检查 `bleHandler.connectedDevices` 或使用 `bleHandler.singleConnectedDevice`（单设备模式）。

### Q: 自动重连不生效？
A: 确保在初始化时设置了 `reconnect: true`，并且设备是异常断开（非主动调用 `disconnectDevice`）。

### Q: 如何处理大数据传输？
A: 微信小程序单次写入数据有大小限制（通常 20 字节），需要分包发送。建议实现分包逻辑或使用 MTU 协商。

### Q: 多设备模式下如何区分数据来源？
A: `addCharacteristicValueChangeListener` 回调的 `result` 参数包含 `deviceId` 字段，可以据此区分。
