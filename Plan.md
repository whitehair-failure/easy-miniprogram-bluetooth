# Plan: miniprogram-bluetooth-utils 重构计划

这是一个分 4 阶段的重构计划，从最关键的问题（请求队列混乱、错误处理）开始，逐步改进架构、增强类型安全，最后完善测试。每个阶段都可以独立完成并验证。

## Steps

1. 修复 IOManager 的请求匹配机制 — 当前 FIFO 队列会导致响应混配，需改为基于 (deviceId, characteristicId, requestId) 的精确匹配，同时添加请求超时自动清理机制（防止内存泄漏），位于 IOManager.ts:74-94

2. 重构错误处理系统 — 将 [Error | null, any] 风格改为标准异常抛出 + 自定义错误类（BLEConnectionError, BLETimeoutError, BLEPermissionError 等），更新所有 manager 和 BLEHandler.ts，让用户用 try-catch 处理错误

3. 拆分单/多设备模式 — 创建 SingleDeviceBLEHandler 和 MultiDeviceBLEHandler 两个子类继承基础 BLEHandler，消除所有 if (this.mode === "single") 分支，简化 ConnectionManager.ts:106-112 中的模式判断逻辑

4. 优化 BluetoothManager 并添加依赖注入 — 要么删除 BluetoothManager.ts 直接用 wx API，要么增强它（添加重试、日志控制开关、超时），并将其作为可注入依赖传入各 manager，方便测试时 mock

5. 锁定公共属性并改善类型安全 — 将 connectedDevices, foundDevList 等数组改为 private，提供返回深拷贝的 getter；强制 BLEHandlerConfig.serviceUId 为必填；添加运行时配置验证；移除未使用的 reconnectingDevices 属性

6. 建立完整的测试基础设施 — 添加 Jest 配置，创建 src/__tests__/ 目录，为所有 5 个 manager 编写单元测试（mock WeChat API），为 BLEHandler 编写集成测试，目标覆盖率 >70%

## Further Considerations

1. 重连逻辑改进 — 当前的 generation-based 取消机制虽然有效但不直观，可考虑改用 AbortController（如果目标环境支持）或显式的 CancellationToken 模式，提升代码可读性
2. 日志系统优化 — 当前 console.log 过多且无法控制，建议添加可配置的日志等级（DEBUG/INFO/WARN/ERROR）和生产环境静默选项，或集成第三方日志库

3. API 风格抉择 — 重构错误处理时需决定：完全改为异常抛出（breaking change）还是同时支持两种风格（提供 xxxSafe() 版本返回 Result 类型）？前者简洁但需用户大改代码，后者兼容但增加 API 数量

4. 性能监控埋点 — 可考虑添加性能统计（连接耗时、重连次数、请求响应时间），帮助用户诊断问题，特别是在复杂的多设备场景