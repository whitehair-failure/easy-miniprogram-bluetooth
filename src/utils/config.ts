/**
 * BLEHandlerConfig 校验工具
 * 供 ServiceManager 与 IOManager 共享，避免重复实现
 */
import type { BLEHandlerConfig } from "../types/ble";

/**
 * 验证 BLE 配置的有效性
 * @throws {Error} 配置无效时抛出
 */
export function validateBLEHandlerConfig(config: BLEHandlerConfig): void {
  if (!config) {
    throw new Error("BLEHandlerConfig is required");
  }

  // serviceUId 是可选的，仅当提供时进行验证
  if (
    config.serviceUId !== undefined &&
    (typeof config.serviceUId !== "string" || config.serviceUId.trim() === "")
  ) {
    throw new Error("serviceUId must be a non-empty string or undefined");
  }

  // 验证特征值 ID（如果提供）
  const characteristicIds = [
    config.readCharacteristicId,
    config.writeCharacteristicId,
    config.notifyCharacteristicId,
  ];

  for (const id of characteristicIds) {
    if (id !== undefined && (typeof id !== "string" || id.trim() === "")) {
      throw new Error(`Invalid characteristic ID: ${id}. Must be a non-empty string or undefined`);
    }
  }
}
