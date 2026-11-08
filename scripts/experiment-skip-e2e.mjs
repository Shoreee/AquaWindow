import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({channel:process.env.AW_BROWSER??'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 page.setDefaultTimeout(20000);
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5178/');
 await page.locator('.experiment-launcher').click();
 await page.locator('.experiment-profile input').first().fill('测试被试');
 await page.locator('.experiment-profile input').last().fill('SKIP-001');
 await page.locator('.experiment-profile .experiment-primary').click();
 await page.getByRole('button',{name:'进入掌握效果测试'}).click();
 assert.equal(await page.locator('.experiment-skip-test').count(),1);
 await page.locator('.experiment-skip-test').click();
 assert.equal(await page.locator('.experiment-worlds button').count(),3);
 assert.equal(await page.evaluate(async()=>{const m=await import('/src/study/onboarding.ts');return m.canEnterExperiment()}),true);
 const skip=await page.evaluate(()=>JSON.parse(localStorage.getItem('aquawindow.experiment.learning-skips.v1')??'{}')['SKIP-001']);
 assert.equal(skip.completedQuestions,0);
 await page.getByRole('button',{name:/实验管理/}).click();
 await page.getByRole('button',{name:'收集数据'}).click();
 assert.match(await page.locator('.experiment-data-table').first().innerText(),/已跳过/);
 console.log('PASS: mastery skip opens experiment and is recorded separately');
}finally{await browser.close();}
