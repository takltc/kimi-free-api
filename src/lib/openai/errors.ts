/**
 * OpenAI错误格式映射器
 * 
 * 用于将内部异常转换为OpenAI API兼容的错误格式
 * 
 * @author jizhejiang
 * @date 2025-08-07 23:46:02
 */

import Exception from '../exceptions/Exception.js';
import APIException from '../exceptions/APIException.js';
import EX from '../consts/exceptions.js';
import API_EX from '../../api/consts/exceptions.js';
import HTTP_STATUS_CODES from '../http-status-codes.js';

/**
 * OpenAI API错误格式
 */
export interface OpenAIError {
  error: {
    message: string;
    type: string;
    param?: string | null;
    code?: string | null;
  };
}

/**
 * OpenAI错误类型枚举
 */
export enum OpenAIErrorType {
  // 认证相关
  INVALID_API_KEY = 'invalid_api_key',
  INVALID_REQUEST_ERROR = 'invalid_request_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  PERMISSION_ERROR = 'permission_error',
  
  // 速率限制
  RATE_LIMIT_ERROR = 'rate_limit_error',
  QUOTA_EXCEEDED_ERROR = 'quota_exceeded_error',
  
  // 服务器错误
  API_ERROR = 'api_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  INTERNAL_SERVER_ERROR = 'internal_server_error',
  
  // 请求错误
  INVALID_REQUEST = 'invalid_request',
  MODEL_NOT_FOUND = 'model_not_found',
  CONTEXT_LENGTH_EXCEEDED = 'context_length_exceeded',
  
  // 其他
  TIMEOUT_ERROR = 'timeout_error',
  CONNECTION_ERROR = 'connection_error'
}

/**
 * 错误码映射表
 * 
 * 将内部错误码映射到OpenAI错误类型和HTTP状态码
 */
const ERROR_CODE_MAPPING: Record<number, { type: OpenAIErrorType; httpStatus: number; code?: string }> = {
  // 系统错误 -1000 ~ -1999
  [-1000]: { type: OpenAIErrorType.INTERNAL_SERVER_ERROR, httpStatus: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR },
  [-1001]: { type: OpenAIErrorType.INVALID_REQUEST, httpStatus: HTTP_STATUS_CODES.BAD_REQUEST },
  [-1002]: { type: OpenAIErrorType.INVALID_REQUEST, httpStatus: HTTP_STATUS_CODES.NOT_FOUND },
  
  // API错误 -2000 ~ -2999
  [-2001]: { type: OpenAIErrorType.AUTHENTICATION_ERROR, httpStatus: HTTP_STATUS_CODES.UNAUTHORIZED, code: 'invalid_api_key' },
  [-2002]: { type: OpenAIErrorType.AUTHENTICATION_ERROR, httpStatus: HTTP_STATUS_CODES.UNAUTHORIZED, code: 'expired_api_key' },
  [-2003]: { type: OpenAIErrorType.PERMISSION_ERROR, httpStatus: HTTP_STATUS_CODES.FORBIDDEN },
  [-2004]: { type: OpenAIErrorType.RATE_LIMIT_ERROR, httpStatus: HTTP_STATUS_CODES.TOO_MANY_REQUESTS, code: 'rate_limit_exceeded' },
  [-2005]: { type: OpenAIErrorType.QUOTA_EXCEEDED_ERROR, httpStatus: HTTP_STATUS_CODES.TOO_MANY_REQUESTS, code: 'quota_exceeded' },
  [-2006]: { type: OpenAIErrorType.MODEL_NOT_FOUND, httpStatus: HTTP_STATUS_CODES.NOT_FOUND, code: 'model_not_found' },
  [-2007]: { type: OpenAIErrorType.CONTEXT_LENGTH_EXCEEDED, httpStatus: HTTP_STATUS_CODES.BAD_REQUEST, code: 'context_length_exceeded' },
  [-2008]: { type: OpenAIErrorType.SERVICE_UNAVAILABLE, httpStatus: HTTP_STATUS_CODES.SERVICE_UNAVAILABLE },
  [-2009]: { type: OpenAIErrorType.TIMEOUT_ERROR, httpStatus: HTTP_STATUS_CODES.GATEWAY_TIMEOUT, code: 'timeout' },
  [-2010]: { type: OpenAIErrorType.CONNECTION_ERROR, httpStatus: HTTP_STATUS_CODES.BAD_GATEWAY, code: 'connection_error' },
  [-2011]: { type: OpenAIErrorType.API_ERROR, httpStatus: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR },
  [-2012]: { type: OpenAIErrorType.INVALID_REQUEST_ERROR, httpStatus: HTTP_STATUS_CODES.BAD_REQUEST },
  [-2013]: { type: OpenAIErrorType.INVALID_REQUEST_ERROR, httpStatus: HTTP_STATUS_CODES.BAD_REQUEST },
  [-2100]: { type: OpenAIErrorType.API_ERROR, httpStatus: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR },
  [-2101]: { type: OpenAIErrorType.API_ERROR, httpStatus: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR },
  [-2102]: { type: OpenAIErrorType.API_ERROR, httpStatus: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR },
  [-2103]: { type: OpenAIErrorType.API_ERROR, httpStatus: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR },
  [-2104]: { type: OpenAIErrorType.API_ERROR, httpStatus: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR },
  [-2105]: { type: OpenAIErrorType.API_ERROR, httpStatus: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR }
};

