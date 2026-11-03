import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:process.env.AW_BROWSER??'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(process.env.AW_URL??'http://localhost:5173/');await page.waitForFunction(()=>!!window.__aw);
 for(const axis of ['x','y']){
  const ids=await page.evaluate(axis=>{const k=window.__aw.kernel;k.closeAll();const a=k.open({appId:'study',title:'关联文档 A',rect:axis==='x'?{x:100,y:100,w:420,h:500}:{x:200,y:100,w:560,h:230},props:{resource:'notes'}});const b=k.open({appId:'study',title:'关联文档 B',rect:axis==='x'?{x:524,y:65,w:420,h:490}:{x:165,y:334,w:600,h:230},props:{resource:'notes'}});return {a,b};},axis);
  await page.locator(`[data-win="${ids.a}"] .aw-title`).click({button:'right'});await page.getByRole('menuitem',{name:'与相邻窗口融合'}).click();
  await page.waitForFunction(({a,b})=>{const k=window.__aw.kernel;return k.get(a)?.group&&k.get(a)?.group===k.get(b)?.group&&!k.get(a).props.surfaceAnimating&&!k.get(b).props.surfaceAnimating;},ids);
  await page.waitForFunction(({a,b})=>[a,b].every(id=>document.querySelector(`[data-win="${id}"] .aw-shell`)?.style.clipPath===''),ids);
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(({a,b})=>[a,b].map(id=>document.querySelector(`[data-win="${id}"] .aw-shell`).style.clipPath),ids),['',''],'Closed staggered seams must never dent either window');
  await page.screenshot({path:`/tmp/aquaw-fusion-no-dent-${axis}.png`});
  const baseline=await page.evaluate(({a,b})=>[window.__aw.kernel.get(a).rect,window.__aw.kernel.get(b).rect],ids);
  const hit=page.locator('.surface-seam-hit').first(),box=await hit.boundingBox();
  const point=t=>axis==='x'?{x:box.x+box.width/2,y:box.y+12+(box.height-24)*t}:{x:box.x+12+(box.width-24)*t,y:box.y+box.height/2};
  const rects=()=>page.evaluate(({a,b})=>[window.__aw.kernel.get(a).rect,window.__aw.kernel.get(b).rect],ids);
  const move=async p=>page.mouse.move(p.x,p.y,{steps:12});
  await move(point(.5));await page.mouse.down();await move(point(.65));await page.mouse.up();assert.deepEqual(await rects(),baseline,'Middle of seam cannot move or resize the group');
  await move(point(.01));await page.mouse.down();await move(point(.35));await page.waitForFunction(()=>Number(document.querySelector('.surface-seam').dataset.surfaceProgress)>.25);
  assert.deepEqual(await rects(),baseline,'Zipping changes the seam, not the window positions');assert.equal(await page.evaluate(()=>window.__aw.ui.get().activeId),null);
  await page.screenshot({path:`/tmp/aquaw-zipper-${axis}.png`});await page.mouse.up();await page.waitForFunction(()=>Number(document.querySelector('.surface-seam').dataset.surfaceProgress)===0);assert.deepEqual(await rects(),baseline);
  // Reaching the far endpoint separates while the pointer is still held.
  await move(point(.99));await page.mouse.down();await move(point(-.03));await page.waitForFunction(({a,b})=>!window.__aw.kernel.get(a).group&&!window.__aw.kernel.get(b).group,ids);
  assert.equal(await page.locator('.surface-zipper-handle,.zipper-thumb,.zipper-endpoint').count(),0);
  await page.mouse.up();
  await page.keyboard.press('Control+z');await page.waitForFunction(({a,b})=>window.__aw.kernel.get(a).group===window.__aw.kernel.get(b).group&&!!window.__aw.kernel.get(a).group,ids);assert.deepEqual(await rects(),baseline);
 }
 assert.deepEqual(errors,[]);console.log('PASS: vertical/horizontal zipper ownership, no mid-seam moving, fixed rectangles during opening, reverse pull, rollback and undo.');
}finally{await browser.close();}
