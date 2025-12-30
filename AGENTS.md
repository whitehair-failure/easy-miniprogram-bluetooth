# AGENTS.md - AI 助手项目指南

> 本文档为 AI 助手提供项目全景，帮助快速理解项目架构、历史决策和开发规范。

## 项目概览

**项目名称**: miniprogram-bluetooth-utils  
**版本**: 0.1.0  
**类型**: TypeScript 库（微信小程序 BLE 工具封装）  
**目标平台**: 微信小程序  
**构建工具**: Rollup + TypeScript  
**仓库**: https://github.com/whitehair-failure/miniprogram-bluetooth-utils

### 项目定位

为微信小程序开发者提供易用、健壮的低功耗蓝牙（BLE）工具库，封装复杂的蓝牙连接、数据传输、自动重连等功能，让开发者专注业务逻辑。

### 核心特性

- ✅ 单设备/多设备连接模式
- ✅ 自动重连机制（可配置重试次数和延时）
- ✅ 智能重连取消（单设备模式切换目标时自动停止旧设备重连）
- ✅ 设备搜索与过滤
- ✅ 数据读写（支持响应等待和超时控制）
- ✅ 多回调事件监听（可注册/注销多个特征值变化监听器）
- ✅ 运行时配置更新
- ✅ 完整的 TypeScript 类型支持

---

## 项目架构

### 目录结构

```
miniprogram-bluetooth-utils/
├── src/
│   ├── index.ts                    # 入口文件（导出 BLEHandler）
│   ├── core/
│   │   ├── BLEHandler.ts           # 门面类，对外统一 API
│   │   ├── BLEHandler.ts.backup    # 重构前备份（700+ 行单文件）
│   │   ├── BluetoothManager.ts     # 微信小程序 BLE API 原生封装
│   │   └── modules/                # 模块化拆分后的管理器
│   │       ├── AdapterManager.ts   # 适配器管理（初始化、状态、RSSI）
│   │       ├── DiscoveryManager.ts # 设备发现管理（搜索、过滤）
│   │       ├── ConnectionManager.ts # 连接管理（连接、断开、重连）
│   │       ├── ServiceManager.ts   # 服务管理（特征值验证、配置更新）
│   │       └── IOManager.ts        # I/O 管理（读写、多回调事件）
│   ├── types/
│   │   └── ble.d.ts                # 类型定义（Device, Config, Callbacks 等）
│   └── utils/
│       └── error.ts                # 错误处理工具（当前未使用）
├── dist/                           # 构建输出（CJS + ESM + 类型声明）
├── README.md                       # 用户文档（API 说明）
├── ARCHITECTURE.md                 # 架构文档（重构说明）
├── EXAMPLES.md                     # 使用示例（6+ 场景）
├── RENAME.md                       # API 迁移映射（旧名 → 新名）
├── AGENTS.md                       # 本文件（AI 助手指南）
├── package.json
├── tsconfig.json
└── rollup.config.mjs
```

### 架构设计模式

#### 1. 门面模式（Facade Pattern）
`BLEHandler` 作为统一入口，隐藏内部 5 个管理器的复杂交互，提供简洁 API。

#### 2. 单一职责原则（SRP）
每个管理器专注一个领域：
- **AdapterManager**: 适配器生命周期
- **DiscoveryManager**: 设备发现
- **ConnectionManager**: 连接状态管理
- **ServiceManager**: 蓝牙服务配置
- **IOManager**: 数据传输

#### 3. 依赖注入
管理器之间通过构造函数或回调参数传递依赖，而非硬编码。

---

## 关键模块详解

### 1. BLEHandler（门面/协调器）
**职责**: 对外统一 API，协调各管理器

**核心方法（新名称）**:
```typescript
// 适配器
getAdapterStatus()           // 检查蓝牙状态
openAdapter()                // 打开蓝牙适配器
closeAdapter()               // 关闭蓝牙适配器

// 设备发现
startDeviceDiscovery()       // 开始搜索设备
onDeviceFound(callback)      // 监听发现设备事件
stopDeviceDiscovery()        // 停止搜索

// 连接
connectDevice(dev | deviceId) // 连接设备（支持 Device 对象或 deviceId 字符串）
onConnectionStateChange(cbs) // 监听连接状态变化
disconnectDevice(deviceId?)  // 断开连接

// 服务与特征值
getDeviceServices(deviceId)  // 获取设备服务列表
validateCharacteristics(deviceId) // 验证特征值
enableCharacteristicNotification(deviceId) // 启用特征值通知

// I/O 操作
writeCharacteristicValue(opts) // 写入数据
readCharacteristicValue(opts)  // 读取数据
addCharacteristicValueChangeListener(cb) // 添加监听器（返回解绑函数）
removeCharacteristicValueChangeListener(cb) // 移除监听器
removeAllCharacteristicValueChangeListeners() // 移除所有监听器

// 其他
getDeviceRSSI(deviceId?)     // 获取信号强度
updateBLEHandlerConfig(cfg)  // 运行时更新配置
```

