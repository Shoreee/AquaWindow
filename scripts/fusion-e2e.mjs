import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],calls=[];page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(r.url().includes('/api/agent/')||r.url().includes('api.deepseek.com'))calls.push(r.url())});
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__aw?.planBuffer.entries.size);
 const ids=await page.evaluate(()=>({writer:window.__aw.kernel.list().find(w=>w.appId==='writer').id,paper:window.__aw.kernel.list().find(w=>w.appId==='preview').id}));
 const root=page.locator(`[data-win="${ids.writer}"]`),snapshot=()=>page.evaluate(()=>window.__aw.kernel.getState().windows);
 await root.locator('.aw-title').click({button:'right'});await page.getByRole('menuitem',{name:'与相关窗口融合',exact:true}).click();
 await page.waitForFunction(({writer,paper})=>{const s=window.__aw.kernel.getState();return s.windows[writer].group?.startsWith('surface:')&&s.windows[writer].rect.x-s.windows[paper].rect.x-s.windows[paper].rect.w<4.01;},ids);
 await page.waitForFunction(()=>window.__aw.kernel.lastHistory()?.label==='surface:fuse');
 const fused=await snapshot();assert.equal(fused[ids.writer].group,fused[ids.paper].group);await page.locator('[data-surface-bond]').waitFor();await page.screenshot({path:'screenshots/qa/surface-fused.png'});
 const title=await root.locator('.aw-title').boundingBox();await page.mouse.move(title.x+150,title.y+20);await page.mouse.down();await page.mouse.move(title.x+180,title.y+42,{steps:8});
 const moved=await snapshot();for(const id of [ids.writer,ids.paper]){assert.ok(Math.abs(moved[id].rect.x-fused[id].rect.x-30)<.05);assert.ok(Math.abs(moved[id].rect.y-fused[id].rect.y-22)<.05);}
 await page.waitForTimeout(700);const energy=await page.locator('.agent-front').evaluate(el=>el.__energy);assert.ok(energy.morph<.01,'Manual movement must not hatch the energy core');assert.ok(energy.core||Number(await page.locator('.iridescent-cursor').evaluate(e=>getComputedStyle(e).opacity))>.9);
 const cover=await root.locator('.agent-transport-skin').getAttribute('data-transport-coverage');assert.ok(Number(cover)>.45&&Number(cover)<.95,'The swallowing front must still be spreading at 700ms');
 await page.mouse.up();await page.waitForFunction(()=>!Object.values(window.__aw.kernel.getState().windows).some(w=>w.props.agentMotion));
 async function pull(fraction){const s=await snapshot(),a=s[ids.paper].rect,b=s[ids.writer].rect,lo=Math.max(a.y,b.y)+25,hi=Math.min(a.y+a.h,b.y+b.h)-25,x=(a.x+a.w+b.x)/2;
  await page.mouse.move(x,lo+2);await page.mouse.down();await page.mouse.move(x,(fraction===1?Math.ceil(hi)+2:lo+(hi-lo)*fraction),{steps:14});await page.screenshot({path:`screenshots/qa/surface-pull-${fraction}.png`});await page.mouse.up();}
 const beforePartial=await snapshot();await pull(.7);await page.waitForTimeout(600);assert.deepEqual(await snapshot(),beforePartial,'A partial opening must restore both the bond and window positions');
 await pull(.998);await page.waitForTimeout(600);assert.equal((await snapshot())[ids.writer].group,(await snapshot())[ids.paper].group,'Almost reaching the end must not detach');
 await pull(1);await page.waitForFunction(({writer,paper})=>{const s=window.__aw.kernel.getState();return !s.windows[writer].group&&!s.windows[paper].group;},ids);assert.equal(await page.locator('[data-surface-bond]').count(),0);
 await page.keyboard.press('Escape');await page.locator('[data-surface-bond]').waitFor();assert.deepEqual(await snapshot(),beforePartial,'One undo must restore the joined group');
 await pull(1);await page.waitForFunction(()=>!document.querySelector('[data-surface-bond]'));
 const separate=await snapshot(),newTitle=await root.locator('.aw-title').boundingBox();await page.mouse.move(newTitle.x+150,newTitle.y+20);await page.mouse.down();await page.mouse.move(newTitle.x+138,newTitle.y+20,{steps:8});await page.locator('.surface-fusion-preview').waitFor();
 const anticipation=page.locator('.surface-fusion-anticipation [data-living-path]').first();await anticipation.waitFor({state:'attached'});const initialWave=await anticipation.getAttribute('d');await page.waitForTimeout(120);assert.notEqual(await anticipation.getAttribute('d'),initialWave,'Approaching fusion must visibly flow along the facing boundaries');await page.mouse.up();
 await page.waitForFunction(({writer,paper})=>{const s=window.__aw.kernel.getState();return s.windows[writer].group&&s.windows[writer].rect.x-s.windows[paper].rect.x-s.windows[paper].rect.w<4.01;},ids);
 await page.waitForFunction(()=>window.__aw.kernel.lastHistory()?.label==='move');await page.keyboard.press('Escape');assert.deepEqual(await snapshot(),separate,'Automatic fusion on drop must keep the whole drag in one undo entry');
 assert.deepEqual(errors,[]);assert.deepEqual(calls,[]);console.log('PASS: related-window fusion, group movement, no manual energy core, slower visible swallowing, partial/near-end rollback, full separation, auto attachment and one-step undo.');
}finally{await browser.close();}
