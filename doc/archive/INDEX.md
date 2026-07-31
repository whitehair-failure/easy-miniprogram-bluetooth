# 📚 文档导航

欢迎使用 miniprogram-bluetooth-utils！本页面帮助你快速找到需要的文档。

## 🚀 快速开始

- **完全新手？** → 从 [README.md](../README.md) 开始
- **需要代码示例？** → 查看 [EXAMPLES.md](./EXAMPLES.md)
- **遇到问题？** → 检查 [EXAMPLES.md](./EXAMPLES.md) 中的错误处理章节

## 📖 文档结构

### 用户文档

| 文档 | 内容 | 适合人群 |
|------|------|---------|
| [README.md](../README.md) | 项目概览、快速开始、API 速查 | 所有用户 |
| [EXAMPLES.md](./EXAMPLES.md) | 12+ 个详细使用示例 | 需要代码示例的开发者 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 架构设计、设计模式、数据流向 | 想深入理解库的开发者 |
| [DEVICE_FILTER_GUIDE.md](./DEVICE_FILTER_GUIDE.md) | 设备过滤的详细说明 | 需要过滤蓝牙设备的用户 |
| [RENAME.md](./RENAME.md) | 旧版本 API 迁移对照 | 从旧版本升级的用户 |

### 项目文档

| 文档 | 内容 |
|------|------|
| [../AGENTS.md](../AGENTS.md) | AI 助手指南（开发者和助手使用） |

## 🎯 按场景查找文档

### "我想要快速开始"
1. 阅读 [README.md](../README.md) 的 **快速开始** 部分
2. 复制 **单设备模式** 或 **多设备模式** 代码
3. 根据需要参考 [EXAMPLES.md](./EXAMPLES.md)

### "我需要详细的使用示例"
→ [EXAMPLES.md](./EXAMPLES.md)

**包含的示例**：
- ✅ 单设备心率计应用
- ✅ 多设备多传感器应用
- ✅ 白名单/黑名单设备过滤
- ✅ 自动重连机制
- ✅ 完整的数据读写流程
- ✅ 多回调监听
- ✅ 错误处理最佳实践
- ✅ 页面生命周期管理
- ✅ 完整的应用框架

### "我想了解库的架构和设计"
→ [ARCHITECTURE.md](./ARCHITECTURE.md)

**包含内容**：
- 🏗️ 三层架构图
- 📐 关键设计模式
- 🔄 数据流向
- 🛡️ 错误处理体系
- ⚡ 性能优化
- 🔮 未来优化方向

### "我需要过滤蓝牙设备"
→ [DEVICE_FILTER_GUIDE.md](./DEVICE_FILTER_GUIDE.md)

**包含内容**：
- 白名单/黑名单用法
- 过滤逻辑详解
- 5 个实际应用场景
- 运行时动态更新
- 最佳实践

### "我需要迁移旧代码"
→ [RENAME.md](./RENAME.md)

**包含内容**：
- 旧 API → 新 API 对照表
- 迁移示例
- 哪些 API 已删除或改名

### "我想深入了解某个特性的实现"
1. 查看 [ARCHITECTURE.md](./ARCHITECTURE.md) 的 **关键特性实现** 部分
2. 浏览 [../src](../src) 中的源代码
3. 参考 [EXAMPLES.md](./EXAMPLES.md) 的相关示例

## 📋 API 快速查询

### 单设备模式 API

**初始化**
```typescript
new SingleDeviceBLEHandler({ config: {...} })
```

**连接**
```typescript
await handler.connectDevice(device)
await handler.disconnectDevice()
```

**数据**
```typescript
await handler.writeCharacteristicValue({ value })
await handler.readCharacteristicValue({})
handler.addCharacteristicValueChangeListener(cb)
```

→ 详见 [README.md](../README.md#主要方法) 或 [EXAMPLES.md](./EXAMPLES.md)

### 多设备模式 API

**初始化**
```typescript
new MultiDeviceBLEHandler({ config: {...} })
```

**连接**
```typescript
await handler.connectDevice(device)
await handler.disconnectDevice(deviceId)  // 需要 deviceId
```

**数据**
```typescript
await handler.writeCharacteristicValue({ deviceId, value })  // 需要 deviceId
await handler.readCharacteristicValue({ deviceId })  // 需要 deviceId
```

→ 详见 [README.md](../README.md#主要方法) 或 [EXAMPLES.md](./EXAMPLES.md)

## 🆚 单设备 vs 多设备

| 特性 | 单设备 | 多设备 |
|------|--------|--------|
| **何时使用** | 一次连接一个设备 | 同时连接多个设备 |
| **API 繁琐度** | 简洁（无需 deviceId） | 完整（需要 deviceId） |
| **示例** | 心率计、体重秤 | 传感器矩阵、多设备同步 |
| **类** | `SingleDeviceBLEHandler` | `MultiDeviceBLEHandler` |
| **文档** | [EXAMPLES.md#单设备模式](./EXAMPLES.md#单设备模式---心率计) | [EXAMPLES.md#多设备模式](./EXAMPLES.md#多设备模式---多传感器) |

## ❓ FAQ

### Q: 文档写得很长，我没时间全部看？
**A**: 
1. 先看 [README.md](../README.md) 的 **快速开始** 部分（5 分钟）
2. 需要具体示例时查看 [EXAMPLES.md](./EXAMPLES.md)（按需查看）
3. 遇到问题时搜索相关关键字

### Q: 我想看代码示例？
**A**: 查看 [EXAMPLES.md](./EXAMPLES.md)，包含 12+ 个完整示例。

### Q: 如何处理蓝牙错误？
**A**: 
1. 查看 [EXAMPLES.md#错误处理](./EXAMPLES.md#错误处理) 的异常类型说明
2. 参考 [EXAMPLES.md#完整错误处理示例](./EXAMPLES.md#完整错误处理示例)

### Q: 如何过滤蓝牙设备？
**A**: 查看 [DEVICE_FILTER_GUIDE.md](./DEVICE_FILTER_GUIDE.md)

### Q: 从旧版本升级怎么办？
**A**: 查看 [RENAME.md](./RENAME.md) 的迁移指南

### Q: 我需要跳过某些文档吗？
**A**: 根据你的需求：
- 只想快速上手？→ 只需 [README.md](../README.md)
- 想了解所有特性？→ 依次阅读所有文档
- 需要特定功能？→ 查看对应文档的目录

## 📞 获取帮助

1. **查阅文档** → 本页面有导航
2. **查看示例** → [EXAMPLES.md](./EXAMPLES.md)
3. **提交 Issue** → GitHub Issues
4. **查看源代码** → [../src](../src) 目录

## 🔄 文档版本

- **当前版本**: 2.0
- **对应代码版本**: 0.1.0+filter-refactor
- **最后更新**: 2025-12-31

## 📈 推荐阅读顺序

### 对于新用户
```
README.md (5 min)
  ↓
EXAMPLES.md - 基础使用部分 (10 min)
  ↓
根据需求选择其他文档
```

### 对于要求高级功能的用户
```
README.md (5 min)
  ↓
EXAMPLES.md (全部，30 min)
  ↓
ARCHITECTURE.md (15 min)
  ↓
DEVICE_FILTER_GUIDE.md (如需) (10 min)
```

### 对于迁移用户
```
RENAME.md (迁移对照，10 min)
  ↓
EXAMPLES.md (查看新用法，15 min)
  ↓
其他文档（如需）
```

---

**Happy Coding! 🚀**

如有任何问题，欢迎查阅文档或提交 Issue。
