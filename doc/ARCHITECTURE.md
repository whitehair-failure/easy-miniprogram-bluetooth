# 架构设计文档

## 概述

`miniprogram-bluetooth-utils` 是一个为微信小程序设计的蓝牙低功耗（BLE）工具库，采用**模块化 + 继承多态**的架构，提供清晰的分层和类型安全的 API。

## 架构演进

### 第一阶段：单体架构（早期版本）
- 单一 `BLEHandler` 类，700+ 行代码
- 使用 `if (this.mode === "single")` 条件分支判断单/多设备
- 代码耦合高，难以维护

### 第二阶段：错误处理重构（Step 2）
- 引入 8 个自定义异常类（BLEError 体系）
- 改 `[Error | null, any]` 返回值为异常抛出
- 使用 `try-catch` 统一错误处理

### 第三阶段：模式分离（Step 3 - 当前）
- 创建 `BLEHandlerBase` 抽象基类
- 分离为 `SingleDeviceBLEHandler` 和 `MultiDeviceBLEHandler` 两个子类
- 通过继承多态替代条件分支，类型检查能力大幅提升

### 第四阶段：管理器模块化（早期）
- 5 个专业化管理器（Adapter/Discovery/Connection/Service/IO）
- 单一职责原则，每个模块 80-200 行代码
- 清晰的接口和内部依赖

## 当前架构（三层结构）

```
┌─────────────────────────────────────────────┐
│  User Code (微信小程序页面/组件)               │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│  Facade Layer (门面 - 对外 API)              │
│  ├─ BLEHandlerBase (抽象基类)              │
│  ├─ SingleDeviceBLEHandler (单设备子类)     │
│  └─ MultiDeviceBLEHandler (多设备子类)      │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│  Manager Layer (管理器 - 核心逻辑)           │
│  ├─ AdapterManager (适配器管理)             │
│  ├─ DiscoveryManager (设备发现)             │
│  ├─ ConnectionManager (连接管理)            │
│  ├─ ServiceManager (服务管理)               │
│  └─ IOManager (数据读写)                    │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│  Platform Layer (平台 - 微信 API)           │
│  └─ wx.* (微信小程序蓝牙 API)               │
└─────────────────────────────────────────────┘
```

## 关键设计模式

### 1. 门面模式（Facade）
`BLEHandlerBase` 作为统一入口，隐藏 5 个管理器的复杂交互。
```typescript
export abstract class BLEHandlerBase {
  protected adapterManager: AdapterManager;
  protected discoveryManager: DiscoveryManager;
  protected connectionManager: ConnectionManager;
  protected serviceManager: ServiceManager;
  protected ioManager: IOManager;
  // ... 统一的公开 API
}
```

### 2. 模板方法模式（Template Method）
`BLEHandlerBase` 定义算法结构，子类实现具体步骤。
```typescript
export abstract class BLEHandlerBase {
  abstract connectDevice(devOrDeviceId: Device | string): Promise<void>;
  abstract disconnectDevice(deviceId?: string): Promise<void>;
  abstract getDeviceServices(deviceId?: string): Promise<BLEService[]>;
  // ... 其他抽象方法由子类实现
}
```

### 3. 单一职责原则（SRP）
每个管理器专注一个领域：

| 管理器 | 职责 | 关键方法 |
|--------|------|---------|
| **AdapterManager** | 蓝牙适配器生命周期 | `openAdapter()`, `getAdapterStatus()`, `getDeviceRSSI()` |
| **DiscoveryManager** | 设备搜索与过滤 | `startDeviceDiscovery()`, `onDeviceFound()`, `updateFilterOptions()` |
| **ConnectionManager** | 连接、断开、重连 | `connectDevice()`, `disconnectDevice()`, `attemptReconnect()` |
| **ServiceManager** | 蓝牙服务、特征值 | `getDeviceServices()`, `validateCharacteristics()`, `enableCharacteristicNotification()` |
| **IOManager** | 数据读写、事件监听 | `writeCharacteristicValue()`, `readCharacteristicValue()`, `addCharacteristicValueChangeListener()` |

