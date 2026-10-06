---
name: easy-miniprogram-bluetooth
description: 'This skill should be used when integrating Bluetooth Low Energy into a WeChat Mini Program with the easy-miniprogram-bluetooth library — adapter init, device discovery with keyword filters, connect/disconnect, service and characteristic validation, notification subscription, data frame read/write with optional response waiting, auto-reconnect, and lifecycle release. It covers the current API surface, the standard encapsulation pattern (app-level singleton plus cross-page reuse), parameter and return contracts, common WeChat BLE error codes, and copy-paste example code.'
argument-hint: '目标设备的服务/特征值 UUID、单设备或多设备、以及业务收发需求'
user-invocable: true
disable-model-invocation: false
agent_created: true
---

# 小程序蓝牙极速接入（easy-miniprogram-bluetooth）

## 1. 适用场景

### 应当使用本 Skill 的场景

- 在微信小程序中与 BLE 外设通信（智能灯、工业控制器、传感器、手环等），需要走通「初始化 → 搜索 → 连接 → 收发」全链路。
- 项目已引入 `easy-miniprogram-bluetooth`，需要按统一模式在多个页面复用同一个蓝牙实例。
- 需要把设备发现做关键字白名单/黑名单过滤（只显示本厂商设备）。
- 需要「发送指令后等待设备回包」的问答式协议（带超时）。
- 需要连接异常断开后自动重连、以及重连间隔/次数可调。
- 需要把业务协议层（组帧、加密、心跳、节流）与蓝牙 I/O 解耦。

### 不应使用本 Skill 的场景

- 只做设备搜索展示、不做连接与数据交互 → 直接调微信原生 API 更轻量。
- 使用其他蓝牙库或自研封装（API 语义不同，不可照搬）。
- 需要经典蓝牙（BR/EDR，如 `wx.createBLEConnection` 之外的蓝牙串口）→ 小程序不支持。

### 触发关键词

小程序蓝牙、BLE、低功耗蓝牙、连接设备、搜索设备、收发数据、特征值、通知订阅、自动重连、`BLEHandler`、`SingleDeviceBLEHandler`、`MultiDeviceBLEHandler`、`easy-miniprogram-bluetooth`。

---

## 2. 安装与引入

```bash
# 必须用 npm install（不要 -D）：开发者工具只对 dependencies 下的包执行「构建 npm」
npm install easy-miniprogram-bluetooth
```

引入方式二选一：

```javascript
// 方式 A（推荐）：构建 npm 后按包名引入
// 微信开发者工具 → 工具 → 构建 npm
import { BLEHandler, SingleDeviceBLEHandler, MultiDeviceBLEHandler } from 'easy-miniprogram-bluetooth';

// 方式 B：直接把 dist/ 拷进项目，按相对路径引入
// import { BLEHandler } from '../../utils/dist';        // 等价于 index.js
// import { BLEHandler } from '../../utils/dist/index.js';
```

- `BLEHandler` 是 `SingleDeviceBLEHandler` 的兼容别名，新代码建议直接写 `SingleDeviceBLEHandler`。
- 入口以 `package.json` 的 `miniprogram` 字段（指向 `dist`）为准，`dist/index.js` 必须存在；`exports` / `module` 在「构建 npm」阶段不被识别。

---

## 3. 标准封装思路（三层）

照搬以下分层，代码才可跨页面复用、可控地释放：

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 单例层 | `app.js` → `globalData.BLEHandler` | 全应用唯一实例，负责 `init()` / `release()`、保存「上次连接设备」 |
| 页面层 | `pages/searchBLE` 等 | 只做 UI 绑定：注册监听 → 搜索 → 连接 → 跳转；负责解绑 |
| 协议层 | `models/*` 或 `utils/*` | 组帧/解帧、加密、心跳、节流；只依赖 `writeCharacteristicValue` / `readCharacteristicValue` |

四条硬规则：

1. **实例只创建一次**：放在 `app.js` 的 `globalData`，页面各自 `new` 会导致多个监听器互相抢数据、设备被反复断开。
2. **`init()` 只调一次**：打开适配器 + 注册全局监听器；重复调用前用 `if (!getApp().globalData.BLEHandler)` 守卫。
3. **监听器必须解绑**：`addXxxListener()` 都返回解绑函数，在 `onUnload` 里调用。
4. **所有异步调用 `try/catch`**：库抛异常，不返回 `[err, res]` 元组。

---

## 4. 核心 API 清单

