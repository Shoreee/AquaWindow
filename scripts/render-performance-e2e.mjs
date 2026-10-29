import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2});
 const errors=[],calls=[];page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(r.url().includes('/api/agent/'))calls.push(r.url())});
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__aw?.planBuffer.entries.size);
 await page.evaluate(async()=>{
  const loaded=performance.getEntriesByType('resource').map(e=>e.name);
  const registry=loaded.find(url=>/\/src\/apps\/registry\.tsx(?:\?|$)/.test(url));
  const react=loaded.find(url=>/\/node_modules\/\.vite\/deps\/react\.js(?:\?|$)/.test(url));
  const {APPS}=await import(registry??'/src/apps/registry.tsx'),reactModule=await import(react??'/node_modules/.vite/deps/react.js');
  const React=reactModule.default??reactModule;
  window.__documentRenders={preview:0,writer:0};
  for(const id of ['preview','writer']){
   const Original=APPS[id].Component;
   APPS[id].Component=function Counted(props){window.__documentRenders[id]++;return React.createElement(Original,props)};
   const win=window.__aw.kernel.list().find(w=>w.appId===id);
   window.__aw.kernel.setProps(win.id,{renderProbe:true});
  }
 });
 await page.waitForFunction(()=>window.__documentRenders.preview>0&&window.__documentRenders.writer>0);await page.evaluate(()=>{window.__documentRenders={preview:0,writer:0}});
 await page.mouse.move(1600,920);await page.keyboard.down('Space');
 await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='cycling');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.up('Space');
 await page.waitForFunction(()=>!window.__aw.adaptation.store.get().performing,null,{timeout:15000});
 const renders=await page.evaluate(()=>window.__documentRenders);
 assert.deepEqual(renders,{preview:0,writer:0},'Shell animation must not re-render its documents');
 const next=await page.evaluate(async()=>{
  const {PAPERS}=await import('/src/apps/data/papers.ts');
  const id=window.__aw.kernel.list().find(w=>w.appId==='preview').id;
  window.__aw.kernel.setProps(id,{paperId:PAPERS[1].id});return {id,title:PAPERS[1].title};
 });
 await page.waitForFunction(({id,title})=>document.querySelector(`[data-win="${id}"] .pv-head h1`)?.textContent===title,next);
 assert.equal(await page.evaluate(()=>window.__documentRenders.preview),1,'Actual document changes must still render');
 await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='idle');
 const moving=await page.evaluate(()=>window.__aw.kernel.list().find(w=>w.appId==='writer'));
 const title=await page.locator(`[data-win="${moving.id}"] .aw-title`).boundingBox();
 await page.mouse.move(title.x+120,title.y+20);await page.mouse.down();await page.mouse.move(title.x+155,title.y+45,{steps:8});await page.mouse.up();
 await page.waitForFunction(id=>!window.__aw.kernel.get(id).props.agentMotion,moving.id);
 const moved=await page.evaluate(id=>window.__aw.kernel.get(id).rect,moving.id);
 assert.ok(Math.abs(moved.x-moving.rect.x-35)<2 && Math.abs(moved.y-moving.rect.y-25)<2,'Cached title handlers must drag from the current animated position');
 const edge=await page.locator(`[data-win="${moving.id}"] .rz-e`).boundingBox();
 await page.mouse.move(edge.x+edge.width*.5,edge.y+edge.height*.5);await page.mouse.down();await page.mouse.move(edge.x+edge.width*.5+20,edge.y+edge.height*.5,{steps:5});await page.mouse.up();
 await page.waitForFunction(id=>!window.__aw.kernel.get(id).props.agentMotion,moving.id);
 const resized=await page.evaluate(id=>window.__aw.kernel.get(id).rect,moving.id);
 assert.ok(Math.abs(resized.w-moved.w-20)<2,'Cached resize handles must use current geometry');
 assert.deepEqual(errors,[]);assert.deepEqual(calls,[]);
 console.log('PASS: shell animation renders documents zero times; content changes and cached drag/resize handlers remain live; zero model calls.');
}finally{await browser.close()}
