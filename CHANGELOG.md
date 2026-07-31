# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 格式。

---

## [0.2.1] - 2026-06-16

### 变更

**`writeCharacteristicValue` 响应配置重构为 `responseConfig`**
- `hasResponse` / `timeoutMs` / `serviceId` / `characteristicId` 从 `writeCharacteristicOption` 顶层字段移入 `responseConfig` 子对象
- 写入操作的 `serviceId` / `characteristicId` 仍使用 `WriteBLECharacteristicValueOption` 顶层字段（用于实际写入目标）
- `pendingRequests` 响应匹配使用 `responseConfig` 中的 `serviceId` / `characteristicId`，未提供时默认使用 `config` 中配置的参数
- 场景示例：写入使用控制特征值，响应匹配使用通知特征值，两者可不同

---

## [0.2.0] - 2026-05-09

### 新增

**连接状态监听重构为 register-once 模式**
- 新增 `addConnectionStateChangeListener(callback)` 方法，返回解绑函数 `() => void`，与 `addCharacteristicValueChangeListener` / `addDeviceFoundListener` 风格一致
- wx 平台监听器（`wx.onBLEConnectionStateChange`）现在只注册一次，多个用户回调存入 Set 统一分发
- callback 直接接收原始 `res`（`WechatMiniprogram.OnBLEConnectionStateChangeListenerResult`）参数
- 微信自动重连成功后，自动重新订阅当前 `config` 中配置的 notify 特征值

**BLEHandlerConfig 扩展**
- 新增 `notifyType?: 'notification' | 'indication'` 配置项，默认值为 `"notify"`，解决原来硬编码 `"indicate"` 导致大多数设备订阅失败的问题

**自动初始化监听器**
- `BLEHandlerBase` 构造函数现在自动注册连接状态监听和特征值变化监听，无需在 `init()` 或业务代码中手动调用

### 变更

- `onConnectionStateChange(callbacks?)` 已移除，替换为 `addConnectionStateChangeListener(callback)` 返回解绑函数
- `updateBLEHandlerConfig()` 改为 `async`，返回类型由 `BLEHandlerConfig` 变为 `Promise<BLEHandlerConfig>`，配置更新后重订 notify 的错误可正常向上传播
- `ServiceManager.ensureCharacteristicListenerRegistered()` 由 `private` 改为 `public`

### 修复

- **[严重] 构造器不能异步初始化**：原构造器内含 `await this.adapterManager.openAdapter()` 和监听器注册，违反 TypeScript 构造器同步性规则。现将所有异步操作移至 `init()` 方法，构造器仅进行同步初始化。用户必须先 `new` 再 `await init()` 完成初始化
- **[严重] `release()` 后无法重新初始化**：`release()` 调用 `wx.offXXX()` 解绑监听，但各 Manager 的标志位（如 `isConnectionStateListenerRegistered`）未重置。下次 `init()` 时由于标志位仍为 `true` 而无法重新注册。现添加 `offConnectionStateListener()` / `offCharacteristicListener()` / `offDeviceFoundListener()` 方法重置标志位
- **[严重] Config 状态分裂**：`ServiceManager` 和 `IOManager` 原先各自持有独立 config 对象，`updateBLEHandlerConfig` 更新后 IOManager 仍使用旧值。现统一为同一对象引用，配置变更立即对读写生效
- **[严重] 设备过滤忽略 `localName`**：`DiscoveryManager` 过滤时仅匹配 `device.name`，`name` 为空的设备无法被发现。现同时检查 `localName`
- **[高] 多设备模式 `disconnectDevice` 不清理连接列表**：手动断开后设备仍残留在 `connectedDevices`，现在多设备模式下也会从列表中移除
- **[高] notify 订阅类型硬编码为 `"indicate"`**：大量只支持 `"notify"` 的设备订阅静默失败，现改为可配置，默认 `"notify"`
- **[高] 字符串 deviceId 连接忽略全局 `reconnect` 配置**：`connectDevice(string)` 时 `reconnect` 被硬编码为 `true`，无视构造参数。现使用 `this.reconnect`
- **[中] `updateBLEHandlerConfig` 异步错误被吞掉**：内部回调 fire-and-forget，重订 notify 的异常无法感知。已改为 async/await 并正常传播
- **[中] `validateCharacteristics` 误报未配置的特征值**：未设置 `writeCharacteristicId` 等字段时也被标记为缺失导致 `success: false`。现在只检查已配置的字段，并补充了 `readCharacteristicId` 的检查
- **[中] `init()` 泄漏永久空回调**：`addCharacteristicValueChangeListener(() => {})` 的返回值被丢弃，空函数永久留在回调集合中。已移除，平台监听器改在构造函数中注册
- **[低] 子类异常使用裸 `Error`**：`SingleDeviceBLEHandler` / `MultiDeviceBLEHandler` 中多处 `throw new Error(...)` 改为 `BLEConnectionError` / `BLEConfigError`，便于调用方 `instanceof` 捕获
- **[低] `config` getter 可被外部绕过修改**：原 getter 直接返回内部对象引用，现返回浅拷贝 `{ ...config }`

