# 错误码与异常处理

> 库从 0.3.0 起**不定义自定义异常类**：catch 到的 `err` 要么是微信原生错误对象（含 `errMsg` / `errno` / `errCode`），要么是原生 `Error`。判断类型请读字段，**不要用 `instanceof`**。

## 1. 两类异常

| 来源 | 形态 | 特征字段 |
| --- | --- | --- |
| 微信原生 API 失败 | 原样透传的微信错误对象 | `errMsg`、`errno`、`errCode` |
| 参数校验 / 配置校验 | `Error` | `message` 为中文描述，如 `多设备模式下必须提供设备ID` |
| 读写等待回包超时 | `Error` | `message` 含「超时」，如 `写入响应超时 - 请求ID: req_2, 设备: xxx, 特征值: xxx` |

库自身抛出且可稳定匹配的中文消息：

| 消息片段 | 触发点 |
| --- | --- |
| `超时` | `writeCharacteristicValue` / `readCharacteristicValue` 等回包超时 |
| `单设备模式下未连接任何设备` | 单设备模式在未连接时调用 `disconnectDevice` / `getDeviceRSSI` / `getDeviceServices` / `enableCharacteristicNotification` / 读写 |
| `多设备模式下必须提供设备ID` | 多设备模式漏传 `deviceId` |
| `必须提供设备ID` | `ConnectionManager.disconnectDevice("")` / `enableCharacteristicNotification("")` |
| `未知的配置项` / `配置项 xxx 类型无效` / `配置对象无效` | `updateBLEHandlerConfig` 入参非法 |
| `请检查是否已授权小程序蓝牙权限` | `getAdapterStatus` 捕获 `103` 后重新包装 |
| `请检查蓝牙是否开启` | `getAdapterStatus` 捕获 `1500102` / `10001` 后重新包装 |

## 2. 微信 BLE 常见错误码

判定时必须 **`errno` 与 `errCode` 同时看** —— 安卓与 iOS 填充的字段不一致，官方部分文档只给了一个字段。推荐写法：`const code = err?.errno ?? err?.errCode;`

| 码 | 含义 | 典型触发 | 处理建议 |
| --- | --- | --- | --- |
| `0` | 正常 | — | — |
| `103` | 未授权蓝牙权限 | `openBluetoothAdapter` / `getBluetoothAdapterState` / `createBLEConnection` | 引导用户在「小程序右上角 → 设置」中开启蓝牙权限（`wx.openSetting`）；首次可先 `wx.authorize({ scope: 'scope.bluetooth' })` |
| `10000` | 未初始化蓝牙适配器 | 未 `init()` 就搜索/连接 | 保证先 `await ble.init()` |
| `10001` | 当前蓝牙适配器不可用 | 手机蓝牙关闭 | 提示用户开启手机蓝牙；与 `errno === 1500102` 同源 |
| `10002` | 没有找到指定设备 | `createBLEConnection` 传了错误 deviceId | 重新搜索取最新 `deviceId`（iOS 的 deviceId 是 UUID，重启会变，不可持久化复用） |
| `10003` | 连接失败 | 设备已被其他手机占用、信号弱、设备未广播 | 重试 1~2 次；确认设备可被连接（`connectable === true`） |
| `10004` | 没有找到指定服务 | `config.serviceUId` 写错 | 用 `getDeviceServices()` 打印真实 UUID 后回填 |
| `10005` | 没有找到指定特征值 | 读写特征值 UUID 写错 | 对照 `getDeviceServices()` + 设备协议文档修正 |
| `10006` | 当前连接已断开 | 连接被设备/系统断开 | 依赖 `reconnect: true` 自动重连；或提示用户重新连接 |
| `10007` | 当前特征值不支持此操作 | 读写特征值写反、用 `notification` 订阅了只支持 `indication` 的特征值 | 检查 `config.notifyType`（本项目实测部分灯具仅支持 `indication`） |
| `10008` | 系统上报错误 | 底层蓝牙栈异常 | 重试一次；连续失败则关闭再打开适配器 |
| `10009` | 安卓系统版本过低（< 4.3）不支持 BLE | 老旧机型 | 提示用户更换设备 |
| `10012` | 连接超时 | `connectTimeout` 太小 / 信号弱 | 加大 `connectTimeout`（本项目灯具用 1000ms，一般设备建议 5000~10000ms） |
| `10013` | `deviceId` 为空或格式不正确 | 传了对象 / 空字符串 / 已被系统回收的 id | 传 `Device` 对象或有效 `deviceId` 字符串；重新搜索 |
| `10015` | 写入数据长度超出范围 | 单包超过 ATT 限制（默认 20 字节） | 业务层按 MTU 分包发送；本项目用协议帧 + 100ms 节流 |
| `10016` / `10017` / `10018` | `notify` / `write` / `read` 参数错误 | UUID 缺失、`value` 不是 `ArrayBuffer` | 校验 `value` 类型与 `config` 完整性 |
| `1509008` + `errCode === -1` | BLE 搜索失败（常见于定位权限未授予） | `startBluetoothDevicesDiscovery` | 弹窗提示用户检查「微信定位权限」与「小程序定位权限」；安卓搜索 BLE 依赖定位权限 |

