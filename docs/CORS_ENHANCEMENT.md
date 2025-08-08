# CORS 增强配置文档

## 概述

本文档描述了对 kimi-free-api 项目的 CORS（跨源资源共享）支持的增强实现。

**作者**: jizhejiang  
**日期**: 2025-08-07 23:39:47  
**版本**: 1.0.0

## 增强内容

### 1. 扩展 CORS 配置

#### 1.1 支持的自定义请求头

增强后的 CORS 配置支持以下请求头：

- `Content-Type` - 内容类型
- `Authorization` - OpenAI 标准认证头
- `OpenAI-Organization` - OpenAI 组织标识头
- `X-Requested-With` - AJAX 请求标识
- `Accept` - 接受的响应类型
- `Accept-Version` - API 版本
- `Content-Length` - 内容长度
- `Content-MD5` - 内容校验
- `Date` - 请求日期
- `X-Api-Version` - API 版本
- `X-CSRF-Token` - CSRF 令牌

#### 1.2 支持的 HTTP 方法

配置支持以下 HTTP 方法：
- GET
- POST
- PUT
- DELETE
- OPTIONS
- PATCH
- HEAD

#### 1.3 动态源处理

CORS 配置使用动态源处理策略：
- 如果请求包含 `Origin` 头，则返回该源
- 如果没有 `Origin` 头，则返回 `*`（允许所有源）

#### 1.4 凭证支持

配置启用了 `credentials: true`，允许跨域请求携带凭证（如 cookies、HTTP 认证等）。

#### 1.5 预检请求缓存

设置 `maxAge: 86400`（24小时），浏览器可以缓存预检请求结果，减少不必要的 OPTIONS 请求。

### 2. OPTIONS 预检快速响应

#### 2.1 实现原理

添加了专门的中间件来处理 OPTIONS 预检请求：
- 检测到 OPTIONS 方法时，立即返回 204 状态码
- 不执行后续中间件，提高响应速度
- 避免 OPTIONS 请求进入认证流程

#### 2.2 中间件执行顺序

```
1. koaCors (CORS 处理，设置响应头)
2. OPTIONS 快速响应中间件（返回 204）
3. koaRange (范围请求支持)
4. authMiddleware (认证)
5. 其他业务中间件...
```

## 实现文件

主要修改的文件：
- `/src/lib/server.ts` - 服务器配置文件，包含 CORS 和 OPTIONS 处理逻辑

## 测试方法

### 1. 使用测试脚本

项目提供了 `test-cors.js` 测试脚本，可以验证 CORS 配置：

```bash
# 启动服务器
npm run dev

# 在另一个终端运行测试
node test-cors.js

# 或指定自定义 API 地址
API_BASE_URL=http://your-api-url:port node test-cors.js
```

### 2. 使用 curl 测试

#### 测试 OPTIONS 预检请求：

```bash
curl -i -X OPTIONS http://localhost:8000/v1/chat/completions \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, OpenAI-Organization"
```

预期响应：
- 状态码: 204 No Content
- 包含 `Access-Control-Allow-Headers` 头，其中包含 `Authorization` 和 `OpenAI-Organization`
- 包含 `Access-Control-Allow-Origin` 头

#### 测试带自定义头的 POST 请求：

```bash
curl -i -X POST http://localhost:8000/v1/chat/completions \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-token" \
  -H "OpenAI-Organization: org-your-org" \
  -d '{"model":"kimi","messages":[{"role":"user","content":"Hello"}]}'
```

### 3. 浏览器测试

在浏览器控制台中执行：

```javascript
fetch('http://localhost:8000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-test',
    'OpenAI-Organization': 'org-test'
  },
  body: JSON.stringify({
    model: 'kimi',
    messages: [{ role: 'user', content: 'Test' }]
  })
})
.then(response => console.log('Response:', response))
.catch(error => console.error('Error:', error));
```

## 兼容性

### OpenAI SDK 兼容性

增强后的 CORS 配置完全兼容 OpenAI 官方 SDK 和第三方客户端：
- 支持 `Authorization` 头用于 API 密钥认证
- 支持 `OpenAI-Organization` 头用于组织标识
- 快速响应 OPTIONS 预检请求，减少延迟

### 浏览器兼容性

支持所有现代浏览器的 CORS 标准：
- Chrome 4+
- Firefox 3.5+
- Safari 4+
- Edge 12+
- Opera 12+

## 安全考虑

1. **动态源处理**: 虽然支持动态源，但在生产环境中建议限制允许的源列表
2. **凭证安全**: 启用了凭证支持，确保只在 HTTPS 环境下使用
3. **请求头验证**: 认证中间件会验证 Authorization 头的格式和有效性

## 故障排除

### 问题 1: OPTIONS 请求返回 401

**原因**: OPTIONS 请求进入了认证中间件  
**解决**: 确保 OPTIONS 处理中间件在认证中间件之前

### 问题 2: 浏览器报 CORS 错误

**原因**: 请求头未在允许列表中  
**解决**: 检查 `allowHeaders` 配置，添加所需的请求头

### 问题 3: 预检请求频繁

**原因**: maxAge 设置过小或未设置  
**解决**: 已设置为 86400 秒（24小时），可根据需要调整

## 未来改进

1. 支持配置文件中自定义 CORS 设置
2. 支持白名单/黑名单源管理
3. 添加 CORS 请求日志和监控
4. 支持更细粒度的路径级 CORS 配置

## 参考资料

- [MDN CORS 文档](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [koa2-cors 文档](https://www.npmjs.com/package/koa2-cors)
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)
