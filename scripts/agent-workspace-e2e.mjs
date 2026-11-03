import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {PlanningMemory} from '../src/agent/adaptive/planningIO.ts';
const browser=await chromium.launch({channel:'chrome',headless:true});
const url=process.env.AW_URL??'http://localhost:5173/';
const errors=[];
function response(ctx){const primary=ctx.selectedIds.length?ctx.selectedIds:[ctx.focusedId??ctx.windows[0].id];return {plans:[{id:'model-context-layout',title:'对照当前材料',rationale:'保留文档位置并安排对照窗口。',priority:.8,confidence:.7,primaryTargets:primary,supportTargets:ctx.windows.filter(w=>!primary.includes(w.id)).map(w=>w.id),steps:[{type:'arrange',targets:ctx.windows.map(w=>w.id),layout:'compare'}],artifacts:[]}]};}
async function setup(delay=0){
 const page=await browser.newPage({viewport:{width:1440,height:900}}),memory=new PlanningMemory(),requests=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/api/agent/plan',async route=>{
  const packet=route.request().postDataJSON();let prepared;
  try{prepared=memory.prepare(packet,'test system');}catch{await route.fulfill({status:409,json:{error:'base_missing'}}).catch(()=>{});return;}
  requests.push({packet,context:prepared.context});
  await new Promise(resolve=>setTimeout(resolve,delay));const output=response(prepared.context),referenceId=memory.remember({...prepared,output});
  await route.fulfill({json:{...output,referenceId}}).catch(()=>{});
 });
 await page.goto(url);await page.waitForFunction(()=>window.__aw?.workspaceModel);
 await page.evaluate(()=>{const {kernel,ui}=window.__aw;kernel.closeAll();ui.set({agentEnabled:true});kernel.open({id:'paper',appId:'study',title:'论文',rect:{x:70,y:65,w:610,h:650},props:{resource:'pdf',taskId:'comparison'}});kernel.open({id:'note',appId:'study',title:'笔记',rect:{x:470,y:100,w:610,h:620},props:{resource:'notes'}});});
 await page.locator('[data-win="note"] .study-notes').fill('核对论文图表，记录证据。');await page.locator('[data-win="note"] .aw-title').focus();
 await page.waitForFunction(async()=>{const {appObservation}=await import('/src/agent/adaptive/observations.ts');return !!appObservation('paper')?.text;});
 return {page,requests};
}
async function context(page){return page.evaluate(async()=>{const {workArea}=await import('/src/system/kernel.ts'),{bus}=await import('/src/system/bus.ts');return window.__aw.workspaceModel.context(window.__aw.kernel.getState(),workArea(),[],bus.recent,{accepted:[],rejected:[]});});}
try{
 // Pending model request produces no local candidate or layout changes.
 {
  const {page,requests}=await setup(4200),baseline=await page.evaluate(()=>window.__aw.kernel.getState().windows);
  await page.evaluate(()=>window.__aw.planBuffer.setRemoteEnabled(true));await page.keyboard.down('Space');
  await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='waiting');
  assert.equal(await page.locator('.agent-candidate-tabs button').count(),0);
  assert.deepEqual(await page.evaluate(()=>window.__aw.kernel.getState().windows),baseline);
  await page.keyboard.up('Space');assert.equal(await page.evaluate(()=>window.__aw.adaptation.store.get().phase),'waiting');
  await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='frozen',null,{timeout:7000});
  assert.ok(await page.evaluate(()=>window.__aw.adaptation.store.get().plans.every(p=>p.origin==='deepseek')));
  await page.keyboard.press('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='idle');
  assert.equal(await page.evaluate(()=>window.__aw.kernel.lastHistory()?.actor),'agent');
  await page.keyboard.press('Control+z');assert.deepEqual(await page.evaluate(()=>window.__aw.kernel.getState().windows),baseline);
  assert.ok(requests.some(r=>r.context.sources.some(s=>s.windowId==='note'&&s.text.includes('记录证据'))));await page.close();
 }
 // Small geometry changes reuse actual model output; larger changes use real reference+delta.
 {
  const {page,requests}=await setup();await page.evaluate(()=>window.__aw.planBuffer.setRemoteEnabled(true));const first=await context(page);
  await page.evaluate(ctx=>window.__aw.planBuffer.request(ctx,true),first);await page.waitForFunction(()=>window.__aw.planBuffer.status==='ready');
  const calls=requests.length;
  await page.evaluate(()=>{const k=window.__aw.kernel,w=k.get('note');k.setRect('note',{...w.rect,x:w.rect.x+8});});
  const small=await context(page);
  const cached=await page.evaluate(ctx=>{const b=window.__aw.planBuffer,plans=b.get(ctx);b.request(ctx,true);return plans;},small);
  assert.ok(cached?.length);await page.waitForTimeout(100);assert.equal(requests.length,calls);
  await page.evaluate(()=>{const k=window.__aw.kernel,w=k.get('note');k.setRect('note',{...w.rect,x:80});});const large=await context(page);
  assert.equal(await page.evaluate(ctx=>window.__aw.planBuffer.get(ctx),large),null);
  await page.evaluate(ctx=>window.__aw.planBuffer.request(ctx,true),large);await page.waitForFunction(()=>window.__aw.planBuffer.status==='ready');
  const packet=requests.at(-1).packet;assert.ok(packet.baseId);assert.equal(packet.context,undefined);assert.equal(packet.delta.sources.upsert.length,0);assert.ok(packet.delta.windows.upsert.length);
  await page.close();
 }
 // A late model response never applies after the explicit ten-second timeout.
 {
  const {page}=await setup(11500),baseline=await page.evaluate(()=>window.__aw.kernel.getState().windows);
  await page.evaluate(()=>window.__aw.planBuffer.setRemoteEnabled(true));const start=Date.now();await page.keyboard.down('Space');
  await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='waiting');await page.waitForTimeout(5500);
  assert.equal(await page.evaluate(()=>window.__aw.adaptation.store.get().phase),'waiting');assert.equal(await page.locator('.agent-candidate-tabs button').count(),0);
  await page.getByText(/Error：自适应等待超过 10 秒/).waitFor({timeout:4500});assert.ok(Date.now()-start>=9900);
  await page.keyboard.up('Space');await page.waitForTimeout(2000);assert.equal(await page.evaluate(()=>window.__aw.adaptation.store.get().phase),'idle');
  assert.deepEqual(await page.evaluate(()=>window.__aw.kernel.getState().windows),baseline);await page.screenshot({path:'/tmp/aquaw-agent-timeout-verified.png'});await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: model-only waiting, ten-second timeout, unchanged layout before response, actual cached-result reuse, large-change delta requests, observed content, confirmation and undo.');
}finally{await browser.close();}
