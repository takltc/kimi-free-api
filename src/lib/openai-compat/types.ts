/**
 * OpenAI API 兼容类型定义
 * @author jizhejiang
 * @date 2025-01-03
 */

// OpenAI 聊天消息格式
export interface OpenAIChatMessage {
    role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
    content?: string | null;
    name?: string;
    // 工具调用（assistant消息）
    tool_calls?: {
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }[];
    // 工具响应（tool消息）
    tool_call_id?: string;
    // 旧版函数调用格式（已弃用但需支持）
    function_call?: {
        name: string;
        arguments: string;
    };
}

// OpenAI 工具定义
export interface OpenAITool {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters?: any;
    };
}

// OpenAI 聊天完成请求
export interface OpenAIChatCompletionRequest {
    model: string;
    messages: OpenAIChatMessage[];
    temperature?: number;
    top_p?: number;
    n?: number;
    stream?: boolean;
    stop?: string | string[];
    max_tokens?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    logit_bias?: { [key: string]: number };
    user?: string;
    // 工具相关
    tools?: OpenAITool[];
    tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
    // 旧版函数调用（已弃用但需支持）
    functions?: any[];
    function_call?: 'none' | 'auto' | { name: string };
    // 其他
    response_format?: { type: 'text' | 'json_object' };
    seed?: number;
}

// OpenAI 聊天完成响应
export interface OpenAIChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: {
        index: number;
        message: {
            role: 'assistant';
            content?: string | null;
            tool_calls?: {
                id: string;
                type: 'function';
                function: {
                    name: string;
                    arguments: string;
                };
            }[];
            function_call?: {
                name: string;
                arguments: string;
            };
        };
        finish_reason: 'stop' | 'length' | 'tool_calls' | 'function_call' | null;
        logprobs?: any;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    system_fingerprint?: string;
}

// OpenAI 流式响应块
export interface OpenAIChatCompletionChunk {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: {
        index: number;
        delta: {
            role?: 'assistant';
            content?: string;
            tool_calls?: {
                index?: number;
                id?: string;
                type?: 'function';
                function?: {
                    name?: string;
                    arguments?: string;
                };
            }[];
            function_call?: {
                name?: string;
                arguments?: string;
            };
        };
        finish_reason?: 'stop' | 'length' | 'tool_calls' | 'function_call' | null;
        logprobs?: any;
    }[];
    system_fingerprint?: string;
}

// 模型信息
export interface OpenAIModel {
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
    permission?: any[];
    root?: string;
    parent?: string | null;
}

// 模型列表响应
export interface OpenAIModelListResponse {
    object: 'list';
    data: OpenAIModel[];
}