### 构造参数（`BLEHandlerConstructor`）

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `config` | `BLEHandlerConfig` | `{}` | 服务与特征值 UUID |
| `searchOption` | `SearchOption` | `{}` | 搜索选项 + `includeKeys` / `excludeKeys` 过滤 |
| `reconnect` | `boolean` | `false` | 异常断开是否自动重连 |
| `connectTimeout` | `number` | `5000` | 连接超时（ms） |
| `maxRetries` | `number` | `3` | 自动重连最大次数 |
| `reconnectDelay` | `number` | `3000` | 自动重连间隔（ms）**实际间隔 = connectTimeout + reconnectDelay** |
| `debug` | `boolean` | `true`（默认开启） | 显式传入才生效；传 `false` 可全局关闭日志（模块级开关） |

`config` 字段：`serviceUId` / `readCharacteristicId` / `writeCharacteristicId` / `notifyCharacteristicId` / `notifyType`（`'notification'` 默认，或 `'indication'`）。
4 位十六进制短 UUID 会自动补全为 `0000XXXX-0000-1000-8000-00805F9B34FB`（大写），写 `'FFF1'` 与写全 UUID 等价。

### 公共方法（单/多设备通用）

| 方法 | 参数 | 返回 |
| --- | --- | --- |
| `init()` | — | `Promise<void>` |
| `release()` | — | `Promise<void>` |
| `getAdapterStatus()` | — | `Promise<{available, discovering}>` |
| `openAdapter()` / `closeAdapter()` | — | `Promise<void>` |
| `startDeviceDiscovery(searchOption?)` | 可覆盖默认搜索选项 | `Promise<void>` |
| `stopDeviceDiscovery()` | — | `Promise<void>` **会清空 `foundDevList`** |
| `addDeviceFoundListener(cb)` | `(devices: Device[]) => void` | 解绑函数 `() => void` |
| `addConnectionStateChangeListener(cb)` | `(res) => void` | 解绑函数 |
| `addCharacteristicValueChangeListener(cb)` | `(res) => void` | 解绑函数（`res.value` 为 `ArrayBuffer`） |
| `removeCharacteristicValueChangeListener(cb)` | — | `boolean` |
| `removeAllCharacteristicValueChangeListeners()` | — | `void` |
| `updateDeviceFilterOptions({includeKeys, excludeKeys})` | 运行时更新过滤 | `void` |
| `getDeviceFilterOptions()` | — | `{includeKeys, excludeKeys}` |
| `validateCharacteristics(deviceId, serviceId?)` | — | `Promise<{success, missingCharacteristics?}>` |
| `updateBLEHandlerConfig(cfg)` | 部分配置 | `Promise<BLEHandlerConfig>`，并重订阅所有已连设备 |
| Getter | — | `foundDevList` / `historyDevList` / `connectedDevices` / `historyConnectedDevices` / `singleConnectedDevice` / `config`（均为深拷贝） |

### 单设备模式（`SingleDeviceBLEHandler`，别名 `BLEHandler`）

| 方法 | 参数 | 返回 |
| --- | --- | --- |
| `connectDevice(devOrDeviceId)` | `Device \| string` | `Promise<void>` |
| `disconnectDevice()` | — | `Promise<void>` |
| `getDeviceRSSI()` | — | `Promise<DeviceRSSIResult>`，取信号强度用 `(await ble.getDeviceRSSI()).RSSI` |
| `getDeviceServices()` | — | `Promise<BLEService[]>` |
| `enableCharacteristicNotification(deviceId?, serviceId?, characteristicId?)` | 全部可选 | `Promise<void>` |
| `writeCharacteristicValue(options)` | `writeCharacteristicOption` | `Promise<{success:true} \| 响应对象>` |
| `readCharacteristicValue(options)` | `readCharacteristicOption` | `Promise<number[]>` |

### 多设备模式（`MultiDeviceBLEHandler`）

与单设备同名，但 `disconnectDevice(deviceId)` / `getDeviceRSSI(deviceId)` / `getDeviceServices(deviceId)` 的 `deviceId` **必填**；`writeCharacteristicValue` / `readCharacteristicValue` 的 `options.deviceId` **必填**。

### I/O 选项

```javascript
// 写入
{
  value: ArrayBuffer,              // 必填，仅支持 ArrayBuffer
  deviceId: string,                // 多设备模式必填
  serviceId?: string,              // 默认 config.serviceUId
  characteristicId?: string,       // 默认 config.writeCharacteristicId
  writeType?: 'write' | 'writeNoResponse',
  responseConfig?: {
    hasResponse: boolean,          // true = 等设备回包后才 resolve
    timeoutMs?: number,            // 默认 1000
    characteristicId?: string,     // 用于匹配回包的特征值，默认 config.notifyCharacteristicId
    serviceId?: string,
  },
}

// 读取
{ deviceId?: string, serviceId?: string, characteristicId?: string, timeoutMs?: number }  // timeoutMs 默认 1000
```

