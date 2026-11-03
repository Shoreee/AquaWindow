import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let mode='corner-peel';const requests=[];
 await page.route('**/api/agent/plan',route=>{
  const packet=route.request().postDataJSON();assert.ok(packet.context);const ctx=packet.context;requests.push(ctx);
  const step=mode==='corner-peel'?{type:'corner-peel',targets:['upper'],corner:'bottom-left',amount:.25}:mode==='fuse'?{type:'fuse',targets:['upper','lower'],movingId:'upper',fixedId:'lower'}:{type:'region',targets:['upper'],mode:'hole',regionId:'marked:user'};
  return route.fulfill({json:{plans:[{id:`model-${mode}`,title:`原生${mode}`,rationale:'测试模型动作与已有手动机制共用状态。',priority:.8,confidence:.7,primaryTargets:step.targets,supportTargets:[],steps:[step],artifacts:[]}]}});
 });
 await page.goto(process.env.AW_URL??'http://localhost:5173/');await page.waitForFunction(()=>window.__aw?.agentDiagnostics);
 await page.evaluate(()=>{const {kernel:k,ui}=window.__aw;k.closeAll();ui.set({agentEnabled:true});k.open({id:'lower',appId:'study',title:'对照材料',rect:{x:100,y:80,w:500,h:600},props:{resource:'notes'}});k.open({id:'upper',appId:'study',title:'工作笔记',rect:{x:350,y:100,w:500,h:600},props:{resource:'notes'}});});
 const root=id=>page.locator(`[data-win="${id}"]`);
 await root('upper').locator('.study-notes').fill('在这里记录对照结果，保持文档内容。');
 const start=async()=>{await root('upper').locator('.aw-title').focus();await page.evaluate(()=>{const b=window.__aw.planBuffer;b.setRemoteEnabled(false);b.setRemoteEnabled(true);});await page.keyboard.down('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='cycling');await page.waitForFunction(()=>!window.__aw.adaptation.store.get().performing);};
 const adopt=async()=>{await page.keyboard.up('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='idle');};
 const undo=async()=>{await page.keyboard.press('Control+z');await page.waitForTimeout(350);};
 await start();assert.equal(await root('upper').locator('.liquid-peel').evaluate(e=>getComputedStyle(e).visibility),'visible');
 assert.ok(await root('upper').locator('[data-peel-flap]').getAttribute('d'));assert.equal(await root('upper').locator('.study-notes').innerText(),'在这里记录对照结果，保持文档内容。');
 await page.screenshot({path:'/tmp/aquaw-model-real-corner.png'});await adopt();await undo();assert.equal(await page.evaluate(()=>window.__aw.kernel.get('upper').props.agentCornerFold),undefined);
 mode='fuse';await start();assert.equal(await page.locator('.surface-seam-hit').count(),1);await adopt();
 assert.ok(await page.evaluate(()=>window.__aw.kernel.get('upper').group===window.__aw.kernel.get('lower').group));
 await undo();assert.equal(await page.locator('.surface-seam-hit').count(),0);
 mode='region';await page.evaluate(()=>window.__aw.kernel.setImportance('upper',[{id:'marked:user',x:.15,y:.15,w:.35,h:.25,weight:1}]));
 await root('upper').locator('.aw-title').focus();await page.evaluate(()=>{const b=window.__aw.planBuffer;b.setRemoteEnabled(false);b.setRemoteEnabled(true);});await page.keyboard.down('Space');
 await page.evaluate(()=>window.__aw.adaptation.select('upper'));await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='cycling');await page.waitForFunction(()=>!window.__aw.adaptation.store.get().performing);
 assert.equal(await root('upper').locator('.cut-rim').count(),1);await page.keyboard.press('Escape');await page.keyboard.up('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='idle');
 assert.equal(await page.evaluate(()=>window.__aw.kernel.get('upper').importance[0].kind),undefined);
 const diagnostic=await page.evaluate(()=>window.__aw.agentDiagnostics.snapshot());assert.ok(diagnostic.some(r=>r.event==='present'&&r.acceptedIds.includes('model-corner-peel')));assert.ok(diagnostic.some(r=>r.event==='present'&&r.acceptedIds.includes('model-fuse')));
 assert.ok(requests.every(ctx=>ctx.task==='workspace'));assert.deepEqual(errors,[]);
 console.log('PASS: model-selected real corner geometry, native fusion/unzip state, explicit marked-region cutout, unchanged content, rollback, undo and final presentation diagnostics.');
}finally{await browser.close();}
