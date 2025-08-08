#!/usr/bin/env node

/**
 * 完整的 E2E 测试套件
 * @author jizhejiang
 * @date 2025-08-07 23:59:44
 * @description 包含普通聊天、流式聊天、模型列表、认证和错误场景的完整测试
 */

const axios = require('axios');
const { EventSourceParserStream } = require('eventsource-parser/stream');
const { Readable } = require('stream');

// 配置
const API_BASE = process.env.API_BASE_URL || 'http://localhost:8001';
const API_KEY = process.env.API_KEY || 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1c2VyLWNlbnRlciIsImV4cCI6MTc2MTA5MzgzMiwiaWF0IjoxNzUzMzE3ODMyLCJqdGkiOiJkMjBvM2kyaTU5NzB0YmZrZzAzMCIsInR5cCI6InJlZnJlc2giLCJhcHBfaWQiOiJraW1pIiwic3ViIjoiY29iODJoMWtxcTR0dHJqczYzZjAiLCJzcGFjZV9pZCI6ImQxb2thdnFtNTJ0NWhyNjZhaTVnIiwiYWJzdHJhY3RfdXNlcl9pZCI6ImQxb2thdnFtNTJ0NWhyNjZhaTUwIiwiZGV2aWNlX2lkIjoiNzQ4MTU1OTY3NjQzODY0MjQzMiIsInJlZ2lvbiI6ImNuIn0.y9FKk_VcgVFeCUl0wFgjPP6tutkg8HIHEn67tBEoCfXDnzHS05icOKQG742eklSHRm7XROY3eL9zyMwhntXNMg'; // 可通过环境变量设置真实token

