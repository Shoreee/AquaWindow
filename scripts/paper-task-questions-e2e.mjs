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

  await page.getByRole('combobox',{name:'测试切换题目'}).selectOption('2');
  await page.getByRole('button',{name:'开始答题'}).click();
  assert.equal(await page.getByRole('button',{name:'下一题'}).isDisabled(),true);
  const board=page.locator('.study-matching-board');
  for(const [left,right] of [['2','2'],['11','11'],['1','1']]){
    await board.locator(`[data-side="left"][data-id="${left}"]`).click();
    await board.locator(`[data-side="right"][data-id="${right}"]`).click();
  }
  assert.equal(await board.locator('line').count(),3);
  await page.getByRole('button',{name:'提交连线'}).click();
  assert.equal(await page.getByRole('button',{name:'下一题'}).isDisabled(),false);

  await page.getByRole('combobox',{name:'测试切换题目'}).selectOption('3');
  await page.getByRole('button',{name:'开始答题'}).click();
  assert.equal(await page.getByRole('button',{name:'下一题'}).isDisabled(),true);
  await page.evaluate(async()=>{const m=await import('/src/apps/StudyMaterials.tsx');m.openStudyResource('qa');});
  const qa=page.locator('.study-qa');
  await qa.locator('input[type=file]').setInputFiles({name:'architecture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fuoAAAAASUVORK5CYII=','base64')});
  await qa.getByRole('textbox',{name:'输入问题'}).fill('请解释图中的编码器和解码器。');
  await qa.getByRole('button',{name:'发送'}).click();
  await qa.getByText('实验示例回答 · 非实时生成').waitFor();
  await page.evaluate(async()=>{const {kernel}=await import('/src/system/kernel.ts');kernel.focus('experiment');});
  await page.getByRole('radio',{name:/编码器和解码器都包含/}).check();
  await page.getByRole('radio',{name:/只有解码器底部标有/}).check();
  await page.getByRole('button',{name:'提交答案'}).click();
  assert.equal(await page.getByRole('button',{name:'下一题'}).isDisabled(),false);
  const types=await page.evaluate(async()=>{const {logStore}=await import('/src/study/logger.ts');return logStore.get().records.map(record=>record.type);});
  assert.ok(types.includes('citation.match.submit'));
  assert.ok(types.includes('qa.image.send'));
  assert.ok(types.includes('qa.image.quiz.submit'));
  console.log('PASS: citation matching and image question unlock their paper stages');
}finally{await browser.close();}
