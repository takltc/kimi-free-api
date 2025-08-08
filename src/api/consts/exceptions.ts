export default {
    API_TEST: [-9999, 'API异常错误'],
    API_REQUEST_PARAMS_INVALID: [-2000, '请求参数非法'],
    API_REQUEST_FAILED: [-2001, '请求失败'],
    API_TOKEN_EXPIRES: [-2002, 'Token已失效'],
    API_FILE_URL_INVALID: [-2003, '远程文件URL非法'],
    API_FILE_EXECEEDS_SIZE: [-2004, '远程文件超出大小'],
    API_CHAT_STREAM_PUSHING: [-2005, '已有对话流正在输出'],
    API_RESEARCH_EXCEEDS_LIMIT: [-2006, '探索版使用量已达到上限'],
    
    // 新增OpenAI兼容错误类型
    API_INVALID_API_KEY: [-2001, '无效的API密钥'],
    API_EXPIRED_API_KEY: [-2002, 'API密钥已过期'],
    API_PERMISSION_DENIED: [-2003, '权限被拒绝'],
    API_RATE_LIMIT_EXCEEDED: [-2004, '请求速率超限'],
    API_QUOTA_EXCEEDED: [-2005, '配额已超限'],
    API_MODEL_NOT_FOUND: [-2006, '模型未找到'],
    API_CONTEXT_LENGTH_EXCEEDED: [-2007, '上下文长度超限'],
    API_SERVICE_UNAVAILABLE: [-2008, '服务暂时不可用'],
    API_TIMEOUT: [-2009, '请求超时'],
    API_CONNECTION_ERROR: [-2010, '连接错误'],
    API_INTERNAL_ERROR: [-2011, '内部服务器错误'],
    API_INVALID_REQUEST: [-2012, '无效的请求格式'],
    API_MISSING_REQUIRED_PARAM: [-2013, '缺少必需的参数'],
    
    // 文件相关错误
    API_FILE_NOT_FOUND: [-2100, '文件未找到'],
    API_FILE_READ_ERROR: [-2101, '文件读取错误'],
    API_FILE_FORMAT_ERROR: [-2102, '文件格式错误'],
    API_FILE_UPLOAD_ERROR: [-2103, '文件上传错误'],
    API_FILE_DOWNLOAD_ERROR: [-2104, '文件下载错误'],
    API_FILE_PROCESSING_ERROR: [-2105, '文件处理错误']
} as Record<string, [number, string]>
