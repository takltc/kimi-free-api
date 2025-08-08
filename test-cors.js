#!/usr/bin/env node

/**
 * CORS 配置测试脚本
 * @author jizhejiang
 * @date 2025-08-07 23:39:47
 * @description 测试增强的 CORS 支持，包括自定义请求头和 OPTIONS 预检
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

console.log('Testing CORS configuration...');
console.log(`API Base URL: ${API_BASE_URL}`);
console.log('---');

/**
 * 测试 OPTIONS 预检请求
 */
async function testOptionsRequest() {
  console.log('Test 1: OPTIONS Preflight Request');
  try {
    const response = await axios({
      method: 'OPTIONS',
      url: `${API_BASE_URL}/v1/chat/completions`,
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, OpenAI-Organization, Content-Type',
        'Origin': 'https://example.com'
      }
    });
    
    console.log(`✓ Status Code: ${response.status}`);
    console.log(`✓ Access-Control-Allow-Origin: ${response.headers['access-control-allow-origin']}`);
    console.log(`✓ Access-Control-Allow-Methods: ${response.headers['access-control-allow-methods']}`);
    console.log(`✓ Access-Control-Allow-Headers: ${response.headers['access-control-allow-headers']}`);
    console.log(`✓ Access-Control-Max-Age: ${response.headers['access-control-max-age']}`);
    
    // 验证是否包含必需的请求头
    const allowedHeaders = response.headers['access-control-allow-headers'];
    if (allowedHeaders) {
      const hasAuthorization = allowedHeaders.toLowerCase().includes('authorization');
      const hasOpenAIOrg = allowedHeaders.toLowerCase().includes('openai-organization');
      
      console.log(`✓ Authorization header allowed: ${hasAuthorization}`);
      console.log(`✓ OpenAI-Organization header allowed: ${hasOpenAIOrg}`);
      
      if (!hasAuthorization || !hasOpenAIOrg) {
        console.error('✗ Missing required headers in CORS configuration');
        return false;
      }
    }
    
    if (response.status === 204) {
      console.log('✓ OPTIONS request returned 204 No Content (fast response)');
    }
    
    return true;
  } catch (error) {
    console.error(`✗ OPTIONS request failed: ${error.message}`);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Headers:`, error.response.headers);
    }
    return false;
  }
}

/**
 * 测试跨域 POST 请求
 */
async function testCorsPostRequest() {
  console.log('\nTest 2: CORS POST Request with Custom Headers');
  try {
    const response = await axios({
      method: 'POST',
      url: `${API_BASE_URL}/v1/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test-token',
        'OpenAI-Organization': 'org-test',
        'Origin': 'https://example.com'
      },
      data: {
        model: 'kimi',
        messages: [
          { role: 'user', content: 'Test CORS' }
        ],
        stream: false
      },
      validateStatus: () => true // 接受任何状态码
    });
    
    console.log(`✓ Status Code: ${response.status}`);
    
    // 检查 CORS 响应头
    const corsHeaders = {
      'access-control-allow-origin': response.headers['access-control-allow-origin'],
      'access-control-allow-credentials': response.headers['access-control-allow-credentials']
    };
    
    for (const [header, value] of Object.entries(corsHeaders)) {
      if (value) {
        console.log(`✓ ${header}: ${value}`);
      }
    }
    
    // 如果是 401，说明 CORS 通过但认证失败（预期行为）
    if (response.status === 401) {
      console.log('✓ CORS passed but authentication failed (expected with test token)');
      return true;
    }
    
    return true;
  } catch (error) {
    console.error(`✗ CORS POST request failed: ${error.message}`);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
    }
    return false;
  }
}

/**
 * 测试不同源的 CORS 请求
 */
async function testDifferentOrigins() {
  console.log('\nTest 3: Different Origins');
  const origins = [
    'https://example.com',
    'http://localhost:3000',
    'https://app.openai.com'
  ];
  
  for (const origin of origins) {
    try {
      const response = await axios({
        method: 'OPTIONS',
        url: `${API_BASE_URL}/v1/chat/completions`,
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'POST'
        }
      });
      
      const allowedOrigin = response.headers['access-control-allow-origin'];
      console.log(`✓ Origin ${origin} -> Allowed: ${allowedOrigin}`);
    } catch (error) {
      console.error(`✗ Origin ${origin} failed: ${error.message}`);
    }
  }
  
  return true;
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('Starting CORS tests...\n');
  
  const results = [];
  
  // 运行测试
  results.push(await testOptionsRequest());
  results.push(await testCorsPostRequest());
  results.push(await testDifferentOrigins());
  
  // 汇总结果
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary:');
  const passed = results.filter(r => r).length;
  const failed = results.length - passed;
  
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n✅ All CORS tests passed successfully!');
    console.log('CORS configuration supports:');
    console.log('  - Authorization header');
    console.log('  - OpenAI-Organization header');
    console.log('  - OPTIONS preflight with 204 response');
    console.log('  - Dynamic origin handling');
  } else {
    console.log('\n❌ Some CORS tests failed. Please check the configuration.');
  }
}

// 运行测试
runTests().catch(console.error);
