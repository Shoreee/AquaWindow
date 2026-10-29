import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
const out='screenshots/qa';await mkdir(out,{recursive:true});const b=await chromium.launch({channel:'chrome',headless:true});
try{
 const c=await b.newContext({viewport:{width:1440,height:900},recordVideo:{dir:`${out}/embodied-videos`,size:{width:1440,height:900}}});const p=await c.newPage(),errors=[],calls=[],frames={};
 p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>{if(r.url().includes('/api/agent/'))calls.push(r.url())});
 await p.goto(process.env.AW_URL??'http://127.0.0.1:5175/');await p.waitForFunction(()=>window.__aw?.planBuffer.entries.size);const baseline=await p.evaluate(()=>window.__aw.kernel.getState().windows);
 await p.mouse.move(1360,780);await p.keyboard.down('Space');await p.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='cycling');
 const types=['peel','peel','yield','encapsulate','branch','merge','permeate'];
 for(let index=0;index<7;index++){
  if(index)await p.keyboard.press('ArrowRight');
  const type=types[index];if(index)await p.waitForFunction(type=>Object.values(window.__aw.kernel.getState().windows).some(w=>w.props.agentMotion?.primitive===type&&w.props.agentMotion.action>.32&&w.props.agentMotion.action<.9),type);
  frames[type]=await p.evaluate(()=>({windows:window.__aw.kernel.getState().windows,links:document.querySelector('.agent-front').__energy.links.map(l=>({gesture:l.gesture,head:l.progress,tail:l.tail,action:l.action})),panels:[...document.querySelectorAll('[data-agent-result].expanded')].length}));
  if(index===0)assert.equal((await p.evaluate(()=>window.__aw.adaptation.store.get().plan.steps[0].mode)),'hole');
  else assert.ok(frames[type].links.some(l=>l.gesture>0));
  await p.screenshot({path:`${out}/primitive-${type}.png`});await p.waitForFunction(()=>!window.__aw.adaptation.store.get().performing,null,{timeout:12000});
  assert.equal(await p.evaluate(()=>window.__aw.adaptation.store.get().index),index);
 }
 assert.ok(Object.values(frames.branch.windows).filter(w=>w.props.agentBranch).length>=2);
 assert.ok(Object.values(frames.merge.windows).some(w=>w.props.agentDivision?.absorbed));
 assert.ok(Object.values(frames.permeate.windows).some(w=>w.depth>0));
 await p.keyboard.up('Space');await p.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='idle');await p.keyboard.press('Escape');
 assert.deepEqual(await p.evaluate(()=>window.__aw.kernel.getState().windows),baseline);assert.deepEqual(errors,[]);assert.deepEqual(calls,[]);
 await writeFile(`${out}/primitive-coverage.json`,JSON.stringify({seen:types,frames},null,2));await c.close();console.log('VIDEO',await p.video().path());console.log('PASS: seven independent native behaviors, manual switching through packed/branch states, same-object continuity, release acceptance and rollback.');
}finally{await b.close()}
