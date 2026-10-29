import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__aw?.planBuffer.entries.size);
 const id=await page.locator('[data-win]').last().getAttribute('data-win'),root=page.locator(`[data-win="${id}"]`);
 const base=await page.evaluate(id=>window.__aw.kernel.get(id).rect,id);
 for(const [edge,dx,dy,kind,edges] of [['e',55,0,'yield',['right']],['se',40,35,'yield',['right','bottom']],['n',0,-30,'yield',['top']],['ne',25,-25,'arrange',['right','top']],['title',45,35,'arrange',null]]){
  const box=await root.locator(edge==='title'?'.aw-title':`.rz-${edge}`).boundingBox();const x=edge==='title'?box.x+170:box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:12});
  await page.waitForFunction(({id,kind})=>window.__aw.kernel.get(id).props.agentMotion?.primitive===kind&&window.__aw.kernel.get(id).props.agentMotion.interaction.strength>.25,{id,kind});
  const motion=await page.evaluate(id=>window.__aw.kernel.get(id).props.agentMotion,id);if(edges)assert.deepEqual(motion.boundary.edges,edges);
  assert.equal(await root.locator('.agent-fluid-front').count(),kind==='yield'?1:0);assert.equal(await root.locator('.agent-fluid-rim').evaluate(e=>getComputedStyle(e).display),'block');
  if(kind==='arrange'){assert.ok(motion.transport.coverage>.1);assert.equal(await root.locator('.agent-transport-skin').count(),1);}
  await page.screenshot({path:`screenshots/qa/manual-boundary-${edge}.png`});await page.mouse.up();
  await page.waitForFunction(id=>!window.__aw.kernel.get(id).props.agentMotion,id);await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(id=>window.__aw.kernel.get(id).rect,id),base);
 }
 // The membrane must start spreading before the carried page moves.
 const downBox=await root.boundingBox(),title=await root.locator('.aw-title').boundingBox();await page.mouse.move(title.x+150,title.y+20);await page.mouse.down();await page.mouse.move(title.x+280,title.y+70);
 await page.waitForFunction(id=>{const w=window.__aw.kernel.get(id);return w.props.agentMotion?.transport.coverage>.08&&w.props.agentMotion.transport.coverage<.65;},id);
 assert.ok(Math.abs((await page.evaluate(id=>window.__aw.kernel.get(id).rect,id)).x-base.x)<2);
 assert.equal(await root.locator('[data-transport-stage=engulf]').count(),1);
 const origin=await page.evaluate(id=>window.__aw.kernel.get(id).props.agentMotion.transport.origin,id);assert.ok(Math.abs(origin[0]-(title.x+150-downBox.x)/downBox.width)<.02&&Math.abs(origin[1]-(title.y+20-downBox.y)/downBox.height)<.02,'Manual wrapping begins at the pointer-down location');await page.screenshot({path:'screenshots/qa/wrap-spreading.png'});
 await page.waitForFunction(({id,x})=>window.__aw.kernel.get(id).rect.x>x+120,{id,x:base.x});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('[data-transport-stage=release]'));await page.screenshot({path:'screenshots/qa/wrap-releasing.png'});
 await page.waitForFunction(id=>!window.__aw.kernel.get(id).props.agentMotion,id);await page.keyboard.press('Escape');
 await root.locator('.l.max').click();await page.waitForFunction(id=>window.__aw.kernel.get(id).props.agentMotion?.primitive==='arrange',id);
 await page.waitForFunction(id=>!window.__aw.kernel.get(id).props.agentMotion,id);assert.equal(await page.evaluate(id=>window.__aw.kernel.get(id).maximized,id),true);
 await page.keyboard.press('Escape');assert.deepEqual(await page.evaluate(id=>window.__aw.kernel.get(id).rect,id),base);
 const side=await root.locator('.rz-e').boundingBox();await page.mouse.move(side.x+side.width/2,side.y+side.height/2);await page.mouse.down();await page.mouse.move(side.x+side.width/2+40,side.y+side.height/2,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();
 assert.deepEqual(await page.evaluate(id=>window.__aw.kernel.get(id).rect,id),base);
 await page.mouse.move(1370,810);await page.keyboard.down('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='cycling');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>Object.values(window.__aw.kernel.getState().windows).some(w=>w.props.agentMotion?.primitive==='yield'&&w.props.agentMotion.action>.3&&w.props.agentMotion.action<.8));
 assert.ok(await page.locator('.agent-fluid-front').count());await page.screenshot({path:'screenshots/qa/agent-yield-visible.png'});await page.keyboard.up('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='idle');
 assert.deepEqual(errors,[]);console.log('PASS: hand and agent share asymmetric single/two-edge deformation, top-edge classification, wrapping transport and single-step undo.');
}finally{await browser.close();}