// 颜色输出辅助函数
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`
};

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// 记录测试结果
function recordTest(name, passed, details = '') {
  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
    console.log(colors.green(`  ✓ ${name}`));
  } else {
    testResults.failed++;
    console.log(colors.red(`  ✗ ${name}`));
  }
  if (details) {
    console.log(colors.gray(`    ${details}`));
  }
}

/**
 * 测试 1: 普通非流式聊天
 */
async function testNormalChat() {
  console.log(colors.cyan('\n📝 测试普通非流式聊天'));
  
  try {
    const response = await axios.post(`${API_BASE}/v1/chat/completions`, {
      model: 'kimi',
      messages: [
        { role: 'user', content: '你好，请简单介绍一下你自己' }
      ],
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 30000  // 30 seconds timeout
    });
    
    if (response.status === 200) {
      const data = response.data;
      
      // 验证响应格式
      if (data.id && data.object === 'chat.completion' && data.choices && data.choices[0]) {
        recordTest('响应格式正确', true);
        
        // 验证消息内容
        const content = data.choices[0].message?.content;
        if (content && content.length > 0) {
          recordTest('返回消息内容', true, `内容长度: ${content.length} 字符`);
        } else {
          recordTest('返回消息内容', false, '消息内容为空');
        }
        
        // 验证 usage 字段
        if (data.usage && typeof data.usage.total_tokens === 'number') {
          recordTest('包含 usage 信息', true);
        } else {
          recordTest('包含 usage 信息', false);
        }
      } else {
        recordTest('响应格式正确', false, '缺少必要字段');
      }
    } else if (response.status === 401) {
      recordTest('普通聊天请求', false, '认证失败 (可能需要有效的 token)');
    } else {
      recordTest('普通聊天请求', false, `状态码: ${response.status}`);
    }
  } catch (error) {
    recordTest('普通聊天请求', false, error.message);
  }
}

/**
 * 测试 2: 流式聊天
 */
async function testStreamChat() {
  console.log(colors.cyan('\n🌊 测试流式聊天'));
  
  try {
    const response = await axios.post(`${API_BASE}/v1/chat/completions`, {
      model: 'kimi',
      messages: [
        { role: 'user', content: '计数从1到5' }
      ],
      stream: true
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      responseType: 'stream',
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      let chunks = [];
      let hasData = false;
      let hasDone = false;
      
      // 处理流式响应
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('流式响应超时'));
        }, 10000);
        
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              hasData = true;
              const data = line.slice(6);
              if (data === '[DONE]') {
                hasDone = true;
              } else {
                try {
                  const json = JSON.parse(data);
                  chunks.push(json);
                } catch (e) {
                  // 忽略解析错误
                }
              }
            }
          }
        });
        
        response.data.on('end', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        response.data.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      
      recordTest('接收到流式数据', hasData);
      recordTest('接收到多个数据块', chunks.length > 1, `共 ${chunks.length} 个数据块`);
      recordTest('接收到 [DONE] 标记', hasDone);
      
      // 验证数据块格式
      if (chunks.length > 0) {
        const firstChunk = chunks[0];
        if (firstChunk.id && firstChunk.object === 'chat.completion.chunk') {
          recordTest('流式数据格式正确', true);
        } else {
          recordTest('流式数据格式正确', false, '缺少必要字段');
        }
      }
    } else if (response.status === 401) {
      recordTest('流式聊天请求', false, '认证失败 (可能需要有效的 token)');
    } else {
      recordTest('流式聊天请求', false, `状态码: ${response.status}`);
    }
  } catch (error) {
    recordTest('流式聊天请求', false, error.message);
  }
}

/**
 * 测试 3: /v1/models 端点
 */
async function testModelsEndpoint() {
  console.log(colors.cyan('\n📋 测试 /v1/models 端点'));
  
  try {
    // 不带认证的请求（应该成功，因为是豁免路径）
    const response1 = await axios.get(`${API_BASE}/v1/models`, {
      validateStatus: () => true
    });
    
    if (response1.status === 200) {
      const data = response1.data;
      
      // 验证响应格式
      if (data.object === 'list' && Array.isArray(data.data)) {
        recordTest('响应格式正确', true);
        recordTest('返回模型列表', data.data.length > 0, `共 ${data.data.length} 个模型`);
        
        // 验证模型对象格式
        if (data.data.length > 0) {
          const model = data.data[0];
          if (model.id && model.object === 'model' && model.created && model.owned_by) {
            recordTest('模型对象格式正确', true);
          } else {
            recordTest('模型对象格式正确', false, '缺少必要字段');
          }
        }
      } else {
        recordTest('响应格式正确', false, '不是标准的列表格式');
      }
    } else {
      recordTest('获取模型列表', false, `状态码: ${response1.status}`);
    }
    
    // 带认证的请求（也应该成功）
    const response2 = await axios.get(`${API_BASE}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      validateStatus: () => true
    });
    
    recordTest('带认证头访问', response2.status === 200, `状态码: ${response2.status}`);
    
  } catch (error) {
    recordTest('模型列表请求', false, error.message);
  }
}

/**
 * 测试 4: 认证失败场景
 */
async function testAuthenticationFailure() {
  console.log(colors.cyan('\n🔒 测试认证失败场景'));
  
  // 测试无认证头
  try {
    const response = await axios.post(`${API_BASE}/v1/chat/completions`, {
      model: 'kimi',
      messages: [{ role: 'user', content: 'test' }]
    }, {
      validateStatus: () => true
    });
    
    if (response.status === 401) {
      recordTest('无认证头返回401', true);
      
      // 验证错误格式
      if (response.data.error && response.data.error.type === 'authentication_error') {
        recordTest('错误格式符合OpenAI规范', true);
      } else {
        recordTest('错误格式符合OpenAI规范', false);
      }
    } else {
      recordTest('无认证头返回401', false, `实际状态码: ${response.status}`);
    }
  } catch (error) {
    recordTest('无认证头测试', false, error.message);
  }
  
  // 测试无效的认证格式
  try {
    const response = await axios.post(`${API_BASE}/v1/chat/completions`, {
      model: 'kimi',
      messages: [{ role: 'user', content: 'test' }]
    }, {
      headers: {
        'Authorization': 'InvalidFormat'
      },
      validateStatus: () => true
    });
    
    recordTest('无效认证格式返回401', response.status === 401, `状态码: ${response.status}`);
  } catch (error) {
    recordTest('无效认证格式测试', false, error.message);
  }
  
  // 测试无效的token格式
  try {
    const response = await axios.post(`${API_BASE}/v1/chat/completions`, {
      model: 'kimi',
      messages: [{ role: 'user', content: 'test' }]
    }, {
      headers: {
        'Authorization': 'Bearer invalid-token'
      },
      validateStatus: () => true,
      timeout: 5000  // 5 seconds timeout
    });
    
    recordTest('无效token格式返回401', response.status === 401, `状态码: ${response.status}`);
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      recordTest('无效token格式测试', false, '请求超时');
    } else {
      recordTest('无效token格式测试', false, error.message);
    }
  }
}

