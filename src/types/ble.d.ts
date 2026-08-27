// Shared BLE-related type declarations used across the project

export interface Device extends WechatMiniprogram.BlueToothDevice {
  isConnect: boolean;
  reconnect?: boolean;
}

export interface SearchOption extends WechatMiniprogram.StartBluetoothDevicesDiscoveryOption {
  includeKeys?: string[];
  excludeKeys?: string[];
}

export interface BLEHandlerConfig {
  serviceUId?: string; // 可选：服务 UUID，不提供时将跳过服务校验
  readCharacteristicId?: string;
  writeCharacteristicId?: string;
  notifyCharacteristicId?: string;
  notifyType?: "notification" | "indication"; // 通知类型，默认为 notification（大多数设备），部分设备仅支持 indication
}

export interface BLEHandlerConstructor {
  config?: BLEHandlerConfig;
  searchOption: SearchOption;
  reconnect?: boolean; // 设备异常断开是否自动重连
  connectTimeout?: number; // 正常连接的超时时间，单位毫秒
  maxRetries?: number; // 最大自动重连次数
  reconnectDelay?: number; // 每次自动重连间隔时间，单位毫秒
  mode?: "single" | "multiple";
  debug?: boolean; // 是否开启调试日志（默认关闭静默，true 时输出 debugLog/debugError/debugWarn）
}

export interface CharacteristicCheckResult {
  success: boolean;
  missingCharacteristics?: string[];
}

// writeCharacteristic 包含原生 WriteBLECharacteristicValueOption 并扩展额外字段
export interface writeCharacteristicOption
  extends WechatMiniprogram.WriteBLECharacteristicValueOption {
  // hasResponse?: boolean;
  // timeoutMs?: number;
  responseConfig?: {
    hasResponse: boolean;
    timeoutMs?: number;
    serviceId?: string;
    characteristicId?: string;
  }; // 可选：是否需要响应，默认为 false；如果需要响应，可以提供一个对象来指定超时时间（单位毫秒）以及服务ID和特征ID（如果不提供，将使用默认配置中的值）
}

// writeCharacteristic 包含原生 WriteBLECharacteristicValueOption 并扩展额外字段
export interface readCharacteristicOption
  extends WechatMiniprogram.ReadBLECharacteristicValueOption {
  timeoutMs?: number;
}

// 特征值读取/写入响应的返回结果（value 为 ArrayBuffer 转换后的字节数组）
export interface CharacteristicValueResult {
  deviceId: string;
  serviceId: string;
  characteristicId: string;
  value: number[]; // 原始 ArrayBuffer 转为普通字节数组
}
