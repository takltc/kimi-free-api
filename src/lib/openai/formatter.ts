/**
 * OpenAI ChatCompletion 格式化器
 * 负责在 OpenAI API 格式和内部 Kimi/Moonshot 格式之间进行转换
 * @author jizhejiang
 * @date 2025-01-03
 */

import util from '@/lib/util.ts';

/**
 * 格式化后的请求类型
 */
export interface FormattedRequest {
  model: string;
  messages: any[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: any;
}

/**
 * Token 使用统计
 */
export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * OpenAI ChatCompletion 响应格式
 */
export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: any[];
      function_call?: any;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'function_call' | null;
    logprobs?: any;
  }>;
  usage?: UsageInfo;
  system_fingerprint?: string;
}

/**
 * OpenAI 流式响应块格式
 */
export interface OpenAIChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: any[];
      function_call?: any;
    };
    finish_reason?: 'stop' | 'length' | 'tool_calls' | 'function_call' | null;
    logprobs?: any;
  }>;
  system_fingerprint?: string;
}

/**
 * 格式化请求数据
 * 将 OpenAI 格式的请求转换为适合内部 API 调用的格式
 * 
 * @param messages 消息数组
 * @param model 模型名称
 * @param stream 是否流式响应
 * @returns 格式化后的请求对象
 */
export function formatRequest(
  messages: any[],
  model: string,
  stream: boolean = false
): FormattedRequest {
  // 处理模型名称映射
  const internalModel = mapModelName(model);
  
  // 处理消息格式
  const formattedMessages = messages.map(msg => {
    // 处理不同角色的消息
    if (msg.role === 'system') {
      return {
        role: 'system',
        content: msg.content || ''
      };
    } else if (msg.role === 'user') {
      return {
        role: 'user',
        content: msg.content || ''
      };
    } else if (msg.role === 'assistant') {
      // 处理包含工具调用的助手消息
      if (msg.tool_calls || msg.function_call) {
        return {
          role: 'assistant',
          content: msg.content || '',
          tool_calls: msg.tool_calls,
          function_call: msg.function_call
        };
      }
      return {
        role: 'assistant',
        content: msg.content || ''
      };
    } else if (msg.role === 'function' || msg.role === 'tool') {
      // 函数/工具响应消息
      return {
        role: msg.role,
        content: msg.content || '',
        name: msg.name,
        tool_call_id: msg.tool_call_id
      };
    }
    
    // 默认返回原消息
    return msg;
  });
  
  return {
    model: internalModel,
    messages: formattedMessages,
    stream
  };
}

/**
 * 格式化响应数据
 * 将内部 Kimi/Moonshot 响应转换为 OpenAI ChatCompletion 格式
 * 
 * @param raw 原始响应数据
 * @param usage 可选的 token 使用统计
 * @returns OpenAI 格式的响应
 */
export function formatResponse(
  raw: any,
  usage?: UsageInfo
): OpenAIChatCompletionResponse {
  // 生成响应 ID
  const responseId = raw.id || `chatcmpl-${util.uuid(false)}`;
  
  // 获取或生成时间戳
  const created = raw.created || util.unixTimestamp();
  
  // 获取模型名称
  const model = raw.model || 'moonshot-v1';
  
  // 处理 choices
  let choices;
  if (raw.choices && Array.isArray(raw.choices)) {
    choices = raw.choices.map((choice: any, index: number) => ({
      index: choice.index !== undefined ? choice.index : index,
      message: {
        role: 'assistant',
        content: choice.message?.content || choice.delta?.content || ''
      },
      finish_reason: choice.finish_reason || 'stop',
      logprobs: choice.logprobs || null
    }));
  } else {
    // 如果没有 choices，创建默认的
    choices = [{
      index: 0,
      message: {
        role: 'assistant',
        content: raw.content || raw.text || ''
      },
      finish_reason: 'stop',
      logprobs: null
    }];
  }
  
  // 处理 usage
  const responseUsage = usage || raw.usage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0
  };
  
  return {
    id: responseId,
    object: 'chat.completion',
    created,
    model,
    choices,
    usage: responseUsage
  };
}

/**
 * 格式化流式响应块
 * 将内部流式数据块转换为 OpenAI 流式格式
 * 
 * @param chunk 流式数据块
 * @param model 模型名称
 * @returns OpenAI 格式的流式响应块
 */
export function formatStreamChunk(
  chunk: any,
  model: string
): OpenAIChatCompletionChunk {
  // 生成或使用已有的 ID
  const chunkId = chunk.id || `chatcmpl-${util.uuid(false)}`;
  
  // 获取或生成时间戳
  const created = chunk.created || util.unixTimestamp();
  
  // 处理 delta 内容
  let delta: any = {};
  let finishReason = null;
  
  if (chunk.choices && chunk.choices[0]) {
    const choice = chunk.choices[0];
    if (choice.delta) {
      delta = choice.delta;
    } else if (choice.message) {
      delta = { content: choice.message.content };
    } else if (chunk.text) {
      delta = { content: chunk.text };
    }
    finishReason = choice.finish_reason || null;
  } else if (chunk.text) {
    delta = { content: chunk.text };
  } else if (chunk.content) {
    delta = { content: chunk.content };
  }
  
  return {
    id: chunkId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index: 0,
      delta,
      finish_reason: finishReason,
      logprobs: null
    }]
  };
}

/**
 * 映射模型名称
 * 将 OpenAI 模型名称映射到内部使用的模型名称
 * 
 * @param openaiModel OpenAI 模型名称
 * @returns 内部模型名称
 */
function mapModelName(openaiModel: string): string {
  // 模型映射表
  const modelMap: { [key: string]: string } = {
    'gpt-3.5-turbo': 'moonshot-v1-8k',
    'gpt-3.5-turbo-16k': 'moonshot-v1-32k',
    'gpt-4': 'moonshot-v1-32k',
    'gpt-4-32k': 'moonshot-v1-128k',
    'gpt-4-turbo': 'moonshot-v1-128k',
    'gpt-4-vision-preview': 'moonshot-v1-vision'
  };
  
  // 如果有映射则返回映射值，否则返回原值
  return modelMap[openaiModel] || openaiModel;
}

/**
 * 计算 token 使用量（简化版）
 * 实际应用中可能需要更精确的计算方法
 * 
 * @param text 文本内容
 * @returns 估算的 token 数量
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  
  // 简单估算：平均每 4 个字符为 1 个 token
  // 中文字符通常占用更多 tokens
  const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherCharCount = text.length - chineseCharCount;
  
  // 中文字符约 2 个字符 1 个 token，其他字符约 4 个字符 1 个 token
  return Math.ceil(chineseCharCount / 2 + otherCharCount / 4);
}

/**
 * 创建错误响应
 * 生成 OpenAI 格式的错误响应
 * 
 * @param error 错误信息
 * @param model 模型名称
 * @returns OpenAI 格式的错误响应
 */
export function formatErrorResponse(
  error: string | Error,
  model: string = 'moonshot-v1'
): OpenAIChatCompletionResponse {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  return {
    id: `chatcmpl-${util.uuid(false)}`,
    object: 'chat.completion',
    created: util.unixTimestamp(),
    model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: `Error: ${errorMessage}`
      },
      finish_reason: 'stop',
      logprobs: null
    }],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
}

export default {
  formatRequest,
  formatResponse,
  formatStreamChunk,
  estimateTokens,
  formatErrorResponse
};