/**
 * 测试 5: 其他错误场景
 */
async function testErrorScenarios() {
  console.log(colors.cyan('\n⚠️ 测试其他错误场景'));
  
  // 测试缺少必需参数
  try {
    const response = await axios.post(`${API_BASE}/v1/chat/completions`, {
      // 缺少 model 和 messages
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      validateStatus: () => true,
      timeout: 10000  // 10 seconds timeout
    });
    
    if (response.status === 400) {
      recordTest('缺少必需参数返回400', true);
      
      // 验证错误消息
      if (response.data.error && response.data.error.message) {
        recordTest('包含错误消息', true, response.data.error.message.substring(0, 50) + '...');
      } else {
        recordTest('包含错误消息', false);
      }
    } else {
      recordTest('缺少必需参数返回400', false, `实际状态码: ${response.status}`);
    }
  } catch (error) {
    recordTest('缺少参数测试', false, error.message);
  }
  
  // 测试无效的消息格式
  try {
    const response = await axios.post(`${API_BASE}/v1/chat/completions`, {
      model: 'kimi',
      messages: 'invalid' // 应该是数组
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      validateStatus: () => true,
      timeout: 10000  // 10 seconds timeout
    });
    
    recordTest('无效消息格式返回错误', response.status >= 400, `状态码: ${response.status}`);
  } catch (error) {
    recordTest('无效消息格式测试', false, error.message);
  }
  
  // 测试不存在的端点
  try {
    const response = await axios.get(`${API_BASE}/v1/invalid-endpoint`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      validateStatus: () => true
    });
    
    recordTest('不存在的端点返回404', response.status === 404, `状态码: ${response.status}`);
  } catch (error) {
    recordTest('不存在端点测试', false, error.message);
  }
  
  // 测试超大请求
  try {
    const largeContent = 'x'.repeat(100000); // 100K字符
    const response = await axios.post(`${API_BASE}/v1/chat/completions`, {
      model: 'kimi',
      messages: [{ role: 'user', content: largeContent }]
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      validateStatus: () => true,
      timeout: 5000
    });
    
    // 只要不崩溃就算通过
    recordTest('处理超大请求', true, `状态码: ${response.status}`);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      recordTest('处理超大请求', true, '请求超时（预期行为）');
    } else {
      recordTest('处理超大请求', false, error.message);
    }
  }
}

/**
 * 测试 6: 联网搜索功能
 */
async function testSearchFeature() {
  console.log(colors.cyan('\n🔍 测试联网搜索功能'));
  
  try {
    const response = await axios.post(`${API_BASE}/v1/chat/completions`, {
      model: 'kimi',
      messages: [
        { role: 'user', content: '今天的日期是什么？' }
      ],
      use_search: true,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 30000  // 30 seconds timeout for search
    });
    
    if (response.status === 200) {
      recordTest('联网搜索请求成功', true);
      
      const content = response.data.choices?.[0]?.message?.content || '';
      // 检查是否包含日期相关内容
      if (content.match(/\d{4}/) || content.match(/月|年|日/)) {
        recordTest('返回包含日期信息', true);
      } else {
        recordTest('返回包含日期信息', false, '可能未启用搜索');
      }
    } else if (response.status === 401) {
      recordTest('联网搜索请求', false, '认证失败');
    } else {
      recordTest('联网搜索请求', false, `状态码: ${response.status}`);
    }
  } catch (error) {
    recordTest('联网搜索测试', false, error.message);
  }
}

/**
 * 测试 7: 多轮对话
 */
