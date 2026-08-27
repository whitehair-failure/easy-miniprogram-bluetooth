# AGENTS.md - AI 助手项目指南

> 本文档为 AI 助手提供项目关键信息，帮助快速上手开发。详细用法见 [doc/](./doc/)。

## 项目概览

**项目名称**: miniprogram-bluetooth-utils  
**版本**: 0.1.0  
**类型**: TypeScript 库（微信小程序 BLE 工具封装）  
**目标平台**: 微信小程序  
**构建工具**: Rollup + TypeScript  
**仓库**: https://github.com/whitehair-failure/miniprogram-bluetooth-utils

---

## 构建与验证

`bash
npm run build       # Rollup 构建，输出 dist/（CJS + ESM + .d.ts）
npm run clean       # 清理 dist/
tsc --noEmit        # 类型检查（修改代码后必须执行）
`

> 修改任何 .ts 文件后，执行 tsc --noEmit 验证类型正确。

---

## 目录结构

`src/
├── index.ts                          # 入口：导出所有公共 API
├── core/
│   ├── BLEHandler.base.ts            # 抽象基类 BLEHandlerBase
│   ├── SingleDeviceBLEHandler.ts     # 单设备子类（无需传 deviceId）
│   ├── MultiDeviceBLEHandler.ts      # 多设备子类（方法需传 deviceId）
│   └── modules/
│       ├── AdapterManager.ts         # 适配器管理（初始化、权限、RSSI）
│       ├── DiscoveryManager.ts       # 设备发现与过滤
│       ├── ConnectionManager.ts      # 连接、断开、自动重连
│       ├── ServiceManager.ts         # 服务/特征值验证与配置
│       └── IOManager.ts              # 读写数据、多回调事件
├── types/
│   └── ble.d.ts                      # 所有类型定义
└── utils/
    ├── config.ts                     # BLEHandlerConfig 校验（validateBLEHandlerConfig）
    ├── logger.ts                     # 统一日志（debugLog/debugError/debugWarn，默认静默）
    ├── runtime.ts                    # 运行时环境判断（鸿蒙/devtools 跳过 BLE API）
    └── uuid.ts                       # UUID 工具（短 UUID → 128 位标准转换）`

> ⚠️ BluetoothManager.ts **不存在**。旧文档中的该文件已在重构时移除。
> ⚠️ BLEHandler.ts.backup 已移至 doc/archive/，**不参与编译**。

---

## 架构模式

- **门面模式**：BLEHandlerBase 协调 5 个内部 Manager，外部只与子类交互。
- **单一职责**：每个 Manager 专注一个领域，勿跨越职责边界。
- **抽象基类**：新增方法先在 BLEHandlerBase 声明为抽象，再在两个子类中实现。
- **新功能路径**：Manager 内实现 → BLEHandlerBase 暴露公共方法 → 子类覆盖（如需）。

---

## 关键类型（src/types/ble.d.ts）

` Typescript
interface Device extends WechatMiniprogram.BlueToothDevice {
isConnect: boolean;
reconnect?: boolean;
}

interface BLEHandlerConfig {
serviceUId?: string; // 可选（未设置时跳过特征值验证）
readCharacteristicId?: string;
writeCharacteristicId?: string;
notifyCharacteristicId?: string;
notifyType?: 'notification' | 'indication'; // 通知类型，默认 "notify"（大多数设备），部分设备仅支持 "indicate"
}

interface SearchOption extends WechatMiniprogram.StartBluetoothDevicesDiscoveryOption {
includeKeys?: string[]; // 白名单（设备名/localName 包含）
excludeKeys?: string[]; // 黑名单
}

interface BLEHandlerConstructor {
config?: BLEHandlerConfig;
searchOption: SearchOption; // 包含过滤选项 includeKeys 和 excludeKeys
reconnect?: boolean;
connectTimeout?: number;
maxRetries?: number;
reconnectDelay?: number;
mode?: "single" | "multiple"; // 仅文档用途，类型由子类决定
debug?: boolean; // 是否开启调试日志（默认关闭静默，true 时输出调试日志）
}

interface writeCharacteristicOption extends WechatMiniprogram.WriteBLECharacteristicValueOption {
responseConfig?: {
  hasResponse: boolean;
  timeoutMs?: number;
  serviceId?: string;
  characteristicId?: string;
}; // 可选：是否需要响应，默认 false；需要响应时指定超时、服务ID、特征ID
}

interface readCharacteristicOption extends WechatMiniprogram.ReadBLECharacteristicValueOption {
timeoutMs?: number;
}
`

