import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({channel:process.env.AW_BROWSER??'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:950}});
 page.setDefaultTimeout(30000);
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5178/');
 await page.locator('.experiment-launcher').click();
 await page.getByRole('textbox',{name:'姓名',exact:true}).fill('测试被试');
 await page.getByRole('textbox',{name:'学号',exact:true}).fill('TEST-001');
 await page.getByRole('button',{name:'进入教学'}).click();
 await page.getByRole('button',{name:'进入掌握效果测试'}).click();
 await page.getByRole('button',{name:'跳过掌握测试'}).click();
 await page.getByRole('button',{name:/论文阅读/}).click();
 assert.equal(await page.getByText('此任务的题目组尚未填全。请在实验管理中填写后开始。').count(),1);
 assert.equal(await page.getByRole('button',{name:'开始本形式'}).count(),0);
 await page.getByRole('button',{name:'返回实验'}).click();
 await page.getByRole('button',{name:/实验管理/}).click();
 const details=page.locator('details[data-eligibility-task="comparison"]');await details.locator('summary').click();
 for(let index=1;index<8;index++)await details.locator('input[type=checkbox]').nth(index).uncheck();
 await page.getByRole('textbox',{name:'图文对照 题目组 A 题目 1'}).fill('第一道待定题');
 await page.getByRole('button',{name:'返回实验入口'}).click();
 await page.getByRole('button',{name:/论文阅读/}).click();
 assert.equal(await page.getByRole('button',{name:'开始本形式'}).count(),0);
 await page.getByRole('button',{name:'返回实验'}).click();
 await page.getByRole('button',{name:/实验管理/}).click();
 await details.locator('summary').click();
 await page.getByRole('textbox',{name:'图文对照 题目组 A 题目 2'}).fill('第二道待定题');
 await page.getByRole('button',{name:'返回实验入口'}).click();
 await page.getByRole('button',{name:/论文阅读/}).click();
 assert.equal(await page.getByRole('button',{name:'开始本形式'}).count(),1);
 assert.equal(await page.evaluate(async()=>{const m=await import('/src/study/paperQuestions.ts');return m.paperTaskReady('comparison',1);}),true);
 console.log('PASS: formal question set remains gated until both prompts are configured');
}finally{await browser.close();}
