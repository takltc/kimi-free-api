/**
 * 认证中间件
 * @author jizhejiang
 * @date 2025-08-07 23:30:16
 * @description 处理 Bearer token 认证，验证 Authorization 头格式
 */

import { Context, Next } from 'koa';
import logger from '@/lib/logger.ts';
import { OpenAIErrorMapper, OpenAIErrorType } from '@/lib/openai/errors.ts';
import HTTP_STATUS_CODES from '@/lib/http-status-codes.ts';

/**
 * 需要跳过认证的路径列表
 */
const SKIP_AUTH_PATHS = [
  '/ping',
  '/models',
  '/token'
];

/**
 * 认证中间件
 * 验证请求中的 Authorization 头，格式必须为 "Bearer <token>"
 * 
 * @param ctx Koa 上下文
 * @param next 下一个中间件
 */
export default async function authMiddleware(ctx: Context, next: Next) {
  // 获取请求路径
  const path = ctx.path;
  
  // 检查是否需要跳过认证
  const shouldSkipAuth = SKIP_AUTH_PATHS.some(skipPath => 
    path.includes(skipPath)
  );
  
  if (shouldSkipAuth) {
    logger.debug(`Skipping auth for path: ${path}`);
    return await next();
  }
  
  // 获取 Authorization 头
  const authorization = ctx.headers.authorization || ctx.headers.Authorization;
  
  // 检查 Authorization 头是否存在
  if (!authorization) {
    logger.warn(`Missing Authorization header for path: ${path} from ${ctx.ip}`);
    
    // 根据路径判断是否使用OpenAI格式
    if (path.startsWith('/v1/')) {
      const { error, httpStatusCode } = OpenAIErrorMapper.createError(
        'Missing authentication credentials',
        OpenAIErrorType.AUTHENTICATION_ERROR,
        HTTP_STATUS_CODES.UNAUTHORIZED,
        'Authorization',
        'invalid_api_key'
      );
      ctx.status = httpStatusCode;
      ctx.body = error;
    } else {
      ctx.status = 401;
      ctx.body = {
        code: -2001,
        message: "未提供认证信息"
      };
    }
    return;
  }
  
  // 检查 Authorization 格式
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  
  if (!bearerMatch) {
    logger.warn(`Invalid Authorization format for path: ${path} from ${ctx.ip}`);
    
    // 根据路径判断是否使用OpenAI格式
    if (path.startsWith('/v1/')) {
      const { error, httpStatusCode } = OpenAIErrorMapper.createError(
        'Invalid authorization header format. Expected format: Bearer YOUR_API_KEY',
        OpenAIErrorType.AUTHENTICATION_ERROR,
        HTTP_STATUS_CODES.UNAUTHORIZED,
        'Authorization',
        'invalid_api_key'
      );
      ctx.status = httpStatusCode;
      ctx.body = error;
    } else {
      ctx.status = 401;
      ctx.body = {
        code: -2001,
        message: "认证头格式错误"
      };
    }
    return;
  }
  
  const token = bearerMatch[1];
  
  // 将 token 存储在 ctx.state 中供后续使用（不再验证 sk- 前缀）
  ctx.state.token = token;
  ctx.state.authorization = authorization;
  
  logger.debug(`Auth passed for path: ${path}`);
  
  // 继续执行下一个中间件
  await next();
}
