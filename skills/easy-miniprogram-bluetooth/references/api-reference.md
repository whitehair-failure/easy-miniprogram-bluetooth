# API 参考（easy-miniprogram-bluetooth 当前实现）

> 依据仓库当前源码（`src/core/**`、`src/types/ble.d.ts`）整理，只描述**现行 API**，不含历史命名。

## 目录

- [1. 类型定义](#1-类型定义)
- [2. 构造与配置](#2-构造与配置)
- [3. 适配器与生命周期](#3-适配器与生命周期)
- [4. 设备发现](#4-设备发现)
- [5. 连接管理](#5-连接管理)
- [6. 服务与特征值](#6-服务与特征值)
- [7. 数据读写](#7-数据读写)
- [8. 监听器](#8-监听器)
- [9. Getter](#9-getter)
- [10. UUID 与过滤规则](#10-uuid-与过滤规则)
- [11. 工具函数](#11-工具函数)

---

## 1. 类型定义

```typescript
interface Device extends WechatMiniprogram.BlueToothDevice {
  isConnect: boolean;
  reconnect?: boolean;
}

interface SearchOption extends WechatMiniprogram.StartBluetoothDevicesDiscoveryOption {
  includeKeys?: string[];   // 白名单：设备名/localName 包含任一关键字
  excludeKeys?: string[];   // 黑名单：设备名/localName 命中任一关键字则丢弃
}

interface BLEHandlerConfig {
  serviceUId?: string;                 // 可选；未设置时跳过特征值校验与通知订阅
  readCharacteristicId?: string;
  writeCharacteristicId?: string;
  notifyCharacteristicId?: string;
  notifyType?: 'notification' | 'indication'; // 默认 'notification'
}

interface BLEHandlerConstructor {
  config?: BLEHandlerConfig;
  searchOption: SearchOption;          // 必填（实际可省略，默认 {}）
  reconnect?: boolean;                 // 默认 false
  connectTimeout?: number;             // 默认 5000
  maxRetries?: number;                 // 默认 3
  reconnectDelay?: number;             // 默认 3000
  mode?: 'single' | 'multiple';        // 仅文档用途，实际模式由子类决定
  debug?: boolean;                     // 显式传入才生效；默认开启，传 false 可全局关闭
}

interface CharacteristicCheckResult {
  success: boolean;
  missingCharacteristics?: string[];   // 取值：'writeCharacteristicId' | 'notifyCharacteristicId' | 'readCharacteristicId'
}

interface writeCharacteristicOption extends WechatMiniprogram.WriteBLECharacteristicValueOption {
  responseConfig?: {
    hasResponse: boolean;              // true = 等待设备回包后 resolve
    timeoutMs?: number;                // 默认 1000
    serviceId?: string;
    characteristicId?: string;         // 回包匹配用的特征值，默认 config.notifyCharacteristicId
  };
}

interface readCharacteristicOption extends WechatMiniprogram.ReadBLECharacteristicValueOption {
  timeoutMs?: number;                  // 默认 1000
}

// 特征值读取/回包结果的内部形态（value 为字节数组）
interface CharacteristicValueResult {
  deviceId: string;
  serviceId: string;
  characteristicId: string;
  value: number[];
}

// getDeviceRSSI 的返回结果，与 wx.getBLEDeviceRSSI 成功回调一致
// 是对象，不是裸 number：取信号强度用 res.RSSI
type DeviceRSSIResult = WechatMiniprogram.GetBLEDeviceRSSISuccessCallbackResult;
// 等价于 { RSSI: number; errMsg: string }
```

---

## 2. 构造与配置

### `new SingleDeviceBLEHandler(options)` / `new MultiDeviceBLEHandler(options)`

- 构造器是**同步**的：解析配置、校验 UUID 配置、创建 5 个内部 Manager。
- 构造器**不注册**任何 wx 监听器，也不打开适配器 —— 这些在 `init()` 里做。
- 传 `debug: true` / `debug: false` 会立即改变全局调试日志开关（模块级，非实例级）。
- `config` 会经过 `validateBLEHandlerConfig` 校验，非法值直接抛 `Error`：
  - `serviceUId` 必须是 undefined 或非空字符串；
  - 三个特征值 ID 必须是非空字符串或 undefined；
  - `notifyType` 只能是 `'notification'` / `'indication'`。

```javascript
const ble = new SingleDeviceBLEHandler({
  debug: false,                         // 生产环境关闭日志（默认是开启的）
  reconnect: true,
  connectTimeout: 1000,
  maxRetries: 90,
  reconnectDelay: 2000,
  searchOption: { includeKeys: ['Li-RGB'], allowDuplicatesKey: true, interval: 1000 },
  config: { serviceUId: 'FFF0', writeCharacteristicId: 'FFF2', notifyCharacteristicId: 'FFF1', notifyType: 'indication' },
});
```

### `updateBLEHandlerConfig(cfg)`

| 项 | 说明 |
| --- | --- |
| 参数 | `Partial<BLEHandlerConfig>`，允许键仅 `serviceUId` / `readCharacteristicId` / `writeCharacteristicId` / `notifyCharacteristicId` / `notifyType` |
| 返回 | `Promise<BLEHandlerConfig>`（更新后的完整配置转正后的副本） |
| 副作用 | 同步更新 ServiceManager 与 IOManager 的配置，并**对所有已连接设备重新订阅通知** |
| 异常 | `未知的配置项: xxx`、`配置项 xxx 类型无效，应为字符串`、`配置对象无效` |

典型用法：连接后拿到真实服务 UUID 再回填。

```javascript
const services = await ble.getDeviceServices();
await ble.updateBLEHandlerConfig({ serviceUId: services[0].uuid });
```

---

## 3. 适配器与生命周期

### `init(): Promise<void>`

- 行为：`openBluetoothAdapter({ mode: 'central' })` → 注册「连接状态」与「特征值变化」两个全局监听器（各只注册一次）。
- 必须在搜索/连接/读写之前调用。
- 需要重复调用时用守卫包裹（库内部对监听器注册是幂等的，但 `openBluetoothAdapter` 会被重复执行）。
- 异常：适配器打开失败时原样抛出微信错误（权限 `103`、蓝牙未开 `10001` / `1500102`）。

```javascript
let inited = false;
async function ensureInit(ble) {
  if (inited) return;
  await ble.init();
  inited = true;
}
```

### `release(): Promise<void>`

- 行为：断开所有已连接设备 → `offBLECharacteristicValueChange` / `offBLEConnectionStateChange` / `offBluetoothDeviceFound` → 清空所有用户回调与设备列表、重置重连代次 → `closeBluetoothAdapter()`。
- 释放后**可以再次 `init()`** 重新使用（标志位与列表均已重置）。
- 断开单个设备失败不会中断整体释放，只记录调试日志。

### `getAdapterStatus(): Promise<{ available, discovering }>`

- 检查适配器是否可用、是否正在搜索；权限/开关问题会**转成中文 Error**：
  - `errno === 103 || errCode === 103` → `请检查是否已授权小程序蓝牙权限`
  - `errno === 1500102 || errCode === 10001` → `请检查蓝牙是否开启`
- 其他错误原样抛出。
- 适合在 `init()` 前做启动态检查或重试循环里的探测。

### `openAdapter()` / `closeAdapter(): Promise<void>`

- `openAdapter` 固定使用 `mode: 'central'`（小程序只能作为主机/中心设备）。
- 一般无需手动调用 —— `init()` 和 `release()` 已分别包含。

### `getDeviceRSSI(deviceId?): Promise<DeviceRSSIResult>`

- 单设备模式**无需传参**（自动取当前连接设备）；多设备模式 `deviceId` **必填**，漏传抛 `Error("多设备模式下必须提供设备ID")`。
- 未连接任何设备时抛 `Error("获取蓝牙设备信号强度失败，单设备模式下未连接任何设备")`。
- **返回的是对象**：`{ RSSI: number; errMsg: string }`（类型 `DeviceRSSIResult`，与 `wx.getBLEDeviceRSSI` 成功回调一致），不是裸 `number`。

```javascript
const { RSSI } = await ble.getDeviceRSSI();      // ✅
console.log('信号强度', RSSI, 'dBm');

const bad = await ble.getDeviceRSSI();           // ❌ 不要当数字用
if (bad < -70) { /* 永远不成立：对象与数字比较 */ }
```

- `devtools` 下直接返回 `{ RSSI: 0 }`（不发起真实调用）。

---

## 4. 设备发现

### `startDeviceDiscovery(searchOption?): Promise<void>`

- 不传参时使用构造时的 `searchOption`。
- 传入的选项会**整体覆盖**本次搜索参数（不合并）；`includeKeys` / `excludeKeys` 由库自行过滤，不会传给微信。
- 异常：搜索失败原样抛出（定位权限相关见错误码表）。

### `stopDeviceDiscovery(): Promise<void>`

- 停止扫描，**并把 `foundDevList` 清空**（`historyDevList` 保留）。
- 调用前先把需要的列表拷走。

### `addDeviceFoundListener(callback): () => void`

```javascript
const off = ble.addDeviceFoundListener((devices) => {
  // devices = 本批次「新发现」的设备数组（已过滤、已附加 isConnect/reconnect 字段）
  // 全量列表请读 ble.foundDevList
  this.setData({ foundDevList: ble.foundDevList });
});
```

- 首次注册时会惰性注册 `wx.onBluetoothDeviceFound`（`init()` 之外也能生效）。
- 同一个设备在 `foundDevList` 中只保留一条（去重），`historyDevList` 亦是。
- 回调抛错被捕获并写调试日志，不会中断其他回调。
- 返回解绑函数；也可用 `removeDeviceFoundListener(cb)` / `removeAllDeviceFoundListeners()`（后两者挂在 DiscoveryManager 上，对外通常用返回的解绑函数即可）。

### 设备过滤

```javascript
ble.updateDeviceFilterOptions({ includeKeys: ['Li-RGB'], excludeKeys: ['Test'] });
console.log(ble.getDeviceFilterOptions()); // { includeKeys, excludeKeys }
```

- 合并语义：只覆盖传入的键，未传的键保持原值（`includeKeys` 与 `excludeKeys` 相互独立）。
- 匹配规则：取 `device.name || device.localName`，两者都为空 → 直接丢弃；黑名单优先，任一命中即丢弃；白名单任一命中即通过；两者都未配置 → 放行全部。
- 传 `includeKeys: []` 等价于「没有白名单」→ 放行全部。

---

## 5. 连接管理

### `connectDevice(devOrDeviceId): Promise<void>`

| 模式 | 参数 | 说明 |
| --- | --- | --- |
| 单设备 | `Device \| string` | 传字符串时会用 deviceId 造一个默认 Device（name/localName 均为该字符串） |
| 多设备 | `Device \| string` | 同上，可多次连接不同设备 |

内部流程（无需手写）：

1. 单设备模式：记录本次目标设备，取消其他设备的重连任务；若已连着别的设备则先断开。
2. `wx.createBLEConnection({ deviceId, timeout: connectTimeout })`。
3. 更新 `connectedDevices` / `historyConnectedDevices`，标记 `isConnect = true`。
4. 串行执行回调：`getDeviceServices()` → `validateCharacteristics()` → `enableCharacteristicNotification()`。

注意：

- 第 4 步中 `validateCharacteristics` 的**结果被忽略**（不抛错），UUID 配错时连接依然「成功」。
- 第 4 步任何一步抛错，整个 `connectDevice` 会 reject（此时设备已连上但状态可能不完整）。
- 单设备模式重复连接同一设备会跳过「先断开」分支。

### `disconnectDevice(deviceId?)`

- 单设备模式：无参，内部取 `singleConnectedDevice.deviceId`；无连接时抛 `Error('断开蓝牙连接失败，单设备模式下未连接任何设备')`。
- 多设备模式：`deviceId` 必填，漏传抛 `Error('多设备模式下必须提供设备ID')`。
- 行为：先把该设备 `reconnect` 置 false（防自动重连），取消进行中的重连循环，再 `closeBLEConnection`，最后从列表移除（单设备清空列表）。

### 自动重连机制

- 由 `init()` 注册的 `onBLEConnectionStateChange` 监听器驱动，条件：`res.connected === false` 且该设备 `reconnect === true`。
- 重试间隔 = `connectTimeout + reconnectDelay`（上一次失败退出后 sleep，再试下一次）。
- 达到 `maxRetries` 仍未成功 → 从 `connectedDevices` 中移除，不再重试。
- 单设备模式下只有「当前目标设备」会被重连，切换目标会自动废弃旧目标的重连循环。
- 微信自身重连成功时（`connected === true` 且设备在历史列表中），库会自动把设备恢复到 `connectedDevices`；不在历史中的未知设备会被强制断开。
- `disconnectDevice()` 与 `release()` 均会终止对应重连任务。

---

## 6. 服务与特征值

### `getDeviceServices(deviceId?): Promise<BLEService[]>`

- 包装 `wx.getBLEDeviceServices`，返回 `res.services || []`。
- 单设备模式无参；多设备模式 `deviceId` 必填。
- 用途：真机打印真实 UUID 来校正 `config`。

### `validateCharacteristics(deviceId, serviceId?): Promise<CharacteristicCheckResult>`

- `config.serviceUId` 与 `serviceId` 都缺失时**直接返回 `{ success: true }`**（跳过校验）。
- 否则 `wx.getBLEDeviceCharacteristics` 拉取列表，与 `config` 中的三个特征值 ID 做**大小写不敏感**比对。
- 返回 `{ success, missingCharacteristics }`，`missingCharacteristics` 元素为配置字段名。
- **不抛错**（除微信 API 本身失败外），调用方必须自行判断 `success`。

```javascript
const check = await ble.validateCharacteristics(deviceId);
if (!check.success) {
  console.warn('特征值不匹配:', check.missingCharacteristics);
}
```

### `enableCharacteristicNotification(deviceId?, serviceId?, characteristicId?): Promise<void>`

- 包装 `wx.notifyBLECharacteristicValueChange`，`state: true`，`type: config.notifyType || 'notification'`。
- **静默跳过**的两种情况：
  - 未传 `serviceId` 且未配置 `config.serviceUId`；
  - 未传 `characteristicId` 且未配置 `config.notifyCharacteristicId`。
- 单设备模式三个参数全可省；多设备模式第一个参数 `deviceId` 必填（否则抛错）。
- `updateBLEHandlerConfig` 会为所有已连接设备重新调用本方法。

---

## 7. 数据读写

### `writeCharacteristicValue(options): Promise<...>`

`options` 关键字段（其余继承微信原生 `WriteBLECharacteristicValueOption`）：

| 字段 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `value` | 是 | — | 必须是 `ArrayBuffer` |
| `deviceId` | 多设备必填 | 单设备自动取当前连接设备 | 单设备模式可显式覆盖 |
| `serviceId` | 否 | `config.serviceUId` | 写入用的服务 |
| `characteristicId` | 否 | `config.writeCharacteristicId` | 写入用的特征值 |
| `writeType` | 否 | 微信默认 | `'write'` / `'writeNoResponse'` |
| `responseConfig.hasResponse` | 否 | `false` | 是否等待设备回包 |
| `responseConfig.timeoutMs` | 否 | `1000` | 等待回包超时 |
| `responseConfig.characteristicId` | 否 | `config.notifyCharacteristicId` | 回包匹配特征值 |

返回值：

- `hasResponse` 为假 → `{ success: true }`。
- `hasResponse` 为真 → resolve 出 `{ deviceId, serviceId, characteristicId, value: number[] }`（`value` 已是字节数组）。
- 异常：
  - 超时 → `Error('写入响应超时 - 请求ID: req_N, 设备: xxx, 特征值: xxx')`；
  - `wx.writeBLECharacteristicValue` 失败 → 原样抛出微信错误；
  - 单设备无连接且未传 `deviceId` → `Error('单设备模式下未连接任何设备，也未提供设备ID')`。

回包匹配规则（重要）：监听器在 `pendingRequests` 中查找**第一个**满足 `deviceId` 与 `characteristicId` 均相同的请求并 resolve。因此：

- 同一特征值上并发多个 `hasResponse: true` 的写入会错配 → 协议层要串行 / 节流；
- 回包特征值必须是已订阅通知的那个（默认取 `config.notifyCharacteristicId`）。

### `readCharacteristicValue(options): Promise<number[]>`

| 字段 | 必填 | 默认 |
| --- | --- | --- |
| `deviceId` | 多设备必填 | 单设备自动取当前连接设备 |
| `serviceId` | 否 | `config.serviceUId` |
| `characteristicId` | 否 | `config.readCharacteristicId` |
| `timeoutMs` | 否 | `1000` |

- 返回**字节数组** `number[]`（内部 `ArrayBuffer` → `Array.from`）。
- 必须已订阅该特征值的通知（`readBLECharacteristicValue` 的返回数据同样通过 `onBLECharacteristicValueChange` 事件送达）。
- 超时 → `Error('读取响应超时 - 请求ID: req_N, 设备: ..., 特征值: ...')`。

```javascript
const bytes = await ble.readCharacteristicValue({ timeoutMs: 2000 });
console.log(bytes);                                  // [1, 2, 3]
const buffer = new Uint8Array(bytes).buffer;         // 需要 buffer 时
```

---

## 8. 监听器

三个监听器（设备发现、连接状态、特征值变化）都是「wx 平台监听只注册一次 + 用户回调存在 Set 中」，注册方法统一返回解绑函数。

### `addConnectionStateChangeListener(cb): () => void`

```javascript
const off = ble.addConnectionStateChangeListener((res) => {
  // res: { deviceId, connected }
  if (!res.connected) console.log('设备断开，库会自动重连（reconnect=true 时）');
});
```

- 回调在库内部完成状态维护之后触发，拿到的是原始 `res`。
- 可在 `init()` 之前注册，`init()` 时才真正挂到 wx 上。

### `addCharacteristicValueChangeListener(cb): () => void`

```javascript
const off = ble.addCharacteristicValueChangeListener((res) => {
  const bytes = Array.from(new Uint8Array(res.value)); // res.value 是 ArrayBuffer
  console.log(res.deviceId, res.characteristicId, bytes);
});
```

- **回调参数是原始 wx 事件**，`res.value` 为 `ArrayBuffer` —— 与 `writeCharacteristicValue({ hasResponse: true })` 返回的字节数组形态不同。
- 回调抛错被捕获写日志，不影响其他回调。
- 配套：`removeCharacteristicValueChangeListener(cb): boolean`、`removeAllCharacteristicValueChangeListeners(): void`。

---

## 9. Getter

均返回**深拷贝**（`{ ...d }`），外部修改不影响内部状态。

| Getter | 返回 | 说明 |
| --- | --- | --- |
| `foundDevList` | `Device[]` | 本次搜索已发现（去重）；`stopDeviceDiscovery()` 后清空 |
| `historyDevList` | `Device[]` | 历史发现，跨搜索保留 |
| `connectedDevices` | `Device[]` | 当前已连接（单设备模式最多 1 个） |
| `historyConnectedDevices` | `Device[]` | 历史连接过 |
| `singleConnectedDevice` | `Device \| undefined` | 取 `connectedDevices[0]` |
| `config` | `BLEHandlerConfig` | 当前配置（UUID 已补全为大写 128 位） |

另有两个只读属性：`reconnect`、`maxRetries`、`reconnectDelay`、`connectTimeout`、`searchOption`。

> 注意：`singleConnectedDevice` 每次访问都返回新对象，用它做 `setData` 不会与内部状态互相影响；断开后为 `undefined`。

---

## 10. UUID 与过滤规则

### 短 UUID 自动补全

- 仅当字符串是**恰好 4 位十六进制字符且不含连字符**时才转换（正则 `/^[0-9a-fA-F]{4}$/`）。
- 规则：`0000{S}.toUpperCase() + '-0000-1000-8000-00805F9B34FB'`，例如 `'fff1'` → `'0000FFF1-0000-1000-8000-00805F9B34FB'`。
- 其他形式（8 位、含连字符、非十六进制）原样透传，不做校验。
- 构造时与 `updateBLEHandlerConfig` 时都会转换；`config` getter 读出来的是转换后的值。

### 设备名过滤

```
name = device.name || device.localName
if (!name)                       → 丢弃
if (excludeKeys 命中任一)         → 丢弃
if (includeKeys 已配置)           → 必须命中任一，否则丢弃
否则                              → 通过
```

---

## 11. 工具函数

`index.ts` 额外导出：

```typescript
import { isShortUUID, convertShortUUIDToFull, convertConfigUUIDs, setDebugEnabled, isDebugEnabled } from 'easy-miniprogram-bluetooth';

isShortUUID('FFF1');                    // true
convertShortUUIDToFull('fff1');         // '0000FFF1-0000-1000-8000-00805F9B34FB'
convertConfigUUIDs({ serviceUId: 'FFF0' });
setDebugEnabled(false);                 // 关闭调试日志（默认开启，也可用构造参数 debug: false）
isDebugEnabled();                       // 查询当前开关状态
```

### 调试日志

- 统一走 `src/utils/logger.ts`，**默认开启**，`debugLog` / `debugError` / `debugWarn` 分别对应 `console.log` / `error` / `warn`。
- 需要静默时两种方式：模块级 `setDebugEnabled(false)`，或构造时传 `debug: false`。
- **不传 `debug` 则不改动开关**，保持当前状态（初始为开启）。
- 日志开关是**模块级全局**，多实例共享：任一实例传 `debug: false` 会影响所有实例。
- 日志内容本身不带统一前缀；仅 `devtools` 跳过 API 的那条会输出 `[BLE] 当前运行在 devtools，已跳过 wx.xxx`。

### 开发者工具行为

`utils/runtime.ts` 在 `platform === 'devtools'` 时跳过所有 `wx.*BLE*` 调用并返回模拟值：

| 调用 | devtools 下的行为 |
| --- | --- |
| `getBluetoothAdapterState` | `{ available: true, discovering: false }` |
| `openBluetoothAdapter` / `closeBluetoothAdapter` | `{ success: true }` |
| `startBluetoothDevicesDiscovery` / `stopBluetoothDevicesDiscovery` | `{ success: true }`，不会触发设备发现回调 |
| `getBLEDeviceServices` | `[]` |
| `getBLEDeviceCharacteristics` | 视为校验通过 |
| `createBLEConnection` / `closeBLEConnection` | 模拟成功 |
| `writeBLECharacteristicValue` | `{ success: true }`（`hasResponse` 场景仍会走超时逻辑） |
| `readBLECharacteristicValue` | 返回 `[0]` |
| `getBLEDeviceRSSI` | `{ RSSI: 0 }` |

结论：**功能必须在真机验证**，工具里「全绿」没有参考价值。
