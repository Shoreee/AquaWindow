import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
import {fixturePlans} from './adaptive-fixtures.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});const out='screenshots/qa';await mkdir(out,{recursive:true});
const base=process.env.AW_URL??'http://127.0.0.1:5175/';
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});const page=await context.newPage(),errors=[],calls=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>{if(r.url().includes('/api/agent/'))calls.push(r.url())});
 await page.goto(base);await page.waitForFunction(()=>window.__aw?.planBuffer.entries.size);
 const snapshot=()=>page.evaluate(()=>{const s=window.__aw.kernel.getState();return {windows:s.windows,order:s.order,focusedId:s.focusedId}}),state=()=>page.evaluate(()=>window.__aw.adaptation.store.get());
 const before=await snapshot();assert.equal(Object.keys(before.windows).length,3);
 await page.mouse.move(1380,780);await page.keyboard.down('Space');await page.waitForTimeout(180);await page.keyboard.up('Space');assert.equal((await state()).phase,'idle');assert.equal(await page.evaluate(()=>window.__aw.kernel.canUndo()),false);
 await page.waitForTimeout(850);await page.keyboard.down('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='cycling');
 assert.equal((await state()).plans.length,7);assert.equal(await page.locator('.agent-candidate-tabs button').count(),7);
 const selected=(await state()).selectedIds;await page.mouse.click(320,80);assert.deepEqual((await state()).selectedIds,selected,'Space-click must not retarget');
 await page.waitForTimeout(3000);assert.equal((await state()).index,0,'Preview never auto-cycles');
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');assert.equal((await state()).index,2);
 await page.waitForFunction(()=>Object.values(window.__aw.kernel.getState().windows).some(w=>w.props.agentMotion?.primitive==='yield'&&w.props.agentMotion.action>.3));
 const tether=await page.locator('.agent-front').evaluate(c=>c.__energy.links.find(l=>l.coordinator));assert.equal(tether.progress,tether.tail,'Same-object switching reuses established energy');
 await page.screenshot({path:`${out}/yield-directional-edge.png`});await page.keyboard.up('Space');assert.equal((await state()).phase,'applying');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='idle');
 assert.ok(await page.evaluate(()=>window.__aw.kernel.lastHistory()?.label.includes('让界')));assert.notDeepEqual((await snapshot()).windows,before.windows);
 await page.keyboard.press('Escape');assert.deepEqual(await snapshot(),before);
 await page.mouse.move(1380,780);await page.keyboard.down('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='cycling');await page.keyboard.press('ArrowRight');await page.keyboard.up('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='idle');
 assert.ok(await page.locator('[data-reveal-mode=edge]').count());await page.locator('.toast button').last().click();assert.deepEqual(await snapshot(),before);
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='cycling');for(let i=0;i<4;i++)await page.keyboard.press('ArrowRight');await page.waitForTimeout(700);await page.keyboard.press('ArrowLeft');await page.keyboard.press('Escape');await page.keyboard.up('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='idle');assert.deepEqual(await snapshot(),before);
 assert.deepEqual(calls,[]);assert.deepEqual(errors,[]);
 await page.setViewportSize({width:980,height:720});await page.waitForTimeout(300);assert.ok((await snapshot()).order.length===3);
 // Explicit opt-in uses only fixtures; never contacts a model service.
 await context.route('**/api/agent/status',r=>r.fulfill({json:{configured:true,model:'fixture'}}));
 await context.route('**/api/agent/plan',r=>{const{context}=r.request().postDataJSON();return r.fulfill({json:{plans:fixturePlans(context)}})});
 await page.getByRole('button',{name:'AquaWindow',exact:true}).click();await page.getByRole('switch',{name:'接入 DeepSeek'}).click();await page.mouse.click(950,650);await page.waitForFunction(()=>window.__aw.planBuffer.status==='ready');assert.ok(calls.length>0);
 await page.reload();await page.waitForFunction(()=>window.__aw?.planBuffer.entries.size);assert.equal(await page.evaluate(()=>window.__aw.planBuffer.remoteEnabled),false);
 for(const reduced of [true,false]){
  const c=await browser.newContext({viewport:{width:1100,height:780},reducedMotion:reduced?'reduce':'no-preference'});
  if(!reduced)await c.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args)}});
  const p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>window.__aw?.planBuffer.entries.size);await p.mouse.move(1040,700);await p.keyboard.down('Space');await p.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='cycling');await p.keyboard.press('ArrowRight');await p.keyboard.up('Space');await p.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='idle');assert.ok(await p.locator('[data-reveal-mode=edge]').count());await c.close();
 }
 await context.close();console.log('PASS: seven manual candidates, live arrows, pre-burst Space-click selection, release acceptance, Esc/button undo, smooth interruption, local mode, opt-in fixtures, reduced motion and WebGL fallback.');
}finally{await browser.close()}
