import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({channel:process.env.AW_BROWSER??'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 page.setDefaultTimeout(20000);
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5178/');
 await page.locator('.experiment-launcher').click();
 await page.getByRole('button',{name:'跳过信息录入（测试）'}).click();
 await page.getByRole('button',{name:'进入掌握效果测试'}).click();
 await page.getByRole('button',{name:'跳过掌握测试'}).click();
 assert.match(await page.locator('.experiment-hub').innerText(),/测试模式/);
 await page.getByRole('button',{name:/论文阅读/}).click();
 await page.getByRole('combobox',{name:'测试切换题目'}).selectOption('3');
 assert.deepEqual(await page.evaluate(async()=>{const f=await import('/src/study/flow.ts'),t=await import('/src/study/tasks.ts');return [f.experimentFlow.get().levels.paper,t.studyTaskStore.get().current,f.experimentFlow.get().stageRunning]}),[3,'answer',false]);
 await page.getByRole('combobox',{name:'测试切换题目'}).selectOption('1');
 await page.getByRole('button',{name:'开始本形式'}).click();
 await page.getByRole('combobox',{name:'测试切换题目'}).selectOption('2');
 assert.deepEqual(await page.evaluate(async()=>{const f=await import('/src/study/flow.ts'),t=await import('/src/study/tasks.ts');return [f.experimentFlow.get().levels.paper,t.studyTaskStore.get().current,f.experimentFlow.get().stageRunning]}),[2,'external',false]);
 await page.getByRole('button',{name:'返回实验'}).click();
 await page.getByRole('button',{name:/文件管理/}).click();
 await page.getByRole('combobox',{name:'测试切换题目'}).selectOption('2');
 assert.deepEqual(await page.evaluate(async()=>{const f=await import('/src/study/flow.ts'),w=await import('/src/study/workspaces.ts');return [f.experimentFlow.get().levels.files,w.fileTaskStore.get().current]}),[2,'task3']);
 await page.evaluate(async()=>{const w=await import('/src/study/workspaces.ts'),f=await import('/src/study/flow.ts');w.startFileTask();w.submitFileDocument('task3-a');f.finishLevel(false);});
 const saved=await page.evaluate(()=>({assignments:localStorage.getItem('aquawindow.experiment.assignments.v1'),records:localStorage.getItem('aquawindow.experiment.records.v1'),skips:localStorage.getItem('aquawindow.experiment.learning-skips.v1'),files:localStorage.getItem('aquawindow.file-studies.results.v1')}));
 assert.equal(JSON.parse(saved.assignments).length,7);
 assert.ok(JSON.parse(saved.assignments).every(person=>person.pending));
 assert.deepEqual({records:saved.records,skips:saved.skips,files:saved.files},{records:null,skips:null,files:null});
 console.log('PASS: profile skip enters test mode, paper and file tasks switch freely, formal data remains clean');
}finally{await browser.close();}
