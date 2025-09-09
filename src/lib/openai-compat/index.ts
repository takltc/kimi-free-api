/**
 * OpenAI API 兼容层主模块
 * @author jizhejiang
 * @date 2025-01-03
 */

import _ from 'lodash';
import { 
    OpenAIChatMessage, 
    OpenAIChatCompletionRequest,
    OpenAIChatCompletionResponse,
    OpenAIChatCompletionChunk,
    OpenAIModel,
    OpenAIModelListResponse
} from './types';
import { validateToolCalls, convertFunctionCallsToToolCalls } from './toolValidation';
import util from '@/lib/util';

/**
 * 将 OpenAI 格式的消息转换为 Kimi 格式
 */
export function formatOpenAIToKimi(messages: OpenAIChatMessage[]): any[] {
    // 先转换旧版 function_call 格式
    let processedMessages = convertFunctionCallsToToolCalls(messages);
    
    // 验证工具调用的配对关系
    processedMessages = validateToolCalls(processedMessages);
    
    // 转换为 Kimi 格式
    const kimiMessages = processedMessages.map(msg => {
        // 处理 tool 消息，转换为 user 消息的一部分
        if (msg.role === 'tool') {
            return {
                role: 'user',
                content: `Tool Response (${msg.tool_call_id}): ${msg.content}`
            };
        }
        
        // 处理包含 tool_calls 的 assistant 消息
        if (msg.role === 'assistant' && msg.tool_calls) {
            let content = msg.content || '';
            msg.tool_calls.forEach(toolCall => {
                content += `\n[调用工具: ${toolCall.function.name}]\n参数: ${toolCall.function.arguments}`;
            });
            return {
                role: 'assistant',
                content: content.trim()
            };
        }
        
        // 其他消息保持原样
        return {
            role: msg.role === 'function' ? 'user' : msg.role,
            content: msg.content || ''
        };
    });
    
    return kimiMessages;
}

/**
 * 将 Kimi 响应转换为 OpenAI 格式
 */
export function formatKimiToOpenAI(
    kimiResponse: any,
    model: string,
    includeToolCalls: boolean = false
): OpenAIChatCompletionResponse {
    // 检测响应中是否包含工具调用
    const toolCalls = includeToolCalls ? extractToolCalls(kimiResponse.choices[0]?.message?.content) : null;
    
    return {
        id: kimiResponse.id || `chatcmpl-${util.uuid()}`,
        object: 'chat.completion',
        created: kimiResponse.created || util.unixTimestamp(),
        model: model,
        choices: [{
            index: 0,
            message: {
                role: 'assistant',
                content: toolCalls ? removeToolCallsFromContent(kimiResponse.choices[0]?.message?.content) : kimiResponse.choices[0]?.message?.content,
                tool_calls: toolCalls || undefined
            },
            finish_reason: toolCalls ? 'tool_calls' : (kimiResponse.choices[0]?.finish_reason || 'stop'),
            logprobs: null
        }],
        usage: kimiResponse.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        }
    };
}

/**
 * 将 Kimi 流式响应转换为 OpenAI 格式
 */
export function formatKimiChunkToOpenAI(
    chunk: any,
    model: string
): OpenAIChatCompletionChunk {
    return {
        id: chunk.id || `chatcmpl-${util.uuid()}`,
        object: 'chat.completion.chunk',
        created: chunk.created || util.unixTimestamp(),
        model: model,
        choices: [{
            index: 0,
            delta: {
                content: chunk.choices?.[0]?.delta?.content
            },
            finish_reason: chunk.choices?.[0]?.finish_reason || null,
            logprobs: null
        }]
    };
}

/**
 * 从内容中提取工具调用
 */
function extractToolCalls(content: string): any[] | null {
    if (!content) return null;
    
    const toolCallPattern = /\[调用工具: ([^\]]+)\]\n参数: ({[^}]+})/g;
    const matches = Array.from(content.matchAll(toolCallPattern));
    
    if (matches.length === 0) return null;
    
    return matches.map((match, index) => ({
        id: `call_${util.uuid()}`,
        type: 'function' as const,
        function: {
            name: match[1],
            arguments: match[2]
        }
    }));
}

/**
 * 从内容中移除工具调用标记
 */
function removeToolCallsFromContent(content: string): string {
    if (!content) return '';
    return content.replace(/\[调用工具: [^\]]+\]\n参数: {[^}]+}/g, '').trim();
}

/**
 * 创建符合 OpenAI 规范的模型列表
 */
export function createModelList(): OpenAIModelListResponse {
    const models = [
        'moonshot-v1',
        'moonshot-v1-8k', 
        'moonshot-v1-32k',
        'moonshot-v1-128k',
        'moonshot-v1-vision',
        'kimi',
        'kimi-search',
        'kimi-research',
        'kimi-k1',
        'kimi-math',
        // Anthropic / Claude
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-3-5-sonnet-20240620'
    ];
    
    const created = 1704067200; // 2024-01-01 的时间戳
    
    return {
        object: 'list',
        data: models.map(id => ({
            id,
            object: 'model',
            created,
            owned_by: 'kimi-free-api',
            permission: [],
            root: id,
            parent: null
        }))
    };
}

/**
 * 处理 OpenAI 请求参数
 */
export function processOpenAIRequest(request: any): OpenAIChatCompletionRequest {
    const {
        model = 'kimi',
        messages = [],
        temperature,
        top_p,
        n,
        stream = false,
        stop,
        max_tokens,
        presence_penalty,
        frequency_penalty,
        logit_bias,
        user,
        tools,
        tool_choice,
        functions,
        function_call,
        response_format,
        seed,
        ...rest
    } = request;
    
    return {
        model,
        messages,
        temperature,
        top_p,
        n,
        stream,
        stop,
        max_tokens,
        presence_penalty,
        frequency_penalty,
        logit_bias,
        user,
        tools,
        tool_choice,
        functions,
        function_call,
        response_format,
        seed,
        ...rest
    };
}

export * from './types';
export { validateToolCalls, convertFunctionCallsToToolCalls } from './toolValidation';