---

## 错误处理

> ⚠️ error.ts（9 个自定义异常类）已在 0.3.0 移除。当前**不抛出自定义错误类型**。

所有方法**抛出异常**，不返回 [err, result] 元组。调用方需 try/catch：

- **微信原生 API 调用失败** → 直接 `throw err`（原始微信错误对象，含 `errMsg`、`errno` / `errCode`）
- **参数校验 / 配置校验 / 超时** → `throw new Error("...")`（原生 Error，超时消息含 "超时" 字样）

`	Typescript
try {
  await ble.connectDevice(device);
} catch (err) {
  if (err?.errno === 103 || err?.errCode === 103) { /* 权限未授权 */ }
  else if (err?.errMsg?.includes('timeout')) { /* 超时 */ }
}
`

**不要**在 Manager 内再包装自定义异常。判断错误类型时读取微信错误字段（errMsg / errno / errCode），不要用 instanceof。

---

## 公共 API 速查

### 所有类共有（BLEHandlerBase）

` Typescript
// 适配器与初始化
getAdapterStatus(): Promise<WechatMiniprogram.GetBluetoothAdapterStateSuccessCallbackResult>
openAdapter(): Promise<void>
closeAdapter(): Promise<void>
release(): Promise<void> // 完全释放资源，重置所有标志位，可再次调用 init()
init(): Promise<void> // 必须在 new 后调用，打开适配器、注册全局监听器

// 设备发现
startDeviceDiscovery(searchOption?): Promise<void>
addDeviceFoundListener(callback: (devices: Device[]) => void): () => void // 返回解绑函数
stopDeviceDiscovery(): Promise<void>

// 过滤
updateDeviceFilterOptions(filterOptions: { includeKeys?: string[]; excludeKeys?: string[] }): void
getDeviceFilterOptions(): { includeKeys?: string[]; excludeKeys?: string[] }

// 连接状态监听（init() 时自动激活，用户只需按需添加额外回调）
addConnectionStateChangeListener(callback: (res) => void): () => void

// I/O 事件（init() 时自动激活平台监听，用户只需按需添加回调）
addCharacteristicValueChangeListener(callback): () => void // 返回解绑函数
removeCharacteristicValueChangeListener(callback): boolean
removeAllCharacteristicValueChangeListeners(): void

// 特征值验证
validateCharacteristics(deviceId: string, serviceId?: string): Promise<CharacteristicCheckResult>

// 配置
updateBLEHandlerConfig(cfg: Partial<BLEHandlerConfig>): Promise<BLEHandlerConfig>

// Getters（只读深拷贝）
foundDevList: Device[]
historyDevList: Device[]
historyConnectedDevices: Device[]
connectedDevices: Device[]
singleConnectedDevice: Device | undefined
config: BLEHandlerConfig
`

### SingleDeviceBLEHandler（无需 deviceId）

`	Typescript
connectDevice(devOrDeviceId: Device | string): Promise<void>
disconnectDevice(): Promise<void>
getDeviceRSSI(): Promise<number>
getDeviceServices(): Promise<WechatMiniprogram.BLEService[]>
enableCharacteristicNotification(deviceId?: string, serviceId?: string, characteristicId?: string): Promise<void>
writeCharacteristicValue(options: writeCharacteristicOption): Promise<void>
readCharacteristicValue(options: readCharacteristicOption): Promise<number[]>
`