async function testMultiTurnConversation() {
  console.log(colors.cyan('\n💬 测试多轮对话'));
  
  try {
    const response = await axios.post(`${API_BASE}/v1/chat/completions`, {
      model: 'kimi',
      messages: [
        { role: 'user', content: '请记住数字 888' },
        { role: 'assistant', content: '好的，我记住了数字 888。' },
        { role: 'user', content: '我刚才让你记住的数字是什么？' }
      ],
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 30000  // 30 seconds timeout
    });
    
    if (response.status === 200) {
      const content = response.data.choices?.[0]?.message?.content || '';
      
      if (content.includes('888')) {
        recordTest('多轮对话上下文保持', true, '正确记住了数字');
      } else {
        recordTest('多轮对话上下文保持', false, '未能保持上下文');
      }
    } else {
      recordTest('多轮对话请求', false, `状态码: ${response.status}`);
    }
  } catch (error) {
    recordTest('多轮对话测试', false, error.message);
  }
}

/**
 * 打印测试报告
 */
function printReport() {
  console.log(colors.cyan('\n' + '='.repeat(60)));
  console.log(colors.cyan('📊 测试报告汇总'));
  console.log(colors.cyan('='.repeat(60)));
  
  console.log(`\n测试环境: ${API_BASE}`);
  console.log(`总测试数: ${testResults.tests.length}`);
  console.log(colors.green(`✓ 通过: ${testResults.passed}`));
  console.log(colors.red(`✗ 失败: ${testResults.failed}`));
  if (testResults.skipped > 0) {
    console.log(colors.yellow(`⊘ 跳过: ${testResults.skipped}`));
  }
  
  const passRate = testResults.tests.length > 0 
    ? (testResults.passed / testResults.tests.length * 100).toFixed(1)
    : 0;
  
  console.log(`\n通过率: ${passRate}%`);
  
  if (testResults.failed > 0) {
    console.log(colors.red('\n失败的测试:'));
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => {
        console.log(colors.red(`  - ${t.name}`));
        if (t.details) {
          console.log(colors.gray(`    ${t.details}`));
        }
      });
  }
  
  if (passRate === '100.0') {
    console.log(colors.green('\n🎉 所有测试通过！'));
  } else if (passRate >= 80) {
    console.log(colors.yellow('\n⚠️ 大部分测试通过，但仍有一些问题需要修复'));
  } else {
    console.log(colors.red('\n❌ 测试失败较多，请检查服务是否正常运行'));
  }
}

/**
 * 主测试函数
 */
async function runAllTests() {
  console.log(colors.magenta('╔════════════════════════════════════════════════════════╗'));
  console.log(colors.magenta('║           Kimi Free API - 完整 E2E 测试套件           ║'));
  console.log(colors.magenta('╚════════════════════════════════════════════════════════╝'));
  console.log();
  console.log('开始时间:', new Date().toLocaleString());
  console.log('API 基础地址:', API_BASE);
  console.log('使用 Token:', API_KEY === 'sk-test-token-12345' ? '默认测试Token' : '自定义Token');
  
  // 检查服务是否运行
  console.log(colors.yellow('\n正在检查服务状态...'));
  try {
    await axios.get(`${API_BASE}/v1/models`, { timeout: 3000 });
    console.log(colors.green('✓ 服务正在运行'));
  } catch (error) {
    console.log(colors.red('✗ 无法连接到服务，请确保 kimi-free-api 正在运行'));
    console.log(colors.gray('  提示: 运行 npm start 启动服务'));
    process.exit(1);
  }
  
  // 运行所有测试
  await testNormalChat();
  await delay(500);
  
  await testStreamChat();
  await delay(500);
  
  await testModelsEndpoint();
  await delay(500);
  
  await testAuthenticationFailure();
  await delay(500);
  
  await testErrorScenarios();
  await delay(500);
  
  await testSearchFeature();
  await delay(500);
  
  await testMultiTurnConversation();
  
  // 打印报告
  printReport();
  
  console.log('\n结束时间:', new Date().toLocaleString());
  
  // 根据测试结果设置退出码
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 处理未捕获的错误
process.on('unhandledRejection', (error) => {
  console.error(colors.red('\n未处理的错误:'), error);
  process.exit(1);
});

// 运行测试
runAllTests().catch(error => {
  console.error(colors.red('\n测试运行失败:'), error);
  process.exit(1);
});