### 4. 防御性拷贝（Defensive Copying）
所有列表属性返回深拷贝，防止外部修改内部状态。
```typescript
get connectedDevices(): Device[] {
  return this._connectedDevices.map(d => ({ ...d }));
}
```

### 5. 错误处理
所有方法统一**异常抛出**（不返回 `[err, result]` 元组）。catch 到微信原生错误时直接 `throw err` 透传（保留 `errMsg` / `errno` / `errCode`），参数校验 / 超时抛原生 `Error`。
```typescript
try {
  await handler.connectDevice(device);
} catch (err) {
  if (err?.errno === 103 || err?.errCode === 103) {
    // 处理权限问题
  } else if (err?.errMsg?.includes('timeout')) {
    // 处理超时
  }
}
```

## 单/多设备模式对比

### SingleDeviceBLEHandler（单设备）
- **场景**：一次只连接一个设备（心率计、血压计、体重秤等）
- **简化**：无需指定 `deviceId`，自动使用当前连接设备
- **类型安全**：编译时强制无 `deviceId` 参数

```typescript
const single = new SingleDeviceBLEHandler({ config });
await single.connectDevice(device);  // 无需 deviceId
await single.writeCharacteristicValue({ value });  // 无需 deviceId
const rssi = await single.getDeviceRSSI();  // 自动用当前设备
```

### MultiDeviceBLEHandler（多设备）
- **场景**：同时连接多个设备（传感器矩阵、多设备同步等）
- **完整**：所有操作明确指定 `deviceId`
- **类型安全**：编译时强制必需 `deviceId` 参数

```typescript
const multi = new MultiDeviceBLEHandler({ config });
await multi.connectDevice(device1);
await multi.writeCharacteristicValue({ deviceId: 'DEV1', value });  // 必须指定
const rssi = await multi.getDeviceRSSI('DEV1');  // 必须指定
```

## 关键特性实现

### 1. 自动重连机制

**问题**：设备异常断开后，如何自动重新连接？

**解决**：使用 generation-based 取消机制。
- 为每个设备维护一个 `reconnectGenerations` Map
- 单设备模式切换连接目标时，递增旧设备的 generation
- 重连循环中检查 generation，不匹配则自我终止

**优势**：
- ✅ 无需额外定时器或 AbortController
- ✅ 单设备切换时立即停止旧设备重连
- ✅ 内存高效（单设备情况下固定开销）

### 2. 多回调事件监听

**问题**：如何支持多个组件同时监听特征值变化？

**解决**：IOManager 维护 `Set<Callback>`。
- 注册时添加到 Set，返回取消函数
- 只注册一个平台监听器，内部遍历 Set 分发
- 注销时从 Set 中删除

**优势**：
- ✅ 一个平台监听器，避免内存泄漏
- ✅ 多个消费者独立监听
- ✅ 可控的回调生命周期

### 3. 灵活的设备过滤

**问题**：如何高效地过滤蓝牙设备（白名单/黑名单）？

**解决**：DiscoveryManager 的 `isDeviceMatched()` 方法。
- 黑名单优先排除（优先级最高）
- 白名单过滤（设备名必须包含至少一个）
- 支持运行时动态更新规则

**算法**：
```
1. 检查黑名单：deviceName 包含任何黑名单关键字 → 过滤掉
2. 检查白名单：如果配置了，deviceName 必须包含至少一个 → 通过或过滤
3. 无配置：接受所有
```

时间复杂度：O(m+n)，其中 m = excludeKeys.length, n = includeKeys.length

### 4. 配置运行时更新

**问题**：不同品牌蓝牙设备使用不同的 UUID，如何灵活支持？

**解决**：ServiceManager 的 `setBLEHandlerConfig()` 方法。
- 验证新配置的有效性
- 更新后自动重新订阅通知
- 支持部分更新（只更新必要字段）

```typescript
handler.updateBLEHandlerConfig({
  serviceUId: 'NEW_UUID',
  // 其他字段保持不变
});
```

