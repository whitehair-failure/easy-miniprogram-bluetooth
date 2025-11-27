# miniprogram-bluetooth-utils

微信小程序低功耗蓝牙（BLE）工具封装库，提供简洁易用的 API 来管理蓝牙设备连接、数据读写等功能。

## 特性

- 🔌 **简洁的 API** - 封装微信小程序复杂的蓝牙 API，提供统一的 `[Error|null, result]` 风格返回值
- 🔄 **自动重连** - 支持设备异常断开后的自动重连机制
- 📱 **单/多设备模式** - 灵活支持单设备或多设备同时连接
- 🎯 **设备过滤** - 支持按关键字过滤搜索到的蓝牙设备
- ⏱️ **超时控制** - 连接、读写操作均支持超时控制
- 📦 **模块化设计** - 代码按职责分离，易于维护和测试
- 📘 **TypeScript 支持** - 完整的类型定义，开发体验更好

## 安装

```bash
npm install miniprogram-bluetooth-utils
```

或直接复制 `dist/` 目录到你的小程序项目中。

## 快速开始

### 基础使用（单设备模式）

```typescript
import { BLEHandler } from 'miniprogram-bluetooth-utils';

// 初始化蓝牙工具
const bleHandler = new BLEHandler({
  mode: 'single', // 单设备模式
  config: {
    serviceUId: 'YOUR_SERVICE_UUID',
    writeCharacteristicId: 'YOUR_WRITE_CHARACTERISTIC_UUID',
    notifyCharacteristicId: 'YOUR_NOTIFY_CHARACTERISTIC_UUID',
    readCharacteristicId: 'YOUR_READ_CHARACTERISTIC_UUID',
  },
  filterKey: ['设备名关键字'], // 可选：按设备名过滤
  reconnect: true, // 启用自动重连
  maxRetries: 3, // 最大重连次数
  reconnectDelay: 3000, // 重连间隔（毫秒）
  connectTimeout: 10000, // 连接超时时间（毫秒）
  searchOption: {
    allowDuplicatesKey: false,
    interval: 0,
  }
});

  // 初始化并搜索设备
await bleHandler.init((devices) => {
  console.log('发现设备:', devices);
  // 选择第一个设备并连接
  if (devices.length > 0) {
    bleHandler.connectDevice(devices[0]);
  }
});

// 连接状态监听
bleHandler.onConnectionStateChange({
  connected: (deviceId) => {
    console.log('设备已连接:', deviceId);
  },
  disconnected: (deviceId) => {
    console.log('设备已断开:', deviceId);
  }
});

// 监听特征值变化（推荐）
const unsubscribe = bleHandler.addCharacteristicValueChangeListener((result) => {
  console.log('收到数据:', result.value);
});
// 取消订阅：
// unsubscribe();

// 写入数据
const buffer = new ArrayBuffer(8);
const [writeErr, writeRes] = await bleHandler.writeCharacteristicValue({
  value: buffer,
  hasResponse: true, // 等待设备响应
  timeoutMs: 2000, // 超时时间
});

// 读取数据
const [readErr, readRes] = await bleHandler.readCharacteristicValue({
  timeoutMs: 2000,
});
```

### 多设备模式

```typescript
const bleHandler = new BLEHandler({
  mode: 'multiple', // 多设备模式
  config: { /* ... */ },
  // ... 其他配置
});

// 连接多个设备
await bleHandler.connectDevice(device1);
await bleHandler.connectDevice(device2);

// 向指定设备写入数据
await bleHandler.writeCharacteristicValue({
  deviceId: device1.deviceId,
  value: buffer,
});

// 断开指定设备
await bleHandler.disconnectDevice(device1.deviceId);
```

## 项目结构

项目采用模块化设计，代码按职责划分：

