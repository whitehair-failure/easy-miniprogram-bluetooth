# AGENTS.md - AI 助手项目指南

> 本文档为 AI 助手提供项目内部关键信息，帮助快速上手开发。
> 面向**使用者**的接入指南在 [`skills/easy-miniprogram-bluetooth/`](./skills/easy-miniprogram-bluetooth/SKILL.md)，本文件聚焦**参与开发**所需的事实。

## 项目概览

| 项       | 值                                                              |
| -------- | --------------------------------------------------------------- |
| 项目名称 | easy-miniprogram-bluetooth                                      |
| 版本     | 0.4.1                                                           |
| 类型     | TypeScript 库（微信小程序 BLE 工具封装）                        |
| 目标平台 | 微信小程序                                                      |
| 构建工具 | Rollup + TypeScript                                             |
| 仓库     | https://github.com/whitehair-failure/easy-miniprogram-bluetooth |

> 旧名 `miniprogram-bluetooth-utils` 已废弃，一律使用新名。仅历史日志与早期 change-log 保留旧名快照。

---

## 构建与验证

```bash
npm run build         # 先 rimraf dist 再 rollup 构建，输出 dist/（ESM + CJS + 单文件 .d.ts）
npm run clean         # 清理 dist/ 与 rollup/ 缓存
npx tsc --noEmit      # 类型检查（修改任何 .ts 后必须执行）
npm run lint          # ESLint 检查
npm run format:check  # Prettier 校验
```

> `tsc --noEmit` 是硬门槛。构建脚本自带 `rimraf dist`，不要在它之外手动拼构建命令。

---

## 目录结构

```text
src/
├── index.ts                          # 入口：导出所有公共 API
├── core/
│   ├── BLEHandler.base.ts            # 抽象基类 BLEHandlerBase（含全部 getter 与公共方法）
│   ├── SingleDeviceBLEHandler.ts     # 单设备子类（无需传 deviceId）
│   ├── MultiDeviceBLEHandler.ts      # 多设备子类（方法需传 deviceId）
│   └── modules/
│       ├── AdapterManager.ts         # 适配器管理（初始化、状态、RSSI）
│       ├── DiscoveryManager.ts       # 设备发现与过滤
│       ├── ConnectionManager.ts      # 连接、断开、自动重连
│       ├── ServiceManager.ts         # 服务/特征值验证与通知订阅
│       └── IOManager.ts              # 读写数据、请求队列、多回调事件
├── types/
│   └── ble.d.ts                      # 所有类型定义（唯一类型来源）
└── utils/
    ├── config.ts                     # BLEHandlerConfig 校验（validateBLEHandlerConfig）
    ├── logger.ts                     # 统一日志（debugLog/debugError/debugWarn，默认开启）
    ├── runtime.ts                    # 运行时环境判断（devtools / 鸿蒙）
    └── uuid.ts                       # UUID 工具（短 UUID → 128 位标准转换）
```

> ⚠️ `BluetoothManager.ts` **不存在**，旧文档中的该文件已在重构时移除。若在任何文档里看到它，是历史残留。
> ⚠️ 仓库中**没有** `doc/` 目录与 `doc/archive/`。历史归档文档与 `BLEHandler.ts.backup` 已删除，勿再引用。

---

## 构建产物与包入口约定（易踩，改前必读）

`rollup.config.mjs` 导出**数组**，共两趟构建：

| 产出                | 格式 | 说明                                   |
| ------------------- | ---- | -------------------------------------- |
| `dist/index.js`     | ESM  | 微信小程序 npm 入口                    |
| `dist/index.cjs.js` | CJS  | `package.json` 的 `main`               |
| `dist/index.d.ts`   | —    | 由第 2 趟 `rollup-plugin-dts` 合并生成 |

- **入口必须叫 `index.js`**：微信开发者工具「构建 npm」后，只写包名时默认寻找 `<包名>/index.js`，且**完全不认** `exports` / `module`（参考 tdesign-miniprogram、miniprogram-computed 等主流包的做法）。
- `package.json`：`main` → `dist/index.cjs.js`、`module` / `exports.import` → `dist/index.js`、`miniprogram` → `dist`、`exports` 内含 `types` 条件。
- **类型声明是单个 `dist/index.d.ts`**：因此 `tsconfig.json` 的 `declaration` 必须保持 `false`，且**不再需要** `declarationDir` 或 `copyTypesPlugin`（整棵类型依赖树会被内联）。
- `src/index.ts` 中的 `export type * from "./types/ble"` **不可删除**：删掉会导致消费者无法 `import type { BLEHandlerConfig }` 等公共类型。
- 改动产物形态后，验证方式是**站在消费者视角**写一个临时 `.ts` 引用包根并跑 `tsc --strict`，比只跑项目自身类型检查更能暴露导出缺失；验证完删除临时文件。

