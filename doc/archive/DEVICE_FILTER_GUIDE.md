# 设备过滤指南

## 概述

微信小程序蓝牙库提供了灵活的设备过滤机制，支持**白名单**（包含关键字）和**黑名单**（排除关键字）模式，并允许运行时动态更新过滤规则。

## 旧版本 → 新版本迁移

### ❌ 旧版本（已弃用）

```typescript
// 使用 filterKey（字符串数组，只支持简单的包含过滤）
const handler = new SingleDeviceBLEHandler({
  config: { ... },
  filterKey: ["MyDevice", "BLE-Sensor"],
  // 只能做简单的包含检查
});
```

### ✅ 新版本（推荐）

```typescript
import type { DeviceFilterOptions } from "./types/ble";

const filterOptions: DeviceFilterOptions = {
  includeKeys: ["MyDevice", "BLE-Sensor"],  // 白名单
  excludeKeys: ["Test", "Debug"],            // 黑名单
};

const handler = new SingleDeviceBLEHandler({
  config: { ... },
  filterOptions,  // 替代 filterKey
  // ...
});
```

## 过滤逻辑

### 判断规则

设备名是否通过过滤取决于以下逻辑：

```
1. 如果配置了 excludeKeys（黑名单）：
   - 设备名包含任何黑名单关键字 → 过滤掉（返回 false）
   
2. 如果配置了 includeKeys（白名单）：
   - 设备名必须包含至少一个白名单关键字 → 通过（返回 true）
   - 设备名不包含任何白名单关键字 → 过滤掉（返回 false）
   
3. 如果都没配置：
   - 接受所有设备（返回 true）
```

### 优先级

**黑名单 > 白名单 > 无限制**

即：黑名单优先排除，剩余的再用白名单过滤。

## 使用场景

### 场景 1：只包含特定品牌设备

```typescript
const filterOptions: DeviceFilterOptions = {
  includeKeys: ["Apple", "Samsung", "Xiaomi"],
};

const handler = new SingleDeviceBLEHandler({
  config: { serviceUId: "180A" },
  filterOptions,
});
```

**结果**：只接受名字中包含 "Apple" 或 "Samsung" 或 "Xiaomi" 的设备。

---

### 场景 2：排除测试/调试设备

```typescript
const filterOptions: DeviceFilterOptions = {
  excludeKeys: ["TEST", "DEBUG", "MOCK"],
};

const handler = new SingleDeviceBLEHandler({
  config: { serviceUId: "180A" },
  filterOptions,
});
```

**结果**：排除名字中包含 "TEST"、"DEBUG" 或 "MOCK" 的设备，其余设备全部接受。

---

### 场景 3：复杂过滤（白名单 + 黑名单）

```typescript
const filterOptions: DeviceFilterOptions = {
  includeKeys: ["Sensor", "Device"],  // 只要名字中有 "Sensor" 或 "Device"
  excludeKeys: ["Broken", "Old"],     // 但排除掉 "Broken" 或 "Old" 的
};

const handler = new SingleDeviceBLEHandler({
  config: { serviceUId: "180A" },
  filterOptions,
});
```

**通过举例**：
- ✅ `"SmartSensor"` → 包含 "Sensor"，不含黑名单关键字 → **接受**
- ✅ `"MyDevice-v2"` → 包含 "Device"，不含黑名单关键字 → **接受**
- ❌ `"OldSensor"` → 包含 "Sensor" 但也包含 "Old" → **过滤掉**
- ❌ `"RandomDevice"` → 虽包含 "Device" 但包含 "Broken" → **过滤掉**
- ❌ `"JustARandomName"` → 不包含任何白名单关键字 → **过滤掉**

---

### 场景 4：运行时动态更新过滤规则

```typescript
const handler = new SingleDeviceBLEHandler({
  config: { serviceUId: "180A" },
  filterOptions: { includeKeys: ["DeviceA"] },
});

// 初始化、搜索等操作...
await handler.init();
await handler.startDeviceDiscovery();

// ... 用户在 UI 上修改过滤条件 ...

// 运行时动态更新过滤规则
handler.updateDeviceFilterOptions({
  includeKeys: ["DeviceB", "DeviceC"],
  excludeKeys: ["Offline"],
});

// 后续发现的设备将使用新的过滤规则
```

