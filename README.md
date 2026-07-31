# miniprogram-bluetooth-utils

微信小程序低功耗蓝牙（BLE）工具封装库，提供简洁的 API 来管理设备发现、连接、通知订阅与数据读写。

> 新用户建议先看 [文档导航](./doc/archive/INDEX.md)。

## 特性

- 简洁 API：封装微信小程序 BLE 复杂流程，统一 Promise 异步调用。
- 单/多设备模式：`SingleDeviceBLEHandler`（默认兼容导出 `BLEHandler`）与 `MultiDeviceBLEHandler`。
- 自动重连：支持设备异常断开后的自动重试（可配置次数与间隔）。
- 过滤机制：支持白名单 `includeKeys` + 黑名单 `excludeKeys`。
- 超时控制：连接、读写都支持超时参数。
- 模块化架构：基类 + 5 个 Manager，职责清晰。
- TypeScript：完整类型定义与自定义异常类。

## 安装

```bash
npm install miniprogram-bluetooth-utils
```

也可以直接复制 `dist/` 到小程序项目中。

## 导出 API

```typescript
export * from './core/BLEHandler.base';
export * from './core/SingleDeviceBLEHandler';
export * from './core/MultiDeviceBLEHandler';
export * from './utils/error';

// 兼容旧命名
export { SingleDeviceBLEHandler as BLEHandler };
```

## 快速开始

### 单设备模式（推荐）

```typescript
import { BLEHandler } from 'miniprogram-bluetooth-utils';

const ble = new BLEHandler({
  config: {
    serviceUId: 'YOUR_SERVICE_UUID',
    writeCharacteristicId: 'YOUR_WRITE_CHARACTERISTIC_UUID',
    notifyCharacteristicId: 'YOUR_NOTIFY_CHARACTERISTIC_UUID',
    readCharacteristicId: 'YOUR_READ_CHARACTERISTIC_UUID',
    notifyType: 'notify', // 可选: 'notify' | 'indicate'
  },
  searchOption: {
    allowDuplicatesKey: false,
    interval: 0,
    includeKeys: ['设备名关键字'],
    excludeKeys: ['Test', 'Debug'],
  },
  reconnect: true,
  maxRetries: 3,
  reconnectDelay: 500,
  connectTimeout: 5000,
});

try {
  // 1) 初始化: 打开适配器并注册全局监听器
  await ble.init();

  // 2) 注册设备发现回调（返回解绑函数）
  const offDeviceFound = ble.addDeviceFoundListener((devices) => {
    console.log('发现设备:', devices);
  });

  // 3) 开始搜索
  await ble.startDeviceDiscovery();

  // 4) 选择并连接设备（示例使用第一个发现设备）
  const first = ble.foundDevList[0];
  if (first) {
    await ble.connectDevice(first);
  }

  // 5) 监听连接状态（返回解绑函数）
  const offConnection = ble.addConnectionStateChangeListener((res) => {
    console.log('连接状态变化:', res.deviceId, res.connected);
  });

  // 6) 监听特征值变化（返回解绑函数）
  const offValueChange = ble.addCharacteristicValueChangeListener((res) => {
    console.log('收到数据:', res.value);
  });

  // 7) 写入
  const buffer = new ArrayBuffer(8);
  await ble.writeCharacteristicValue({
    value: buffer,
    responseConfig: {
      hasResponse: true,
      timeoutMs: 2000,
    },
  });

  // 8) 读取
  const data = await ble.readCharacteristicValue({ timeoutMs: 2000 });
  console.log('读取成功:', data);

  // 使用完后可按需解绑
  offDeviceFound();
  offConnection();
  offValueChange();
} catch (err) {
  console.error('BLE 操作失败:', err);
}

// 页面卸载 / 组件销毁时
// await ble.release();
```

### 多设备模式

```typescript
import { MultiDeviceBLEHandler } from 'miniprogram-bluetooth-utils';

const ble = new MultiDeviceBLEHandler({
  config: {
    serviceUId: 'YOUR_SERVICE_UUID',
    writeCharacteristicId: 'YOUR_WRITE_CHARACTERISTIC_UUID',
    notifyCharacteristicId: 'YOUR_NOTIFY_CHARACTERISTIC_UUID',
  },
  reconnect: true,
  searchOption: {
    allowDuplicatesKey: false,
    interval: 0,
  },
});

await ble.init();
await ble.startDeviceDiscovery();

const deviceA = ble.foundDevList[0];
const deviceB = ble.foundDevList[1];

if (deviceA) await ble.connectDevice(deviceA);
if (deviceB) await ble.connectDevice(deviceB);

if (deviceA) {
  await ble.writeCharacteristicValue({
    deviceId: deviceA.deviceId, // 多设备模式必填
    value: new ArrayBuffer(8),
    timeoutMs: 2000,
  });
}

if (deviceA) {
  await ble.disconnectDevice(deviceA.deviceId);
}
```