---

## 5. 调用流程步骤

```
① app.js 建单例        → globalData.BLEHandler = new SingleDeviceBLEHandler(options)
② 页面 onLoad 授权     → wx.getSetting → 缺 scope.bluetooth 则 wx.authorize
③ init()              → 打开适配器 + 注册全局监听器（只调一次）
④ 注册监听            → addDeviceFoundListener / addConnectionStateChangeListener / addCharacteristicValueChangeListener
⑤ startDeviceDiscovery → 搜索（示例：8 秒后自动 stop）
⑥ connectDevice(dev)  → 内部自动完成：createBLEConnection → getDeviceServices → validateCharacteristics → enableCharacteristicNotification
⑦ 收发数据            → writeCharacteristicValue / readCharacteristicValue
⑧ onUnload            → stopDeviceDiscovery + 解绑函数
⑨ 需要彻底停止时       → release()（断开全部、解绑、关适配器；之后可再次 init()）
```

关键顺序约束：

- `init()` 必须在搜索/连接/读写之前。
- 搜索与连接**不要并行**：先 `startDeviceDiscovery` 拿到设备，连接成功后立刻 `stopDeviceDiscovery`，否则安卓侧扫描会干扰连接。
- `connectDevice` 成功后无需手动 `getDeviceServices` / `enableCharacteristicNotification`，内部已经串行做过（但特征值校验结果不会抛出，需自行检查，见 §6.5）。
- 自动重连是**内置能力**：`reconnect: true` 时，异常断开由连接状态监听器自动触发，不要自己在页面上写重连定时器。

---

## 6. 关键契约与易踩的坑（务必先读）

1. **异常模型**：所有方法 `throw`，不返回元组。微信原生 API 失败时原样抛出微信错误对象（含 `errMsg` / `errno` / `errCode`）；参数校验与超时抛原生 `Error`，**超时消息含「超时」二字**（如 `写入响应超时 - 请求ID: req_3, 设备: ...`）。判断类型读字段，不要用 `instanceof`。
2. **`readCharacteristicValue` 返回 `number[]`**（字节数组），不是 `ArrayBuffer`。需要 buffer 时用 `new Uint8Array(bytes).buffer`。
3. **`writeCharacteristicValue` 返回值分两种**：`responseConfig.hasResponse` 为假 → `{ success: true }`；为真 → resolve 出回包对象 `{ deviceId, serviceId, characteristicId, value: number[] }`（`value` 已是字节数组，可直接取 `res.value[0]` 做状态码判断）。
4. **`addCharacteristicValueChangeListener` 的回调拿到的是原始 wx 事件，`res.value` 是 `ArrayBuffer`**，与第 3 点的返回类型**不一致**：

   ```javascript
   const off = ble.addCharacteristicValueChangeListener((res) => {
     const bytes = Array.from(new Uint8Array(res.value)); // 必须自己转
     console.log(bytes);
   });
   ```

5. **`connectDevice` 不会因特征值缺失而失败**。`validateCharacteristics` 只返回 `{ success, missingCharacteristics }`，`connectDevice` 内部调用后忽略结果。因此 UUID 配错时会「连得上但收不到/发不出数据」。需要严格校验时，连接后再调一次：

   ```javascript
   const check = await ble.validateCharacteristics(ble.singleConnectedDevice.deviceId);
   if (!check.success) console.warn('缺失特征值', check.missingCharacteristics); // ['writeCharacteristicId', ...]
   ```

