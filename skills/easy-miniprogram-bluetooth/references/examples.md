# 参考示例代码

所有示例均使用**当前 API**，可直接复制到小程序项目中按需删减。

## 目录

- [1. app.js：全局单例](#1-appjs全局单例)
- [2. 搜索页：完整页面（推荐骨架）](#2-搜索页完整页面推荐骨架)
- [3. 自动重连（含华为/鸿蒙兼容分支）](#3-自动重连含华为鸿蒙兼容分支)
- [4. 协议层：组帧发送 + 等待回包 + 心跳 + 节流](#4-协议层组帧发送--等待回包--心跳--节流)
- [5. 读取特征值](#5-读取特征值)
- [6. 多设备模式](#6-多设备模式)
- [7. 服务与特征值校验](#7-服务与特征值校验)
- [8. 页面卸载与资源释放](#8-页面卸载与资源释放)
- [9. onLoad 初始化重试（适配器未就绪）](#9-onload-初始化重试适配器未就绪)

---

## 1. app.js：全局单例

> 复制前先确认依赖已安装（`npm install easy-miniprogram-bluetooth@^0.4.1`，必须落在 `dependencies`），并已提示用户在微信开发者工具中执行「工具 → 构建 npm」。详见 `../SKILL.md` §2。

要点：实例只建一次、`init()` 只调一次、业务只从 `getApp().globalData.BLEHandler` 拿实例。

```javascript
// app.js
import { SingleDeviceBLEHandler, setDebugEnabled } from 'easy-miniprogram-bluetooth';

setDebugEnabled(false); // 调试期改 true

App({
  globalData: {
    BLEHandler: null,
    Lighting: null,
  },

  async ensureBLEReady() {
    if (this.globalData.BLEHandler) {
      return this.globalData.BLEHandler;
    }

    this.globalData.BLEHandler = new SingleDeviceBLEHandler({
      mode: 'single',            // 仅文档用途；实际模式由类决定
      reconnect: true,
      connectTimeout: 1000,      // 灯具响应快，可设小
      maxRetries: 90,
      reconnectDelay: 2000,      // 实际重连间隔 = connectTimeout + reconnectDelay = 3000ms
      searchOption: {
        includeKeys: ['Li-RGB', 'Li-HC', 'Li-LT'], // 白名单
        // excludeKeys: ['Test', 'Debug'],
        allowDuplicatesKey: true,
        interval: 1000,
      },
      config: {
        serviceUId: 'FFF0',                 // 短 UUID 会自动补全
        readCharacteristicId: 'FFF1',
        writeCharacteristicId: 'FFF2',
        notifyCharacteristicId: 'FFF1',
        notifyType: 'indication',           // 仅支持 indicate 的设备必须显式指定
      },
    });

    await this.globalData.BLEHandler.init();
    return this.globalData.BLEHandler;
  },

  async releaseBLE() {
    const ble = this.globalData.BLEHandler;
    if (!ble) return;
    try {
      await ble.release();
    } catch (err) {
      console.error('[BLE] release 失败', err);
    } finally {
      this.globalData.BLEHandler = null; // 置空后才能再次 ensureBLEReady()
    }
  },
});
```

---

## 2. 搜索页：完整页面（推荐骨架）

要点：权限 → 初始化 → 注册监听 → 搜索（带超时停止）→ 连接 → 保存设备 → 卸载时解绑。

```javascript
// pages/searchBLE/searchBLE.js
import { handleBLEError } from '../../utils/bleError';

Page({
  data: {
    foundDevList: [],
    connectedDev: null,
  },

  async onLoad() {
    // 1) 权限
    const { authSetting } = await wx.getSetting();
    if (!authSetting['scope.bluetooth']) {
      try {
        await wx.authorize({ scope: 'scope.bluetooth' });
      } catch (e) {
        // 用户拒绝：后续操作会拿到 103，由 handleBLEError 引导到 openSetting
      }
    }

    // 2) 初始化单例（内部有守卫）
    wx.showLoading({ title: '正在初始化蓝牙', mask: true });
    let ble;
    try {
      ble = await getApp().ensureBLEReady();
    } catch (err) {
      wx.hideLoading();
      handleBLEError(err, '初始化蓝牙失败');
      wx.showModal({ title: '请检查是否已开启手机蓝牙并已授予小程序蓝牙权限', showCancel: false });
      return;
    }
    wx.hideLoading();

    // 3) 已有连接：直接同步状态，不回搜索
    if (ble.singleConnectedDevice) {
      this.setData({ connectedDev: ble.singleConnectedDevice });
      return;
    }

    // 4) 注册监听并保存解绑函数
    this._offFound = ble.addDeviceFoundListener((devices) => {
      // 回调参数是本批次新发现设备；UI 以全量列表为准
      wx.hideLoading();
      this.setData({
        foundDevList: ble.foundDevList.filter(
          (item) => item.deviceId !== ble.singleConnectedDevice?.deviceId,
        ),
      });
    });

    this._offConn = ble.addConnectionStateChangeListener((res) => {
      if (res.connected) {
        this.setData({ connectedDev: ble.singleConnectedDevice });
      } else {
        this.setData({ connectedDev: null });
      }
    });

    // 5) 搜索
    await this.startSearch();
  },

  async startSearch() {
    const ble = getApp().globalData.BLEHandler;
    if (!ble) return;

    this.setData({ foundDevList: [] });
    try {
      await ble.startDeviceDiscovery();
      wx.showLoading({ title: '正在搜索设备', mask: true });

      // 8 秒后自动停止搜索
      this._searchTimer = setTimeout(async () => {
        // 先拷贝列表，因为 stopDeviceDiscovery() 会清空 foundDevList
        const list = ble.foundDevList;
        try {
          await ble.stopDeviceDiscovery();
        } catch (e) {
          /* ignore */
        }
        wx.hideLoading();
        this.setData({ foundDevList: list });
        if (list.length === 0) {
          wx.showToast({ title: '未找到设备，请点击重试', icon: 'none' });
        }
      }, 8000);
    } catch (err) {
      wx.hideLoading();
      // 搜索失败的兜底：定位权限 / 蓝牙开关
      const code = err?.errno ?? err?.errCode;
      if (code === -1 || err?.errno === 1509008 || code === 10001) {
        wx.showModal({ title: '请检查微信定位权限、小程序定位权限与手机蓝牙开关', showCancel: false });
        return;
      }
      handleBLEError(err, '搜索设备失败');
    }
  },

  async onConnect(e) {
    const device = e.currentTarget.dataset.device;
    const ble = getApp().globalData.BLEHandler;
    if (!ble) return;

    wx.showLoading({ title: '正在连接设备', mask: true });
    try {
      await ble.connectDevice(device);

      // 连接成功后立刻停止搜索，避免扫描干扰连接
      try {
        await ble.stopDeviceDiscovery();
      } catch (err2) {
        /* ignore */
      }
      if (this._searchTimer) {
        clearTimeout(this._searchTimer);
        this._searchTimer = null;
      }

      // 保存最后一次成功连接的设备，供下次自动重连
      wx.setStorageSync('saveTempDevice', ble.singleConnectedDevice);

      wx.hideLoading();
      wx.showToast({ title: '连接成功', icon: 'success' });
      this.setData({ connectedDev: ble.singleConnectedDevice });
    } catch (err) {
      wx.hideLoading();
      handleBLEError(err, '连接设备失败');
    }
  },

  async onDisconnect() {
    const ble = getApp().globalData.BLEHandler;
    if (!ble) return;
    try {
      await ble.disconnectDevice();          // 单设备模式无需传参
      this.setData({ connectedDev: null, foundDevList: [] });
      wx.showToast({ title: '已断开连接', icon: 'none' });
    } catch (err) {
      handleBLEError(err, '断开连接失败');
    }
  },

  async onHide() {
    // 页面不可见时停止扫描，省电
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    const ble = getApp().globalData.BLEHandler;
    if (!ble) return;
    try {
      await ble.stopDeviceDiscovery();
    } catch (e) {
      /* ignore */
    }
  },

  onUnload() {
    // 解绑监听，防止页面销毁后回调仍持有 this
    if (this._offFound) {
      this._offFound();
      this._offFound = null;
    }
    if (this._offConn) {
      this._offConn();
      this._offConn = null;
    }
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
  },
});
```

---

## 3. 自动重连（含华为/鸿蒙兼容分支）

`reconnect: true` 已处理「运行期间异常断开」，这里处理**冷启动时恢复上次设备**。华为/鸿蒙机型后台留存过久后直接 `createBLEConnection` 常失败，需先扫描再连。

```javascript
// pages/searchBLE/searchBLE.js（片段）

/** 判断是否为华为/鸿蒙机型（后台留存久后直连易失败） */
function isHarmonyLike() {
  const info = wx.getDeviceInfo();
  return (
    info.brand === 'HUAWEI' ||
    info.brand === 'huawei' ||
    info.platform === 'ohos' ||
    (typeof info.system === 'string' && info.system.includes('Harmony'))
  );
}

async function autoReconnect() {
  const ble = getApp().globalData.BLEHandler;
  const saveTempDevice = wx.getStorageSync('saveTempDevice');
  if (!ble || !saveTempDevice) return false;

  wx.showLoading({ title: '正在自动连接设备' });
  try {
    if (isHarmonyLike()) {
      // 华为/鸿蒙：先扫描，发现同名设备后再连
      let found = null;
      const offFound = ble.addDeviceFoundListener(() => {
        found = ble.foundDevList.find((d) => d.name === saveTempDevice.name);
      });
      await ble.startDeviceDiscovery();
      await new Promise((resolve) => setTimeout(resolve, 3500));
      if (offFound) offFound();
      try {
        await ble.stopDeviceDiscovery();
      } catch (e) {
        /* ignore */
      }
      if (!found) throw new Error('未扫描到已保存的设备');
      await ble.connectDevice(found);
    } else {
      // 普通机型：直接按 deviceId 连接
      await ble.connectDevice(saveTempDevice.deviceId);
    }

    wx.hideLoading();
    wx.showToast({ title: '自动连接成功', icon: 'success' });
    return true;
  } catch (err) {
    wx.hideLoading();
    console.warn('[BLE] 自动连接失败', err);
    return false;
  }
}

// 页面 onLoad 中：
// if (await autoReconnect()) { 跳转到业务页 } else { await this.startSearch(); }
```

> 注意：`saveTempDevice` 里的 `deviceId` 在 iOS 上可能变化，作为「优先尝试」而不是唯一依据；失败时回落到搜索是必须的。

---

## 4. 协议层：组帧发送 + 等待回包 + 心跳 + 节流

要点：**只依赖 `writeCharacteristicValue` / `readCharacteristicValue`**，不碰 UI；同一特征值上的发送必须串行或节流，否则 `hasResponse` 回包会错配。

```javascript
// models/sendFrame.js
const HEARTBEAT_INTERVAL = 120000; // 120s

function ble() {
  return getApp().globalData.BLEHandler;
}

/** 每个协议对象挂一份心跳定时器，避免全局变量污染 */
function refreshHeartbeat(onTimeout) {
  const app = getApp();
  if (app.globalData._sendHeartTimer) {
    clearTimeout(app.globalData._sendHeartTimer);
  }
  app.globalData._sendHeartTimer = setTimeout(onTimeout, HEARTBEAT_INTERVAL);
}

/**
 * 发送数据帧
 * @param {Uint8Array} frame 已组好的帧
 * @param {boolean} hasResponse 是否等待设备回包
 * @param {number} timeoutMs 回包超时
 * @param {Function} onHeartbeatTimeout 心跳超时回调（重发心跳）
 */
async function sendFrame(frame, { hasResponse = false, timeoutMs = 1000, onHeartbeatTimeout } = {}) {
  if (onHeartbeatTimeout) refreshHeartbeat(onHeartbeatTimeout);

  const options = {
    value: frame.buffer,
    responseConfig: { hasResponse, timeoutMs },
  };

  try {
    return await ble().writeCharacteristicValue(options);
  } catch (err) {
    console.error('[BLE] writeCharacteristicValue 失败', err);
    throw err;
  }
}

/** 尾缘节流：连续调用只有最后一次真正执行 */
function throttleTrailing(fn, wait = 100) {
  let timer = null;
  return function throttled(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
}

export { sendFrame, throttleTrailing, refreshHeartbeat };
```

带状态码校验的问答式发送：

```javascript
/**
 * 发送并校验设备返回的首字节状态码
 * 返回值：hasResponse 为真时 resolve 出 { deviceId, serviceId, characteristicId, value: number[] }
 */
async function sendAndCheck(frame, rightCodes = [0x39], timeoutMs = 200) {
  const res = await sendFrame(frame, { hasResponse: true, timeoutMs });
  const code = res?.value?.[0];
  if (!rightCodes.includes(code)) {
    console.warn('[BLE] 设备返回异常状态码', code, '期望', rightCodes);
    return false;
  }
  return true;
}
```

节流后的发送入口：

```javascript
// 协议基类里
class BaseProtocol {
  constructor() {
    // 100ms 尾缘节流，避免快速连续下发把回包错配
    this.send = throttleTrailing((frame, opts) => sendFrame(frame, opts), 100);
  }
  buildFrame(cmd, payload) { /* 组帧逻辑 */ }
}
```

---

## 5. 读取特征值

```javascript
async function readOnce(timeoutMs = 2000) {
  const ble = getApp().globalData.BLEHandler;
  try {
    const bytes = await ble.readCharacteristicValue({ timeoutMs }); // number[]
    console.log('[BLE] 读取到', bytes);
    return bytes;
  } catch (err) {
    if (/超时/.test(err?.message || '')) {
      console.warn('[BLE] 读取超时：确认该特征值已订阅通知（notifyCharacteristicId 配置正确）');
    }
    throw err;
  }
}

// 需要 ArrayBuffer 时：
const buffer = new Uint8Array(await readOnce()).buffer;
```

> 读取到的数据同样是通过 `onBLECharacteristicValueChange` 事件送达的，因此**该特征值必须已开启通知订阅**，否则一定会超时。

---

## 6. 多设备模式

要点：所有方法都带 `deviceId`，`writeCharacteristicValue` / `readCharacteristicValue` 的 `options.deviceId` 必填。

```javascript
// app.js
import { MultiDeviceBLEHandler } from 'easy-miniprogram-bluetooth';

const ble = new MultiDeviceBLEHandler({
  reconnect: true,
  maxRetries: 5,
  connectTimeout: 10000,
  reconnectDelay: 3000,
  searchOption: { includeKeys: ['MyDev'], allowDuplicatesKey: false, interval: 0 },
  config: { serviceUId: 'FFF0', writeCharacteristicId: 'FFF2', notifyCharacteristicId: 'FFF1' },
});
await ble.init();
await ble.startDeviceDiscovery();

// 连接多台
const [a, b] = ble.foundDevList;
if (a) await ble.connectDevice(a);
if (b) await ble.connectDevice(b);

// 分别下发
await ble.writeCharacteristicValue({
  deviceId: a.deviceId,
  value: new Uint8Array([0x01, 0x02]).buffer,
  responseConfig: { hasResponse: true, timeoutMs: 500 },
});

// 分别断开
await ble.disconnectDevice(a.deviceId);
```

按设备区分回包（多设备下必须按 deviceId 分流）：

```javascript
ble.addCharacteristicValueChangeListener((res) => {
  const bytes = Array.from(new Uint8Array(res.value));
  const map = {
    [deviceA.deviceId]: handleA,
    [deviceB.deviceId]: handleB,
  };
  (map[res.deviceId] || (() => {}))(bytes);
});
```

---

## 7. 服务与特征值校验

```javascript
const ble = getApp().globalData.BLEHandler;

// 1) 打印真实 UUID（首次对接设备时必做）
const services = await ble.getDeviceServices();          // 单设备无参
console.log('[BLE] services', JSON.stringify(services, null, 2));
for (const svc of services) {
  const chars = await ble.validateCharacteristics(ble.singleConnectedDevice.deviceId, svc.uuid);
  console.log('[BLE] service', svc.uuid, 'check =', chars);
}

// 2) 按照真实服务回填配置（会自动为已连接设备重订阅通知）
await ble.updateBLEHandlerConfig({ serviceUId: services[0].uuid });

// 3) 判定配置是否匹配
const check = await ble.validateCharacteristics(ble.singleConnectedDevice.deviceId);
if (!check.success) {
  // missingCharacteristics 元素为配置字段名，例如 ['writeCharacteristicId']
  console.warn('[BLE] 缺失特征值', check.missingCharacteristics);
}

// 4) 手动订阅（换特征值时用）
await ble.enableCharacteristicNotification();            // 单设备：全可选
await ble.enableCharacteristicNotification(deviceId, serviceId, characteristicId); // 多设备
```

> 注意：`connectDevice` 内部虽然调用了校验，但**不会因为校验失败而报错**。要求严格时必须像上面第 3 步这样主动检查一次。

---

## 8. 页面卸载与资源释放

```javascript
// 只在「确定要彻底停止蓝牙」时调用 release（例如退出到登录页、切换账号）
async function fullShutdown() {
  await getApp().releaseBLE(); // 内部：release() + 置空 globalData.BLEHandler
}

// 普通页面退出：只解绑监听 + 停止扫描，不要 release
onUnload() {
  const ble = getApp().globalData.BLEHandler;
  if (ble) ble.stopDeviceDiscovery().catch(() => {});
  if (this._offFound) this._offFound();
  if (this._offConn) this._offConn();
  if (this._offValue) this._offValue();
}
```

| 场景 | 该做什么 |
| --- | --- |
| 页面跳转 / 返回 | 停止扫描 + 解绑本页监听 |
| 长期后台 | 按产品策略决定是否 `release()`（会断开设备） |
| 退出登录 / 切换账号 | `release()` 并置空单例 |
| 需要重新开始 | `release()` 之后再次 `ensureBLEReady()`（`init()` 可重复调用） |

---

## 9. onLoad 初始化重试（适配器未就绪）

系统蓝牙刚开机时 `openBluetoothAdapter` 可能短暂失败，用定时重试兜住。

```javascript
async function initWithRetry(ble, { intervalMs = 5000, maxAttempts = 6 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await ble.init();
      return true;
    } catch (err) {
      console.warn(`[BLE] 第 ${attempt} 次初始化失败`, err);
      const code = err?.errno ?? err?.errCode;
      if (code === 103) throw err; // 权限问题重试无用，直接抛给上层引导授权
      if (attempt === maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return false;
}

// 页面中使用
// const ble = getApp().globalData.BLEHandler;
// await initWithRetry(ble);
```

---

## 相关文件

- 完整 API 与契约：`references/api-reference.md`
- 错误码与统一兜底：`references/error-handling.md`
- 主流程与常见坑速查：`../SKILL.md`
