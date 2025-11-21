const { chromium } = require('playwright');

async function testLogin() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // 访问登录页面
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(2000);
    
    // 检查页面是否加载
    const title = await page.title();
    console.log('页面标题:', title);
    
    // 检查是否有登录表单
    const hasLoginForm = await page.locator('input[type="text"], input[type="email"]').count() > 0;
    console.log('是否有登录表单:', hasLoginForm);
    
  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    await browser.close();
  }
}

testLogin();