```
src/
├── index.ts                    # 导出入口
├── core/
│   ├── BLEHandler.ts           # 主类（门面/协调器）
│   ├── BluetoothManager.ts     # 微信 API 封装
│   └── modules/                # 各个功能模块
│       ├── AdapterManager.ts   # 适配器管理（初始化、状态检查）
│       ├── ConnectionManager.ts # 连接管理（连接、断开、重连）
│       ├── DiscoveryManager.ts  # 设备发现（搜索、过滤）
│       ├── IOManager.ts         # 读写操作（数据传输、请求队列）
│       └── ServiceManager.ts    # 服务管理（特征值、配置）
├── types/
│   └── ble.d.ts                # TypeScript 类型定义
└── utils/
    └── error.ts                # 错误处理工具
```

### 模块说明

- **AdapterManager** - 管理蓝牙适配器的生命周期（打开、关闭、状态检查）
- **DiscoveryManager** - 处理设备搜索、发现和过滤逻辑
- **ConnectionManager** - 管理设备连接、断开和自动重连
- **ServiceManager** - 处理蓝牙服务和特征值的获取、检查、配置
- **IOManager** - 处理数据读写操作和请求队列管理
- **BLEHandler** - 主类，作为门面协调各个管理器，提供统一 API

## API 文档

### BLEHandler 构造函数

```typescript
new BLEHandler(options: BLEHandlerConstructor)
```

**参数：**
- `mode`: `'single' | 'multiple'` - 连接模式
- `config`: `BLEHandlerConfig` - 蓝牙服务和特征值 UUID 配置
  - `serviceUId`: 服务 UUID
  - `writeCharacteristicId`: 写特征值 UUID
  - `notifyCharacteristicId`: 通知特征值 UUID
  - `readCharacteristicId`: 读特征值 UUID（可选）
- `filterKey`: `string[]` - 设备名过滤关键字（可选）
- `reconnect`: `boolean` - 是否启用自动重连（默认 false）
- `maxRetries`: `number` - 最大重连次数（默认 3）
- `reconnectDelay`: `number` - 重连间隔毫秒数（默认 3000）
- `connectTimeout`: `number` - 连接超时毫秒数（可选）
- `searchOption`: `StartBluetoothDevicesDiscoveryOption` - 搜索配置（可选）

### 主要方法（已更新命名）

#### 初始化与搜索
- `init(callback?)` - 初始化蓝牙并可选搜索设备
- `openAdapter()` - 打开蓝牙适配器
- `getAdapterStatus()` - 检查蓝牙状态和权限
- `startDeviceDiscovery(options?)` - 开始搜索设备
- `stopDeviceDiscovery()` - 停止搜索设备
- `onDeviceFound(callback)` - 监听发现新设备

#### 连接管理
- `connectDevice(device)` - 连接指定设备
- `disconnectDevice(deviceId?)` - 断开设备连接
- `onConnectionStateChange(callbacks)` - 监听连接状态变化

#### 服务与特征值
- `getDeviceServices(deviceId?)` - 获取设备的所有服务
- `validateCharacteristics(deviceId, serviceId?)` - 检查特征值是否存在
- `enableCharacteristicNotification(deviceId, serviceId?, characteristicId?)` - 订阅特征值通知
- `updateBLEHandlerConfig(config)` - 运行时更新配置

#### 数据读写
- `writeCharacteristicValue(options)` - 写入数据
- `readCharacteristicValue(options)` - 读取数据
- `addCharacteristicValueChangeListener(callback)` - 监听特征值变化（返回取消订阅函数）

#### 其他
- `getDeviceRSSI(deviceId?)` - 获取设备信号强度
- `closeAdapter()` - 关闭蓝牙适配器
- `release(callback?)` - 释放所有资源

### 返回值格式

所有异步方法均返回 `Promise<[Error | null, any]>` 格式：

```typescript
const [err, res] = await bleHandler.connectDevice(device);
if (err) {
  console.error('连接失败:', err);
} else {
  console.log('连接成功:', res);
}
```

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 清理构建产物
npm run clean
```

## 注意事项

1. **微信基础库版本**：请确保小程序基础库版本支持所需的蓝牙 API
2. **权限配置**：需要在 `app.json` 中配置蓝牙权限
3. **UUID 格式**：服务和特征值 UUID 需要符合微信小程序的格式要求
4. **错误处理**：建议对所有蓝牙操作进行错误处理
5. **资源释放**：页面卸载时记得调用 `release()` 方法释放资源

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