/**
 * OpenAI错误映射器类
 */
export class OpenAIErrorMapper {
  
  /**
   * 将内部异常转换为OpenAI错误格式
   * 
   * @param error 内部异常
   * @param param 可选的参数名称（用于指示哪个参数导致了错误）
   * @returns OpenAI错误对象和HTTP状态码
   */
  static mapError(error: Error | Exception | APIException | any, param?: string): { 
    error: OpenAIError; 
    httpStatusCode: number 
  } {
    // 处理Exception或APIException
    if (error instanceof Exception || error instanceof APIException) {
      const mapping = ERROR_CODE_MAPPING[error.errcode];
      
      if (mapping) {
        return {
          error: {
            error: {
              message: error.errmsg || error.message,
              type: mapping.type,
              param: param || null,
              code: mapping.code || null
            }
          },
          httpStatusCode: error.httpStatusCode || mapping.httpStatus
        };
      }
      
      // 没有找到映射，使用默认值
      return {
        error: {
          error: {
            message: error.errmsg || error.message,
            type: OpenAIErrorType.API_ERROR,
            param: param || null,
            code: 'internal_error'
          }
        },
        httpStatusCode: error.httpStatusCode || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
      };
    }
    
    // 处理普通Error对象
    if (error instanceof Error) {
      // 尝试从错误消息推断错误类型
      const errorType = this.inferErrorType(error.message);
      const httpStatus = this.inferHttpStatus(errorType);
      
      return {
        error: {
          error: {
            message: error.message,
            type: errorType,
            param: param || null,
            code: this.inferErrorCode(errorType)
          }
        },
        httpStatusCode: httpStatus
      };
    }
    
    // 处理字符串错误
    if (typeof error === 'string') {
      return {
        error: {
          error: {
            message: error,
            type: OpenAIErrorType.API_ERROR,
            param: param || null,
            code: null
          }
        },
        httpStatusCode: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
      };
    }
    
    // 处理未知类型错误
    return {
      error: {
        error: {
          message: 'An unknown error occurred',
          type: OpenAIErrorType.API_ERROR,
          param: param || null,
          code: 'unknown_error'
        }
      },
      httpStatusCode: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    };
  }
  
  /**
   * 从错误消息推断错误类型
   * 
   * @param message 错误消息
   * @returns OpenAI错误类型
   */
  private static inferErrorType(message: string): OpenAIErrorType {
    const lowercaseMessage = message.toLowerCase();
    
    // 认证相关
    if (lowercaseMessage.includes('api key') || lowercaseMessage.includes('api_key')) {
      return OpenAIErrorType.INVALID_API_KEY;
    }
    if (lowercaseMessage.includes('authentication') || lowercaseMessage.includes('unauthorized')) {
      return OpenAIErrorType.AUTHENTICATION_ERROR;
    }
    if (lowercaseMessage.includes('permission') || lowercaseMessage.includes('forbidden')) {
      return OpenAIErrorType.PERMISSION_ERROR;
    }
    
    // 速率限制
    if (lowercaseMessage.includes('rate limit')) {
      return OpenAIErrorType.RATE_LIMIT_ERROR;
    }
    if (lowercaseMessage.includes('quota')) {
      return OpenAIErrorType.QUOTA_EXCEEDED_ERROR;
    }
    
    // 请求错误
    if (lowercaseMessage.includes('invalid request') || lowercaseMessage.includes('bad request')) {
      return OpenAIErrorType.INVALID_REQUEST;
    }
    if (lowercaseMessage.includes('model not found') || lowercaseMessage.includes('model_not_found')) {
      return OpenAIErrorType.MODEL_NOT_FOUND;
    }
    if (lowercaseMessage.includes('context length') || lowercaseMessage.includes('token limit')) {
      return OpenAIErrorType.CONTEXT_LENGTH_EXCEEDED;
    }
    
    // 连接错误
    if (lowercaseMessage.includes('timeout')) {
      return OpenAIErrorType.TIMEOUT_ERROR;
    }
    if (lowercaseMessage.includes('connection')) {
      return OpenAIErrorType.CONNECTION_ERROR;
    }
    
    // 服务不可用
    if (lowercaseMessage.includes('service unavailable') || lowercaseMessage.includes('temporarily unavailable')) {
      return OpenAIErrorType.SERVICE_UNAVAILABLE;
    }
    
    // 默认为API错误
    return OpenAIErrorType.API_ERROR;
  }
  