---

### 场景 5：查询当前过滤选项

```typescript
const currentFilter = handler.getDeviceFilterOptions();
console.log("当前白名单:", currentFilter.includeKeys);
console.log("当前黑名单:", currentFilter.excludeKeys);

// 清空所有过滤（接受所有设备）
handler.updateDeviceFilterOptions({});
```

## API 参考

### DeviceFilterOptions 接口

```typescript
interface DeviceFilterOptions {
  includeKeys?: string[];  // 白名单：设备名必须包含其中至少一个关键字
  excludeKeys?: string[];  // 黑名单：设备名不能包含任何一个关键字
}
```

### BLEHandlerBase 相关方法

#### updateDeviceFilterOptions(filterOptions)

更新设备过滤选项（运行时）。

```typescript
handler.updateDeviceFilterOptions({
  includeKeys: ["NewDevice"],
  excludeKeys: ["Broken"],
});
```

**参数**：
- `filterOptions: DeviceFilterOptions` - 新的过滤选项

**返回值**：`void`

**说明**：
- 更新后立即生效，后续发现的设备将使用新规则
- 已发现的设备列表（`foundDevList`）不会被重新过滤
- 特别适合 UI 中的实时过滤调整

---

#### getDeviceFilterOptions()

获取当前过滤选项（深拷贝）。

```typescript
const filter = handler.getDeviceFilterOptions();
```

**参数**：无

**返回值**：`DeviceFilterOptions` - 当前过滤选项的深拷贝

**说明**：
- 返回的是深拷贝，修改返回值不会影响实际的过滤规则
- 使用 `updateDeviceFilterOptions()` 来修改过滤规则

---

## DiscoveryManager 内部细节

### updateFilterOptions(filterOptions)

在 DiscoveryManager 中更新过滤选项。

```typescript
discoveryManager.updateFilterOptions({
  includeKeys: ["MyDevice"],
});
```

### getFilterOptions()

获取当前过滤选项。

```typescript
const opts = discoveryManager.getFilterOptions();
```

### 私有方法：isDeviceMatched(deviceName)

内部判断设备是否匹配当前过滤条件，按照上述规则进行判断。

## 注意事项

### 1. 空字符串处理

```typescript
// ❌ 不推荐：包含空字符串
const badFilter: DeviceFilterOptions = {
  includeKeys: ["Device", ""],  // 空字符串没有意义
};

// ✅ 推荐：过滤出非空关键字
const goodFilter: DeviceFilterOptions = {
  includeKeys: ["Device", "Sensor"].filter(k => k.trim().length > 0),
};
```

### 2. 大小写敏感

过滤是**大小写敏感**的。

```typescript
const filter: DeviceFilterOptions = {
  includeKeys: ["MyDevice"],
};

// ✅ 匹配
"MyDevice-v1"

// ❌ 不匹配（大小写不同）
"mydevice-v1"
"MYDEVICE-v1"

// ✅ 解决方案：在 includeKeys 中包含多个大小写变体
const filter2: DeviceFilterOptions = {
  includeKeys: ["MyDevice", "mydevice", "MYDEVICE"],
};
```

### 3. 子字符串匹配

过滤使用**子字符串匹配**（`String.prototype.includes()`），不是精确匹配。

```typescript
const filter: DeviceFilterOptions = {
  includeKeys: ["Device"],
};

// ✅ 以下都匹配
"Device"
"MyDevice"
"Device-v1"
"SmartDevice-Pro"
"DeviceManager"

// ❌ 以下都不匹配
"Dvice"  // 拼写错误
"Dev ice" // 有空格
```

### 4. 已发现设备列表不会被重新过滤