> `1509008` 这一组合来自本项目 `pages/searchBLE/searchBLE.js` 的实测兜底分支；不同安卓 ROM 可能返回其他 errno，因此搜索失败建议统一走「弹窗提示检查定位权限 + 蓝牙开关」的兜底文案，而不是精确匹配单一码。
> `10016`~`10018` 的具体数值随基础库版本略有差异，按「参数/UUID 校验」这一类处理即可。

## 3. 推荐判定顺序

```
1. err?.errno ?? err?.errCode
   ├─ 103                      → 权限问题，引导开权限
   ├─ 10001 / 1500102          → 蓝牙未开
   ├─ 10002 / 10013            → deviceId 失效，重新搜索
   ├─ 10012                    → 超时，放大超时参数后重试
   └─ 其它                     → 进入第 2 步
2. err?.message?.includes('超时')  → 设备未回包：检查 notifyCharacteristicId / 加大 timeoutMs / 确认已订阅通知
3. err?.message 含「必须提供设备ID」→ 调用方漏参（多设备模式）
4. 兜底：err?.errMsg || err?.message || String(err)
```

## 4. 统一兜底封装（可直接复用）

```javascript
// utils/bleError.js
export function describeBLEError(err) {
  const code = err?.errno ?? err?.errCode;
  const msg = err?.errMsg || err?.message || String(err || '');

  if (code === 103) return { tip: '请在设置中开启小程序蓝牙权限', action: 'openSetting' };
  if (code === 10001 || code === 1500102) return { tip: '请打开手机蓝牙后重试', action: 'retry' };
  if (code === 10002 || code === 10013) return { tip: '设备已失效，请重新搜索', action: 'research' };
  if (code === 10004 || code === 10005) return { tip: '服务或特征值不匹配，请检查设备配置', action: 'none' };
  if (code === 10007) return { tip: '特征值不支持该操作，请检查通知类型', action: 'none' };
  if (code === 10006) return { tip: '连接已断开，正在尝试重连', action: 'reconnect' };
  if (code === 10012 || /超时/.test(msg)) return { tip: '操作超时，请靠近设备后重试', action: 'retry' };
  if (/必须提供设备ID/.test(msg)) return { tip: '内部调用缺少设备ID', action: 'none' };
  if (code === -1 && err?.errno === 1509008) return { tip: '请检查微信定位权限与小程序定位权限', action: 'modal' };

  return { tip: '蓝牙操作失败，请重试', action: 'retry' };
}

export function handleBLEError(err, fallbackTitle = '操作失败') {
  const { tip, action } = describeBLEError(err);
  console.error('[BLE]', fallbackTitle, { code: err?.errno ?? err?.errCode, msg: err?.errMsg || err?.message });

  if (action === 'openSetting') {
    wx.showModal({
      title: tip,
      showCancel: false,
      success: () => wx.openSetting(),
    });
    return { tip, action };
  }

  wx.showToast({ title: tip, icon: 'none', duration: 2000 });
  return { tip, action };
}
```

页面里使用：

```javascript
try {
  await ble.connectDevice(device);
} catch (err) {
  handleBLEError(err, '连接设备失败');
}
```

## 5. 权限与前置检查

```javascript
// 页面 onLoad：蓝牙授权（首次会弹系统授权框）
const { authSetting } = await wx.getSetting();
if (!authSetting['scope.bluetooth']) {
  try {
    await wx.authorize({ scope: 'scope.bluetooth' });
  } catch (e) {
    // 用户拒绝：后续调用会拿到 103，走 openSetting 引导
  }
}
```

补充要点：

- **安卓搜索 BLE 设备需要定位权限**：`scope.userLocation`。若业务必须搜索，需要在 `app.json` 声明并在运行时申请：

  ```json
  {
    "permission": {
      "scope.userLocation": { "desc": "用于搜索附近的蓝牙设备" }
    }
  }
  ```

- **iOS 的 `deviceId` 不是硬件 MAC**（是系统分配的 UUID），同一设备在不同手机/重启后可能变化，**不要持久化后长期复用**做自动重连的唯一依据。
- `errCode === -1` 通常表示底层返回了非标准码，此时真实信息在 `errno` 里 —— 不要看到 `-1` 就当成成功。

## 6. 常见"没报错但不好用"的坑

| 现象 | 根因 | 处理 |
| --- | --- | --- |
| 连接成功但收不到任何数据 | `notifyCharacteristicId` 未配置 → 订阅被静默跳过 | 补全 `config` 或调用 `enableCharacteristicNotification(deviceId, serviceId, characteristicId)` |
| 连接成功但发送报错 | `writeCharacteristicId` 写错 | `getDeviceServices()` 后 `updateBLEHandlerConfig` 回填 |
| `hasResponse: true` 一律超时 | 回包特征值与 `config.notifyCharacteristicId` 不一致 | 显式传 `responseConfig.characteristicId` |
| 回包内容串了 | 同一特征值上并发多个 `hasResponse` 写入 | 串行发送或节流（如 `throttleTrailing(fn, 100)`） |
| 发送报 10015 | 单包超过 20 字节 | 协议层分包 |
| 停止搜索后设备列表空了 | `stopDeviceDiscovery()` 会清空 `foundDevList` | 停止前先拷贝到页面 data |
| 开发者工具一切正常，真机失败 | devtools 下所有 BLE API 被跳过并返回模拟值 | 必须真机验证 |
