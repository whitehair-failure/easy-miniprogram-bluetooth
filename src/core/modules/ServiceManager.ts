/**
 * ServiceManager - 服务与特征值管理模块
 * 负责获取服务、检查特征值、订阅通知
 */
import BluetoothManager from "../BluetoothManager";
import type {
  BLEHandlerConfig,
  CharacteristicCheckResult,
} from "../../types/ble";

export class ServiceManager {
  public readonly config: BLEHandlerConfig;

  constructor(config: BLEHandlerConfig) {
    this.config = config;
  }

  /**
   * 运行时更新配置
   * 接受部分配置项：serviceUId / writeCharacteristicId / notifyCharacteristicId
   * 返回 [Error|null, updatedConfig]
   */
  setBLEHandlerConfig(
    cfg: Partial<BLEHandlerConfig>,
    onConfigUpdated?: () => Promise<void>
  ): [Error | null, BLEHandlerConfig] {
    if (!cfg || typeof cfg !== "object") {
      return [new Error("Invalid config object"), this.config];
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
        return [new Error(`Unknown config key: ${key}`), this.config];
      }
      const val = (cfg as any)[key];
      if (val != null && typeof val !== "string") {
        return [
          new Error(`Invalid type for ${key}, expected string`),
          this.config,
        ];
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

    return [null, this.config];
  }

  /**
   * 获取蓝牙设备的所有服务
   * @returns {Promise<[Error | null, WechatMiniprogram.BLEService[] | undefined]>} 错误对象和服务列表
   */
  async getDeviceServices(deviceId: string) {
    let [err, res] = await BluetoothManager.getBLEDeviceServices(deviceId);
    return [err, res];
  }

  /**
   * 检查蓝牙设备的服务是否拥有已设置的特征值
   * @param {string} deviceId 设备ID
   * @param {string} [serviceId] 服务ID（可选，默认使用config中的serviceUId）
   * @returns {Promise<[Error | null, CharacteristicCheckResult]>} 特征值检查结果
   */
  async validateCharacteristics(
    deviceId: string,
    serviceId?: string
  ): Promise<[Error | null, CharacteristicCheckResult]> {
    let [err, res] = await BluetoothManager.getBLEDeviceCharacteristics(
      deviceId,
      serviceId || this.config.serviceUId || ""
    );
    console.log("checkCharacteristics", res);

    if (err) {
      return [err, { success: false }];
    }

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

    return [null, result];
  }

  // Note: old name `checkCharacteristics` removed. Use `validateCharacteristics`.

  /**
   * 启用蓝牙设备特征值变化的通知功能
   * @param {string} deviceId 设备ID
   * @param {string} [serviceId] 服务ID
   * @param {string} [characteristicId] 特征值ID
   * @returns {Promise<[Error | null, any]>} 错误对象和结果
   */
  async enableCharacteristicNotification(
    deviceId: string,
    serviceId?: string,
    characteristicId?: string
  ) {
    if (!deviceId) {
      return [new Error("必须提供设备ID"), null];
    }
    return await BluetoothManager.notifyBLECharacteristicValueChange(
      deviceId,
      serviceId || this.config.serviceUId || "",
      characteristicId || this.config.notifyCharacteristicId || ""
    );
  }

  // Note: old name `notifyBLECharacteristicValueChange` removed. Use `enableCharacteristicNotification`.
}
