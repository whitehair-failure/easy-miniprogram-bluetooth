let cachedIsDevtools: boolean | undefined;
let cachedIsHarmony: boolean | undefined;

/**
 * 判断当前是否运行在微信开发者工具环境。
 */
export function isDevtoolsPlatform(): boolean {
  if (cachedIsDevtools !== undefined) {
    return cachedIsDevtools;
  }

  try {
    if (typeof wx === "undefined" || typeof wx.getDeviceInfo !== "function") {
      cachedIsDevtools = false;
      return cachedIsDevtools;
    }

    const deviceInfo = wx.getDeviceInfo();
    cachedIsDevtools = deviceInfo?.platform === "devtools";
    return cachedIsDevtools;
  } catch {
    cachedIsDevtools = false;
    return cachedIsDevtools;
  }
}

/**
 * 在 devtools 环境中跳过蓝牙 API 调用。
 */
export function shouldSkipBLEApiCall(apiName: string): boolean {
  const shouldSkip = isDevtoolsPlatform();
  if (shouldSkip) {
    console.log(`[BLE] 当前运行在 devtools，已跳过 wx.${apiName}`);
  }
  return shouldSkip;
}

/**
 * 判断当前是否运行在鸿蒙（HarmonyOS）环境。
 */
export function isHarmonyOS(): boolean {
  if (cachedIsHarmony !== undefined) {
    return cachedIsHarmony;
  }

  try {
    if (typeof wx === "undefined" || typeof wx.getDeviceInfo !== "function") {
      cachedIsHarmony = false;
      return cachedIsHarmony;
    }

    const deviceInfo = wx.getDeviceInfo();
    const brand = deviceInfo?.brand;
    const platform = deviceInfo?.platform;
    const system = deviceInfo?.system;

    if (
      brand === "HUAWEI" ||
      brand === "huawei" ||
      platform === "ohos" ||
      (typeof system === "string" && system.includes("Harmony"))
    ) {
      cachedIsHarmony = true;
    } else {
      cachedIsHarmony = false;
    }

    return cachedIsHarmony;
  } catch {
    cachedIsHarmony = false;
    return cachedIsHarmony;
  }
}
