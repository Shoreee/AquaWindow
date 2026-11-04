import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({channel:process.env.AW_BROWSER??'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:950}});
 page.setDefaultTimeout(30000);
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5178/');
 await page.locator('.experiment-launcher').click();
 await page.getByRole('button',{name:'跳过信息录入（测试）'}).click();
 await page.getByRole('button',{name:'进入掌握效果测试'}).click();
 await page.getByRole('button',{name:'跳过掌握测试'}).click();
 await page.getByRole('button',{name:/论文阅读/}).click();
 assert.deepEqual(await page.evaluate(async()=>{const m=await import('/src/study/flow.ts');return m.paperLevels}),['comparison','bilingual','external','answer']);
 await page.getByRole('combobox',{name:'测试切换题目'}).selectOption('1');
 await page.getByRole('button',{name:'开始答题'}).click();
 await page.evaluate(async()=>{const m=await import('/src/apps/StudyMaterials.tsx');m.openStudyResource('english-pdf');});
 const reader=page.locator('.aw-win').filter({has:page.locator('.study-pdf-text-layer')}).last();
 await reader.locator('.study-pdf-scroll').evaluate(root=>{const third=root.querySelector('[data-page="3"]');if(third)root.scrollTop=third.offsetTop;});
 await reader.locator('[data-page="3"] .study-pdf-text-layer span').first().waitFor();
 const layer=await reader.locator('[data-page="3"] .study-pdf-text-layer').evaluate(el=>({text:el.textContent??'',height:el.querySelector('span')?.getBoundingClientRect().height??0}));
 assert.match(layer.text,/The encoder is composed/);assert.ok(layer.height>0);
 const expected=await page.evaluate(async()=>{const m=await import('/src/study/tasks.ts');return m.studyTasks.bilingual.bilingualPrompt.english});
 await page.getByRole('textbox',{name:'对应英文原文'}).fill(expected);
 await page.getByRole('button',{name:'提交英文原文'}).click();
 assert.equal(await page.getByRole('button',{name:'下一题'}).isDisabled(),false);
 await page.getByRole('combobox',{name:'测试切换题目'}).selectOption('2');
 const task=await page.evaluate(async()=>{const m=await import('/src/study/tasks.ts');return m.studyTasks.external});
 assert.ok(task.resources.some(item=>item.id==='bahdanau'));
 await page.evaluate(async()=>{const m=await import('/src/apps/StudyMaterials.tsx');m.openStudyResource('browser');});
 await page.getByRole('textbox',{name:'搜索网页'}).fill('https://arxiv.org/abs/1706.03762');
 await page.getByRole('button',{name:'搜索'}).click();
 const frame=page.frameLocator('.study-browser iframe');
 await frame.getByRole('heading',{name:'Attention Is All You Need'}).waitFor();
 assert.match(await frame.locator('body').innerText(),/arXiv:1706\.03762/);
 console.log('PASS: bilingual source selection and answer, merged task count, arXiv address opens local page');
}finally{await browser.close();}
