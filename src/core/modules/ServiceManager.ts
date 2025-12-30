/**
 * ServiceManager - 服务与特征值管理模块
 * 负责获取服务、检查特征值、订阅通知
 */
import type {
  BLEHandlerConfig,
  CharacteristicCheckResult,
} from "../../types/ble";
import { BLEServiceError, BLEConfigError, convertWxErrorToBLEError } from "../../utils/error";

export class ServiceManager {
  public readonly config: BLEHandlerConfig;

  constructor(config: BLEHandlerConfig) {
    this.config = config;
  }

  /**
   * 运行时更新配置
   * 接受部分配置项：serviceUId / writeCharacteristicId / notifyCharacteristicId
   * @throws {BLEConfigError}
   */
  setBLEHandlerConfig(
    cfg: Partial<BLEHandlerConfig>,
    onConfigUpdated?: () => Promise<void>
  ): BLEHandlerConfig {
    if (!cfg || typeof cfg !== "object") {
      throw new BLEConfigError("Invalid config object");
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
        throw new BLEConfigError(`Unknown config key: ${key}`);
      }
      const val = (cfg as any)[key];
      if (val != null && typeof val !== "string") {
        throw new BLEConfigError(`Invalid type for ${key}, expected string`);
      }
    }

    // 合并到本地配置
    if (cfg.serviceUId) this.config.serviceUId = cfg.serviceUId;
    if (cfg.writeCharacteristicId)
      this.config.writeCharacteristicId = cfg.writeCharacteristicId;
    if (cfg.notifyCharacteristicId)
      this.config.notifyCharacteristicId = cfg.notifyCharacteristicId;
    if (cfg.readCharacteristicId)
      this.config.readCharacteristicId = cfg.readCharacteristicId;

    // 如果有回调，执行配置更新后的操作（如重新订阅通知）
    if (onConfigUpdated) {
      onConfigUpdated();
    }

    return this.config;
  }

  /**
   * 获取蓝牙设备的所有服务
   * @throws {BLEServiceError}
   */
  async getDeviceServices(deviceId: string): Promise<WechatMiniprogram.BLEService[]> {
    console.log(`获取蓝牙设备所有服务...`);
    const res = await wx.getBLEDeviceServices({ deviceId });
    console.log(`✔ 获取service成功！`, res);
    return res.services || [];
  }

  /**
   * 检查蓝牙设备的服务是否拥有已设置的特征值
   * @param {string} deviceId 设备ID
   * @param {string} [serviceId] 服务ID（可选，默认使用config中的serviceUId）
   * @throws {BLEServiceError | BLEConfigError}
   */
  async validateCharacteristics(
    deviceId: string,
    serviceId?: string
  ): Promise<CharacteristicCheckResult> {
    console.log(`开始获取特征值...`);
    const res = await wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId: serviceId || this.config.serviceUId || ""
    });
    console.log(`✔ 获取特征值成功！`, res);

    // 存储缺失的特征值ID
    const missingCharacteristics: string[] = [];

    // 检查写特征值
    if (
      !this.config.writeCharacteristicId ||
      !res?.characteristics.some(
        (c: any) => c.uuid === this.config.writeCharacteristicId
      )
    ) {
      missingCharacteristics.push("writeCharacteristicId");
    }

    // 检查通知特征值
    if (
      !this.config.notifyCharacteristicId ||
      !res?.characteristics.some(
        (c: any) => c.uuid === this.config.notifyCharacteristicId
      )
    ) {
      missingCharacteristics.push("notifyCharacteristicId");
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
   * @param {string} deviceId 设备ID
   * @param {string} [serviceId] 服务ID
   * @param {string} [characteristicId] 特征值ID
   * @throws {BLEConfigError | BLEServiceError}
   */
  async enableCharacteristicNotification(
    deviceId: string,
    serviceId?: string,
    characteristicId?: string
  ): Promise<void> {
    if (!deviceId) {
      throw new BLEConfigError("必须提供设备ID");
    }
    console.log(`准备订阅特征值变化...`);
    await wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId: serviceId || this.config.serviceUId || "",
      characteristicId: characteristicId || this.config.notifyCharacteristicId || "",
      state: true,
      type: "indicate"
    });
    console.log(`✔ 订阅特征值成功！`);
  }

  // Note: old name `notifyBLECharacteristicValueChange` removed. Use `enableCharacteristicNotification`.
}
