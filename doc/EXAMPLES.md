# 详细使用示例指南

本文档提供了 miniprogram-bluetooth-utils 库的完整使用示例，涵盖单设备、多设备、设备过滤、错误处理等各种场景。

## 目录

- [详细使用示例指南](#详细使用示例指南)
  - [目录](#目录)
  - [基础使用](#基础使用)
    - [单设备模式 - 心率计](#单设备模式---心率计)
    - [多设备模式 - 多传感器](#多设备模式---多传感器)
  - [设备过滤](#设备过滤)
    - [白名单过滤](#白名单过滤)
    - [黑名单过滤](#黑名单过滤)
    - [双重过滤](#双重过滤)
    - [运行时动态更新](#运行时动态更新)
  - [连接与重连](#连接与重连)
    - [自动重连](#自动重连)
    - [监听连接状态](#监听连接状态)
  - [数据读写](#数据读写)
    - [写入数据](#写入数据)
    - [读取数据](#读取数据)
    - [特征值变化监听](#特征值变化监听)
  - [错误处理](#错误处理)
    - [异常类型](#异常类型)
    - [完整错误处理示例](#完整错误处理示例)
  - [高级应用](#高级应用)
    - [配置更新](#配置更新)
    - [页面生命周期管理](#页面生命周期管理)
  - [最佳实践](#最佳实践)
  - [完整应用框架](#完整应用框架)
  - [参考](#参考)

---

## 基础使用

### 单设备模式 - 心率计

最常见的场景：一次只连接一个蓝牙设备。

```typescript
import { SingleDeviceBLEHandler } from 'miniprogram-bluetooth-utils';

// 1. 初始化
const heartRateMonitor = {
  handler: null,

  async init() {
    this.handler = new SingleDeviceBLEHandler({
      config: {
        serviceUId: '180D',  // 心率服务 UUID
        writeCharacteristicId: '2A37',  // 心率特征值
        notifyCharacteristicId: '2A37',  // 通知特征值
      },
      reconnect: true,  // 启用自动重连
      maxRetries: 3,
      reconnectDelay: 3000,
      connectTimeout: 10000,
    });

    try {
      // 初始化蓝牙适配器
      await this.handler.openAdapter();
      console.log('✅ 蓝牙适配器已打开');
    } catch (err) {
      console.error('❌ 打开蓝牙适配器失败:', err);
      throw err;
    }
  },

  // 2. 搜索设备
  async searchDevices() {
    if (!this.handler) await this.init();

    try {
      await this.handler.startDeviceDiscovery({
        allowDuplicatesKey: false,
        interval: 0,
      });

      this.handler.addDeviceFoundListener((devices) => {
        console.log('📱 发现设备:', devices.map(d => d.name));
      });

      console.log('🔍 开始搜索设备...');
      // 搜索 10 秒后停止
      setTimeout(() => {
        this.handler.stopDeviceDiscovery();
      }, 10000);
    } catch (err) {
      console.error('❌ 搜索设备失败:', err);
    }
  },

  // 3. 连接设备
  async connectDevice(device) {
    try {
      console.log(`⏳ 正在连接 ${device.name}...`);
      await this.handler.connectDevice(device);
      console.log('✅ 已连接到设备');

      // 连接成功后，启用特征值通知
      await this.handler.enableCharacteristicNotification();
      console.log('✅ 已启用特征值通知');
    } catch (err) {
      console.error('❌ 连接失败:', err);
      throw err;
    }
  },

  // 4. 监听心率数据
  listenHeartRate() {
    const unsubscribe = this.handler.addCharacteristicValueChangeListener((result) => {
      // result.value 是 Uint8Array，包含心率数据
      const heartRate = result.value[1];  // 通常心率在第二个字节
      console.log(`❤️ 心率: ${heartRate} bpm`);
    });

    return unsubscribe;  // 保存用于后续取消
  },

  // 5. 断开连接
  async disconnect() {
    try {
      await this.handler.disconnectDevice();
      console.log('✅ 已断开连接');
    } catch (err) {
      console.error('❌ 断开失败:', err);
    }
  },

  // 6. 清理资源
  async cleanup() {
    try {
      await this.handler.release();
      console.log('✅ 已释放所有资源');
    } catch (err) {
      console.error('❌ 清理失败:', err);
    }
  },
};

// 使用示例
(async () => {
  try {
    await heartRateMonitor.init();
    await heartRateMonitor.searchDevices();
    // 用户选择设备后
    // await heartRateMonitor.connectDevice(selectedDevice);
    // heartRateMonitor.listenHeartRate();
  } catch (err) {
    console.error('应用错误:', err);
  }
})();
```

---

### 多设备模式 - 多传感器

场景：同时连接多个蓝牙设备进行数据采集。

```typescript
import { MultiDeviceBLEHandler } from 'miniprogram-bluetooth-utils';

const multiSensorApp = {
  handler: null,
  connectedDevices: new Map(),  // 设备 ID → 设备对象映射

  async init() {
    this.handler = new MultiDeviceBLEHandler({
      config: {
        serviceUId: '180A',  // 设备信息服务
        readCharacteristicId: '2A29',  // 厂商名称
        writeCharacteristicId: '2A19',  // 电池电量
        notifyCharacteristicId: '2A19',
      },
      reconnect: true,
      maxRetries: 3,
    });

    try {
      await this.handler.openAdapter();
      console.log('✅ 蓝牙适配器已打开');
    } catch (err) {
      console.error('❌ 打开失败:', err);
      throw err;
    }
  },

  async searchDevices() {
    if (!this.handler) await this.init();

    try {
      await this.handler.startDeviceDiscovery();
      this.handler.addDeviceFoundListener((devices) => {
        console.log('发现设备:', devices.map(d => `${d.name}(${d.deviceId})`));
      });
    } catch (err) {
      console.error('❌ 搜索失败:', err);
    }
  },

  async connectMultipleDevices(deviceList) {
    const results = [];

    for (const device of deviceList) {
      try {
        console.log(`⏳ 连接 ${device.name}...`);
        await this.handler.connectDevice(device);
        this.connectedDevices.set(device.deviceId, device);
        console.log(`✅ ${device.name} 已连接`);
        results.push({ device, status: 'success' });
      } catch (err) {
        console.error(`❌ ${device.name} 连接失败:`, err);
        results.push({ device, status: 'failed', error: err });
      }
    }

    return results;
  },

  async readFromDevice(deviceId) {
    try {
      const result = await this.handler.readCharacteristicValue({
        deviceId,
        // 其他参数自动使用 config 中的默认值
      });

      console.log(`📖 设备 ${deviceId} 的读取结果:`, result);
      return result;
    } catch (err) {
      console.error(`❌ 读取失败 (${deviceId}):`, err);
      throw err;
    }
  },

  async writeToDevice(deviceId, data) {
    try {
      await this.handler.writeCharacteristicValue({
        deviceId,  // ← 多设备模式必须指定
        value: data,
      });

      console.log(`📝 已向 ${deviceId} 写入数据`);
    } catch (err) {
      console.error(`❌ 写入失败 (${deviceId}):`, err);
      throw err;
    }
  },

  monitorAllDevices() {
    const unsubscribe = this.handler.addCharacteristicValueChangeListener((result) => {
      const { deviceId, value } = result;
      console.log(`📊 ${deviceId} 的数据:`, value);
    });

    return unsubscribe;
  },

  async disconnectDevice(deviceId) {
    try {
      await this.handler.disconnectDevice(deviceId);  // ← 多设备模式必须指定
      this.connectedDevices.delete(deviceId);
      console.log(`✅ 已断开 ${deviceId}`);
    } catch (err) {
      console.error(`❌ 断开失败 (${deviceId}):`, err);
    }
  },

  async disconnectAll() {
    const disconnectPromises = Array.from(this.connectedDevices.keys()).map(deviceId =>
      this.disconnectDevice(deviceId),
    );

    await Promise.all(disconnectPromises);
    console.log('✅ 所有设备已断开');
  },
};

// 使用示例
(async () => {
  try {
    await multiSensorApp.init();
    await multiSensorApp.searchDevices();

    // 连接多个设备
    const devices = [
      { deviceId: 'DEV1', name: '传感器A' },
      { deviceId: 'DEV2', name: '传感器B' },
    ];
    const results = await multiSensorApp.connectMultipleDevices(devices);

    // 从所有连接的设备读取数据
    for (const [deviceId] of multiSensorApp.connectedDevices) {
      await multiSensorApp.readFromDevice(deviceId);
    }

    // 监听所有设备的数据变化
    multiSensorApp.monitorAllDevices();

    // 断开所有设备
    // await multiSensorApp.disconnectAll();
  } catch (err) {
    console.error('应用错误:', err);
  }
})();
```

---

## 设备过滤

### 白名单过滤

只接受特定品牌或特定前缀的设备。

```typescript
import { SingleDeviceBLEHandler } from 'miniprogram-bluetooth-utils';

const whitelistExample = async () => {
  const handler = new SingleDeviceBLEHandler({
    config: { serviceUId: '180A' },
    // 只接受名字中包含这些关键字的设备
    filterOptions: {
      includeKeys: ['MyDevice', 'SmartBand', 'HeartRate'],
    },
  });

  handler.addDeviceFoundListener((devices) => {
    // ✅ 只会显示包含上述关键字的设备
    console.log('✅ 过滤后的设备:', devices.map(d => d.name));
  });

  await handler.startDeviceDiscovery();
};
```

### 黑名单过滤

排除测试、离线或其他不需要的设备。

```typescript
const blacklistExample = async () => {
  const handler = new SingleDeviceBLEHandler({
    config: { serviceUId: '180A' },
    // 排除这些关键字的设备
    filterOptions: {
      excludeKeys: ['TEST', 'DEBUG', 'Offline', 'Broken'],
    },
  });

  handler.addDeviceFoundListener((devices) => {
    // ✅ 排除了包含黑名单关键字的设备
    console.log('✅ 有效设备:', devices.map(d => d.name));
  });

  await handler.startDeviceDiscovery();
};
```

### 双重过滤

同时使用白名单和黑名单。

```typescript
const dualFilterExample = async () => {
  const handler = new SingleDeviceBLEHandler({
    config: { serviceUId: '180A' },
    filterOptions: {
      // 必须包含至少一个白名单关键字
      includeKeys: ['Sensor', 'Device'],
      // 同时排除黑名单关键字
      excludeKeys: ['Broken', 'Old', 'Deprecated'],
    },
  });

  handler.addDeviceFoundListener((devices) => {
    // ✅ 设备名包含 "Sensor" 或 "Device"
    // ✅ 且不包含 "Broken"、"Old" 或 "Deprecated"
    console.log('✅ 有效设备:', devices);
  });

  await handler.startDeviceDiscovery();
};
```

### 运行时动态更新

根据用户选择或条件动态调整过滤规则。

```typescript
const dynamicFilterExample = async () => {
  const handler = new SingleDeviceBLEHandler({
    config: { serviceUId: '180A' },
    filterOptions: {
      includeKeys: ['Device'],
    },
  });

  await handler.startDeviceDiscovery();

  // 用户在 UI 中选择了新的过滤条件
  function onUserFilterChange(brands, excludeWords) {
    handler.updateDeviceFilterOptions({
      includeKeys: brands.length > 0 ? brands : undefined,
      excludeKeys: excludeWords.length > 0 ? excludeWords : undefined,
    });
    console.log('✅ 过滤规则已更新');
  }

  // 获取当前过滤规则
  function getCurrentFilter() {
    const filter = handler.getDeviceFilterOptions();
    console.log('当前白名单:', filter.includeKeys);
    console.log('当前黑名单:', filter.excludeKeys);
    return filter;
  }

  // 清空过滤（接受所有设备）
  function clearFilter() {
    handler.updateDeviceFilterOptions({});
    console.log('✅ 过滤规则已清空');
  }

  // 模拟用户操作
  onUserFilterChange(['Apple', 'Samsung'], ['Test']);
  getCurrentFilter();
  clearFilter();
};
```

---

## 连接与重连

### 自动重连

设备断开后自动重新连接。

```typescript
const autoReconnectExample = async () => {
  const handler = new SingleDeviceBLEHandler({
    config: { serviceUId: '180A' },
    reconnect: true,      // ← 启用自动重连
    maxRetries: 5,        // 最多重试 5 次
    reconnectDelay: 2000, // 每次等待 2 秒
  });

  try {
    await handler.openAdapter();
    await handler.init();

    // 连接设备后，如果意外断开，会自动尝试重连
    // 用户通过 onConnectionStateChange 监听重连事件
    handler.onConnectionStateChange({
      connected: (deviceId) => {
        console.log('✅ 设备已连接:', deviceId);
      },
      disconnected: (deviceId) => {
        console.log('⚠️ 设备已断开，正在自动重连...', deviceId);
      },
    });
  } catch (err) {
    console.error('❌ 初始化失败:', err);
  }
};
```

### 监听连接状态

实时监听设备连接、断开和重连事件。

```typescript
const connectionStateExample = async () => {
  const handler = new SingleDeviceBLEHandler({
    config: { serviceUId: '180A' },
    reconnect: true,
  });

  handler.onConnectionStateChange({
    // 连接成功
    connected: (deviceId) => {
      console.log('✅ 已连接:', deviceId);
      // 更新 UI
      wx.setStorageSync('connectedDevice', deviceId);
    },

    // 已断开
    disconnected: (deviceId) => {
      console.log('📵 已断开:', deviceId);
      // 清理资源、更新 UI
      wx.removeStorageSync('connectedDevice');
    },

    // 通用回调（包含详细信息）
    callback: (result) => {
      console.log('连接状态变化:', result);
    },
  });

  // 在页面卸载时清理
  onUnload(() => {
    handler.release();
  });
};
```

---

## 数据读写

### 写入数据

向设备发送命令或数据。

```typescript
const writeExample = async () => {
  const handler = new SingleDeviceBLEHandler({
    config: {
      serviceUId: '180A',
      writeCharacteristicId: 'ABC123',
    },
  });

  try {
    // 简单写入（无需等待响应）
    const data = new ArrayBuffer(4);
    const view = new Uint8Array(data);
    view[0] = 0x01;
    view[1] = 0x02;
    view[2] = 0x03;
    view[3] = 0x04;

    await handler.writeCharacteristicValue({
      value: data,
    });
    console.log('✅ 数据已发送');

    // 写入并等待设备响应
    await handler.writeCharacteristicValue({
      value: data,
      hasResponse: true,    // ← 等待设备响应
      timeoutMs: 2000,      // 超时 2 秒
    });
    console.log('✅ 设备已确认');
  } catch (err) {
    console.error('❌ 写入失败:', err);
  }
};
```

### 读取数据

从设备读取数据。

```typescript
const readExample = async () => {
  const handler = new SingleDeviceBLEHandler({
    config: {
      serviceUId: '180A',
      readCharacteristicId: 'XYZ789',
    },
  });

  try {
    const data = await handler.readCharacteristicValue({
      timeoutMs: 3000,
    });

    const view = new Uint8Array(data);
    console.log('✅ 读取的数据:', Array.from(view));
  } catch (err) {
    console.error('❌ 读取失败:', err);
  }
};
```

### 特征值变化监听

监听设备推送的数据（最常用）。

```typescript
const listenerExample = async () => {
  const handler = new SingleDeviceBLEHandler({
    config: {
      serviceUId: '180A',
      notifyCharacteristicId: 'NOTIFY123',
    },
  });

  // 连接设备并启用通知
  await handler.connectDevice(device);
  await handler.enableCharacteristicNotification();

  // 监听数据
  const unsubscribe = handler.addCharacteristicValueChangeListener((result) => {
    const { deviceId, value } = result;
    const view = new Uint8Array(value);

    console.log(`📊 从 ${deviceId} 收到数据:`, Array.from(view));

    // 处理数据
    processData(view);
  });

  // 可以添加多个监听器（都会被调用）
  const unsubscribe2 = handler.addCharacteristicValueChangeListener((result) => {
    console.log('📈 另一个监听器接收到数据');
  });

  // 不需要时取消监听
  // unsubscribe();
  // unsubscribe2();

  // 或清空所有监听
  // handler.removeAllCharacteristicValueChangeListeners();
};
```

---

## 错误处理

> 注意：库从 0.3.0 起**不再定义自定义异常类**，直接抛出微信原生错误对象或原生 `Error`。

### 错误类型

微信原生错误对象携带 `errMsg`、`errno` / `errCode` 字段，可用于区分错误；参数校验 / 超时场景抛出原生 `Error`。

```typescript
try {
  await handler.connectDevice(device);
} catch (err) {
  // 微信原生错误对象（errMsg / errno / errCode）或原生 Error
  if (err?.errno === 103 || err?.errCode === 103) {
    console.error('❌ 缺少蓝牙权限，请在应用权限中授予');
  } else if (err?.errMsg?.includes('timeout')) {
    console.error('❌ 连接超时，请重试');
  } else {
    console.error('❌ 错误:', err?.errMsg || err);
  }
}
```

### 完整错误处理示例

展示生产环境中的完整错误处理。

```typescript
class BluetoothDeviceManager {
  handler = null;

  async initialize() {
    try {
      this.handler = new SingleDeviceBLEHandler({
        config: {
          serviceUId: '180A',
          writeCharacteristicId: 'WRITE',
          notifyCharacteristicId: 'NOTIFY',
        },
        reconnect: true,
      });

      // 打开适配器
      try {
        await this.handler.openAdapter();
      } catch (err) {
        if (err?.errno === 103 || err?.errCode === 103) {
          throw new Error('请在系统设置中授予蓝牙权限');
        }
        if (err?.errno === 1500102 || err?.errCode === 10001) {
          throw new Error('请打开手机蓝牙后重试');
        }
        throw err;
      }
    } catch (err) {
      this.handleError('初始化', err);
      throw err;
    }
  }

  async connect(device) {
    try {
      await this.handler.connectDevice(device);
      await this.handler.enableCharacteristicNotification();
      console.log('✅ 连接成功');
    } catch (err) {
      if (err?.errMsg?.includes('timeout')) {
        console.error('❌ 连接超时，设备可能距离太远');
        // 自动重试或提示用户
      } else if (err?.errno === 1500102 || err?.errCode === 10001) {
        console.error('❌ 连接被拒绝或设备不支持此服务');
      }
      throw err;
    }
  }

  async sendData(data) {
    try {
      await this.handler.writeCharacteristicValue({
        value: data,
        hasResponse: true,
        timeoutMs: 3000,
      });
    } catch (err) {
      if (err?.message?.includes('超时')) {
        console.error('❌ 设备未及时响应，请检查连接');
      } else {
        console.error('❌ 数据写入失败:', err?.errMsg || err);
      }
      throw err;
    }
  }

  handleError(operation, err) {
    console.error(`❌ ${operation}失败:`, {
      type: err?.constructor?.name,
      message: err?.errMsg || err?.message,
      errorCode: err?.errCode ?? err?.errno,
    });

    // 可以上报到日志系统
    wx.reportAnalytics('ble_error', {
      operation,
      errorType: err?.constructor?.name,
    });
  }

  async cleanup() {
    try {
      await this.handler.release();
    } catch (err) {
      console.error('⚠️ 清理资源失败:', err);
    }
  }
}

// 使用
const manager = new BluetoothDeviceManager();
try {
  await manager.initialize();
  await manager.connect(selectedDevice);
  await manager.sendData(commandBuffer);
} catch (err) {
  // 显示用户友好的错误信息
  wx.showToast({
    title: '蓝牙操作失败',
    icon: 'error',
  });
} finally {
  await manager.cleanup();
}
```

---

## 高级应用

### 配置更新

运行时更新服务或特征值 UUID（用于支持多种设备）。

```typescript
const configUpdateExample = async () => {
  const handler = new SingleDeviceBLEHandler({
    config: {
      serviceUId: '180A',  // 初始服务
      writeCharacteristicId: 'CHAR1',
    },
  });

  // 连接到不同品牌的设备时，可能需要不同的 UUID
  async function switchDevice(newDevice) {
    // 获取新设备的 UUID（可能从云端配置或用户输入）
    const newUUIDs = await getDeviceUUIDs(newDevice.name);

    // 运行时更新配置
    handler.updateBLEHandlerConfig({
      serviceUId: newUUIDs.service,
      writeCharacteristicId: newUUIDs.write,
      notifyCharacteristicId: newUUIDs.notify,
    });

    console.log('✅ 配置已更新，重新连接设备...');
    await handler.connectDevice(newDevice);
  }

  async function getDeviceUUIDs(deviceName) {
    // 从云端或本地数据库获取配置
    const config = {
      'Device A': {
        service: 'SERVICE_UUID_A',
        write: 'WRITE_CHAR_A',
        notify: 'NOTIFY_CHAR_A',
      },
      'Device B': {
        service: 'SERVICE_UUID_B',
        write: 'WRITE_CHAR_B',
        notify: 'NOTIFY_CHAR_B',
      },
    };
    return config[deviceName];
  }
};
```

### 页面生命周期管理

在微信小程序中正确管理蓝牙资源。

```typescript
// page.ts
import { SingleDeviceBLEHandler } from 'miniprogram-bluetooth-utils';

Page({
  data: {
    connected: false,
    lastHeartRate: 0,
  },

  handler: null,
  unsubscribe: null,

  onLoad() {
    // 页面加载时初始化
    this.initBluetooth();
  },

  async initBluetooth() {
    try {
      this.handler = new SingleDeviceBLEHandler({
        config: {
          serviceUId: '180D',
          notifyCharacteristicId: '2A37',
        },
        reconnect: true,
        connectTimeout: 10000,
      });

      await this.handler.getAdapterStatus();
    } catch (err) {
      wx.showToast({
        title: '蓝牙不可用',
        icon: 'error',
      });
    }
  },

  async onConnect(device) {
    try {
      // 连接设备
      await this.handler.connectDevice(device);

      // 启用通知
      await this.handler.enableCharacteristicNotification();

      // 监听数据
      this.unsubscribe = this.handler.addCharacteristicValueChangeListener((result) => {
        const heartRate = result.value[1];
        this.setData({ lastHeartRate: heartRate });
      });

      // 监听连接状态
      this.handler.onConnectionStateChange({
        connected: () => {
          this.setData({ connected: true });
        },
        disconnected: () => {
          this.setData({ connected: false });
        },
      });

      this.setData({ connected: true });
    } catch (err) {
      wx.showToast({
        title: '连接失败',
        icon: 'error',
      });
    }
  },

  onShow() {
    // 页面显示时的操作
    if (this.handler && !this.data.connected) {
      // 尝试重新连接
    }
  },

  onHide() {
    // 页面隐藏时，断开连接（可选）
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  },

  async onUnload() {
    // 页面卸载时，必须释放所有资源
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    try {
      await this.handler?.release();
    } catch (err) {
      console.error('释放资源失败:', err);
    }
  },
});
```

---

## 最佳实践

1. **总是使用 try-catch**
   ```typescript
   try {
     await bleHandler.connectDevice(device);
   } catch (err) {
     // 处理异常
   }
   ```

2. **记得释放资源**
   ```typescript
   onUnload(() => {
     handler.release();
   });
   ```

3. **多监听器时保存取消函数**
   ```typescript
   const unsub1 = handler.addCharacteristicValueChangeListener(cb1);
   const unsub2 = handler.addCharacteristicValueChangeListener(cb2);
   // 需要时
   unsub1();
   unsub2();
   ```

4. **使用深拷贝的设备列表**
   ```typescript
   // ✅ 返回的是深拷贝
   const devices = handler.foundDevList;
   devices.push(fake);  // 不影响内部
   ```

5. **单设备模式不需要 deviceId**
   ```typescript
   // ❌ 错误
   const single = new SingleDeviceBLEHandler({...});
   await single.writeCharacteristicValue({
     deviceId: 'ABC',  // 不需要！
     value: data,
   });

   // ✅ 正确
   await single.writeCharacteristicValue({
     value: data,
   });
   ```

6. **多设备模式必须指定 deviceId**
   ```typescript
   // ✅ 正确
   const multi = new MultiDeviceBLEHandler({...});
   await multi.writeCharacteristicValue({
     deviceId: 'ABC',  // 必需！
     value: data,
   });
   ```

---

## 完整应用框架

```typescript
// app.ts
export const bleManager = {
  handler: null,

  async init() {
    // 应用启动时初始化蓝牙
    try {
      const { SingleDeviceBLEHandler } = await import('miniprogram-bluetooth-utils');
      this.handler = new SingleDeviceBLEHandler({
        config: {
          serviceUId: '180A',
        },
        reconnect: true,
      });
    } catch (err) {
      console.error('蓝牙初始化失败:', err);
    }
  },
};

// page.ts
import { bleManager } from '../app';

Page({
  async onLoad() {
    if (!bleManager.handler) {
      await bleManager.init();
    }
  },

  async connectDevice(device) {
    try {
      await bleManager.handler.connectDevice(device);
      this.onConnected();
    } catch (err) {
      this.showError('连接失败');
    }
  },

  onConnected() {
    // 业务逻辑
  },

  showError(message) {
    wx.showToast({ title: message, icon: 'error' });
  },

  onUnload() {
    bleManager.handler?.release();
  },
});
```

---

## 参考

- [README.md](../README.md) - 快速开始
- [DEVICE_FILTER_GUIDE.md](./DEVICE_FILTER_GUIDE.md) - 设备过滤详细说明
- [RENAME.md](./RENAME.md) - API 迁移对照
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 架构说明