---

## 架构模式

- **门面模式**：`BLEHandlerBase` 协调 5 个内部 Manager，外部只与子类交互。
- **单一职责**：每个 Manager 专注一个领域，勿跨越职责边界。
- **模板方法**：公共流程在基类，模式相关方法声明为 `abstract`，由两个子类实现。
- **新功能路径**：Manager 内实现 → `BLEHandlerBase` 暴露公共方法 → 子类覆盖（如需）。

---

## 关键类型（src/types/ble.d.ts）

```typescript
interface Device extends WechatMiniprogram.BlueToothDevice {
  isConnect: boolean;
  reconnect?: boolean;
}

interface SearchOption extends WechatMiniprogram.StartBluetoothDevicesDiscoveryOption {
  includeKeys?: string[]; // 白名单（设备名 / localName 包含任一即通过）
  excludeKeys?: string[]; // 黑名单（优先级高于白名单）
}

interface BLEHandlerConfig {
  serviceUId?: string; // 可选：未设置时跳过特征值校验与通知订阅
  readCharacteristicId?: string;
  writeCharacteristicId?: string;
  notifyCharacteristicId?: string;
  notifyType?: "notification" | "indication"; // 默认 "notification"
}

interface BLEHandlerConstructor {
  config?: BLEHandlerConfig;
  searchOption: SearchOption;
  reconnect?: boolean; // 默认 false
  connectTimeout?: number; // 默认 5000
  maxRetries?: number; // 默认 3
  reconnectDelay?: number; // 默认 3000
  mode?: "single" | "multiple"; // 仅文档用途，实际模式由子类决定
  debug?: boolean; // 仅显式传入时生效；模块级全局开关，默认开启
}

interface CharacteristicCheckResult {
  success: boolean;
  missingCharacteristics?: string[]; // 缺失项是配置字段名，如 "writeCharacteristicId"
}

interface CharacteristicValueResult {
  deviceId: string;
  serviceId: string;
  characteristicId: string;
  value: number[]; // ArrayBuffer 转换后的字节数组
}

// 与 wx.getBLEDeviceRSSI 成功回调一致：{ RSSI: number; errMsg: string }
type DeviceRSSIResult = WechatMiniprogram.GetBLEDeviceRSSISuccessCallbackResult;

interface writeCharacteristicOption extends WechatMiniprogram.WriteBLECharacteristicValueOption {
  responseConfig?: {
    hasResponse: boolean;
    timeoutMs?: number; // 默认 1000
    serviceId?: string;
    characteristicId?: string; // 回包匹配用，默认 config.notifyCharacteristicId
  };
}

interface readCharacteristicOption extends WechatMiniprogram.ReadBLECharacteristicValueOption {
  timeoutMs?: number; // 默认 1000
}
```

---

## 错误处理

> ⚠️ `error.ts`（9 个自定义异常类）已在 0.3.0 移除。当前**不抛出自定义错误类型**。

所有方法**抛出异常**，不返回 `[err, result]` 元组。调用方需 try/catch：

- **微信原生 API 调用失败** → 直接 `throw err`（原始微信错误对象，含 `errMsg`、`errno` / `errCode`）
- **参数校验 / 配置校验 / 超时** → `throw new Error("...")`（原生 Error，超时消息含 "超时" 字样）

```typescript
try {
  await ble.connectDevice(device);
} catch (err) {
  if (err?.errno === 103 || err?.errCode === 103) {
    /* 权限未授权 */
  } else if (err?.errMsg?.includes("timeout")) {
    /* 超时 */
  }
}
```

**不要**在 Manager 内再包装自定义异常。判断错误类型时读取微信错误字段（`errMsg` / `errno` / `errCode`），不要用 `instanceof`。新增错误消息一律用中文。

---

## 公共 API 速查

### 所有类共有（BLEHandlerBase）

