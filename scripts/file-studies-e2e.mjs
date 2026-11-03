import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5176/');
 await page.waitForFunction(()=>!!window.__aw);
 const pdfId=await page.evaluate(()=>window.__aw.kernel.open({appId:'study',title:'Attention Is All You Need 中文版.pdf',rect:{x:150,y:80,w:650,h:680},props:{resource:'pdf',taskId:'comparison'}}));
 await page.waitForFunction(id=>document.querySelector(`[data-win="${id}"] .study-pdf-page[data-page="1"] canvas`)?.style.visibility==='visible',pdfId);
 await page.locator(`[data-win="${pdfId}"] .study-pdf-scroll`).evaluate(element=>{element.scrollTop=410});
 const modeMenu=async()=>{await page.locator('.study-mode-trigger').click();return page.locator('.system-drop.study-mode .study-mode-option')};
 await (await modeMenu()).filter({hasText:'融合与拆分'}).click();
 const switchEnvironment=async(label)=>{await page.locator('.study-environment-trigger').click();await page.locator('.system-drop.study-environment .study-mode-option').filter({hasText:label}).click()};
 await switchEnvironment('文件管理');
 assert.equal(await page.locator(`[data-win="${pdfId}"]`).count(),0);
 assert.equal(await (await modeMenu()).count(),2);
 await page.locator('.study-mode-trigger').click();
 await page.locator('.study-task-toggle').click();
 await (await modeMenu()).filter({hasText:'并列呈现'}).click();
 await page.getByRole('button',{name:'任务二'}).click();
 assert.equal(await page.evaluate(()=>window.__aw.ui.get().studyEnvironment),'files');
 assert.match(await page.locator('.study-mode-trigger').innerText(),/并列呈现/);
 assert.equal(await page.getByRole('button',{name:'开始任务'}).isEnabled(),true);
 await page.getByRole('button',{name:'开始任务'}).click();
 await page.locator('.file-study-guide').getByText('请找到开票日期为 2026 年 10 月 12 日、项目为文创打印制作费、价税合计为 326 元的发票样张。').waitFor();
 assert.deepEqual(await page.evaluate(()=>{const guide=window.__aw.kernel.list().find(win=>win.appId==='file-study-guide');return [guide?.rect.x,guide?.rect.y,guide?.rect.w,guide?.rect.h]}),[8,36,1424,142]);
 assert.deepEqual(await page.evaluate(()=>window.__aw.kernel.list().filter(win=>win.appId==='file-study').sort((a,b)=>a.rect.x-b.rect.x).map(win=>win.props.studyDocumentId)),['task2-a','task2-b','task2-c']);
 await page.locator('.study-task-toggle').click();
 await page.getByRole('button',{name:'任务一'}).click();
 const cases=[
  {task:'任务一',target:'download_8734.pdf'},
  {task:'任务二',target:'download_6382.png'},
  {task:'任务三',target:'scan_5721.png'},
 ];
 for(const item of cases){
  if(item.task!=='任务一')await page.getByRole('button',{name:item.task}).click();
  for(const mode of ['并列呈现','主次呈现']){
   if(mode==='主次呈现')await page.getByRole('button',{name:item.task}).click();
   await (await modeMenu()).filter({hasText:mode}).click();
   await page.getByRole('button',{name:'开始任务'}).click();
   assert.equal(await page.locator('[data-win]').filter({has:page.locator('.file-study-guide')}).count(),1);
   assert.equal(await page.evaluate(()=>window.__aw.kernel.list().filter(win=>win.appId==='file-study').length),mode==='并列呈现'?3:4);
   if(item.task==='任务三'){
    assert.equal(await page.locator('.file-study-task3').count(),mode==='并列呈现'?3:4);
    assert.equal(await page.locator('.file-study-task3.task1-native-compact').count(),mode==='并列呈现'?0:3);
    assert.equal(await page.locator('.file-study-task3 .study-document-image').count(),mode==='并列呈现'?3:4);
   }
   if(mode==='主次呈现'){
    if(item.task==='任务一'){
     await page.waitForFunction(()=>document.querySelector('.file-study-document .study-pdf-page canvas')?.style.visibility==='visible');
     await page.locator('.file-study-document .study-pdf-scroll').evaluate(element=>{element.scrollTop=220});
    }
    const secondary=page.locator(item.task==='任务三'?'.task1-native-promote':'.file-study-compact').first();
    await secondary.click();
    await page.waitForFunction(()=>window.__aw.kernel.list().some(win=>win.appId==='file-study'&&win.props.studyDocumentId?.endsWith('-b')&&win.rect.x<window.innerWidth/2));
    if(item.task==='任务三')await page.locator('[data-win]').filter({hasText:item.target}).locator('.task1-native-promote').click();
    else await page.locator('.file-study-compact').filter({hasText:item.target}).click();
    if(item.task==='任务一'){
     await page.waitForFunction(()=>document.querySelector('.file-study-document .study-pdf-scroll')?.scrollTop>160);
    }
   }
   const targetWindow=page.locator('[data-win]').filter({has:page.locator(item.task==='任务三'?'.file-study-task3:not(.task1-native-compact)':'.file-study-document')}).filter({hasText:item.target});
   await targetWindow.getByRole('button',{name:'选择此文件并提交'}).click();
   await page.locator('.study-task-toggle').click();
   await page.getByText('已提交。本轮答案已记录。').waitFor();
  }
 }
 const results=await page.evaluate(()=>JSON.parse(localStorage.getItem('aquawindow.file-studies.results.v1')));
 assert.equal(results.length,6);
 assert.ok(results.every(result=>result.correct));
 assert.deepEqual(new Set(results.map(result=>result.mode)),new Set(['parallel','primary-secondary']));
 const fileWindows=await page.evaluate(()=>window.__aw.kernel.getState().order);
 await switchEnvironment('论文阅读');
 assert.equal(await page.evaluate(()=>window.__aw.ui.get().studyMode),'fusion');
 assert.ok(await page.evaluate(id=>!!window.__aw.kernel.get(id),pdfId));
 assert.ok(await page.locator(`[data-win="${pdfId}"] .study-pdf-scroll`).evaluate(element=>element.scrollTop)>350);
 await switchEnvironment('文件管理');
 assert.deepEqual(await page.evaluate(()=>window.__aw.kernel.getState().order),fileWindows);
 assert.equal(await (await modeMenu()).count(),2);
 assert.deepEqual(errors,[]);
 console.log('PASS: three tasks in parallel and primary-secondary modes; paper workspace remains independent.');
}finally{await browser.close()}