## 初始化与释放

```typescript
const ble = new BLEHandler(options);
await ble.init();

// ... 业务逻辑

await ble.release();
```

- `init()`：打开适配器并注册全局监听器（连接状态、特征值变化）。
- `release()`：断开所有连接、移除全局监听、关闭适配器；释放后可再次调用 `init()`。

## 核心类型

```typescript
interface BLEHandlerConstructor {
  config?: BLEHandlerConfig;
  searchOption: SearchOption;
  reconnect?: boolean;
  connectTimeout?: number;
  maxRetries?: number;
  reconnectDelay?: number;
  mode?: 'single' | 'multiple';
}

interface BLEHandlerConfig {
  serviceUId?: string;
  readCharacteristicId?: string;
  writeCharacteristicId?: string;
  notifyCharacteristicId?: string;
  notifyType?: 'notification' | 'indication';
}
```

说明：`serviceUId` 在类型层是可选；若不设置，会跳过基于该服务的特征值校验流程。

## 主要实例方法

### 通用（基类）

- `init()`
- `release()`
- `getAdapterStatus()`
- `openAdapter()`
- `closeAdapter()`
- `startDeviceDiscovery(searchOption?)`
- `stopDeviceDiscovery()`
- `addDeviceFoundListener(callback)`
- `addConnectionStateChangeListener(callback)`
- `addCharacteristicValueChangeListener(callback)`
- `removeCharacteristicValueChangeListener(callback)`
- `removeAllCharacteristicValueChangeListeners()`
- `updateDeviceFilterOptions(filterOptions)`
- `getDeviceFilterOptions()`
- `validateCharacteristics(deviceId, serviceId?)`
- `updateBLEHandlerConfig(cfg)`
- Getter: `foundDevList`, `historyDevList`, `connectedDevices`, `historyConnectedDevices`, `singleConnectedDevice`, `config`

### 单设备模式

- `connectDevice(devOrDeviceId)`
- `disconnectDevice()`
- `getDeviceRSSI()`
- `getDeviceServices()`
- `enableCharacteristicNotification(deviceId?, serviceId?, characteristicId?)`
- `writeCharacteristicValue(options)`
- `readCharacteristicValue(options)`

### 多设备模式

- `connectDevice(devOrDeviceId)`
- `disconnectDevice(deviceId)`
- `getDeviceRSSI(deviceId)`
- `getDeviceServices(deviceId)`
- `enableCharacteristicNotification(deviceId, serviceId?, characteristicId?)`
- `writeCharacteristicValue(options)`（`options.deviceId` 必填）
- `readCharacteristicValue(options)`（`options.deviceId` 必填）

## 错误处理

所有异步 API 都会抛错，建议统一 `try/catch`。

```typescript
try {
  await ble.connectDevice(device);
} catch (err) {
  if (err instanceof BLEConnectionError) {
    // 连接错误处理
  }
}
```

当前自定义异常类（均继承 `BLEError`）：

- `BLEAdapterError`
- `BLEPermissionError`
- `BLEConnectionError`
- `BLETimeoutError`
- `BLEDeviceNotFoundError`
- `BLEServiceError`
- `BLEConfigError`
- `BLEIOError`

## 项目结构

```text
src/
├── index.ts
├── core/
│   ├── BLEHandler.base.ts
│   ├── SingleDeviceBLEHandler.ts
│   ├── MultiDeviceBLEHandler.ts
│   ├── BLEHandler.ts.backup
│   └── modules/
│       ├── AdapterManager.ts
│       ├── DiscoveryManager.ts
│       ├── ConnectionManager.ts
│       ├── ServiceManager.ts
│       └── IOManager.ts
├── types/
│   └── ble.d.ts
└── utils/
    └── error.ts
```

## 开发

```bash
npm install
npm run build
npm run clean
npx tsc --noEmit
```

## 文档

- [文档导航](./doc/archive/INDEX.md)
- [详细示例](./doc/archive/EXAMPLES.md)
- [架构设计](./doc/archive/ARCHITECTURE.md)
- [设备过滤指南](./doc/archive/DEVICE_FILTER_GUIDE.md)
- [API 迁移说明](./doc/archive/RENAME.md)
- [更新日志](./CHANGELOG.md)

## 注意事项

1. 确保微信基础库版本支持所需 BLE API。
2. 在 `app.json` 配置蓝牙权限。
3. 建议所有 BLE 操作都使用 `try/catch`。
4. 页面卸载时调用 `release()` 释放资源。

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request。
