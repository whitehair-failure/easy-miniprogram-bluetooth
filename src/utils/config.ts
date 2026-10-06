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
    throw new Error("BLEHandlerConfig 配置不能为空");
  }

  // serviceUId 是可选的，仅当提供时进行验证
  if (
    config.serviceUId !== undefined &&
    (typeof config.serviceUId !== "string" || config.serviceUId.trim() === "")
  ) {
    throw new Error("serviceUId 必须是非空字符串或 undefined");
  }

  // 验证特征值 ID（如果提供）
  const characteristicIds = [
    config.readCharacteristicId,
    config.writeCharacteristicId,
    config.notifyCharacteristicId,
  ];

  for (const id of characteristicIds) {
    if (id !== undefined && (typeof id !== "string" || id.trim() === "")) {
      throw new Error(`特征值 ID 无效: ${id}，必须是非空字符串或 undefined`);
    }
  }

  // 验证通知类型（如果提供）
  if (
    config.notifyType !== undefined &&
    config.notifyType !== "notification" &&
    config.notifyType !== "indication"
  ) {
    throw new Error(`notifyType 无效: ${config.notifyType}，必须是 "notification" 或 "indication"`);
  }
}
