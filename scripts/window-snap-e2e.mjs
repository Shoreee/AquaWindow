import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(process.env.AW_URL??'http://127.0.0.1:5176/');
  await page.waitForFunction(()=>!!window.__aw);

  async function snap(id,side){
    const bar=page.locator(`[data-win="${id}"] .aw-title`);
    const box=await bar.boundingBox();
    assert.ok(box,`missing title bar for ${id}`);
    const y=box.y+box.height/2;
    await page.mouse.move(box.x+box.width/2,y);
    await page.mouse.down();
    await page.mouse.move(side==='left'?12:1428,y,{steps:12});
    await page.locator('.snap-preview').waitFor({state:'visible'});
    await page.mouse.up();
    await page.waitForFunction(({id,side})=>{
      const rect=window.__aw.kernel.get(id)?.rect;
      return rect&&Math.abs(rect.x-(side==='left'?8:724))<1&&Math.abs(rect.w-708)<1;
    },{id,side});
    assert.equal(await page.locator('.snap-preview').count(),0);
  }

  const paperIds=await page.evaluate(()=>[
    window.__aw.kernel.open({appId:'finder',title:'Paper left',rect:{x:100,y:100,w:500,h:500}}),
    window.__aw.kernel.open({appId:'finder',title:'Paper right',rect:{x:760,y:160,w:500,h:500}}),
  ]);
  assert.equal(await page.evaluate(()=>window.__aw.ui.get().tech.snap),true);
  await snap(paperIds[0],'left');
  await snap(paperIds[1],'right');

  await page.locator('.study-environment-trigger').click();
  await page.locator('.system-drop.study-environment .study-mode-option').nth(1).click();
  assert.equal(await page.evaluate(()=>window.__aw.ui.get().studyEnvironment),'files');
  assert.equal(await page.evaluate(()=>window.__aw.ui.get().tech.snap),true);
  const fileIds=await page.evaluate(()=>window.__aw.kernel.list().filter(win=>win.appId==='finder').map(win=>win.id));
  assert.equal(fileIds.length,2);
  await snap(fileIds[0],'left');
  await snap(fileIds[1],'right');
  assert.deepEqual(errors,[]);
  console.log('PASS: left and right edge drag snaps windows in paper and file environments.');
}finally{await browser.close()}
