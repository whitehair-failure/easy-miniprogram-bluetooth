export * from "./core/BLEHandler.base";
export * from "./core/SingleDeviceBLEHandler";
export * from "./core/MultiDeviceBLEHandler";
export * from "./utils/uuid";
export * from "./utils/logger";

// 对外类型定义（Device / BLEHandlerConfig / SearchOption / writeCharacteristicOption 等）
// 这些类型出现在公共 API 签名里，必须能从包根引入，否则消费者无法显式标注变量类型。
export type * from "./types/ble";

// 为了兼容性，也导出原来的 BLEHandler（默认为 SingleDeviceBLEHandler）
export { SingleDeviceBLEHandler as BLEHandler } from "./core/SingleDeviceBLEHandler";
