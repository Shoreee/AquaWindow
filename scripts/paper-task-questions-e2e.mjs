import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({channel:process.env.AW_BROWSER??'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:950}});
 page.setDefaultTimeout(30000);
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5178/');
 await page.locator('.experiment-launcher').click();
 await page.getByRole('button',{name:'实验管理',exact:true}).click();
 const details=page.locator('details[data-eligibility-task="bilingual"]');await details.locator('summary').click();
 for(let index=1;index<8;index++)await details.locator('input[type=checkbox]').nth(index).uncheck();
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('aquawindow.experiment.paper-questions.v2')??'{}').bilingual?.[0]??['','']);
 assert.deepEqual(await stored(),['','']);
 await page.getByRole('textbox',{name:'中英对照 题目组 A 题目 1'}).fill('第一道待定题');
 assert.deepEqual(await stored(),['第一道待定题','']);
 await page.getByRole('textbox',{name:'中英对照 题目组 A 题目 2'}).fill('第二道待定题');
 assert.deepEqual(await stored(),['第一道待定题','第二道待定题']);
 await page.reload();
 assert.equal(await page.evaluate(async()=>{const m=await import('/src/study/paperQuestions.ts');return m.paperTaskReady('bilingual',1);}),true);
 console.log('PASS: unprepared paper tasks require both questions per selected form and persist after reload');
}finally{await browser.close();}
