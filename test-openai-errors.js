/**
 * OpenAI错误格式测试脚本
 * 
 * 用于测试错误处理规范化是否正确工作
 * 
 * @author jizhejiang
 * @date 2025-08-07 23:46:02
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

// 测试用例配置
const testCases = [
  {
    name: '测试无效的API密钥',
    config: {
      method: 'POST',
      url: `${BASE_URL}/v1/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid_key_123'
      },
      data: {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      }
    },
    expectedError: {
      type: 'authentication_error',
      hasMessage: true,
      hasCode: true
    }
  },
  {
    name: '测试缺少必需参数',
    config: {
      method: 'POST',
      url: `${BASE_URL}/v1/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test123'
      },
      data: {
        // 缺少 model 和 messages
      }
    },
    expectedError: {
      type: 'invalid_request',
      hasMessage: true,
      hasParam: true
    }
  },
  {
    name: '测试无效的路由',
    config: {
      method: 'GET',
      url: `${BASE_URL}/v1/invalid/endpoint`,
      headers: {
        'Content-Type': 'application/json'
      }
    },
    expectedError: {
      type: 'invalid_request',
      hasMessage: true
    }
  },
  {
    name: '测试非v1路由的错误格式（应返回旧格式）',
    config: {
      method: 'GET',
      url: `${BASE_URL}/api/invalid`,
      headers: {
        'Content-Type': 'application/json'
      }
    },
    expectedOldFormat: true
  }
];

// 颜色输出辅助函数
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`
};

// 执行测试
async function runTests() {
  console.log(colors.cyan('='.repeat(60)));
  console.log(colors.cyan('OpenAI错误格式测试'));
  console.log(colors.cyan('='.repeat(60)));
  console.log();

  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    console.log(colors.blue(`运行测试: ${testCase.name}`));
    
    try {
      const response = await axios(testCase.config);
      console.log(colors.red('  ✗ 测试失败: 期望收到错误响应，但请求成功'));
      failedTests++;
    } catch (error) {
      if (error.response) {
        const responseData = error.response.data;
        const statusCode = error.response.status;
        
        console.log(colors.yellow(`  状态码: ${statusCode}`));
        console.log(colors.yellow(`  响应数据: ${JSON.stringify(responseData, null, 2)}`));
        
        // 检查是否为期望的旧格式
        if (testCase.expectedOldFormat) {
          if (responseData.code !== undefined && responseData.message !== undefined) {
            console.log(colors.green('  ✓ 测试通过: 正确返回旧格式错误'));
            passedTests++;
          } else {
            console.log(colors.red('  ✗ 测试失败: 期望旧格式错误，但格式不正确'));
            failedTests++;
          }
        } 
        // 检查OpenAI错误格式
        else if (testCase.expectedError) {
          let passed = true;
          const error = responseData.error;
          
          if (!error) {
            console.log(colors.red('  ✗ 缺少error对象'));
            passed = false;
          } else {
            // 检查错误类型
            if (testCase.expectedError.type && error.type !== testCase.expectedError.type) {
              console.log(colors.red(`  ✗ 错误类型不匹配: 期望 ${testCase.expectedError.type}, 实际 ${error.type}`));
              passed = false;
            }
            
            // 检查是否有消息
            if (testCase.expectedError.hasMessage && !error.message) {
              console.log(colors.red('  ✗ 缺少error.message'));
              passed = false;
            }
            
            // 检查是否有代码
            if (testCase.expectedError.hasCode && error.code === undefined) {
              console.log(colors.red('  ✗ 缺少error.code'));
              passed = false;
            }
            
            // 检查是否有参数
            if (testCase.expectedError.hasParam && error.param === undefined) {
              console.log(colors.red('  ✗ 缺少error.param'));
              passed = false;
            }
          }
          
          if (passed) {
            console.log(colors.green('  ✓ 测试通过: OpenAI错误格式正确'));
            passedTests++;
          } else {
            failedTests++;
          }
        }
      } else {
        console.log(colors.red(`  ✗ 测试失败: 网络错误 - ${error.message}`));
        failedTests++;
      }
    }
    
    console.log();
  }
  
  // 输出测试结果汇总
  console.log(colors.cyan('='.repeat(60)));
  console.log(colors.cyan('测试结果汇总'));
  console.log(colors.cyan('='.repeat(60)));
  console.log(colors.green(`通过的测试: ${passedTests}`));
  console.log(colors.red(`失败的测试: ${failedTests}`));
  console.log(colors.yellow(`总测试数: ${testCases.length}`));
  
  if (failedTests === 0) {
    console.log(colors.green('\n✓ 所有测试通过！'));
  } else {
    console.log(colors.red(`\n✗ ${failedTests} 个测试失败`));
  }
}

// 运行测试
runTests().catch(error => {
  console.error(colors.red('测试运行时出错:'), error);
  process.exit(1);
});
