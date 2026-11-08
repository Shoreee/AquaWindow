import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({channel:process.env.AW_BROWSER??'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:950}});
 page.setDefaultTimeout(30000);
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5178/');
 const seeded=await page.evaluate(async()=>{
  const {paperQuestionSet,isChoiceQuestion}=await import('/src/study/paperQuestions.ts');
  return [0,1,2].map(index=>paperQuestionSet('comparison',index).map(question=>isChoiceQuestion(question)?{prompt:question.prompt,answer:question.answer,options:question.options}:question));
 });
 assert.deepEqual(seeded.map(set=>set.map(question=>question.answer)),[['A','B'],['B','A'],['A','C']]);
 assert.equal(seeded[0][0].options[0],'Masked Multi-Head Attention');
 assert.match(seeded[2][1].prompt,/下一个词的概率分布/);
 await page.locator('.experiment-launcher').click();
 await page.getByRole('button',{name:'实验管理',exact:true}).click();
 const details=page.locator('details[data-eligibility-task="comparison"]');await details.locator('summary').click();
 for(const index of [3,4,5,6,7])await details.locator('input[type=checkbox]').nth(index).uncheck();
 assert.equal(await details.locator('.experiment-question-set').count(),3);
 assert.equal(await page.getByRole('textbox',{name:'图文对照 题目组 A 题目 1 选项 A'}).inputValue(),'Masked Multi-Head Attention');
 await page.getByRole('button',{name:'返回实验入口'}).click();
 await page.getByRole('textbox',{name:'姓名',exact:true}).fill('测试被试');
 await page.getByRole('textbox',{name:'学号',exact:true}).fill('CHOICE-001');
 await page.getByRole('button',{name:'进入教学'}).click();
 await page.getByRole('button',{name:'进入掌握效果测试'}).click();
 await page.getByRole('button',{name:'跳过掌握测试'}).click();
 await page.getByRole('button',{name:/论文阅读/}).click();
 await page.getByRole('button',{name:'开始本形式'}).click();
 assert.equal(await page.getByRole('radio').count(),4);
 assert.equal(await page.getByRole('button',{name:'下一题'}).isDisabled(),true);
 await page.getByRole('radio',{name:/A\. Masked Multi-Head Attention/}).check();
 await page.getByRole('button',{name:'下一题'}).click();
 await page.getByRole('radio',{name:/B\. 右侧解码器/}).check();
 await page.getByRole('button',{name:'下一种形式'}).click();
 const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('aquawindow.experiment.records.v1')??'[]'));
 assert.deepEqual(records.map(record=>[record.questionSet,record.questionIndex,record.response,record.correct]),[[0,0,'A',true],[0,1,'B',true]]);
 console.log('PASS: task 1 has three two-question multiple-choice sets, selected answers and correctness are recorded');
}finally{await browser.close();}
