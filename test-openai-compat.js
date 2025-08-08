/**
 * OpenAI 兼容性测试脚本
 * @author jizhejiang
 * @date 2025-01-03
 */

const axios = require('axios');

const API_BASE = 'http://localhost:8000/v1';
const API_KEY = 'YOUR_REFRESH_TOKEN_HERE'; // 替换为实际的 refresh_token

async function testModelsAPI() {
    console.log('\n========== 测试 /v1/models API ==========');
    try {
        const response = await axios.get(`${API_BASE}/models`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });
        
        console.log('响应状态:', response.status);
        console.log('响应数据:', JSON.stringify(response.data, null, 2));
        
        // 验证响应格式
        const data = response.data;
        if (data.object === 'list' && Array.isArray(data.data)) {
            console.log('✅ 响应格式正确');
            
            // 检查模型字段
            const model = data.data[0];
            if (model && model.id && model.object === 'model' && model.created && model.owned_by && Array.isArray(model.permission)) {
                console.log('✅ 模型字段完整');
            } else {
                console.log('❌ 模型字段不完整');
            }
        } else {
            console.log('❌ 响应格式错误');
        }
    } catch (error) {
        console.error('测试失败:', error.message);
    }
}

async function testChatCompletions() {
    console.log('\n========== 测试 /v1/chat/completions API ==========');
    
    // 测试基本对话
    console.log('\n1. 测试基本对话:');
    try {
        const response = await axios.post(`${API_BASE}/chat/completions`, {
            model: 'kimi',
            messages: [
                { role: 'user', content: '你好' }
            ],
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('响应状态:', response.status);
        const data = response.data;
        
        // 验证响应格式
        if (data.id && data.object === 'chat.completion' && data.created && data.model && data.choices) {
            console.log('✅ 响应格式正确');
            console.log('助手回复:', data.choices[0]?.message?.content?.substring(0, 100) + '...');
        } else {
            console.log('❌ 响应格式错误');
            console.log('响应数据:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('测试失败:', error.response?.data || error.message);
    }
    
    // 测试工具调用
    console.log('\n2. 测试工具调用:');
    try {
        const response = await axios.post(`${API_BASE}/chat/completions`, {
            model: 'kimi',
            messages: [
                { 
                    role: 'user', 
                    content: '使用计算器工具计算 123 + 456' 
                }
            ],
            tools: [
                {
                    type: 'function',
                    function: {
                        name: 'calculator',
                        description: '执行基本的数学运算',
                        parameters: {
                            type: 'object',
                            properties: {
                                expression: {
                                    type: 'string',
                                    description: '要计算的数学表达式'
                                }
                            },
                            required: ['expression']
                        }
                    }
                }
            ],
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('响应状态:', response.status);
        const data = response.data;
        
        // 检查是否有 tool_calls
        if (data.choices[0]?.message?.tool_calls) {
            console.log('✅ 检测到工具调用');
            console.log('工具调用:', JSON.stringify(data.choices[0].message.tool_calls, null, 2));
        } else {
            console.log('ℹ️ 未检测到工具调用（Kimi 可能不支持直接的工具调用）');
            console.log('助手回复:', data.choices[0]?.message?.content?.substring(0, 200) + '...');
        }
    } catch (error) {
        console.error('测试失败:', error.response?.data || error.message);
    }
    
    // 测试多轮对话
    console.log('\n3. 测试多轮对话:');
    try {
        const response = await axios.post(`${API_BASE}/chat/completions`, {
            model: 'kimi',
            messages: [
                { role: 'system', content: '你是一个有帮助的助手' },
                { role: 'user', content: '记住数字 42' },
                { role: 'assistant', content: '好的，我记住了数字 42。' },
                { role: 'user', content: '我刚才让你记住的数字是多少？' }
            ],
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('响应状态:', response.status);
        const data = response.data;
        console.log('助手回复:', data.choices[0]?.message?.content?.substring(0, 200) + '...');
        
        // 检查是否正确处理了多轮对话
        if (data.choices[0]?.message?.content?.includes('42')) {
            console.log('✅ 多轮对话上下文保持正确');
        } else {
            console.log('⚠️ 多轮对话上下文可能有问题');
        }
    } catch (error) {
        console.error('测试失败:', error.response?.data || error.message);
    }
}

async function runTests() {
    console.log('开始 OpenAI 兼容性测试...');
    console.log('API 基础地址:', API_BASE);
    console.log('请确保 kimi-free-api 服务正在运行');
    
    await testModelsAPI();
    
    if (API_KEY === 'YOUR_REFRESH_TOKEN_HERE') {
        console.log('\n⚠️ 请先设置有效的 refresh_token 才能测试 chat API');
        console.log('编辑此文件并将 API_KEY 替换为实际的 refresh_token');
        return;
    }
    
    await testChatCompletions();
    
    console.log('\n测试完成！');
}

// 运行测试
runTests().catch(console.error);
