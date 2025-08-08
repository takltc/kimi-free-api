# 错误处理规范化文档

## 概述

本系统实现了双重错误格式支持：
- **OpenAI兼容格式**：用于 `/v1/*` 路径下的所有API
- **传统格式**：用于其他路径

## OpenAI错误格式

### 结构

```json
{
  "error": {
    "message": "错误消息",
    "type": "错误类型",
    "param": "相关参数（可选）",
    "code": "错误代码（可选）"
  }
}
```

### 错误类型

| 类型 | 说明 | HTTP状态码 |
|------|------|------------|
| `invalid_api_key` | 无效的API密钥 | 401 |
| `authentication_error` | 认证错误 | 401 |
| `permission_error` | 权限错误 | 403 |
| `rate_limit_error` | 速率限制 | 429 |
| `quota_exceeded_error` | 配额超限 | 429 |
| `invalid_request` | 无效请求 | 400 |
| `model_not_found` | 模型未找到 | 404 |
| `context_length_exceeded` | 上下文超长 | 400 |
| `service_unavailable` | 服务不可用 | 503 |
| `timeout_error` | 请求超时 | 504 |
| `connection_error` | 连接错误 | 502 |
| `api_error` | API错误 | 500 |

### 错误代码映射

| 内部错误码 | OpenAI错误类型 | HTTP状态码 | 错误代码 |
|-----------|---------------|-----------|----------|
| -1000 | internal_server_error | 500 | - |
| -1001 | invalid_request | 400 | - |
| -1002 | invalid_request | 404 | - |
| -2001 | authentication_error | 401 | invalid_api_key |
| -2002 | authentication_error | 401 | expired_api_key |
| -2003 | permission_error | 403 | - |
| -2004 | rate_limit_error | 429 | rate_limit_exceeded |
| -2005 | quota_exceeded_error | 429 | quota_exceeded |
| -2006 | model_not_found | 404 | model_not_found |
| -2007 | context_length_exceeded | 400 | context_length_exceeded |
| -2008 | service_unavailable | 503 | - |
| -2009 | timeout_error | 504 | timeout |
| -2010 | connection_error | 502 | connection_error |

## 传统错误格式

### 结构

```json
{
  "code": -1000,
  "message": "错误消息",
  "data": null
}
```

## 使用示例

### 在控制器中抛出OpenAI兼容错误

```typescript
import APIException from '@/lib/exceptions/APIException.ts';
import API_EX from '@/api/consts/exceptions.ts';

// 抛出认证错误
throw new APIException(API_EX.API_INVALID_API_KEY, '无效的API密钥');

// 抛出速率限制错误
throw new APIException(API_EX.API_RATE_LIMIT_EXCEEDED, '请求过于频繁');
```

### 手动创建OpenAI错误响应

```typescript
import { OpenAIErrorMapper, OpenAIErrorType } from '@/lib/openai/errors.ts';
import HTTP_STATUS_CODES from '@/lib/http-status-codes.ts';

const { error, httpStatusCode } = OpenAIErrorMapper.createError(
  '错误消息',
  OpenAIErrorType.INVALID_REQUEST,
  HTTP_STATUS_CODES.BAD_REQUEST,
  'messages',  // 参数名
  'invalid_format'  // 错误代码
);

ctx.status = httpStatusCode;
ctx.body = error;
```

## 测试

运行测试脚本验证错误格式：

```bash
node test-openai-errors.js
```

## 注意事项

1. **路径识别**：系统自动根据请求路径判断使用哪种错误格式
   - `/v1/*` 路径：OpenAI格式
   - 其他路径：传统格式

2. **HTTP状态码**：错误响应会自动设置对应的HTTP状态码

3. **错误日志**：所有错误都会记录到日志系统

4. **向后兼容**：传统API路径仍然返回原有格式，确保兼容性

## 扩展

如需添加新的错误类型：

1. 在 `src/api/consts/exceptions.ts` 中添加新的错误定义
2. 在 `src/lib/openai/errors.ts` 的 `ERROR_CODE_MAPPING` 中添加映射
3. 必要时扩展 `OpenAIErrorType` 枚举

## 相关文件

- `src/lib/openai/errors.ts` - OpenAI错误格式映射器
- `src/lib/response/FailureBody.ts` - 错误响应体
- `src/lib/server.ts` - 全局异常拦截
- `src/middleware/auth.ts` - 认证中间件错误处理
- `src/api/consts/exceptions.ts` - API异常定义
- `test-openai-errors.js` - 错误格式测试脚本
