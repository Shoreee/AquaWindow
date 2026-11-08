import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({channel:process.env.AW_BROWSER??'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:950}});
 page.setDefaultTimeout(30000);
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5178/');
 await page.locator('.experiment-launcher').click();
 await page.getByRole('button',{name:'实验管理',exact:true}).click();
 assert.equal(await page.locator('.experiment-assignment-table').first().locator('tbody tr').count(),7);
 const details=page.locator('details[data-eligibility-task="comparison"]');
 await details.locator('summary').click();
 for(const index of [3,4,5,6,7])await details.locator('input[type=checkbox]').nth(index).uncheck();
 assert.equal(await details.locator('.experiment-question-set').count(),3);
 for(const [setIndex,letter] of ['A','B','C'].entries())for(let question=1;question<=2;question++){
  await page.getByRole('textbox',{name:`图文对照 题目组 ${letter} 题目 ${question}`}).fill(`${letter}${question} 测试题`);
 }
 const rows=page.locator('.experiment-assignment-table').first().locator('tbody tr');
 assert.match(await rows.nth(0).innerText(),/普通窗口 · A[\s\S]*掀角查看 · B[\s\S]*融合与拆分 · C/);
 assert.match(await rows.nth(1).innerText(),/掀角查看 · C[\s\S]*融合与拆分 · A[\s\S]*普通窗口 · B/);
 await page.getByRole('button',{name:'返回实验入口'}).click();
 await page.evaluate(async()=>{
  const m=await import('/src/study/onboarding.ts');
  m.registerParticipant('测试被试','001');
  m.onboarding.set({stage:'ready',records:m.learningQuestions.map(q=>({mode:q.mode,seconds:1,attempts:1,passedAt:new Date().toISOString()}))});
 });
 await page.getByRole('button',{name:/论文阅读/}).click();
 const current=()=>page.evaluate(async()=>{const f=await import('/src/study/flow.ts');return f.currentPaperCondition();});
 assert.equal((await current()).mode,'standard');
 for(const [mode,setIndex] of [['standard',0],['peel',1],['fusion',2]]){
  const before=await current();assert.equal(before.mode,mode);assert.equal(before.setIndex,setIndex);assert.equal(before.item,0);
  await page.evaluate(async()=>{const f=await import('/src/study/flow.ts');f.beginPaperLevel();});
  for(let item=0;item<2;item++){
   assert.equal((await current()).prompt,`${'ABC'[setIndex]}${item+1} 测试题`);
   await page.evaluate(async value=>{const f=await import('/src/study/flow.ts');f.finishPaperQuestion(value);},`${mode}-${item+1}`);
  }
  if(mode==='standard'){
   await page.reload();await page.locator('.experiment-launcher').click();
   await page.getByRole('textbox',{name:'姓名',exact:true}).fill('测试被试');
   await page.getByRole('textbox',{name:'学号',exact:true}).fill('001');
   await page.getByRole('button',{name:'进入教学'}).click();
   await page.getByRole('button',{name:'进入掌握效果测试'}).click();
   await page.getByRole('button',{name:'跳过掌握测试'}).click();
   await page.getByRole('button',{name:/论文阅读/}).click();
   assert.equal((await current()).mode,'peel');
  }
 }
 const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('aquawindow.experiment.records.v1')??'[]'));
 assert.equal(records.length,6);
 assert.deepEqual(records.map(record=>[record.task,record.technique,record.questionSet,record.questionIndex]),[
  ['comparison','standard',0,0],['comparison','standard',0,1],
  ['comparison','peel',1,0],['comparison','peel',1,1],
  ['comparison','fusion',2,0],['comparison','fusion',2,1],
 ]);
 assert.equal((await page.evaluate(async()=>{const f=await import('/src/study/flow.ts');return f.experimentFlow.get().levels.paper;})),1);
 await page.evaluate(async()=>{
  const m=await import('/src/study/onboarding.ts');m.registerParticipant('第二位被试','002');
  m.onboarding.set({stage:'ready',records:m.learningQuestions.map(q=>({mode:q.mode,seconds:1,attempts:1,passedAt:new Date().toISOString()}))});
 });
 await page.getByRole('button',{name:/论文阅读/}).click();
 const second=await current();assert.equal(second.mode,'peel');assert.equal(second.setIndex,2);
 await page.reload();
 const persisted=await page.evaluate(async()=>{const a=await import('/src/study/assignments.ts'),q=await import('/src/study/paperQuestions.ts');return {count:a.assignmentStore.get().participants.length,choices:a.assignmentStore.get().eligibility.paper.comparison,prompt:q.paperQuestionSet('comparison',2)[1]};});
 assert.deepEqual(persisted,{count:7,choices:['standard','peel','fusion'],prompt:'C2 测试题'});
 console.log('PASS: seven slots, three modes, two prompts per set, six records per participant, counterbalanced mode and set order');
}finally{await browser.close();}
