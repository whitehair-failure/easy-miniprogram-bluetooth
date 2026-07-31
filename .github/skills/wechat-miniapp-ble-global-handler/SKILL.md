---
name: wechat-miniapp-ble-global-handler
description: 'Use when integrating miniprogram-bluetooth-utils in WeChat Mini Program with app.js global BLEHandler, cross-page reuse, industrial IoT BLE workflows, characteristic read/write orchestration, reconnection, and lifecycle-safe release.'
argument-hint: 'App-level BLE usage goal (single-device or multi-device) and your device protocol requirements'
user-invocable: true
disable-model-invocation: false
---

# WeChat Mini Program BLE Global Handler Workflow

## What This Skill Produces

This skill guides the agent to produce a complete and consistent BLE integration based on miniprogram-bluetooth-utils for WeChat Mini Program projects where BLE is tightly coupled with industrial IoT devices.

Expected output:
- A stable app-level BLE architecture (`app.js` global singleton)
- Page-level usage pattern (`getApp().globalData.BLEHandler`)
- Business-layer read/write wrappers (frame send, optional response, timeout)
- Reconnection and discovery strategy for real devices
- Lifecycle-safe initialization and resource release
- API names aligned with current library implementation (new API, not legacy aliases)

## Detailed Usage Blueprint

Use this exact architecture when applying the skill:

1. Create one BLE singleton in `app.js`
- Create once and store in `getApp().globalData.BLEHandler`.
- Never recreate in every page lifecycle hook.

2. Initialize once, then reuse cross-page
- Initialize in app startup or first BLE page entry with `await ble.init()`.
- In pages, always reuse `getApp().globalData.BLEHandler`.

3. Page responsibilities
- Page A (search/connect): discovery, connect, optional auto-reconnect trigger.
- Page B/C (business): protocol framing and write/read operations.
- App lifecycle: centralized release on boundary where BLE should fully stop.

4. Error handling model
- Current library throws exceptions.
- All BLE async calls must use `try/catch`; do not use tuple pattern `[err, res]`.

## When To Use

Use this skill when the project has these traits:
- WeChat Mini Program uses BLE to communicate with one or more physical devices
- BLE capabilities must be reused by multiple pages
- Project wants app-level singleton BLE state and cross-page access
- Business protocol code (frame encode/decode, heartbeat, encryption) needs direct access to BLE read/write operations
- Existing code may still use legacy method names and needs migration to the current API

Trigger keywords:
- app.js global BLEHandler
- miniprogram BLE singleton
- industrial IoT miniapp BLE
- connect/discovery/read/write/reconnect flow
- migrate legacy BLEHandler methods

## Method Name Reference (Current API)

This section is mandatory during migration and review.

### Base methods (both single and multi mode)

- `init()`
- `release()`
- `getAdapterStatus()`
- `openAdapter()`
- `closeAdapter()`
- `startDeviceDiscovery(searchOption?)`
- `stopDeviceDiscovery()`
- `addDeviceFoundListener(callback)`
- `addConnectionStateChangeListener(callback)`
- `addCharacteristicValueChangeListener(callback)`
- `removeCharacteristicValueChangeListener(callback)`
- `removeAllCharacteristicValueChangeListeners()`
- `updateDeviceFilterOptions(filterOptions)`
- `getDeviceFilterOptions()`
- `validateCharacteristics(deviceId, serviceId?)`
- `updateBLEHandlerConfig(cfg)`

Read-only getters:
- `foundDevList`
- `historyDevList`
- `connectedDevices`
- `historyConnectedDevices`
- `singleConnectedDevice`
- `config`

### Single-device methods

- `connectDevice(devOrDeviceId)`
- `disconnectDevice()`
- `getDeviceRSSI()`
- `getDeviceServices()`
- `enableCharacteristicNotification(deviceId?, serviceId?, characteristicId?)`
- `writeCharacteristicValue(options)`
- `readCharacteristicValue(options)`

### Multi-device methods

- `connectDevice(devOrDeviceId)`
- `disconnectDevice(deviceId)`
- `getDeviceRSSI(deviceId)`
- `getDeviceServices(deviceId)`
- `enableCharacteristicNotification(deviceId, serviceId?, characteristicId?)`
- `writeCharacteristicValue(options)` (requires `options.deviceId`)
- `readCharacteristicValue(options)` (requires `options.deviceId`)

## Legacy To Current Method Map

Always replace these names before adding new features:

- `checkBLEAdapter` -> `getAdapterStatus`
- `startSearchBLE` -> `startDeviceDiscovery`
- `stopSearchBLE` -> `stopDeviceDiscovery`
- `connectBLE` -> `connectDevice`
- `disconnectBLE` -> `disconnectDevice`
- `writeCharacteristic` -> `writeCharacteristicValue`
- `readCharacteristic` -> `readCharacteristicValue`
- `onBluetoothFound` -> `addDeviceFoundListener`
- tuple handling `[err, res]` -> `try/catch`

