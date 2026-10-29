import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
const out='screenshots/qa';await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,recordVideo:{dir:`${out}/fluid-videos`,size:{width:1440,height:900}}});const page=await context.newPage(),errors=[],calls=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'||m.text().includes('Energy renderer unavailable'))errors.push(m.text())});page.on('request',r=>{if(r.url().includes('/api/agent/'))calls.push(r.url())});
try{
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__aw?.planBuffer.entries.size);
 await page.mouse.move(1050,785);await page.keyboard.down('Space');await page.locator('[data-win]').last().locator('.aw-title').click({position:{x:150,y:20}});await page.mouse.move(1050,785);await page.evaluate(()=>window.__aw.adaptation.store.set({deadline:performance.now()+60000}));
 await page.waitForFunction(()=>document.querySelector('.agent-front').__energy.links.some(l=>l.progress>.15&&l.progress<.85));await page.screenshot({path:`${out}/donated-material.png`});
 await page.waitForTimeout(900);await page.mouse.move(1170,720,{steps:8});assert.ok(Math.hypot(...await page.locator('.agent-front').evaluate(c=>c.__energy.shellOffset))>1);await page.mouse.move(1050,785,{steps:6});
 await page.waitForFunction(()=>document.querySelector('.agent-front').__energy.links.some(l=>l.bound>.99));const settled=await page.locator('.agent-front').evaluate(c=>c.__energy.links[0]);assert.equal(settled.crawl,1);assert.equal(settled.progress,settled.tail);assert.ok(settled.highlight>.9);await page.screenshot({path:`${out}/luminous-selected-edge.png`});
 await page.keyboard.press('Escape');const recovery=await page.evaluate(()=>new Promise(resolve=>{const values=[];let frames=0;const read=()=>{const link=document.querySelector('.agent-front').__energy.links[0];values.push({returning:link?.withdrawing,head:link?.progress??1,opacity:link?.opacity??0});if(++frames<65)requestAnimationFrame(read);else resolve(values)};requestAnimationFrame(read)}));assert.ok(recovery.some(v=>v.returning&&v.opacity>.1&&v.head>.1&&v.head<.95));assert.equal(recovery.at(-1).opacity,0);
 await page.keyboard.up('Space');await page.waitForTimeout(500);assert.equal(await page.locator('.agent-front').evaluate(c=>c.__energy.links.length),0);
 const residue=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const canvas=document.querySelector('.agent-front'),copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const ctx=copy.getContext('2d');ctx.drawImage(canvas,0,0);const data=ctx.getImageData(0,0,copy.width,copy.height).data,scene=canvas.__energy,dpr=copy.width/innerWidth;let count=0;for(let y=0;y<copy.height;y++)for(let x=0;x<copy.width;x++){if(x/dpr>scene.x-20&&x/dpr<scene.x+45&&y/dpr>scene.y-20&&y/dpr<scene.y+55)continue;if(data[(y*copy.width+x)*4+3]>2)count++;}resolve(count)})));assert.equal(residue,0,'No noisy material may remain after return');
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='cycling');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>Object.values(window.__aw.kernel.getState().windows).some(w=>w.props.agentMotion?.primitive==='yield'&&w.props.agentMotion.action>.1));
 const shape=await page.locator('[data-fluid-skin="true"]').first().evaluate(el=>({filter:getComputedStyle(el).filter,clip:getComputedStyle(el).clipPath,stroke:el.parentElement.querySelector('.agent-fluid-front')?.getAttribute('d')}));assert.equal(shape.filter,'none');assert.ok(shape.clip.startsWith('path(')&&shape.stroke.length>20);assert.equal(await page.locator('feDisplacementMap').count(),0);
 const timing=await page.evaluate(()=>new Promise(resolve=>{const samples=[];let previous='',updates=0,total=0,last=performance.now(),frames=0;const collect=now=>{const w=Object.values(window.__aw.kernel.getState().windows).find(w=>w.props.agentMotion?.primitive==='yield'&&w.props.agentMotion.action>.05&&w.props.agentMotion.action<.95);if(w){const signature=JSON.stringify(w.rect);if(previous){total++;if(signature!==previous)updates++;samples.push(now-last)}previous=signature}last=now;if(++frames<90)requestAnimationFrame(collect);else{samples.sort((a,b)=>a-b);resolve({updates,total,ratio:updates/Math.max(1,total),p95FrameMs:samples[Math.floor(samples.length*.95)]})}};requestAnimationFrame(collect)}));assert.ok(timing.total>8&&timing.ratio>.8,JSON.stringify(timing));
 await page.keyboard.up('Space');await page.waitForFunction(()=>window.__aw.adaptation.store.get().phase==='idle');
 // A signed Gaussian used to erase the inside of the carrying body on several GPUs.
 const carrierPixels=await page.evaluate(async()=>{
  const {createAgentRenderer}=await import('/src/field/agentRenderer.ts');
  const canvas=document.createElement('canvas');const renderer=createAgentRenderer(canvas);
  const scene={x:1000,y:760,morph:1,energy:1,pull:[0,0],velocity:[0,0],shellOffset:[0,0],burst:0,drain:0,depletion:[0,0,0],roots:[0,.3,.6],transport:10,core:false,
   links:[{transport:1,transportProgress:.5,side:1,carrier:[400,200,400,400],opacity:1,landing:0,birthTime:1,birthFlow:1,poseBlend:1,previousPose:[1,0,0,.32],previousSeed:1,impact:-2,budding:true,gesture:1,action:.5,seed:1,extent:.32,from:[0,0],layer:0,to:[400,400],progress:0,tail:0,root:0,width:13,returning:0,phase:1,feedback:0,arrival:0,crawl:0,bound:0,beat:0,sever:0,bite:0,entry:0,host:[400,200,400,400],impactHost:[400,200,400,400],impactOccluders:[],normal:[1,0],occluders:[]}]};
  renderer.render(scene,1,1);
  const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
  const ctx=copy.getContext('2d');ctx.drawImage(canvas,0,0);
  const pixels=ctx.getImageData(580,385,40,30).data;let minimum=255;
  for(let i=3;i<pixels.length;i+=4)minimum=Math.min(minimum,pixels[i]);
  scene.links[0]={...scene.links[0],transport:0,gesture:5,action:1,landing:1,progress:1,tail:1,arrival:0};
  renderer.render(scene,2,1);ctx.clearRect(0,0,copy.width,copy.height);ctx.drawImage(canvas,0,0);
  const closed=ctx.getImageData(580,385,40,30).data;let closureAlpha=0;
  for(let i=3;i<closed.length;i+=4)closureAlpha=Math.max(closureAlpha,closed[i]);
  renderer.dispose();return {minimum,closureAlpha};
 });
 assert.equal(carrierPixels.minimum,0,'Transport uses the actual window silhouette, never an overlaid white carrying sheet');
 assert.equal(carrierPixels.closureAlpha,0,'Finished encapsulation must never leave a white interior mask');
 assert.deepEqual(errors,[]);assert.deepEqual(calls,[]);await writeFile(`${out}/fluid-metrics.json`,JSON.stringify(timing,null,2));await context.close();console.log('VIDEO',await page.video().path());console.log('PASS: donated material, inertial core, short depth/crawl, persistent selection, physical recovery, clean exit, directional native edge and frame-synchronous geometry.');console.log(timing);
}finally{await browser.close()}