**重要属性**:
```typescript
connectedDevices: Device[]          // 已连接设备列表
singleConnectedDevice: Device | undefined // 单设备模式当前设备
foundDevList: Device[]              // 搜索到的设备列表
historyConnectedDevices: Device[]   // 历史连接过的设备
config: BLEHandlerConfig            // 当前配置（serviceUId, characteristicIds）
```

### 2. ConnectionManager（连接管理器）
**关键特性**:
- **单设备模式智能切换**: 连接新设备时自动取消旧设备的重连任务
- **重连代次机制**: 使用 `reconnectGenerations` Map 存储每个设备的代次，递增代次即可取消重连循环
- **activeTargetDeviceId**: 单设备模式下用户期望的目标设备，用于抑制非目标设备的自动重连

**重要方法**:
```typescript
connectDevice(devOrDeviceId, timeout, onServicesReady)
  // 支持 Device 对象或 deviceId 字符串
  // 字符串模式会自动构造 Device 对象（包含所有必需的 BlueToothDevice 属性）

attemptReconnect(device, onReconnect)
  // 重连循环，检查 generation 和 activeTargetDeviceId 决定是否继续

cancelReconnectForDevice(deviceId)
  // 递增该设备的 generation，终止其重连循环

cancelReconnectsExcept(deviceIdToKeep)
  // 取消除指定设备外的所有设备重连（单设备切换时调用）
```

### 3. IOManager（I/O 管理器）
**关键特性**:
- **多回调注册**: 使用 `Set<CharacteristicChangeCallback>` 存储多个监听器
- **单一平台监听器**: 只注册一个 `wx.onBLECharacteristicValueChange`，内部分发给所有回调
- **请求队列**: `pendingRequests` Map 存储等待响应的读写请求

**重要方法**:
```typescript
addCharacteristicValueChangeListener(callback)
  // 返回解绑函数: () => void

removeCharacteristicValueChangeListener(callback)
  // 移除特定回调

writeCharacteristicValue(opts)
  // 支持 hasResponse=true 时等待设备响应（通过 pendingRequests 匹配）

readCharacteristicValue(opts)
  // 读取后等待特征值变化通知
```

### 4. DiscoveryManager（设备发现管理器）
**关键特性**:
- **设备过滤**: 根据 `filterKey` 数组过滤设备名称
- **去重**: 使用 `deviceId` 去重，避免重复设备

### 5. ServiceManager（服务管理器）
**关键特性**:
- **运行时配置更新**: `setBLEHandlerConfig` 支持动态修改 serviceUId 和 characteristicIds
- **特征值验证**: `validateCharacteristics` 检查设备是否支持配置的特征值

### 6. AdapterManager（适配器管理器）
**关键特性**:
- **权限检测**: `getAdapterStatus` 检查蓝牙和位置权限
- **超时控制**: `withTimeout` 工具方法包装 Promise

### 7. BluetoothManager（平台包装层）
**注意**: 此模块保留了 BLE 前缀的原生 API 映射，未重命名，因为它直接对应微信小程序的 `wx.*` API。

---

## 重要历史决策与变更

### 1. 模块化重构（2025年11月）
**动机**: 原 `BLEHandler.ts` 超过 700 行，职责混乱，难以维护。

**行动**: 拆分为 5 个模块 + 1 个门面，每个模块 80-200 行。

**结果**: 
- 文件行数减少 70%
- 可测试性大幅提升
- 保持 API 向后兼容（通过门面委托）

**备份**: `BLEHandler.ts.backup` 保存了重构前的代码。

### 2. API 重命名（2025年11月）
**动机**: 旧 API 名称冗长（如 `connectBLE`, `checkBLEAdapter`），不符合语义化命名。

**行动**: 
- 移除 BLE 前缀（如 `connectBLE` → `connectDevice`）
- 统一事件 API 风格（`add...Listener` / `remove...Listener`）
- 删除旧名称（breaking change）

**迁移**: 提供 `RENAME.md` 映射表，包含所有旧名 → 新名对照。

**影响**: 
- 外部用户需要手动迁移代码
- 文档（README, EXAMPLES）已全部更新为新名称

### 3. 重连取消逻辑（2025年11月）
**问题**: 单设备模式下，用户连接设备 B 时，设备 A 仍在后台重连，导致状态混乱。

