/**
 * UUID 转换工具函数
 * 支持将16位短UUID转换为标准128位UUID
 */

/**
 * 判断是否为16位短UUID格式
 * 16位短UUID为4个十六进制字符组成（例如：180D）
 * @param uuid 待检查的UUID字符串
 * @returns 是否为16位短UUID
 */
export function isShortUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== "string") return false;
  // 4个十六进制字符，不包含连字符
  return /^[0-9a-fA-F]{4}$/.test(uuid.trim());
}

/**
 * 将16位短UUID转换为标准128位UUID
 * 转换规则: 0000${shortUuid}-0000-1000-8000-00805f9b34fb
 * @param shortUuid 16位短UUID（例如：180D）
 * @returns 标准128位UUID
 */
export function convertShortUUIDToFull(shortUuid: string): string {
  if (!shortUuid || typeof shortUuid !== "string") return shortUuid;

  const cleanUuid = shortUuid.trim().toUpperCase();

  if (!isShortUUID(cleanUuid)) {
    // 如果不是短UUID，直接返回原值
    return shortUuid;
  }

  return `0000${cleanUuid}-0000-1000-8000-00805F9B34FB`.toUpperCase();
}

/**
 * 批量转换UUID配置对象中的所有UUID字段
 * @param config 配置对象，包含可能的UUID字段
 * @returns 转换后的配置对象
 */
export function convertConfigUUIDs(config: any): any {
  if (!config || typeof config !== "object") return config;

  // UUID相关的字段名
  const uuidFields = [
    "serviceUId",
    "readCharacteristicId",
    "writeCharacteristicId",
    "notifyCharacteristicId",
  ];

  const converted = { ...config };

  for (const field of uuidFields) {
    if (field in converted && converted[field]) {
      const uuid = converted[field];
      if (typeof uuid === "string") {
        converted[field] = convertShortUUIDToFull(uuid);
      }
    }
  }

  return converted;
}
