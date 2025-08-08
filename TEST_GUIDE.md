# Kimi Free API 测试指南

## 快速开始

### 1. 启动服务

首先确保服务正在运行：

```bash
# 构建项目
npm run build

# 启动服务
npm start
```

### 2. 运行测试

#### 运行完整的 E2E 测试
```bash
npm test
# 或
npm run test:e2e
```

#### 使用真实 token 测试
```bash
# 设置环境变量
export API_KEY="YOUR_REAL_REFRESH_TOKEN"
npm test
```

#### 运行特定测试
```bash
npm run test:auth   # 测试认证功能
npm run test:cors   # 测试CORS配置
npm run test:errors # 测试错误处理
npm run test:compat # 测试OpenAI兼容性
```

#### 运行所有测试
```bash
npm run test:all
```

## 测试覆盖范围

### E2E 完整测试 (test-e2e-complete.js)
- ✅ 普通非流式聊天
- ✅ 流式聊天（SSE格式）
- ✅ /v1/models 端点
- ✅ 认证失败场景
- ✅ 错误处理场景
- ✅ 联网搜索功能
- ✅ 多轮对话

### 认证测试 (test-auth.js)
- ✅ 无认证头请求
- ✅ 错误格式认证头
- ✅ 无效token格式
- ✅ 有效token格式
- ✅ 豁免路径访问

### CORS测试 (test-cors.js)
- ✅ OPTIONS预检请求
- ✅ 跨域POST请求
- ✅ 自定义请求头支持
- ✅ 不同源测试

### 错误处理测试 (test-openai-errors.js)
- ✅ 无效API密钥
- ✅ 缺少必需参数
- ✅ 无效路由
- ✅ OpenAI错误格式规范

## 测试环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| API_BASE_URL | API服务地址 | http://localhost:8000 |
| API_KEY | refresh_token | sk-test-token-12345 |

## 常见问题

### Q: 测试失败提示无法连接到服务
A: 确保服务已经启动，运行 `npm start` 启动服务。

### Q: 认证测试失败
A: 这是正常的，除非你提供了有效的 refresh_token。

### Q: 如何获取真实的 refresh_token？
A: 参考 README.md 中的"接入准备"章节。

## 测试报告解读

测试完成后会显示详细的测试报告：

```
📊 测试报告汇总
============================================================
测试环境: http://localhost:8000
总测试数: 25
✓ 通过: 20
✗ 失败: 5

通过率: 80.0%
```

- 100% 通过率：所有功能正常
- 80%+ 通过率：主要功能正常，部分功能可能需要有效token
- 低于80%：请检查服务配置或网络连接

## 持续集成

可以将测试集成到 CI/CD 流程中：

```yaml
# GitHub Actions 示例
- name: Run tests
  run: |
    npm run build
    npm start &
    sleep 5
    npm test
```
