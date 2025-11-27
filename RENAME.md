# 迁移对照（旧名称 -> 新名称）

下面列出了库中所有已更改的 API 名称（旧名 -> 新名），以便外部用户快速迁移代码。所有条目均以模块/类为单位分组，按“旧名 -> 新名”格式列出。

> 注意：我们已在代码中移除了旧名（breaking change）。请在升级到此版本时把你的调用替换为新名。

---

## 全局（BLEHandler 外围 facade）
- `setBLEHandlerConfig` -> `updateBLEHandlerConfig`
- `checkBLEAdapter` -> `getAdapterStatus`
- `openBLEAdapter` -> `openAdapter`
- `closeBLEAdapter` -> `closeAdapter`
- `startSearchBLE` -> `startDeviceDiscovery`
- `onBluetoothFound` -> `onDeviceFound`
- `stopSearchBLE` -> `stopDeviceDiscovery`
- `connectBLE` -> `connectDevice`
- `onBLEConnectionStateChange` -> `onConnectionStateChange`
- `disconnectBLE` -> `disconnectDevice`
- `getBLEDeviceRSSI` -> `getDeviceRSSI`
- `getBLEServices` -> `getDeviceServices`
- `checkCharacteristics` -> `validateCharacteristics`
- `notifyBLECharacteristicValueChange` -> `enableCharacteristicNotification`
- `addCharacteristicValueChangeCallback` -> `addCharacteristicValueChangeListener`
- `delCharacteristicValueChangeCallback` -> `removeCharacteristicValueChangeListener`
- `delAllCharacteristicValueChangeCallback` -> `removeAllCharacteristicValueChangeListeners`
- `writeCharacteristic` -> `writeCharacteristicValue`
- `readCharacteristic` -> `readCharacteristicValue`

---

## 模块：ServiceManager
- `getBLEServices` -> `getDeviceServices`
- `checkCharacteristics` -> `validateCharacteristics`
- `notifyBLECharacteristicValueChange` -> `enableCharacteristicNotification`

（注意：类内部仍保留 `setBLEHandlerConfig` 实现供运行时配置合并；对外请使用 `BLEHandler.updateBLEHandlerConfig`）

---

## 模块：IOManager
- `addCharacteristicValueChangeCallback` -> `addCharacteristicValueChangeListener`
- `delCharacteristicValueChangeCallback` -> `removeCharacteristicValueChangeListener`
- `delAllCharacteristicValueChangeCallback` -> `removeAllCharacteristicValueChangeListeners`
- `writeCharacteristic` -> `writeCharacteristicValue`
- `readCharacteristic` -> `readCharacteristicValue`

事件 API 风格说明：我们统一采用 `add...Listener` / `remove...Listener` / `removeAll...Listeners` 风格，并且 `add...` 返回一个解绑函数。

---

## 模块：DiscoveryManager
- `startSearchBLE` -> `startDeviceDiscovery`
- `onBluetoothFound` -> `onDeviceFound`
- `stopSearchBLE` -> `stopDeviceDiscovery`

---

## 模块：ConnectionManager
- `connectedDevList` -> `connectedDevices`
- `historyConnectedDevList` -> `historyConnectedDevices`
- `reconnectedDevList` -> `reconnectingDevices`
- `connectedSingleDev` -> `singleConnectedDevice`
- `getReconnectGeneration` -> `getReconnectGenerationForDevice`
- `cancelReconnect` -> `cancelReconnectForDevice`
- `cancelAllReconnectsExcept` -> `cancelReconnectsExcept`
- `connectBLE` -> `connectDevice`
- `handleDeviceReconnect` -> `attemptReconnect`
- `onBLEConnectionStateChange` -> `onConnectionStateChange`
- `disconnectBLE` -> `disconnectDevice`

---

## 模块：AdapterManager
- `checkBLEAdapter` -> `getAdapterStatus`
- `openBLEAdapter` -> `openAdapter`
- `closeBLEAdapter` -> `closeAdapter`
- `getBLEDeviceRSSI` -> `getDeviceRSSI`

---

## 低层平台包装（注意）
库内部对微信小程序原生 API 的包装 `BluetoothManager` 仍保留部分以 `BLE` 为前缀的函数名（例如 `getBLEDeviceRSSI`、`notifyBLECharacteristicValueChange` 等），因为这些仍直接对应平台 API。如果你直接依赖 `BluetoothManager`，请检查该模块的导出并适配相应名称。

---

## 迁移示例（简单替换）
旧用法（示例）：

```ts
await bleHandler.startSearchBLE();
bleHandler.onBluetoothFound((devices) => { ... });
await bleHandler.connectBLE(dev);
bleHandler.addCharacteristicValueChangeCallback(cb);
```

新版对等写法：

```ts
await bleHandler.startDeviceDiscovery();
bleHandler.onDeviceFound((devices) => { ... });
await bleHandler.connectDevice(dev);
const unsubscribe = bleHandler.addCharacteristicValueChangeListener(cb);
unsubscribe(); // 取消订阅
```

---

如果你希望我同时自动替换仓库中剩余的示例和文档（README、EXAMPLES 等）以反映这些新名，我可以继续替换并运行一次类型检查/构建验证。你要我继续吗？

