# 认证中间件说明

## 概述

认证中间件位于 `src/middleware/auth.ts`，用于验证 API 请求中的 Bearer token 格式。

## 功能特性

1. **Token 格式验证**
   - 检查 `Authorization` 头是否存在
   - 验证格式必须为 `Bearer sk-...`
   - 不符合格式要求的请求将返回 401 错误

2. **路径豁免**
   以下路径不需要认证：
   - `/ping` - 健康检查接口
   - `/models` - 模型列表接口
   - `/token` - Token 相关接口

3. **错误响应格式**
   当认证失败时，返回 OpenAI 兼容的错误格式：
   ```json
   {
     "error": {
       "message": "Unauthorized",
       "type": "invalid_request_error",
       "code": "401"
     }
   }
   ```

## 使用方式

### 客户端请求示例

```javascript
// 正确的请求格式
const response = await axios.post('http://localhost:8000/v1/chat/completions', {
  model: 'kimi',
  messages: [{ role: 'user', content: 'Hello' }]
}, {
  headers: {
    'Authorization': 'Bearer sk-your-actual-token-here'
  }
});
```

### Token 格式要求

- 必须使用 `Bearer` 认证方案
- Token 必须以 `sk-` 开头
- 格式：`Authorization: Bearer sk-xxxxxxxxxxxxx`

## 集成位置

认证中间件在 `src/lib/server.ts` 中挂载，执行顺序为：
1. CORS 中间件
2. 范围请求支持
3. **认证中间件** ← 在此位置
4. 异常处理中间件
5. 请求体解析中间件
6. 路由处理

## 测试

使用 `test-auth.js` 脚本可以测试认证中间件的各种场景：

```bash
node test-auth.js
```

测试场景包括：
- 无 Authorization 头的请求
- 错误格式的 Authorization 头
- Token 格式不正确（不以 sk- 开头）
- 正确格式的 Token
- 豁免路径访问

## 注意事项

1. 中间件仅验证 token 格式，不验证 token 的有效性
2. 实际的 token 有效性验证在 `chat.ts` 控制器中进行
3. Token 会被存储在 `ctx.state.token` 中供后续使用
