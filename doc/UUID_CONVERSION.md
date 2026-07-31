## UUID 自动转换功能

为了提高开发体验，`miniprogram-bluetooth-utils` 现已支持**16位短UUID自动转换为标准128位UUID**的功能。

### 功能说明

#### 支持的转换格式
- **输入**: 16位短UUID（4个十六进制字符，例如 `180D`、`FFF0`）
- **输出**: 标准128位UUID（格式为 `0000${shortUuid}-0000-1000-8000-00805f9b34fb`）

#### 自动转换的字段
配置对象中以下UUID字段会自动进行转换：
- `serviceUId` - 服务UUID
- `readCharacteristicId` - 读特征ID
- `writeCharacteristicId` - 写特征ID
- `notifyCharacteristicId` - 通知特征ID

### 使用示例

#### 构造函数中使用
```typescript
import { SingleDeviceBLEHandler } from 'miniprogram-bluetooth-utils';

// 16位短UUID会自动转换为128位标准UUID
const handler = new SingleDeviceBLEHandler({
  config: {
    serviceUId: '180D',                    // 自动转换为: 0000180d-0000-1000-8000-00805f9b34fb
    readCharacteristicId: 'FFF1',          // 自动转换为: 0000fff1-0000-1000-8000-00805f9b34fb
    writeCharacteristicId: 'FFF2',         // 自动转换为: 0000fff2-0000-1000-8000-00805f9b34fb
    notifyCharacteristicId: 'FFF4',        // 自动转换为: 0000fff4-0000-1000-8000-00805f9b34fb
  },
  searchOption: {
    includeKeys: ['device_name'],
  },
});
```

#### 运行时更新配置时使用
```typescript
// 更新配置时，16位短UUID也会自动转换
await handler.updateBLEHandlerConfig({
  writeCharacteristicId: '2A37',           // 自动转换为: 00002a37-0000-1000-8000-00805f9b34fb
});
```

#### 既有的128位UUID仍然可用
```typescript
// 如果已经是标准128位UUID，不需要改动，仍然可以使用
const handler = new SingleDeviceBLEHandler({
  config: {
    serviceUId: '0000180d-0000-1000-8000-00805f9b34fb',
    readCharacteristicId: '0000fff1-0000-1000-8000-00805f9b34fb',
  },
  searchOption: {},
});
```

### API 参考

#### `convertShortUUIDToFull(shortUuid: string): string`
将单个短UUID转换为标准128位UUID。

**参数:**
- `shortUuid` - 16位短UUID字符串（例如 `"180D"`）

**返回值:** 标准128位UUID字符串

**示例:**
```typescript
import { convertShortUUIDToFull } from 'miniprogram-bluetooth-utils';

const fullUUID = convertShortUUIDToFull('180D');
console.log(fullUUID); // 输出: 0000180d-0000-1000-8000-00805f9b34fb
```

#### `isShortUUID(uuid: string): boolean`
检查字符串是否为16位短UUID格式。

**参数:**
- `uuid` - 待检查的UUID字符串

**返回值:** 是否为短UUID格式（boolean）

**示例:**
```typescript
import { isShortUUID } from 'miniprogram-bluetooth-utils';

console.log(isShortUUID('180D'));  // true
console.log(isShortUUID('0000180d-0000-1000-8000-00805f9b34fb')); // false
```

### 技术细节

- 转换自动在 `ServiceManager` 的构造函数和配置更新时进行
- 短UUID识别基于正则表达式 `/^[0-9a-fA-F]{4}$/`（4个十六进制字符）
- 转换不区分大小写，输出为小写格式
- 如果输入不是短UUID格式，原值保持不变
- 所有与蓝牙API的通信使用转换后的标准128位UUID
