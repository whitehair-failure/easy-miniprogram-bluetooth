export * from "./core/BLEHandler.base";
export * from "./core/SingleDeviceBLEHandler";
export * from "./core/MultiDeviceBLEHandler";
export * from "./utils/uuid";
export * from "./utils/logger";

// 为了兼容性，也导出原来的 BLEHandler（默认为 SingleDeviceBLEHandler）
export { SingleDeviceBLEHandler as BLEHandler } from "./core/SingleDeviceBLEHandler";