**解决方案**: 
- 引入 `activeTargetDeviceId`（用户期望的目标设备）
- 引入 `reconnectGenerations` Map（每设备一个代次计数器）
- 连接新设备时调用 `cancelReconnectsExcept(newDeviceId)`
- 重连循环中检查 generation 和 activeTargetDeviceId，不匹配则终止

**效果**: 单设备切换时旧设备重连立即停止，避免资源浪费。

### 4. 多回调支持（2025年11月）
**问题**: 旧版只支持单个 `onBLECharacteristicValueChange` 回调。

**解决方案**: 
- IOManager 维护 `Set<CharacteristicChangeCallback>`
- 只注册一个平台监听器，内部遍历 Set 分发事件
- `addCharacteristicValueChangeListener` 返回解绑函数

**效果**: 支持多个模块/页面同时监听特征值变化。

### 5. connectDevice 参数扩展（2025年12月）
**问题**: 有时只有 `deviceId` 字符串，构造完整 `Device` 对象繁琐。

**解决方案**: 
- `connectDevice` 第一参数改为 `Device | string`
- 传入字符串时自动构造 Device 对象（填充所有 `WechatMiniprogram.BlueToothDevice` 必需属性）

**效果**: 简化调用，同时保持向后兼容。

---

## 类型定义关键点

### Device 接口
```typescript
export interface Device extends WechatMiniprogram.BlueToothDevice {
  isConnect: boolean;    // 连接状态标志
  reconnect?: boolean;   // 是否启用自动重连
}
```

**注意**: `WechatMiniprogram.BlueToothDevice` 包含：
- `deviceId`, `name`, `RSSI`, `advertisData`, `advertisServiceUUIDs`
- `connectable`, `localName`, `serviceData`

构造 Device 对象时必须包含这些属性。

### BLEHandlerConfig
```typescript
export interface BLEHandlerConfig {
  readCharacteristicId?: string;
  writeCharacteristicId?: string;
  notifyCharacteristicId?: string;
  serviceUId?: string;
}
```

### ConnectionStateCallbacks
```typescript
export interface ConnectionStateCallbacks {
  callback?: (result: OnBLEConnectionStateChangeListenerResult) => void;
  connected?: (deviceId: string) => void;
  disconnected?: (deviceId: string) => void;
}
```

---

## 开发规范与约定

### 1. 命名规范
- **模块名**: PascalCase + Manager 后缀（如 `ConnectionManager`）
- **方法名**: camelCase，动词开头（如 `connectDevice`, `getAdapterStatus`）
- **属性名**: camelCase（如 `connectedDevices`, `singleConnectedDevice`）
- **移除 BLE 前缀**: 对外 API 不使用 BLE 前缀（除非对应平台原生 API）

### 2. 错误处理
- **返回值风格**: `[Error | null, any]`（类似 Go 语言的错误处理）
- **第一元素**: 错误对象或 null
- **第二元素**: 结果或 null

示例：
```typescript
const [err, res] = await bleHandler.connectDevice(device);
if (err) {
  console.error('连接失败:', err);
  return;
}
// 使用 res
```

### 3. 异步操作
- 所有蓝牙操作都是异步的，使用 `async/await`
- 提供超时控制（`withTimeout` 工具方法）

### 4. 事件监听
- **注册**: 返回解绑函数（`() => void`）
- **注销**: 提供 `remove...` 方法接受原回调引用
- **全部清空**: 提供 `removeAll...` 方法

示例：
```typescript
const unsubscribe = bleHandler.addCharacteristicValueChangeListener(callback);
// ...
unsubscribe(); // 解绑
```

### 5. 模式切换
- **单设备模式** (`mode: "single"`):
  - 只允许一个设备连接
  - 连接新设备时自动断开旧设备
  - 支持 `singleConnectedDevice` 快捷访问
  
- **多设备模式** (`mode: "multiple"`):
  - 允许多个设备同时连接
  - 操作时需要明确指定 `deviceId`

---

## 常见问题与陷阱

### 1. 设备自动重连混乱
**问题**: 单设备模式下切换目标时，旧设备仍在重连。

**解决**: 已通过 `activeTargetDeviceId` 和 `reconnectGenerations` 解决。

### 2. 多回调注册问题
**问题**: 注册多个监听器时只有最后一个生效。

**解决**: 已改为 Set 管理多回调，全部生效。

### 3. 配置更新后未生效
**问题**: 调用 `updateBLEHandlerConfig` 后数据仍发往旧特征值。

**解决**: 配置更新时会自动重新订阅通知（`onServicesReady` 回调）。

### 4. 写入数据无响应
**问题**: `writeCharacteristicValue` 设置 `hasResponse: true` 但超时。