```typescript
// 适配器与初始化
getAdapterStatus(): Promise<WechatMiniprogram.GetBluetoothAdapterStateSuccessCallbackResult>
openAdapter(): Promise<void>
closeAdapter(): Promise<void>
release(): Promise<void> // 完全释放资源，重置所有标志位，可再次调用 init()
init(): Promise<void> // 必须在 new 后调用，打开适配器、注册全局监听器

// 设备发现
startDeviceDiscovery(searchOption?): Promise<void>
addDeviceFoundListener(callback: (devices: Device[]) => void): () => void // 返回解绑函数
stopDeviceDiscovery(): Promise<void> // 会清空 foundDevList

// 过滤
updateDeviceFilterOptions(filterOptions: { includeKeys?: string[]; excludeKeys?: string[] }): void
getDeviceFilterOptions(): { includeKeys?: string[]; excludeKeys?: string[] }

// 连接状态监听（init() 时自动激活，用户只需按需添加回调）
addConnectionStateChangeListener(callback: (res) => void): () => void

// I/O 事件（init() 时自动激活平台监听，用户只需按需添加回调）
addCharacteristicValueChangeListener(callback): () => void // 返回解绑函数
removeCharacteristicValueChangeListener(callback): boolean
removeAllCharacteristicValueChangeListeners(): void

// 特征值验证
validateCharacteristics(deviceId: string, serviceId?: string): Promise<CharacteristicCheckResult>

// 配置
updateBLEHandlerConfig(cfg: Partial<BLEHandlerConfig>): Promise<BLEHandlerConfig> // 并重订阅所有已连设备

// Getters（只读深拷贝）
foundDevList: Device[]
historyDevList: Device[]
historyConnectedDevices: Device[]
connectedDevices: Device[]
singleConnectedDevice: Device | undefined
config: BLEHandlerConfig

// 只读属性
reconnect: boolean
connectTimeout?: number
maxRetries: number
reconnectDelay: number
searchOption: SearchOption
```

### SingleDeviceBLEHandler（无需 deviceId）

```typescript
connectDevice(devOrDeviceId: Device | string): Promise<void>
disconnectDevice(): Promise<void>
getDeviceRSSI(): Promise<DeviceRSSIResult> // 取信号强度用 (await ble.getDeviceRSSI()).RSSI
getDeviceServices(): Promise<WechatMiniprogram.BLEService[]>
enableCharacteristicNotification(deviceId?, serviceId?, characteristicId?): Promise<void>
writeCharacteristicValue(options: writeCharacteristicOption): Promise<any>
readCharacteristicValue(options: readCharacteristicOption): Promise<number[]>
```

### MultiDeviceBLEHandler（方法需传 deviceId）

```typescript
connectDevice(devOrDeviceId: Device | string): Promise<void>
disconnectDevice(deviceId: string): Promise<void>
getDeviceRSSI(deviceId: string): Promise<DeviceRSSIResult>
getDeviceServices(deviceId: string): Promise<WechatMiniprogram.BLEService[]>
enableCharacteristicNotification(deviceId: string, serviceId?, characteristicId?): Promise<void>
writeCharacteristicValue(options: writeCharacteristicOption): Promise<any> // options.deviceId 必填
readCharacteristicValue(options: readCharacteristicOption): Promise<number[]> // options.deviceId 必填
```

### 模块级工具（index.ts 一并导出）

```typescript
// 兼容别名
export { SingleDeviceBLEHandler as BLEHandler }

// utils/uuid
isShortUUID(uuid: string): boolean
convertShortUUIDToFull(shortUuid: string): string
convertConfigUUIDs(config: BLEHandlerConfig): BLEHandlerConfig

// utils/logger
setDebugEnabled(enabled: boolean): void // 默认开启，传 false 可全局关闭
isDebugEnabled(): boolean
debugLog / debugError / debugWarn(...args: unknown[]): void
```

---

## 开发规范

### 命名

- Manager 类：PascalCase + Manager（如 `ConnectionManager`）
- 方法：动词开头 camelCase（如 `connectDevice`）
- 对外 API **不使用 BLE 前缀**

### 日志

- **禁止在 Manager / core 中直接写 `console.*`**，统一走 `src/utils/logger.ts` 的 `debugLog` / `debugError` / `debugWarn`。
- logger **默认开启**（`debugEnabled = true`），日志直接输出到宿主小程序控制台；需要静默时用 `setDebugEnabled(false)` 或构造参数 `debug: false`（模块级全局，影响所有实例）。**不要**把默认值改成 `false`——那会让开发期排查失去日志。

### 配置校验

- 一律复用 `src/utils/config.ts` 的 `validateBLEHandlerConfig`，不要在 Manager 里重复实现。
- `ServiceManager` 与 `IOManager` 各自持有经 UUID 转换后的 config 副本，`updateBLEHandlerConfig` 会同步更新两者，改动时注意保持一致性。