## Procedure

1. Confirm runtime mode and ownership model
- Decide `SingleDeviceBLEHandler` (or `BLEHandler` alias) vs `MultiDeviceBLEHandler`.
- If app mostly controls one active device at a time, use single mode.
- If app needs concurrent device operations, use multi mode and require `deviceId` in I/O calls.

2. Build app-level singleton in `app.js`
- Create BLE instance once and assign to `globalData.BLEHandler`.
- Use current constructor fields:
  - `searchOption` (required, includes `includeKeys` and `excludeKeys` for filtering)
  - `config` (`serviceUId`, `readCharacteristicId`, `writeCharacteristicId`, `notifyCharacteristicId`, `notifyType`)
  - `reconnect`, `connectTimeout`, `maxRetries`, `reconnectDelay`
- Initialize with `await ble.init()` once adapter is ready.

Recommended minimal skeleton:

```javascript
// app.js
import { BLEHandler } from './utils/dist/index';

App({
  globalData: {
    BLEHandler: null,
  },

  async ensureBLEReady() {
    if (!this.globalData.BLEHandler) {
      this.globalData.BLEHandler = new BLEHandler({
        searchOption: {
          allowDuplicatesKey: true,
          interval: 1000,
          includeKeys: ['Li-RGB', 'Li-HC', 'Li-LT'],
        },
        reconnect: true,
        connectTimeout: 10000,
        maxRetries: 5,
        reconnectDelay: 3000,
        config: {
          serviceUId: 'YOUR_SERVICE_UUID',
          readCharacteristicId: 'YOUR_READ_UUID',
          writeCharacteristicId: 'YOUR_WRITE_UUID',
          notifyCharacteristicId: 'YOUR_NOTIFY_UUID',
          notifyType: 'indication',
        },
      });
    }

    await this.globalData.BLEHandler.getAdapterStatus();
    await this.globalData.BLEHandler.init();
  },
});
```

3. Register discovery and state listeners through current APIs
- Discovery:
  - `addDeviceFoundListener(callback)`
  - `startDeviceDiscovery()` / `stopDeviceDiscovery()`
- Connection state:
  - `addConnectionStateChangeListener(callback)`
- Characteristic events:
  - `addCharacteristicValueChangeListener(callback)`
- Keep returned unsubscribe functions and clean up as needed.

Recommended page-side skeleton:

```javascript
// pages/searchBLE/searchBLE.js
Page({
  async onLoad() {
    const app = getApp();
    await app.ensureBLEReady();

    const ble = app.globalData.BLEHandler;

    this.offFound = ble.addDeviceFoundListener((devices) => {
      this.setData({ foundDevList: devices });
    });

    this.offConn = ble.addConnectionStateChangeListener((res) => {
      console.log('connection:', res.deviceId, res.connected);
    });

    await ble.startDeviceDiscovery();
  },

  async onUnload() {
    const ble = getApp().globalData.BLEHandler;
    await ble.stopDeviceDiscovery();
    if (this.offFound) this.offFound();
    if (this.offConn) this.offConn();
  },
});
```

4. Migrate legacy calls to current method names
- Replace legacy names if present:
  - `checkBLEAdapter` -> `getAdapterStatus`
  - `startSearchBLE` -> `startDeviceDiscovery`
  - `stopSearchBLE` -> `stopDeviceDiscovery`
  - `connectBLE` -> `connectDevice`
  - `disconnectBLE` -> `disconnectDevice`
  - `writeCharacteristic` -> `writeCharacteristicValue`
  - `readCharacteristic` -> `readCharacteristicValue`
  - `onBluetoothFound` -> `addDeviceFoundListener`
- Replace tuple error handling (`[err, res]`) with `try/catch` because current library throws exceptions.

5. Integrate protocol/business send wrappers
- Keep protocol framing in business layer.
- Construct write options in one place:
  - `value: frame.buffer`
  - `responseConfig` with `hasResponse` (as needed by protocol), `timeoutMs`, and optional `serviceId`/`characteristicId` for response matching
- Call `writeCharacteristicValue(options)` from wrappers.
- For read-on-demand flows, use `readCharacteristicValue({ timeoutMs, ... })`.

Recommended protocol wrapper:

```javascript
async function sendFrame(frame, hasResponse = false, timeoutMs = 1000) {
  const ble = getApp().globalData.BLEHandler;
  return ble.writeCharacteristicValue({
    value: frame.buffer,
    responseConfig: { hasResponse, timeoutMs },
  });
}

async function readFrame(timeoutMs = 1000) {
  const ble = getApp().globalData.BLEHandler;
  return ble.readCharacteristicValue({ timeoutMs });
}
```

