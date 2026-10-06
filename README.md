# easy-miniprogram-bluetooth

微信小程序低功耗蓝牙（BLE）工具封装库，提供简洁的 Promise API 来管理设备发现、连接、通知订阅与数据读写。

> 接入实战指南（含分层封装模式、易踩坑清单、错误码表、可复制示例）见 [`skills/easy-miniprogram-bluetooth/`](./skills/easy-miniprogram-bluetooth/SKILL.md)。
> 让 AI 助手自动按这套模式写代码，可一行命令装成 Skill，见 [作为 Skill 接入](#作为-skill-接入ai-助手--agent)。

## 特性

- 简洁 API：封装微信小程序 BLE 复杂流程，统一 Promise 异步调用。
- 单/多设备模式：`SingleDeviceBLEHandler`（兼容别名 `BLEHandler`）与 `MultiDeviceBLEHandler`。
- 自动重连：设备异常断开后自动重试，次数与间隔可配置。
- 过滤机制：按设备名 / `localName` 做白名单 `includeKeys` + 黑名单 `excludeKeys` 过滤，支持运行时更新。
- 超时控制：连接、读、写（可选等待回包）均支持超时参数。
- UUID 容错：`"FFF1"` 这类 16 位短 UUID 自动补全为标准 128 位 UUID。
- 模块化架构：抽象基类 + 5 个 Manager，职责清晰。
- 调试日志开关：**默认开启**便于排查；调用 `setDebugEnabled(false)` 或构造时传 `debug: false` 可全局关闭。
- TypeScript：完整类型定义，类型声明合并为单个 `dist/index.d.ts`。

## 安装

```bash
npm install easy-miniprogram-bluetooth
```

安装后需在微信开发者工具中执行 **工具 → 构建 npm**，之后即可直接按包名引入：

```typescript
import { BLEHandler } from "easy-miniprogram-bluetooth";
```

> - 必须用 `npm install`（不要加 `-D`）安装：开发者工具只扫描 `dependencies` 下的包参与构建。
> - 包内 `dist/` 根目录必须存在 `index.js`（本库由 rollup 产出）：只写包名时，开发者工具默认寻找 `<包名>/index.js` 作为入口。
> - `package.json` 的 `exports` / `module` 字段在「构建 npm」阶段不被识别，入口以 `miniprogram` 字段（指向 `dist`）为准。

也可以直接复制 `dist/` 到小程序项目中，按相对路径引入（对应 `dist/index.js`）。

> TypeScript 消费者若需显式标注 BLE 类型，建议自行安装类型包：`npm install -D miniprogram-api-typings`。本库的公共签名引用了 `WechatMiniprogram.*` 命名空间，开启 `skipLibCheck` 时不会报错，但类型会退化为 `any`。

## 作为 Skill 接入（AI 助手 / Agent）

本库自带一份接入 Skill，覆盖依赖检查与安装、分层封装模式、调用流程、易踩坑清单、微信 BLE 错误码兜底与可复制示例。一行命令即可装到支持 Skills 的环境中：

```bash
npx skills add https://github.com/whitehair-failure/easy-miniprogram-bluetooth --skill easy-miniprogram-bluetooth
```

> 该 Skill 对应库版本 **0.4.1**，示例与 API 说明均以该版本为准。

装好后可按名字显式调用 `easy-miniprogram-bluetooth`，助手也会依据描述自动触发（例如「用微信小程序蓝牙连接设备并收发数据」）。它会引导助手：

1. 先检测 `easy-miniprogram-bluetooth` 是否已在目标项目的 `dependencies` 中，未安装则直接执行 `npm install`（不会用 `-D`，避免开发者工具不参与「构建 npm」）；
2. 提示你在微信开发者工具中执行**工具 → 构建 npm**（这步只能手动操作）；
3. 按「`app.js` 单例 → 页面注册监听 → 协议层收发」三层结构生成代码，并附上错误处理与生命周期释放。

不想装 Skill，也可以直接阅读 [`skills/easy-miniprogram-bluetooth/SKILL.md`](./skills/easy-miniprogram-bluetooth/SKILL.md)。

## 导出 API

`src/index.ts` 的实际导出：

```typescript
export * from "./core/BLEHandler.base"; // BLEHandlerBase
export * from "./core/SingleDeviceBLEHandler"; // SingleDeviceBLEHandler
export * from "./core/MultiDeviceBLEHandler"; // MultiDeviceBLEHandler
export * from "./utils/uuid"; // isShortUUID / convertShortUUIDToFull / convertConfigUUIDs
export * from "./utils/logger"; // setDebugEnabled / isDebugEnabled / debugLog / debugError / debugWarn

// 对外类型定义（Device / BLEHandlerConfig / SearchOption / writeCharacteristicOption 等）
export type * from "./types/ble";

// 兼容旧命名
export { SingleDeviceBLEHandler as BLEHandler };
```

## 快速开始

### 单设备模式（推荐）

```typescript
import { BLEHandler } from "easy-miniprogram-bluetooth";

const ble = new BLEHandler({
  config: {
    serviceUId: "FFF0", // 4 位短 UUID 会自动补全为 128 位
    writeCharacteristicId: "FFF2",
    notifyCharacteristicId: "FFF1",
    readCharacteristicId: "FFF1",
    notifyType: "notification", // 可选: 'notification' | 'indication'
  },
  searchOption: {
    allowDuplicatesKey: false,
    interval: 0,
    includeKeys: ["设备名关键字"],
    excludeKeys: ["Test", "Debug"],
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
    // devices 只是本批次新发现的设备；全量列表请读 ble.foundDevList
    console.log("发现设备:", devices);
  });

  // 3) 开始搜索
  await ble.startDeviceDiscovery();

  // 4) 选择并连接设备（示例使用第一个发现设备）
  const first = ble.foundDevList[0];
  if (first) {
    // connectDevice 内部会自动完成：获取服务 → 校验特征值 → 订阅通知
    await ble.connectDevice(first);
    await ble.stopDeviceDiscovery(); // 连接后停止搜索，避免扫描干扰连接
  }

  // 5) 监听连接状态（返回解绑函数）
  const offConnection = ble.addConnectionStateChangeListener((res) => {
    console.log("连接状态变化:", res.deviceId, res.connected);
  });

  // 6) 监听特征值变化（返回解绑函数）
  const offValueChange = ble.addCharacteristicValueChangeListener((res) => {
    // 注意：回调收到的是原始 wx 事件，res.value 是 ArrayBuffer
    console.log("收到数据:", Array.from(new Uint8Array(res.value)));
  });

  // 7) 写入
  const buffer = new ArrayBuffer(8);
  await ble.writeCharacteristicValue({ value: buffer });

  // 写入并等待设备回包（回包对象中的 value 已是 number[]）
  const reply = await ble.writeCharacteristicValue({
    value: buffer,
    responseConfig: {
      hasResponse: true,
      timeoutMs: 2000,
    },
  });
  console.log("设备回包:", reply?.value);

  // 8) 读取（返回 number[]，即原始 ArrayBuffer 转成的字节数组）
  const data = await ble.readCharacteristicValue({ timeoutMs: 2000 });
  console.log("读取成功:", data);

  // 使用完后可按需解绑
  offDeviceFound();
  offConnection();
  offValueChange();
} catch (err) {
  console.error("BLE 操作失败:", err);
}

// 页面卸载 / 组件销毁时
// await ble.release();
```

### 多设备模式

```typescript
import { MultiDeviceBLEHandler } from "easy-miniprogram-bluetooth";

const ble = new MultiDeviceBLEHandler({
  config: {
    serviceUId: "YOUR_SERVICE_UUID",
    writeCharacteristicId: "YOUR_WRITE_CHARACTERISTIC_UUID",
    notifyCharacteristicId: "YOUR_NOTIFY_CHARACTERISTIC_UUID",
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
    responseConfig: { hasResponse: true, timeoutMs: 2000 },
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

- `init()`：打开适配器并注册全局监听器（连接状态、特征值变化）；**必须在搜索/连接/读写之前调用**。
- `release()`：断开所有连接、解绑全局监听并重置各 Manager 状态、关闭适配器；释放后可再次调用 `init()`。

## 核心类型

以下类型均可从包根直接引入（`import type { ... } from "easy-miniprogram-bluetooth"`）：

```typescript
interface BLEHandlerConstructor {
  config?: BLEHandlerConfig;
  searchOption: SearchOption;
  reconnect?: boolean; // 默认 false
  connectTimeout?: number; // 连接超时，默认 5000ms
  maxRetries?: number; // 自动重连最大次数，默认 3
  reconnectDelay?: number; // 自动重连间隔，默认 3000ms
  mode?: "single" | "multiple"; // 仅文档用途，实际模式由子类决定
  debug?: boolean; // 显式传入时才生效；默认开启，传 false 可全局关闭
}

interface BLEHandlerConfig {
  serviceUId?: string; // 可选：不设置时跳过基于该服务的特征值校验与通知订阅
  readCharacteristicId?: string;
  writeCharacteristicId?: string;
  notifyCharacteristicId?: string;
  notifyType?: "notification" | "indication"; // 默认 "notification"
}

interface SearchOption extends WechatMiniprogram.StartBluetoothDevicesDiscoveryOption {
  includeKeys?: string[]; // 白名单：设备名 / localName 包含任一即通过
  excludeKeys?: string[]; // 黑名单：包含任一即过滤（优先级高于白名单）
}

interface writeCharacteristicOption extends WechatMiniprogram.WriteBLECharacteristicValueOption {
  responseConfig?: {
    hasResponse: boolean; // true 时等待设备回包后才 resolve
    timeoutMs?: number; // 回包超时，默认 1000ms
    serviceId?: string;
    characteristicId?: string; // 用于匹配回包，默认使用 config.notifyCharacteristicId
  };
}

interface readCharacteristicOption extends WechatMiniprogram.ReadBLECharacteristicValueOption {
  timeoutMs?: number; // 默认 1000ms
}

interface CharacteristicCheckResult {
  success: boolean;
  missingCharacteristics?: string[]; // 缺失项为配置字段名，如 "writeCharacteristicId"
}

interface CharacteristicValueResult {
  deviceId: string;
  serviceId: string;
  characteristicId: string;
  value: number[]; // 原始 ArrayBuffer 转为普通字节数组
}

// getDeviceRSSI 的返回结果，与 wx.getBLEDeviceRSSI 一致（是对象，不是裸 number）
type DeviceRSSIResult = WechatMiniprogram.GetBLEDeviceRSSISuccessCallbackResult;
// 等价于 { RSSI: number; errMsg: string }

interface Device extends WechatMiniprogram.BlueToothDevice {
  isConnect: boolean;
  reconnect?: boolean;
}
```

说明：

- `reconnectDelay` 是**每次重连的等待时间**。实际间隔为 `connectTimeout + reconnectDelay`，因为上一轮连接要先超时失败才会进入下一轮。
- 4 位十六进制短 UUID（如 `"FFF1"`）会被自动转换为 `0000FFF1-0000-1000-8000-00805F9B34FB`，与写全 UUID 等价。
- `getDeviceRSSI()` 返回 `DeviceRSSIResult` 对象，取信号强度请用 `(await ble.getDeviceRSSI()).RSSI`。

## 主要实例方法

### 通用（`BLEHandlerBase`）

- `init()` / `release()`
- `getAdapterStatus()`
- `openAdapter()` / `closeAdapter()`
- `startDeviceDiscovery(searchOption?)` / `stopDeviceDiscovery()`
- `addDeviceFoundListener(callback)` → 解绑函数
- `addConnectionStateChangeListener(callback)` → 解绑函数
- `addCharacteristicValueChangeListener(callback)` → 解绑函数
- `removeCharacteristicValueChangeListener(callback): boolean`
- `removeAllCharacteristicValueChangeListeners()`
- `updateDeviceFilterOptions(filterOptions)` / `getDeviceFilterOptions()`
- `validateCharacteristics(deviceId, serviceId?)`
- `updateBLEHandlerConfig(cfg)`
- Getter（均返回深拷贝）: `foundDevList`、`historyDevList`、`connectedDevices`、`historyConnectedDevices`、`singleConnectedDevice`、`config`
- 只读属性: `reconnect`、`connectTimeout`、`maxRetries`、`reconnectDelay`、`searchOption`

### 单设备模式（`SingleDeviceBLEHandler`）

- `connectDevice(devOrDeviceId)`
- `disconnectDevice()`
- `getDeviceRSSI(): Promise<DeviceRSSIResult>`
- `getDeviceServices()`
- `enableCharacteristicNotification(deviceId?, serviceId?, characteristicId?)`
- `writeCharacteristicValue(options)`
- `readCharacteristicValue(options): Promise<number[]>`

### 多设备模式（`MultiDeviceBLEHandler`）

- `connectDevice(devOrDeviceId)`
- `disconnectDevice(deviceId)`（必填）
- `getDeviceRSSI(deviceId): Promise<DeviceRSSIResult>`（`deviceId` 必填）
- `getDeviceServices(deviceId)`（必填）
- `enableCharacteristicNotification(deviceId, serviceId?, characteristicId?)`（`deviceId` 必填）
- `writeCharacteristicValue(options)`（`options.deviceId` 必填）
- `readCharacteristicValue(options)`（`options.deviceId` 必填）

## 调试日志

**默认开启**，会向宿主小程序控制台输出调试日志，便于开发期排查问题。上线前建议关闭：

```typescript
// 方式一：模块级开关（全局生效）
import { setDebugEnabled } from "easy-miniprogram-bluetooth";
setDebugEnabled(false); // 关闭
setDebugEnabled(true); // 重新开启

// 方式二：构造参数（仅显式传入 debug 时生效）
const ble = new BLEHandler({ searchOption: {}, debug: false }); // 关闭
const ble2 = new BLEHandler({ searchOption: {}, debug: true }); // 开启
```

> 日志开关是**模块级全局状态**，不是实例级：任一实例传 `debug: false` 会影响所有实例的输出。多实例场景建议统一用 `setDebugEnabled()` 管理。

内部日志统一走 `debugLog` / `debugError` / `debugWarn`，分别对应 `console.log` / `error` / `warn`；可用 `isDebugEnabled()` 查询当前状态。

## 错误处理

所有方法**抛出异常**（不返回 `[err, result]` 元组），建议统一 `try/catch`。

库不定义自定义异常类：**catch 到的 `err` 就是原始微信小程序错误对象或原生 `Error`**。微信原生错误携带 `errMsg`、`errno` / `errCode` 字段，可按需据此区分错误类型。

```typescript
try {
  await ble.connectDevice(device);
} catch (err) {
  // 微信原生错误对象（errMsg / errno / errCode）或原生 Error
  if (err?.errno === 103 || err?.errCode === 103) {
    // 蓝牙权限未授权
  } else if (err?.errMsg?.includes("timeout")) {
    // 超时
  } else {
    console.error("BLE 操作失败:", err?.errMsg || err);
  }
}
```

参数校验、配置校验与超时抛原生 `Error`，消息稳定含以下关键词，可直接用 `message` 判断：

| 关键词                      | 触发场景                                                         |
| --------------------------- | ---------------------------------------------------------------- |
| `超时`                      | 读写等待回包超时（如 `写入响应超时 - 请求ID: req_3, 设备: ...`） |
| `必须提供设备ID`            | 多设备模式漏传 `deviceId`                                        |
| `未连接任何设备`            | 单设备模式在未连接时调用需设备的操作                             |
| `未知的配置项` / `类型无效` | `updateBLEHandlerConfig` 传入了不支持的键或错误的类型            |

## 项目结构

```text
src/
├── index.ts                          # 入口：导出所有公共 API
├── core/
│   ├── BLEHandler.base.ts            # 抽象基类 BLEHandlerBase
│   ├── SingleDeviceBLEHandler.ts     # 单设备子类（无需传 deviceId）
│   ├── MultiDeviceBLEHandler.ts      # 多设备子类（方法需传 deviceId）
│   └── modules/
│       ├── AdapterManager.ts         # 适配器管理（初始化、状态、RSSI）
│       ├── DiscoveryManager.ts       # 设备发现与过滤
│       ├── ConnectionManager.ts      # 连接、断开、自动重连
│       ├── ServiceManager.ts         # 服务/特征值验证与通知订阅
│       └── IOManager.ts              # 读写数据、请求队列、多回调事件
├── types/
│   └── ble.d.ts                      # 所有类型定义
└── utils/
    ├── config.ts                     # BLEHandlerConfig 校验
    ├── logger.ts                     # 统一日志（默认开启）
    ├── runtime.ts                    # 运行时环境判断（devtools / 鸿蒙）
    └── uuid.ts                       # UUID 工具（短 UUID → 128 位）

skills/easy-miniprogram-bluetooth/    # 对外接入指南（Skill）
change-log/                           # 版本变更记录
dist/                                 # 构建产物（index.js / index.cjs.js / index.d.ts）
```

构建产物说明（`rollup.config.mjs` 两趟产出）：

| 文件                | 格式 | 用途                                                 |
| ------------------- | ---- | ---------------------------------------------------- |
| `dist/index.js`     | ESM  | 微信小程序 npm 入口（`miniprogram` 字段指向 `dist`） |
| `dist/index.cjs.js` | CJS  | `package.json` 的 `main`，供 `require()` 使用        |
| `dist/index.d.ts`   | —    | 整棵类型依赖树合并后的单文件类型声明                 |

## 开发

```bash
npm install
npm run build         # 清理 dist 后 rollup 构建（JS + 类型声明）
npm run clean         # 清理 dist/ 与 rollup/ 缓存
npx tsc --noEmit      # 类型检查（修改 .ts 后必须执行）
npm run lint          # ESLint 检查
npm run lint:fix      # ESLint 自动修复
npm run format        # Prettier 格式化
npm run format:check  # Prettier 校验
```

## 文档

- 接入 Skill 安装：`npx skills add https://github.com/whitehair-failure/easy-miniprogram-bluetooth --skill easy-miniprogram-bluetooth`
- [接入指南（Skill）](./skills/easy-miniprogram-bluetooth/SKILL.md) — 依赖安装、分层封装模式、调用流程、易踩坑清单、错误码表
- [完整 API 契约](./skills/easy-miniprogram-bluetooth/references/api-reference.md)
- [错误处理与错误码](./skills/easy-miniprogram-bluetooth/references/error-handling.md)
- [可复制示例](./skills/easy-miniprogram-bluetooth/references/examples.md)
- [AGENTS.md](./AGENTS.md) — 面向 AI 助手与开发者的项目内部指南
- [更新日志](./change-log/)

## 注意事项

1. 确保微信基础库版本支持所需 BLE API。
2. 在 `app.json` 配置蓝牙权限；安卓侧搜索设备还依赖定位权限。
3. 建议所有 BLE 操作都使用 `try/catch`。
4. 页面卸载时调用 `release()` 释放资源。
5. 调试日志**默认开启**，上线前建议在 `app.js` 里调用 `setDebugEnabled(false)` 关闭。
6. **微信开发者工具下所有 BLE API 会被跳过并返回模拟值**（`readCharacteristicValue` → `[0]`、`getDeviceServices` → `[]`），必须真机验证。
7. `connectDevice` 内部会串行执行「获取服务 → 校验特征值 → 订阅通知」，但**特征值校验结果不会抛错**。UUID 配错时会「连得上却收发不了数据」，可手动再调一次 `validateCharacteristics` 确认。
8. `hasResponse: true` 的回包按 `deviceId + characteristicId` 匹配**第一个**待处理请求，同一特征值上并发写入会互相错配，协议层请串行或节流。
9. `stopDeviceDiscovery()` 会清空 `foundDevList`，需要保留列表请提前取走。

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request。
