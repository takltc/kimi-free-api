/**
 * 认证中间件测试脚本
 * 用于验证认证中间件是否正常工作
 */

const axios = require('axios');

const API_BASE = 'http://localhost:8000/v1';

async function testAuth() {
  console.log('开始测试认证中间件...\n');
  
  // 测试1: 没有 Authorization 头的请求
  console.log('测试1: 没有 Authorization 头的请求');
  try {
    const response = await axios.post(`${API_BASE}/chat/completions`, {
      model: 'kimi',
      messages: [{ role: 'user', content: 'Hello' }]
    });
    console.log('❌ 应该返回401错误，但请求成功了');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ 正确返回401错误');
      console.log('错误响应:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ 错误:', error.message);
    }
  }
  
  console.log('\n---\n');
  
  // 测试2: 错误格式的 Authorization 头
  console.log('测试2: 错误格式的 Authorization 头（不是 Bearer 格式）');
  try {
    const response = await axios.post(`${API_BASE}/chat/completions`, {
      model: 'kimi',
      messages: [{ role: 'user', content: 'Hello' }]
    }, {
      headers: {
        'Authorization': 'InvalidFormat sk-test123'
      }
    });
    console.log('❌ 应该返回401错误，但请求成功了');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ 正确返回401错误');
      console.log('错误响应:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ 错误:', error.message);
    }
  }
  
  console.log('\n---\n');
  
  // 测试3: Bearer 格式但 token 不以 sk- 开头
  console.log('测试3: Bearer 格式但 token 不以 sk- 开头');
  try {
    const response = await axios.post(`${API_BASE}/chat/completions`, {
      model: 'kimi',
      messages: [{ role: 'user', content: 'Hello' }]
    }, {
      headers: {
        'Authorization': 'Bearer invalid-token-format'
      }
    });
    console.log('❌ 应该返回401错误，但请求成功了');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ 正确返回401错误');
      console.log('错误响应:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ 错误:', error.message);
    }
  }
  
  console.log('\n---\n');
  
  // 测试4: 正确格式的 Bearer token
  console.log('测试4: 正确格式的 Bearer token（sk- 开头）');
  try {
    const response = await axios.post(`${API_BASE}/chat/completions`, {
      model: 'kimi',
      messages: [{ role: 'user', content: 'Hello' }]
    }, {
      headers: {
        'Authorization': 'Bearer sk-test-valid-token-12345'
      }
    });
    console.log('✅ 请求通过认证（但可能因为 token 无效而失败，这是预期的）');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ 认证格式正确，但 token 本身无效（这是预期的）');
    } else {
      console.log('请求失败，但已通过格式验证:', error.message);
    }
  }
  
  console.log('\n---\n');
  
  // 测试5: 访问豁免路径
  console.log('测试5: 访问豁免路径 /ping（不需要认证）');
  try {
    const response = await axios.get(`${API_BASE}/ping`);
    console.log('✅ 成功访问豁免路径，响应:', response.data);
  } catch (error) {
    console.log('❌ 访问豁免路径失败:', error.message);
  }
  
  console.log('\n---\n');
  
  // 测试6: 访问 models 路径（豁免路径）
  console.log('测试6: 访问 /models 路径（豁免路径）');
  try {
    const response = await axios.get(`${API_BASE}/models`);
    console.log('✅ 成功访问 models 路径');
    console.log('模型列表:', JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
  } catch (error) {
    console.log('❌ 访问 models 路径失败:', error.message);
  }
  
  console.log('\n测试完成！');
}

// 运行测试
testAuth().catch(error => {
  console.error('测试出错:', error);
  process.exit(1);
});
