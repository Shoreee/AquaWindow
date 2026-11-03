import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:process.env.AW_BROWSER??'chrome',headless:true});
try{
 for(const mode of ['parallel','primary-secondary']){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(process.env.AW_URL??'http://localhost:5173/');await page.waitForFunction(()=>!!window.__aw);
  const pdfId=await page.evaluate(()=>window.__aw.kernel.open({appId:'study',title:'原桌面论文',rect:{x:150,y:80,w:650,h:680},props:{resource:'pdf',taskId:'comparison'}}));
  await page.waitForFunction(id=>document.querySelector(`[data-win="${id}"] .study-pdf-page canvas`)?.style.visibility==='visible',pdfId);
  await page.locator(`[data-win="${pdfId}"] .study-pdf-scroll`).evaluate(el=>{el.scrollTop=410});
  await page.getByRole('button',{name:'打开实验',exact:true}).click();await page.getByRole('textbox',{name:'参与者编号'}).fill('P01');
  await page.locator('.experiment-worlds').getByRole('button',{name:/文件管理/}).click();
  const orders=[];
  for(let index=0;index<3;index++){
   const task=`task${index+1}`;await page.getByText(`第 ${index+1} / 3 题`,{exact:true}).waitFor();
   await page.getByRole('combobox',{name:'交互方式'}).selectOption('peel');
   assert.equal(await page.evaluate(()=>window.__aw.ui.get().tech.peel),true);
   await page.getByRole('combobox',{name:'呈现方式'}).selectOption(mode);await page.getByRole('button',{name:'开始答题',exact:true}).click();
   await page.waitForFunction(()=>window.__aw.kernel.list().filter(w=>w.appId==='file-study').length===4);
   orders.push(await page.evaluate(()=>window.__aw.kernel.list().filter(w=>w.appId==='file-study').map(w=>w.props.studyDocumentId)));
   const target=await page.evaluate(task=>window.__aw.kernel.list().find(w=>w.props.studyDocumentId===`${task}-a`).id,task),root=page.locator(`[data-win="${target}"]`);
   if(mode==='primary-secondary'){
    const selector=task==='task3'?'.task1-native-promote':'.file-study-compact',secondary=page.locator(selector).first();
    await secondary.click();
    if(await root.locator(selector).count())await root.locator(selector).click();
   }
   await root.getByRole('button',{name:'选择此文件并提交',exact:true}).click();await page.getByRole('button',{name:'打开实验',exact:true}).click();
   await page.locator('.experiment-app').getByRole('status').filter({hasText:'已提交'}).waitFor();await page.getByRole('button',{name:'下一题',exact:true}).click();
  }
  await page.getByRole('heading',{name:'本轮已完成',exact:true}).waitFor();
  const results=await page.evaluate(()=>JSON.parse(localStorage.getItem('aquawindow.file-studies.results.v1')));
  assert.equal(results.length,3);assert.ok(results.every(item=>item.correct&&item.mode===mode&&item.candidateOrder.length===4));
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'导出记录',exact:true}).click();const download=await event;assert.equal(download.suggestedFilename(),'aquawindow-experiment.json');const output=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(output.stages.length,3);assert.deepEqual(output.stages.map(stage=>stage.stage),[1,2,3]);assert.ok(output.stages.every(stage=>stage.participant==='P01'&&stage.technique===mode&&!stage.selfReported));
  await page.locator('[data-win="experiment"]').getByRole('button',{name:'关闭',exact:true}).click();
  assert.ok(await page.locator(`[data-win="${pdfId}"] .study-pdf-scroll`).evaluate(el=>el.scrollTop)>350);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: sequential levels in both file layouts, same four candidates, promotion, submissions, export and desktop restoration.');
}catch(error){const p=browser.contexts().flatMap(c=>c.pages())[0];if(p){console.log(await p.locator('body').innerText());console.log(await p.evaluate(()=>({ui:window.__aw.ui.get(),windows:window.__aw.kernel.list().map(w=>({id:w.id,appId:w.appId,title:w.title,minimized:w.minimized}))})));await p.screenshot({path:'/tmp/aquaw-file-error.png'});}throw error;}finally{await browser.close();}