  /**
   * 根据错误类型推断HTTP状态码
   * 
   * @param errorType OpenAI错误类型
   * @returns HTTP状态码
   */
  private static inferHttpStatus(errorType: OpenAIErrorType): number {
    switch (errorType) {
      case OpenAIErrorType.INVALID_API_KEY:
      case OpenAIErrorType.AUTHENTICATION_ERROR:
        return HTTP_STATUS_CODES.UNAUTHORIZED;
        
      case OpenAIErrorType.PERMISSION_ERROR:
        return HTTP_STATUS_CODES.FORBIDDEN;
        
      case OpenAIErrorType.RATE_LIMIT_ERROR:
      case OpenAIErrorType.QUOTA_EXCEEDED_ERROR:
        return HTTP_STATUS_CODES.TOO_MANY_REQUESTS;
        
      case OpenAIErrorType.INVALID_REQUEST:
      case OpenAIErrorType.INVALID_REQUEST_ERROR:
      case OpenAIErrorType.CONTEXT_LENGTH_EXCEEDED:
        return HTTP_STATUS_CODES.BAD_REQUEST;
        
      case OpenAIErrorType.MODEL_NOT_FOUND:
        return HTTP_STATUS_CODES.NOT_FOUND;
        
      case OpenAIErrorType.SERVICE_UNAVAILABLE:
        return HTTP_STATUS_CODES.SERVICE_UNAVAILABLE;
        
      case OpenAIErrorType.TIMEOUT_ERROR:
        return HTTP_STATUS_CODES.GATEWAY_TIMEOUT;
        
      case OpenAIErrorType.CONNECTION_ERROR:
        return HTTP_STATUS_CODES.BAD_GATEWAY;
        
      case OpenAIErrorType.API_ERROR:
      case OpenAIErrorType.INTERNAL_SERVER_ERROR:
      default:
        return HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
    }
  }
  
  /**
   * 根据错误类型推断错误代码
   * 
   * @param errorType OpenAI错误类型
   * @returns 错误代码
   */
  private static inferErrorCode(errorType: OpenAIErrorType): string | null {
    switch (errorType) {
      case OpenAIErrorType.INVALID_API_KEY:
        return 'invalid_api_key';
      case OpenAIErrorType.RATE_LIMIT_ERROR:
        return 'rate_limit_exceeded';
      case OpenAIErrorType.QUOTA_EXCEEDED_ERROR:
        return 'quota_exceeded';
      case OpenAIErrorType.MODEL_NOT_FOUND:
        return 'model_not_found';
      case OpenAIErrorType.CONTEXT_LENGTH_EXCEEDED:
        return 'context_length_exceeded';
      case OpenAIErrorType.TIMEOUT_ERROR:
        return 'timeout';
      case OpenAIErrorType.CONNECTION_ERROR:
        return 'connection_error';
      default:
        return null;
    }
  }
  
  /**
   * 创建OpenAI格式的错误响应
   * 
   * @param message 错误消息
   * @param type 错误类型
   * @param httpStatus HTTP状态码
   * @param param 可选的参数名称
   * @param code 可选的错误代码
   * @returns OpenAI错误响应
   */
  static createError(
    message: string,
    type: OpenAIErrorType = OpenAIErrorType.API_ERROR,
    httpStatus: number = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    param?: string,
    code?: string
  ): { error: OpenAIError; httpStatusCode: number } {
    return {
      error: {
        error: {
          message,
          type,
          param: param || null,
          code: code || null
        }
      },
      httpStatusCode: httpStatus
    };
  }
}

export default OpenAIErrorMapper;
