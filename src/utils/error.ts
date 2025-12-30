/**
 * 错误码映射表
 */
const errorMap: { [key: string]: string } = {
  10000: "未初始化蓝牙适配器",
  10001: "当前蓝牙适配器不可用",
  10002: "没有找到指定设备",
  10003: "连接失败",
  10004: "没有找到指定服务",
  10005: "没有找到指定特征值",
  10006: "当前连接已断开",
  10007: "当前特征值不支持此操作",
  10008: "其他错误，请查看 errMsg",
  10009: "Android 系统特有，系统版本低于 4.3 不支持 BLE",
  10010: "已连接",
  10011: "配对设备需要配对码",
  10012: "连接超时",
  10013: "连接 deviceId 为空或者格式不正确",
};

/**
 * 自定义 BLE 错误基类
 */
export class BLEError extends Error {
  public readonly code: string | number;
  public readonly originalError?: any;

  constructor(message: string, code: string | number = "UNKNOWN", originalError?: any) {
    super(message);
    this.name = "BLEError";
    this.code = code;
    this.originalError = originalError;
    
    // 维持正确的原型链（TypeScript/Babel 兼容）
    Object.setPrototypeOf(this, BLEError.prototype);
  }
}

/**
 * 蓝牙适配器相关错误
 */
export class BLEAdapterError extends BLEError {
  constructor(message: string, code: string | number = "ADAPTER_ERROR", originalError?: any) {
    super(message, code, originalError);
    this.name = "BLEAdapterError";
    Object.setPrototypeOf(this, BLEAdapterError.prototype);
  }
}

/**
 * 蓝牙权限错误
 */
export class BLEPermissionError extends BLEError {
  constructor(message: string = "蓝牙权限未授予或已被禁止", code: string | number = "PERMISSION_DENIED", originalError?: any) {
    super(message, code, originalError);
    this.name = "BLEPermissionError";
    Object.setPrototypeOf(this, BLEPermissionError.prototype);
  }
}

/**
 * 蓝牙连接错误
 */
export class BLEConnectionError extends BLEError {
  public readonly deviceId?: string;

  constructor(message: string, deviceId?: string, code: string | number = "CONNECTION_ERROR", originalError?: any) {
    super(message, code, originalError);
    this.name = "BLEConnectionError";
    this.deviceId = deviceId;
    Object.setPrototypeOf(this, BLEConnectionError.prototype);
  }
}

/**
 * 蓝牙超时错误
 */
export class BLETimeoutError extends BLEError {
  public readonly timeoutMs: number;
  public readonly operation: string;

  constructor(message: string, operation: string, timeoutMs: number, code: string | number = "TIMEOUT", originalError?: any) {
    super(message, code, originalError);
    this.name = "BLETimeoutError";
    this.operation = operation;
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, BLETimeoutError.prototype);
  }
}

/**
 * 蓝牙设备未找到错误
 */
export class BLEDeviceNotFoundError extends BLEError {
  public readonly deviceId?: string;

  constructor(message: string, deviceId?: string, code: string | number = "DEVICE_NOT_FOUND", originalError?: any) {
    super(message, code, originalError);
    this.name = "BLEDeviceNotFoundError";
    this.deviceId = deviceId;
    Object.setPrototypeOf(this, BLEDeviceNotFoundError.prototype);
  }
}

/**
 * 蓝牙服务或特征值错误
 */
export class BLEServiceError extends BLEError {
  public readonly serviceId?: string;
  public readonly characteristicId?: string;

  constructor(
    message: string,
    serviceId?: string,
    characteristicId?: string,
    code: string | number = "SERVICE_ERROR",
    originalError?: any
  ) {
    super(message, code, originalError);
    this.name = "BLEServiceError";
    this.serviceId = serviceId;
    this.characteristicId = characteristicId;
    Object.setPrototypeOf(this, BLEServiceError.prototype);
  }
}

/**
 * 蓝牙配置错误
 */
export class BLEConfigError extends BLEError {
  constructor(message: string, code: string | number = "CONFIG_ERROR", originalError?: any) {
    super(message, code, originalError);
    this.name = "BLEConfigError";
    Object.setPrototypeOf(this, BLEConfigError.prototype);
  }
}

/**
 * 蓝牙读写错误
 */
export class BLEIOError extends BLEError {
  public readonly operation: "read" | "write";
  public readonly deviceId?: string;
  public readonly characteristicId?: string;

  constructor(
    message: string,
    operation: "read" | "write",
    deviceId?: string,
    characteristicId?: string,
    code: string | number = "IO_ERROR",
    originalError?: any
  ) {
    super(message, code, originalError);
    this.name = "BLEIOError";
    this.operation = operation;
    this.deviceId = deviceId;
    this.characteristicId = characteristicId;
    Object.setPrototypeOf(this, BLEIOError.prototype);
  }
}

/**
 * 将错误码或错误对象转换为对应的错误信息
 * @param {string | number | Error} errCodeOrErr 错误码、错误对象
 * @returns {string} 错误信息
 */
export function formatError(errCodeOrErr: string | number | Error | any): string {
  if (errCodeOrErr instanceof Error) {
    return errCodeOrErr.message;
  }

  const errMsg =
    typeof errCodeOrErr === "object" && errCodeOrErr.errMsg
      ? errCodeOrErr.errMsg
      : errorMap[errCodeOrErr.toString()];
  return errMsg || "未知错误";
}

/**
 * 将微信原生错误转换为 BLEError
 * @param err 微信原生错误对象
 * @returns BLEError 实例
 */
export function convertWxErrorToBLEError(err: any): BLEError {
  const errCode = err?.errCode || err?.errno || "UNKNOWN";
  const errMsg = err?.errMsg || err?.message || formatError(errCode);

  // 根据错误码返回不同的错误类型
  switch (errCode) {
    case 103:
    case "103":
      return new BLEPermissionError(errMsg, errCode, err);
    
    case 10000:
    case 10001:
    case 10009:
      return new BLEAdapterError(errMsg, errCode, err);
    
    case 10002:
    case 10013:
      return new BLEDeviceNotFoundError(errMsg, undefined, errCode, err);
    
    case 10003:
    case 10006:
    case 10010:
      return new BLEConnectionError(errMsg, undefined, errCode, err);
    
    case 10012:
      return new BLETimeoutError(errMsg, "connection", 0, errCode, err);
    
    case 10004:
    case 10005:
    case 10007:
      return new BLEServiceError(errMsg, undefined, undefined, errCode, err);
    
    default:
      return new BLEError(errMsg, errCode, err);
  }
}

/**
 * 旧版错误处理函数（向后兼容）
 * @deprecated 使用 formatError 或 convertWxErrorToBLEError
 */
export default function (err: any): string {
  console.log("微信原始错误码:", err);
  return formatError(err);
}
