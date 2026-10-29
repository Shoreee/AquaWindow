import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),requests=[];
 await page.route('https://api.deepseek.com/**',route=>{requests.push(route.request());return route.fulfill({json:{choices:[{message:{content:'{"plans":[]}'},finish_reason:'stop'}]}})});
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5175/');await page.getByRole('button',{name:'AquaWindow',exact:true}).waitFor();
 await page.getByRole('button',{name:'AquaWindow',exact:true}).click();
 await page.getByLabel('DeepSeek API Key',{exact:true}).fill('visitor-fixture');await page.getByRole('button',{name:'保存 Key',exact:true}).click();
 assert.equal(await page.getByRole('switch',{name:'接入 DeepSeek'}).getAttribute('aria-checked'),'false');assert.equal(requests.length,0);
 assert.equal(await page.getByLabel('DeepSeek API Key',{exact:true}).inputValue(),'');
 assert.ok(!(await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}))).includes('visitor-fixture'));
 await page.getByRole('switch',{name:'接入 DeepSeek'}).click();await page.getByText('随时就绪',{exact:true}).waitFor();
 assert.ok(requests.length>0);assert.equal(requests[0].headers().authorization,'Bearer visitor-fixture');assert.ok(!requests[0].postData().includes('visitor-fixture'));
 await page.getByRole('button',{name:'AquaWindow',exact:true}).click();await page.getByRole('button',{name:'清除 Key',exact:true}).click();assert.equal(await page.getByRole('switch',{name:'接入 DeepSeek'}).getAttribute('aria-checked'),'false');
 await page.reload();await page.getByRole('button',{name:'AquaWindow',exact:true}).click();assert.equal(await page.getByRole('button',{name:'清除 Key',exact:true}).count(),0);assert.equal(await page.getByRole('switch',{name:'接入 DeepSeek'}).getAttribute('aria-checked'),'false');
 console.log('PASS: memory-only Key input, opt-in required, official endpoint only, no storage or context leak, clearing and reload disable access.');
}finally{await browser.close();}