### 事件监听模式

- 三个平台监听器（连接状态、特征值变化、设备发现）均只向 wx 注册一次，在 `init()` 中自动激活（不再在构造器中）。
- 注册方法返回解绑函数（`() => void`）。
- 仅 IOManager 额外提供 `remove...` / `removeAll...` 方法。
- 多监听器用 `Set` 管理，平台只注册一个监听器。
- `release()` 调用后所有标志位重置，允许再次 `init()` 重新注册。

### 数组保护

- `connectedDevices`、`foundDevList` 等均为**私有数组 + 深拷贝 getter**，不要绕过 getter 直接修改内部状态。

### 重连机制

- `ConnectionManager` 用 `reconnectGenerations` Map 跟踪每设备代次；递增代次即可取消重连循环（无需手动 cancel）。
- 单设备模式切换目标时调用 `cancelReconnectsExcept(newDeviceId)`。
- **实际重连间隔 = `connectTimeout + reconnectDelay`**：while 循环里要等上一轮连接超时失败才会进入下一轮，改这个公式前先想清楚。
- `disconnectDevice()` 或 `release()` 时自动取消该设备的重连任务。

### 初始化与释放流程

- **初始化**：`const ble = new Handler(...); await ble.init();`
  - 构造器：同步初始化管理器、解析配置、按 `debug` 参数设置日志开关
  - `init()`：异步打开适配器、注册全局监听器
- **释放**：`await ble.release();`
  - 断开所有连接的设备
  - 解绑全局监听器 + 重置所有 Manager 的注册标志位与设备列表
  - 关闭适配器
  - 释放后可再次调用 `init()` 重新使用

---

## 运行时环境适配

`src/utils/runtime.ts` 提供环境判断，**所有 wx BLE API 调用前都应经 `shouldSkipBLEApiCall(name)` 守卫**：

- `isDevtoolsPlatform()`：`wx.getDeviceInfo().platform === "devtools"` 时，跳过 BLE API 并返回模拟值（`readCharacteristicValue` → `[0]`、`getDeviceServices` → `[]`）。**因此开发者工具里通过不代表真机通过。**
- `isHarmonyOS()`：识别华为 / `ohos` / `HarmonyOS` 环境，供上层业务分支使用。

---

## 已知的类型与运行时不一致（勿当成 bug 顺手"修"）

- `addCharacteristicValueChangeListener` 回调收到的是**原始 wx 事件**（`res.value` 为 `ArrayBuffer`），而 `writeCharacteristicValue({ responseConfig: { hasResponse: true } })` resolve 出的是**已转换**的 `CharacteristicValueResult`（`value` 为 `number[]`）。两者形态**有意不同**，不要为了"统一"而改其中一侧。

### 已修复（勿回退）

- `getDeviceRSSI()` 原先运行时返回 `{ RSSI }` 对象但类型标注为 `Promise<number>`，已于 2026-09-11 统一为 `Promise<DeviceRSSIResult>`（即 `WechatMiniprogram.GetBLEDeviceRSSISuccessCallbackResult`，含 `RSSI` 与 `errMsg`）。**这是破坏性变更**：调用方从 `const rssi = await ble.getDeviceRSSI()` 改为 `const { RSSI } = await ble.getDeviceRSSI()`。

---

## 文档索引

| 文档                                                                                             | 用途                                         |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| [README.md](./README.md)                                                                         | 用户文档：安装、快速开始、类型、API 概览     |
| [skills/easy-miniprogram-bluetooth/SKILL.md](./skills/easy-miniprogram-bluetooth/SKILL.md)       | 接入指南：分层封装模式、调用流程、易踩坑清单 |
| [references/api-reference.md](./skills/easy-miniprogram-bluetooth/references/api-reference.md)   | 全量 API 契约                                |
| [references/error-handling.md](./skills/easy-miniprogram-bluetooth/references/error-handling.md) | 错误码与统一兜底                             |
| [references/examples.md](./skills/easy-miniprogram-bluetooth/references/examples.md)             | 可复制示例                                   |
| [change-log](./change-log/)                                                                      | 版本变更记录（历史快照，不代表当前实现）     |

> 上游源码（`src/core/**`、`src/types/ble.d.ts`、`src/utils/**`）改动后，需同步 `skills/easy-miniprogram-bluetooth/`，不要只改 README。