### MultiDeviceBLEHandler（方法需传 deviceId）

`	Typescript
connectDevice(devOrDeviceId: Device | string): Promise<void>
disconnectDevice(deviceId: string): Promise<void>
getDeviceRSSI(deviceId: string): Promise<number>
getDeviceServices(deviceId: string): Promise<WechatMiniprogram.BLEService[]>
enableCharacteristicNotification(deviceId: string, serviceId?: string, characteristicId?: string): Promise<void>
writeCharacteristicValue(options: writeCharacteristicOption): Promise<void>  // options.deviceId 必填
readCharacteristicValue(options: readCharacteristicOption): Promise<number[]>  // options.deviceId 必填
`

### 兼容别名（index.ts）

`	Typescript
export { SingleDeviceBLEHandler as BLEHandler }  // 向后兼容
`

### 调试日志开关（模块级，默认静默）

`	Typescript
import { setDebugEnabled } from "miniprogram-bluetooth-utils";
setDebugEnabled(true); // 默认关闭，需要调试时开启；关闭后所有 debugLog/debugError/debugWarn 静默
`

也可在初始化时通过构造参数开启（仅显式传入 `debug` 时生效）：

`	Typescript
const ble = new SingleDeviceBLEHandler({ searchOption, debug: true });
await ble.init(); // 后续所有调试日志将输出
`

---

## 开发规范

### 命名

- Manager 类：PascalCase + Manager（如 ConnectionManager）
- 方法：动词开头 camelCase（如 connectDevice）
- 对外 API **不使用 BLE 前缀**

### 事件监听模式

- 所有三个平台监听器（连接状态、特征值变化、设备发现）均只向 wx 注册一次，在 `init()` 中自动激活（不再在构造器中）
- 注册方法返回解绑函数（`() => void`）
- 同时提供 `remove...` 和 `removeAll...` 方法（仅 IOManager 特征值回调）
- 多监听器用 Set 管理，平台只注册一个监听器
- `release()` 调用后，所有标志位重置，允许再次调用 `init()` 重新注册

### 数组保护

- connectedDevices、foundDevList 等均为**私有数组 + 深拷贝 getter**
- 不要绕过 getter 直接修改内部状态

### 重连机制

- ConnectionManager 用 reconnectGenerations Map 跟踪每设备代次
- 递增代次即可取消重连循环（无需手动 cancel）
- 单设备模式切换目标时调用 cancelReconnectsExcept(newDeviceId)
- `disconnect()` 或 `release()` 时自动取消该设备的重连任务

### 初始化与释放流程

- **初始化**：`const ble = new Handler(...); await ble.init();`
  - 构造器：同步初始化管理器、解析配置
  - `init()`：异步打开适配器、注册全局监听器
- **释放**：`await ble.release();`
  - 断开所有连接的设备
  - 解绑全局监听器 + 重置所有 Manager 的注册标志位
  - 关闭适配器
  - 释放后可再次调用 `init()` 重新使用

---

## 文档索引

| 文档                                                                       | 用途                         |
| -------------------------------------------------------------------------- | ---------------------------- |
| [README.md](./README.md)                                                   | 用户文档、快速开始、API 概览 |
| [doc/EXAMPLES.md](./doc/EXAMPLES.md)                                       | 12+ 个完整可运行示例         |
| [doc/ARCHITECTURE.md](./doc/ARCHITECTURE.md)                               | 架构设计与设计模式           |
| [doc/archive/DEVICE_FILTER_GUIDE.md](./doc/archive/DEVICE_FILTER_GUIDE.md) | 设备过滤详细指南             |
| [doc/archive/RENAME.md](./doc/archive/RENAME.md)                           | 旧 API 新 API 迁移对照       |
| [change-log](./change-log/)                                                | 版本变更记录                 |

---
