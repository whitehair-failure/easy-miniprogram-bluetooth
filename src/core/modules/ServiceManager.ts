/**
 * ServiceManager - 服务与特征值管理模块
 * 负责获取服务、检查特征值、订阅通知
 */
import type { BLEHandlerConfig, CharacteristicCheckResult } from "../../types/ble";
import { shouldSkipBLEApiCall } from "../../utils/runtime";
import { convertConfigUUIDs } from "../../utils/uuid";
import { validateBLEHandlerConfig } from "../../utils/config";

export class ServiceManager {
  public readonly config: BLEHandlerConfig;

  constructor(config: BLEHandlerConfig) {
    // 自动将短UUID转换为标准128位UUID
    const convertedConfig = convertConfigUUIDs(config);
    validateBLEHandlerConfig(convertedConfig);
    this.config = convertedConfig;
  }

  /**
   * 运行时更新配置
   * 接受部分配置项：serviceUId / writeCharacteristicId / notifyCharacteristicId
   * @throws {Error}
   */
  setBLEHandlerConfig(cfg: Partial<BLEHandlerConfig>): BLEHandlerConfig {
    if (!cfg || typeof cfg !== "object") {
      throw new Error("Invalid config object");
    }

    // 验证传入的字段类型
    const allowedKeys: Array<keyof BLEHandlerConfig> = [
      "serviceUId",
      "writeCharacteristicId",
      "notifyCharacteristicId",
      "readCharacteristicId",
    ];

    for (const key of Object.keys(cfg) as Array<string>) {
      if (!allowedKeys.includes(key as any)) {
        throw new Error(`Unknown config key: ${key}`);
      }
      const val = (cfg as any)[key];
      if (val != null && typeof val !== "string") {
        throw new Error(`Invalid type for ${key}, expected string`);
      }
    }

    // 自动将短UUID转换为标准128位UUID
    const convertedCfg = convertConfigUUIDs(cfg);

    // 创建新配置对象进行验证
    const newConfig = { ...this.config, ...convertedCfg };
    validateBLEHandlerConfig(newConfig);

    // 验证通过后，更新配置
    if (convertedCfg.serviceUId) this.config.serviceUId = convertedCfg.serviceUId;
    if (convertedCfg.writeCharacteristicId)
      this.config.writeCharacteristicId = convertedCfg.writeCharacteristicId;
    if (convertedCfg.notifyCharacteristicId)
      this.config.notifyCharacteristicId = convertedCfg.notifyCharacteristicId;
    if (convertedCfg.readCharacteristicId)
      this.config.readCharacteristicId = convertedCfg.readCharacteristicId;

    return this.config;
  }

  /**
   * 获取蓝牙设备的所有服务
   * @throws {Error}
   */
  async getDeviceServices(deviceId: string): Promise<WechatMiniprogram.BLEService[]> {
    console.log(`获取蓝牙设备所有服务...`);
    if (shouldSkipBLEApiCall("getBLEDeviceServices")) {
      return [];
    }
    const res = await wx.getBLEDeviceServices({ deviceId });
    console.log(`✔ 获取service成功！`, res);
    return res.services || [];
  }

  /**
   * 检查蓝牙设备的服务是否拥有已设置的特征值
   * 当 serviceUId 未配置时，将跳过验证
   * @param {string} deviceId 设备ID
   * @param {string} [serviceId] 服务ID（可选，默认使用config中的serviceUId）
   * @throws {Error}
   */
  async validateCharacteristics(
    deviceId: string,
    serviceId?: string,
  ): Promise<CharacteristicCheckResult> {
    // 如果未配置 serviceUId 且未提供 serviceId，跳过验证
    if (!this.config.serviceUId && !serviceId) {
      console.log(`serviceUId 未配置，跳过特征值验证`);
      return { success: true };
    }

    if (shouldSkipBLEApiCall("getBLEDeviceCharacteristics")) {
      return { success: true };
    }

    console.log(`开始获取特征值...`);
    const res = await wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId: serviceId || this.config.serviceUId || "",
    });
    console.log(`✔ 获取特征值成功！`, res);

    // 存储缺失的特征值ID
    const missingCharacteristics: string[] = [];

    // 检查写特征值（只有配置了才检查）
    if (
      this.config.writeCharacteristicId &&
      !res?.characteristics.some((c: any) => c.uuid === this.config.writeCharacteristicId)
    ) {
      missingCharacteristics.push("writeCharacteristicId");
    }

    // 检查通知特征值（只有配置了才检查）
    if (
      this.config.notifyCharacteristicId &&
      !res?.characteristics.some((c: any) => c.uuid === this.config.notifyCharacteristicId)
    ) {
      missingCharacteristics.push("notifyCharacteristicId");
    }

    // 检查读特征值（只有配置了才检查）
    if (
      this.config.readCharacteristicId &&
      !res?.characteristics.some((c: any) => c.uuid === this.config.readCharacteristicId)
    ) {
      missingCharacteristics.push("readCharacteristicId");
    }

    // 构造返回结果
    const result: CharacteristicCheckResult = {
      success: missingCharacteristics.length === 0,
    };

    // 如果有缺失的特征值，添加到结果中
    if (missingCharacteristics.length > 0) {
      result.missingCharacteristics = missingCharacteristics;
      console.warn(`缺失以下特征值: ${missingCharacteristics.join(", ")}`);
    }

    return result;
  }

  // Note: old name `checkCharacteristics` removed. Use `validateCharacteristics`.

  /**
   * 启用蓝牙设备特征值变化的通知功能
   * 当 serviceUId 和 notifyCharacteristicId 都未配置时，将跳过通知订阅
   * @param {string} deviceId 设备ID
   * @param {string} [serviceId] 服务ID
   * @param {string} [characteristicId] 特征值ID
   * @throws {Error}
   */
  async enableCharacteristicNotification(
    deviceId: string,
    serviceId?: string,
    characteristicId?: string,
  ): Promise<void> {
    if (!deviceId) {
      throw new Error("必须提供设备ID");
    }

    // 如果未配置 serviceUId 且未提供 serviceId，跳过通知订阅
    if (!serviceId && !this.config.serviceUId) {
      console.log(`serviceUId 未配置，跳过特征值通知订阅`);
      return;
    }

    // 如果未配置 notifyCharacteristicId 且未提供 characteristicId，跳过通知订阅
    if (!characteristicId && !this.config.notifyCharacteristicId) {
      console.log(`notifyCharacteristicId 未配置，跳过特征值通知订阅`);
      return;
    }

    if (shouldSkipBLEApiCall("notifyBLECharacteristicValueChange")) {
      return;
    }

    console.log(`准备订阅特征值变化...`);
    console.log(`this.config`, this.config);
    await wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId: serviceId || this.config.serviceUId || "",
      characteristicId: characteristicId || this.config.notifyCharacteristicId || "",
      state: true,
      type: this.config.notifyType || "notification",
    });
    console.log(`✔ 订阅特征值成功！`);
  }

  // Note: old name `notifyBLECharacteristicValueChange` removed. Use `enableCharacteristicNotification`.
}