## 数据流向

### 连接流程
```
用户代码
  ↓ connectDevice(device)
BLEHandlerBase (多态分发)
  ↓
ConnectionManager.connectDevice()
  ↓ 
wx.createBLEConnection()
  ↓
ServiceManager.getDeviceServices()
  ↓
IOManager.enableCharacteristicListenerRegistry()
  ↓
wx.onBLECharacteristicValueChange()
  ↓
✅ 连接完成
```

### 数据读写流程
```
用户代码
  ↓ writeCharacteristicValue(options)
BLEHandlerBase
  ↓
IOManager.writeCharacteristicValue()
  ↓
wx.writeBLECharacteristicValue()
  ↓
[如果 hasResponse=true]
pendingRequests.set(requestId, ...)
  ↓
等待 wx.onBLECharacteristicValueChange()
  ↓
解析响应，resolve(result)
  ↓
✅ 读写完成
```

## 错误处理体系

> 0.3.0 起移除自定义异常类（BLEError 体系），统一透传微信原生错误 / 抛原生 `Error`。

- **微信 API 调用失败**：直接 `throw err`，错误对象含 `errMsg`、`errno` / `errCode`
- **参数 / 配置校验失败**：`throw new Error("...")`
- **超时**：`throw new Error("...超时...")`（消息含超时描述）

**使用模式**：
```typescript
try {
  // 蓝牙操作
} catch (err) {
  if (err?.errMsg?.includes('timeout')) {
    // 特定处理超时
  } else {
    // 通用处理
  }
}
```

## 类型安全

### 强制必填项
```typescript
interface BLEHandlerConfig {
  serviceUId: string;  // ← 必填（非可选）
  writeCharacteristicId?: string;
  // ...
}
```

### 编译时 deviceId 检查
```typescript
// ✅ 单设备：无需 deviceId
const single = new SingleDeviceBLEHandler({...});
await single.getDeviceRSSI();  // OK

// ❌ 多设备：缺少 deviceId（编译失败）
const multi = new MultiDeviceBLEHandler({...});
await multi.getDeviceRSSI();
// TS2554: Expected 1 arguments, but got 0.
```

## 内存管理

### 资源释放
```typescript
// 页面卸载时调用 release()
onUnload() {
  handler.release();  // 关闭蓝牙、清理事件监听
}
```

### 防止内存泄漏
1. **事件监听**：返回取消函数或提供移除方法
2. **请求队列**：超时自动清理
3. **列表属性**：返回深拷贝，防止外部修改

## 性能考虑

### 设备过滤
- 时间复杂度：O(m+n)
- 每个发现的设备都会经过过滤逻辑
- 建议关键字数量 < 50

### 多回调监听
- 平台监听器数量：1
- 回调函数数量：可多个
- 分发开销：O(k)，其中 k = 回调数量

## 扩展性

### 添加新管理器
1. 创建新的 Manager 类（继承无，独立编写）
2. 在 BLEHandlerBase 中实例化
3. 在子类中暴露 public 方法

### 自定义错误处理
直接继承原生 `Error`（库自身不再提供可继承的异常基类）：
```typescript
class MyCustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MyCustomError';
  }
}
```

## 未来优化方向

1. **性能监控**：添加操作耗时统计和性能指标上报
2. **日志系统**：可配置的日志等级（DEBUG/INFO/WARN/ERROR）
3. **断线恢复**：更智能的断线重连策略（指数退避）
4. **事件驱动**：支持事件模式（emit/on）
5. **测试覆盖**：单元测试和集成测试框架

## 参考

- [README.md](../README.md) - 用户入门指南
- [EXAMPLES.md](./EXAMPLES.md) - 详细使用案例
- [DEVICE_FILTER_GUIDE.md](./DEVICE_FILTER_GUIDE.md) - 设备过滤说明
- [RENAME.md](./RENAME.md) - API 迁移对照
- [AGENTS.md](../AGENTS.md) - AI 助手指南