6. Handle lifecycle and reliability
- On app/page visibility changes, avoid duplicate `init()` storms.
- On app shutdown/background policy boundary, call `await ble.release()`.
- For auto-reconnect/device restoration:
  - restore stored target device metadata
  - ensure discovery window and timeout fallback exist
  - stop discovery after connect success or timeout

  Lifecycle method suggestions:

  - App boundary release: `await getApp().globalData.BLEHandler?.release()`
  - Re-entry initialize: call your app-level `ensureBLEReady()` guard
  - Avoid repeated listener registration without unsubscribe

7. Add compatibility guards for vendor/device specifics
- Keep manufacturer-specific fallback logic (for example Huawei/Harmony discovery-connect behavior) in business app code, not in library internals.
- Ensure guard branches still call the same current API methods.

## Method-Level Usage Notes

- `getAdapterStatus()`:
  - Check adapter and permission readiness before `init()`.
  - Use in startup guard or retry loop.

- `init()`:
  - Opens adapter and installs internal global listeners.
  - Must be called before discovery/connect/read/write operations.

- `startDeviceDiscovery()` / `stopDeviceDiscovery()`:
  - Always pair start and stop to avoid endless scan drain.
  - For scan pages, stop in `onHide` or `onUnload`.

- `addDeviceFoundListener()`:
  - Preferred way to reactively update discovered list.
  - Save and call unsubscribe function when leaving page.

- `connectDevice()`:
  - Accepts `Device` object or `deviceId` string.
  - After success, service validation and notify subscription are handled by class flow.

- `disconnectDevice()`:
  - Single mode requires no args.
  - Multi mode requires explicit `deviceId`.

- `writeCharacteristicValue(options)`:
  - Use `responseConfig.hasResponse: true` for command ACK workflows.
  - Use `responseConfig.timeoutMs` per protocol requirement.
  - Use `responseConfig.serviceId` / `responseConfig.characteristicId` to specify which notify characteristic to match for responses (defaults to `config` values if omitted).

- `readCharacteristicValue(options)`:
  - Use for explicit read operations or protocol fallback reads.

- `release()`:
  - Disconnects devices, clears listeners, closes adapter.
  - Call when app really wants full BLE shutdown.

## Decision Points

- Single vs multi device:
  - Single: simpler page code, implicit active device context
  - Multi: explicit `deviceId` everywhere, better concurrency
- Write strategy:
  - `responseConfig.hasResponse: true` when protocol requires ACK validation
  - `responseConfig.hasResponse: false` for fire-and-forget heartbeat/control frames
- Discovery strategy:
  - Fixed short scan window for UI responsiveness
  - Longer scan window for noisy industrial BLE environments
- Reconnect strategy:
  - Conservative retries for battery-sensitive scenarios
  - Aggressive retries for always-on controller scenarios

## Validation Steps

1. Cold start:
- Open miniapp and ensure `init()` succeeds.
- Confirm no duplicate listener callbacks.

2. Discovery:
- Start scan and observe device list updates.
- Stop scan and confirm no further found callbacks.

3. Connect and I/O:
- Connect target device.
- Send one no-response frame and one response-required frame.
- Execute read flow if protocol requires.

4. Reconnect path:
- Simulate disconnect and verify reconnect policy behavior.

5. Lifecycle:
- Leave page/app and ensure release policy is respected.
- Re-enter and verify BLE can reinitialize correctly.

## Completion Checklist

- `app.js` has exactly one BLE instance in global data
- No legacy API names remain in app/page code
- No tuple-style `[err, res]` handling remains for BLE calls
- Discovery/listener APIs use add/remove or unsubscribe patterns
- Protocol send wrapper calls `writeCharacteristicValue` with explicit options
- Auto reconnect path and normal connect path both work
- `release()` is called on the intended lifecycle boundary
- Connection and characteristic listeners do not duplicate across repeated page entry

## Failure Patterns To Catch

- Using separate `filterOptions` instead of embedding in `searchOption`
- Using `filterKey` instead of `includeKeys`/`excludeKeys` in `searchOption`
- Calling `init(callback)` (old style) instead of `await init()`
- Calling `writeCharacteristic` and expecting tuple return
- Swallowing thrown BLE exceptions without user feedback/retry branch
- Not stopping discovery after successful connect
- Re-registering listeners every page show without cleanup

## Suggested Output Shape For Agent

When applying this skill, generate results in this order:
1. Migration diff list (legacy -> current API)
2. `app.js` singleton initialization and lifecycle patch
3. Page-level discovery/connect/disconnect patch
4. Protocol send/read wrapper patch
5. Validation notes (manual test steps and edge-case checks)

## Example Prompts

- `/wechat-miniapp-ble-global-handler 把现有小程序的 BLE 代码从旧 API 迁移到当前 miniprogram-bluetooth-utils` 
- `/wechat-miniapp-ble-global-handler 按单设备模式重构 app.js 全局 BLEHandler，并修复页面读写流程` 
- `/wechat-miniapp-ble-global-handler 为工业设备协议层封装 send/read，并保留自动重连策略`