6. **`serviceUId` 或 `notifyCharacteristicId` 未配置时，通知订阅会被静默跳过**（`enableCharacteristicNotification` 直接 return，不报错）。让 `hasResponse: true` 生效的前提是 `config.notifyCharacteristicId` 正确，或每次显式传 `responseConfig.characteristicId`。
7. **回包匹配规则**：按 `deviceId` + 特征值 ID 匹配，且取**第一个**满足条件的待处理请求。同一特征值上并发多个 `hasResponse: true` 的写入会互相错配 —— 协议层务必串行发送或加节流（示例用 `throttleTrailing(fn, 100)`）。
8. **`stopDeviceDiscovery()` 会清空 `foundDevList`**。停止搜索前先把列表拷到自己页面：`this.setData({ list: ble.foundDevList })`。
9. **`addDeviceFoundListener` 回调参数是本批次新发现的设备数组**，不是全量列表；要全量请读 `ble.foundDevList`。
10. **`getDeviceRSSI()` 返回的是 `DeviceRSSIResult` 对象（即 `{ RSSI, errMsg }`），不是裸 number**。必须按 `(await ble.getDeviceRSSI()).RSSI` 取值，直接当数字用会得到 `NaN` 或 `undefined`。
11. **`updateDeviceFilterOptions` 是合并语义**：只覆盖传入的键。传 `{ includeKeys: [] }` 表示「白名单为空」→ 放行所有设备。
12. **开发者工具里一切正常不代表真机正常**：`devtools` 环境下所有 wx BLE API 被跳过并返回模拟值（`readCharacteristicValue` → `[0]`、`getDeviceServices` → `[]`、`validateCharacteristics` → `{success:true}`）。**必须在真机验证**。
13. **单设备模式切换设备会自动断开旧设备**，`disconnectDevice()` 无需参数；多设备模式每个方法都要 `deviceId`。
14. **`release()` 后可以再次 `init()`**：所有标志位已重置、设备列表已清空，适合「退出到首页/切换账号」这类彻底停止场景。

---

## 7. 常见错误码及处理建议（速查）

判断时 **`errno` 与 `errCode` 都要看**（iOS 与安卓填充字段不同）。

| 码 | 含义 | 处理建议 |
| --- | --- | --- |
| `103` | 蓝牙权限未授权 | 引导用户在小程序设置页开启蓝牙权限；`wx.openSetting` |
| `10000` | 未初始化蓝牙适配器 | 先 `await ble.init()` / `openAdapter()` |
| `10001` | 蓝牙适配器不可用 | 提示用户打开手机蓝牙；`errno === 1500102` 同样归此类 |
| `10002` | 没有找到指定设备 | 重新搜索；检查 `includeKeys` 白名单是否写错 |
| `10003` | 连接失败 | 重试；确认设备未被其他手机占用、距离足够近 |
| `10004` / `10005` | 服务/特征值不存在 | 用 `getDeviceServices()` 打印真实 UUID，修正 `config` |
| `10006` | 当前连接已断开 | 走重连；检查 `reconnect: true` 是否开启 |
| `10007` | 特征值不支持该操作 | 服务/特征值写反了（读写特征值互换），或该特征值不支持 write |
| `10008` | 系统上报错误 | 一般为设备侧异常，重试一次 |
| `10012` | 操作超时 | 加大 `connectTimeout`；`hasResponse` 超时则加大 `timeoutMs` |
| `10013` | deviceId 为空或格式不正确 | 检查是否传了 `Device` 对象而非 `deviceId` 字符串 |
| `10015`~`10018` | 写入/读取/订阅参数错误 | 多为数据长度超限（默认 ATT 20 字节，需分包）或 UUID 缺失 |
| `1509008` + `errCode === -1` | 搜索失败，常见于定位权限未授予 | 弹窗提示用户检查微信定位权限与小程序定位权限（搜索 BLE 设备在安卓侧依赖定位权限） |

库自身抛出的原生 `Error` 也有稳定特征：`message` 含「超时」（读写响应超时）、「未连接任何设备」（单设备模式空操作）、「必须提供设备ID」（多设备模式漏参）、「未知的配置项 / 类型无效」（`updateBLEHandlerConfig` 传错键）。

完整的错误码表、判定顺序与统一兜底封装见 `references/error-handling.md`。

---

## 8. 参考示例代码

最小可用骨架（完整可运行版本见 `references/examples.md`）：

```javascript
// app.js —— 全局单例
import { SingleDeviceBLEHandler } from 'easy-miniprogram-bluetooth';

App({
  globalData: { BLEHandler: null },

  async ensureBLEReady() {
    if (!this.globalData.BLEHandler) {
      this.globalData.BLEHandler = new SingleDeviceBLEHandler({
        mode: 'single',
        reconnect: true,
        connectTimeout: 1000,
        maxRetries: 90,
        reconnectDelay: 2000,
        searchOption: {
          includeKeys: ['Li-RGB', 'Li-HC', 'Li-LT'], // 白名单：设备名/localName 包含任一即可
          allowDuplicatesKey: true,
          interval: 1000,
        },
        config: {
          serviceUId: 'FFF0',
          readCharacteristicId: 'FFF1',
          writeCharacteristicId: 'FFF2',
          notifyCharacteristicId: 'FFF1',
          notifyType: 'indication', // 部分设备仅支持 indication
        },
      });
      await this.globalData.BLEHandler.init();
    }
    return this.globalData.BLEHandler;
  },
});
```