```typescript
const handler = new SingleDeviceBLEHandler({
  config: { serviceUId: "180A" },
  filterOptions: { includeKeys: ["Device"] },
});

await handler.startDeviceDiscovery();
// 假设发现了：Device-1, Device-2, Other-1, Other-2
// foundDevList 中只有：Device-1, Device-2

// 现在改变过滤规则
handler.updateDeviceFilterOptions({ includeKeys: ["Other"] });

// foundDevList 仍然是：Device-1, Device-2
// 而不是：Other-1, Other-2

// 💡 如果需要重新过滤，应该清空并重新搜索：
await handler.stopDeviceDiscovery();
// foundDevList 被清空
await handler.startDeviceDiscovery();
// 现在会发现：Other-1, Other-2
```

## 向后兼容性

**破坏性变更**：`filterKey` 已被移除，必须使用 `filterOptions` 替代。

**迁移指南**：

```typescript
// 旧版本
const handler = new SingleDeviceBLEHandler({
  filterKey: ["Device"],
  // ...
});

// 新版本
const handler = new SingleDeviceBLEHandler({
  filterOptions: { includeKeys: ["Device"] },
  // ...
});
```

## 常见问题

### Q: 设备名为空或 undefined 时会发生什么？

A: 空设备名总是被过滤掉（返回 `false`）。

```typescript
const filter: DeviceFilterOptions = {};
// 空名字 → false（被过滤）
// 有名字 → true（接受所有）
```

### Q: 能否同时使用 includeKeys 和 excludeKeys？

A: 可以，黑名单优先处理（先排除），剩余的再用白名单检查。

```typescript
const filter: DeviceFilterOptions = {
  includeKeys: ["Device"],
  excludeKeys: ["Broken"],
};

// Device-1 → 包含 "Device" 且不含 "Broken" → ✅
// Device-Broken → 包含 "Device" 但也包含 "Broken" → ❌
// BrokenDevice → 包含 "Device" 但也包含 "Broken" → ❌
```

### Q: 如何接受所有设备？

A: 将 `filterOptions` 设为空对象或 `undefined`。

```typescript
// 方式 1
handler.updateDeviceFilterOptions({});

// 方式 2
handler.updateDeviceFilterOptions(undefined!);
```

### Q: 过滤规则变更后，已连接的设备会受影响吗？

A: 不会。过滤规则只影响新发现的设备，已连接的设备不受影响。

```typescript
const handler = new SingleDeviceBLEHandler({
  config: { serviceUId: "180A" },
  filterOptions: { includeKeys: ["Device"] },
});

// 发现并连接 Device-1
await handler.connectDevice("Device-1");

// 改变过滤规则
handler.updateDeviceFilterOptions({ includeKeys: ["Other"] });

// Device-1 仍然保持连接
// 而后续搜索只会发现 Other-* 设备
```

## 完整示例

```typescript
import { SingleDeviceBLEHandler } from "./dist/index.esm.js";
import type { DeviceFilterOptions } from "./src/types/ble";

// 1. 创建处理器，包含初始过滤规则
const filterOptions: DeviceFilterOptions = {
  includeKeys: ["MyBLE"],      // 只要名字中有 "MyBLE"
  excludeKeys: ["Test", "Old"], // 排除 "Test" 和 "Old" 的设备
};

const handler = new SingleDeviceBLEHandler({
  config: {
    serviceUId: "0000180A-0000-1000-8000-00805F9B34FB",
  },
  filterOptions,
  mode: "single",
});

// 2. 初始化并搜索
await handler.openAdapter();
await handler.startDeviceDiscovery();

handler.onDeviceFound((devices) => {
  console.log("发现设备:", devices.map(d => d.name));
});

// 3. 用户调整过滤规则（例如通过 UI）
function onFilterChange(newInclude: string[], newExclude: string[]) {
  handler.updateDeviceFilterOptions({
    includeKeys: newInclude,
    excludeKeys: newExclude,
  });
  console.log("过滤规则已更新");
}

// 4. 查询当前过滤规则
function getCurrentFilter() {
  return handler.getDeviceFilterOptions();
}

// 5. 连接设备
await handler.connectDevice("MyBLE-Sensor-001");

// 6. 清理
await handler.release();
```

---

**文档版本**: 1.0  
**最后更新**: 2025-12-31