---

## [0.1.0] - 2025-12-31

### 新增

**设备过滤机制重构**
- 新增 DeviceFilterOptions 接口，支持白名单（includeKeys）和黑名单（excludeKeys）双重过滤
- 新增 updateDeviceFilterOptions() 方法，支持运行时动态更新过滤规则
- 新增 getDeviceFilterOptions() 方法，获取当前过滤配置

**单/多设备模式分离**
- 新增抽象基类 BLEHandlerBase，协调 5 个内部 Manager
- 新增 SingleDeviceBLEHandler 子类，无需在方法调用时传入 deviceId
- 新增 MultiDeviceBLEHandler 子类，所有设备操作方法需明确传入 deviceId
- 新增兼容别名 export { SingleDeviceBLEHandler as BLEHandler }

**异常处理重构**
- 新增 9 个自定义异常类：BLEError, BLEAdapterError, BLEPermissionError, BLEConnectionError, BLETimeoutError, BLEDeviceNotFoundError, BLEServiceError, BLEConfigError, BLEIOError
- 新增辅助函数：formatError(err), convertWxErrorToBLEError(err)

**模块化重构**
- 新增 AdapterManager：蓝牙适配器生命周期管理
- 新增 DiscoveryManager：设备发现与过滤
- 新增 ConnectionManager：连接、断开、自动重连，含 reconnectGenerations 代次机制
- 新增 ServiceManager：特征值验证与配置更新
- 新增 IOManager：读写数据，多回调 Set 管理

**类型安全改进**
- connectedDevices、foundDevList、historyDevList、historyConnectedDevices 改为私有数组 + 深拷贝 getter
- 新增 historyDevList getter（发现过的历史设备）
- 新增 CharacteristicCheckResult 接口

**connectDevice 参数扩展**
- connectDevice 第一参数由 Device 扩展为 Device | string，传入字符串时自动构造 Device 对象

**多回调事件监听**
- addCharacteristicValueChangeListener(callback) 返回解绑函数 () => void
- removeCharacteristicValueChangeListener(callback) 移除特定回调
- removeAllCharacteristicValueChangeListeners() 清空所有监听器
- addDeviceFoundListener(callback) 返回解绑函数（替代原 onDeviceFound）

### 变更

- 错误处理模式从返回 [Error | null, any] 元组改为**抛出异常**，调用方需 try/catch
- filterKey 参数重命名为 filterOptions（BLEHandlerConstructor）
- onDeviceFound(callback) 重命名为 addDeviceFoundListener(callback)
- 所有对外 API 移除 BLE 前缀（如 connectBLE → connectDevice，详见 doc/archive/RENAME.md）
- BLEHandlerConfig.serviceUId 改为可选（未设置时跳过特征值验证）

### 移除

- 移除原单文件 BLEHandler.ts（已拆分为 5 个 Manager + 抽象基类），旧代码保留为 BLEHandler.ts.backup
- 移除 BluetoothManager.ts 平台包装层（功能合并入各 Manager）
- 移除所有带 BLE 前缀的旧 API 名称

### 修复

- 单设备模式切换目标时，旧设备重连任务未及时取消（通过 activeTargetDeviceId + reconnectGenerations 解决）
- 多个 onBLECharacteristicValueChange 回调注册后仅最后一个生效（改为 Set 管理多回调）

---

## [0.0.1] - 2025-11-01

### 新增

- 初始版本：基础 BLE API 封装（单文件 BLEHandler.ts，700+ 行）
- 单/多设备连接支持
- 自动重连机制（reconnect、maxRetries、reconnectDelay 参数）
- 特征值读写与通知订阅
- TypeScript 类型定义（ble.d.ts）
- Rollup 构建：输出 CJS + ESM + .d.ts