```javascript
// pages/searchBLE/searchBLE.js —— 页面层
Page({
  data: { foundDevList: [], connectedDev: null },

  async onLoad() {
    // 1) 权限
    const { authSetting } = await wx.getSetting();
    if (!authSetting['scope.bluetooth']) {
      try { await wx.authorize({ scope: 'scope.bluetooth' }); } catch (e) { /* 用户拒绝 */ }
    }

    // 2) 单例初始化（内部有守卫，重复调用安全）
    const ble = await getApp().ensureBLEReady();

    // 3) 注册监听并保存解绑函数
    this._offFound = ble.addDeviceFoundListener(() => {
      this.setData({ foundDevList: ble.foundDevList }); // 以全量列表为准
    });
    this._offConn = ble.addConnectionStateChangeListener((res) => {
      if (res.connected) this.setData({ connectedDev: ble.singleConnectedDevice });
    });

    // 4) 搜索并在 8 秒后停止
    await this.startSearch();
  },

  async startSearch() {
    const ble = getApp().globalData.BLEHandler;
    try {
      await ble.startDeviceDiscovery();
      setTimeout(async () => {
        try { await ble.stopDeviceDiscovery(); } catch (e) { /* ignore */ }
        if (ble.foundDevList.length === 0) wx.showToast({ title: '未找到设备', icon: 'none' });
      }, 8000);
    } catch (err) {
      if (err?.errCode === -1 && err?.errno === 1509008) {
        wx.showModal({ title: '请检查微信定位权限与小程序定位权限', showCancel: false });
      }
    }
  },

  async onConnect(e) {
    const ble = getApp().globalData.BLEHandler;
    wx.showLoading({ title: '正在连接', mask: true });
    try {
      await ble.connectDevice(e.currentTarget.dataset.device);
      await ble.stopDeviceDiscovery();
      wx.setStorageSync('saveTempDevice', ble.singleConnectedDevice); // 供下次自动重连
      wx.showToast({ title: '连接成功', icon: 'success' });
    } catch (err) {
      wx.showToast({ title: '连接失败', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  async onUnload() {
    const ble = getApp().globalData.BLEHandler;
    try { await ble.stopDeviceDiscovery(); } catch (e) { /* ignore */ }
    if (this._offFound) { this._offFound(); this._offFound = null; }
    if (this._offConn) { this._offConn(); this._offConn = null; }
  },
});
```

```javascript
// 协议层 —— 组帧后发送，可选等待回包
async function sendFrame(frame, hasResponse = false, timeoutMs = 1000) {
  const ble = getApp().globalData.BLEHandler;
  return ble.writeCharacteristicValue({
    value: frame.buffer,
    responseConfig: { hasResponse, timeoutMs },
  });
}

// 等待回包：返回对象中的 value 已是 number[]
const res = await sendFrame(frame, true, 200);
if (res?.value?.[0] !== 0x39) console.warn('设备返回异常状态码', res?.value?.[0]);
```

更多示例（自动重连、华为/鸿蒙兼容分支、心跳与节流、多设备并发、完整错误兜底）见 `references/examples.md`。

---

## 9. 交付前验证清单

- [ ] `app.js` 中只有一个 BLE 实例，页面不重复 `new`。
- [ ] `init()` 有守卫，不会被页面生命周期反复调用。
- [ ] 每个 `addXxxListener()` 的解绑函数都在 `onUnload` 里执行。
- [ ] 连接成功后已 `stopDeviceDiscovery()`。
- [ ] 所有 BLE 调用都在 `try/catch` 中，且对用户有可见反馈（toast/modal）。
- [ ] `config` 中的 `serviceUId` / `writeCharacteristicId` / `notifyCharacteristicId` 来自真机 `getDeviceServices()` 打印结果，不是猜的。
- [ ] `hasResponse: true` 的发送在同一特征值上串行或节流。
- [ ] 在**真机**（安卓 + iOS 各一台）上跑通搜索 → 连接 → 收发 → 断连重连。

---

## 10. 参考文件

| 文件 | 内容 |
| --- | --- |
| `references/api-reference.md` | 完整 API 清单：逐个方法的参数、返回值、异常、注意事项 |
| `references/error-handling.md` | 微信 BLE 错误码全表、判定顺序、统一兜底封装 |
| `references/examples.md` | 可直接复制的示例：app.js 单例、搜索页、协议封装、自动重连、多设备、心跳节流 |