**原因**: 
- 设备未正确响应
- `notifyCharacteristicId` 配置错误
- 特征值通知未启用

**排查**: 
1. 检查 `enableCharacteristicNotification` 是否被调用
2. 检查 `config.notifyCharacteristicId` 是否正确
3. 使用小程序蓝牙调试工具验证设备行为

### 5. 连接后立即断开
**问题**: 连接成功后几秒内断开。

**原因**: 
- `connectTimeout` 设置过短
- 获取服务/特征值耗时过长
- 设备固件问题

**排查**: 增大 `connectTimeout` 或 `onServicesReady` 回调中添加日志。

---

## 测试与验证

### 当前状态
- ✅ TypeScript 类型检查通过（`tsc --noEmit`）
- ✅ Rollup 构建成功（生成 CJS + ESM）
- ⚠️ 无单元测试（待补充）

### 建议的测试策略

#### 单元测试（推荐使用 Jest）
```
tests/
├── AdapterManager.test.ts       # 模拟 wx API，测试适配器生命周期
├── ConnectionManager.test.ts    # 测试连接、断开、重连逻辑
├── DiscoveryManager.test.ts     # 测试设备过滤、去重
├── ServiceManager.test.ts       # 测试配置更新、特征值验证
└── IOManager.test.ts            # 测试读写、回调注册/注销
```

#### 集成测试
```
tests/
└── BLEHandler.integration.test.ts  # 测试各模块协作流程
```

#### 真机测试
- 使用小程序开发者工具的真机调试功能
- 测试不同品牌蓝牙设备的兼容性
- 验证自动重连、弱信号场景

---

## 构建与发布

### 构建命令
```bash
npm run build       # 构建 dist/ 输出
npm run clean       # 清理 dist/
```

### 输出文件
- `dist/index.cjs.js`: CommonJS 格式
- `dist/index.esm.js`: ES Module 格式
- `dist/index.d.ts`: TypeScript 类型声明

### 发布前检查清单
- [ ] 运行 `tsc --noEmit` 确保无类型错误
- [ ] 运行 `npm run build` 确保构建成功
- [ ] 更新 `package.json` 版本号
- [ ] 更新 `README.md` 和 `EXAMPLES.md`（如有 API 变更）
- [ ] 提交 Git 并打 tag（如 `v0.1.0`）
- [ ] 运行 `npm publish`（首次需要 `npm login`）

---

## 外部依赖

### 生产依赖
无（纯前端库，运行时依赖微信小程序环境）

### 开发依赖
- `typescript`: 类型检查和声明生成
- `rollup`: 打包工具
- `@rollup/plugin-typescript`: TypeScript 插件
- `miniprogram-api-typings`: 微信小程序 API 类型定义

---

## 文档索引

- **README.md**: 用户文档，API 说明，快速开始
- **ARCHITECTURE.md**: 架构设计，重构说明，模块职责
- **EXAMPLES.md**: 6+ 个完整使用示例（基础连接、多设备、错误处理等）
- **RENAME.md**: API 迁移映射表（旧名 → 新名）
- **AGENTS.md**: 本文件，AI 助手快速理解项目

---

## AI 助手使用建议

### 回答用户问题时
1. **优先查看用户当前文件**: 确定用户正在操作的模块
2. **引用具体行号**: 使用 `[文件名](文件路径#L起始行-L结束行)` 格式
3. **遵循现有命名**: 使用新 API 名称（参考 RENAME.md）
4. **保持错误处理风格**: 返回 `[Error | null, any]`
5. **考虑模式影响**: 区分单设备/多设备模式的行为差异

### 修改代码时
1. **保持架构一致**: 新功能放入对应管理器，通过 BLEHandler 暴露
2. **更新类型定义**: 修改 `src/types/ble.d.ts`
3. **同步文档**: 更新 README.md 和 EXAMPLES.md
4. **运行验证**: 执行 `tsc --noEmit` 和 `npm run build`

### 添加新功能时
1. **确定模块归属**: 属于哪个管理器？还是需要新建模块？
2. **保持单一职责**: 不要让一个模块承担过多责任
3. **提供示例**: 在 EXAMPLES.md 中添加使用示例
4. **考虑向后兼容**: 尽量不破坏现有 API

---

## 联系与贡献

- **GitHub**: https://github.com/whitehair-failure/miniprogram-bluetooth-utils
- **Issues**: https://github.com/whitehair-failure/miniprogram-bluetooth-utils/issues
- **协议**: MIT License

---

**最后更新**: 2025-12-30  
**文档版本**: 1.0  
**对应代码版本**: 0.1.0
