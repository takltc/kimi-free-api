/**
 * OpenAI 工具调用验证模块
 * @author jizhejiang
 * @date 2025-01-03
 */

import { OpenAIChatMessage } from './types';

/**
 * 验证并清理 OpenAI 格式的工具调用消息
 * 确保 tool_calls 和 tool messages 正确配对
 * 移除没有对应响应的 tool_calls
 * 移除没有对应调用的 tool messages
 */
export function validateToolCalls(messages: OpenAIChatMessage[]): OpenAIChatMessage[] {
    const validatedMessages: OpenAIChatMessage[] = [];
    
    for (let i = 0; i < messages.length; i++) {
        const currentMessage = { ...messages[i] };
        
        // 处理包含 tool_calls 的 assistant 消息
        if (currentMessage.role === 'assistant' && currentMessage.tool_calls) {
            const validToolCalls: typeof currentMessage.tool_calls = [];
            
            // 收集紧随其后的所有 tool 消息
            const immediateToolMessages: OpenAIChatMessage[] = [];
            let j = i + 1;
            while (j < messages.length && messages[j].role === 'tool') {
                immediateToolMessages.push(messages[j]);
                j++;
            }
            
            // 验证每个 tool_call 是否有对应的 tool 消息
            currentMessage.tool_calls.forEach(toolCall => {
                const hasMatchingToolMessage = immediateToolMessages.some(
                    toolMsg => toolMsg.tool_call_id === toolCall.id
                );
                
                if (hasMatchingToolMessage) {
                    validToolCalls.push(toolCall);
                }
            });
            
            // 更新 assistant 消息
            if (validToolCalls.length > 0) {
                currentMessage.tool_calls = validToolCalls;
            } else {
                delete currentMessage.tool_calls;
            }
            
            // 只有当消息有内容或有效的 tool_calls 时才包含它
            if (currentMessage.content || currentMessage.tool_calls) {
                validatedMessages.push(currentMessage);
            }
        }
        // 处理 tool 消息
        else if (currentMessage.role === 'tool') {
            let hasMatchingToolCall = false;
            
            // 检查前面的 assistant 消息是否有匹配的 tool_call
            if (i > 0) {
                const prevMessage = messages[i - 1];
                if (prevMessage.role === 'assistant' && prevMessage.tool_calls) {
                    hasMatchingToolCall = prevMessage.tool_calls.some(
                        toolCall => toolCall.id === currentMessage.tool_call_id
                    );
                } else if (prevMessage.role === 'tool') {
                    // 向前查找包含 tool_calls 的 assistant 消息
                    for (let k = i - 1; k >= 0; k--) {
                        if (messages[k].role === 'tool') continue;
                        if (messages[k].role === 'assistant' && messages[k].tool_calls) {
                            hasMatchingToolCall = messages[k].tool_calls!.some(
                                toolCall => toolCall.id === currentMessage.tool_call_id
                            );
                        }
                        break;
                    }
                }
            }
            
            if (hasMatchingToolCall) {
                validatedMessages.push(currentMessage);
            }
        }
        // 其他类型的消息原样保留
        else {
            validatedMessages.push(currentMessage);
        }
    }
    
    return validatedMessages;
}

/**
 * 将旧版 function_call 格式转换为新版 tool_calls 格式
 */
export function convertFunctionCallsToToolCalls(messages: OpenAIChatMessage[]): OpenAIChatMessage[] {
    return messages.map(message => {
        if (message.role === 'assistant' && message.function_call && !message.tool_calls) {
            return {
                ...message,
                tool_calls: [{
                    id: `call_${generateId()}`,
                    type: 'function' as const,
                    function: message.function_call
                }],
                function_call: undefined
            };
        }
        
        if (message.role === 'function') {
            // 转换 function 角色为 tool 角色
            return {
                ...message,
                role: 'tool' as const,
                tool_call_id: message.name || `call_${generateId()}`
            };
        }
        
        return message;
    });
}

/**
 * 生成随机 ID
 */
function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}
