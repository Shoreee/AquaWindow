import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__aw?.planBuffer.entries.size);await page.mouse.move(1320,810);await page.waitForTimeout(100);
 const pixels=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
  const source=document.querySelector('.agent-front'),s=source.__energy,canvas=document.createElement('canvas');canvas.width=innerWidth;canvas.height=innerHeight;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0,innerWidth,innerHeight);const data=ctx.getImageData(Math.floor(s.x)-3,Math.floor(s.y)-3,35,38).data;let aa=0,min=255,solid=0;
  for(let i=0;i<data.length;i+=4){const alpha=data[i+3];if(alpha>0&&alpha<255)aa++;if(alpha>250){solid++;min=Math.min(min,.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]);}}
  resolve({aa,min,solid,scale:source.width/innerWidth,morph:s.morph});
 })));
 assert.ok(pixels.scale>=2&&pixels.aa>4&&pixels.solid>15,JSON.stringify(pixels));assert.ok(pixels.min>50&&pixels.min<210,'Cursor ink must stay visible without becoming near-black');
 await page.keyboard.down('Space');const morphs=await page.evaluate(()=>new Promise(resolve=>{const samples=[];let frames=0;const read=()=>{samples.push(document.querySelector('.agent-front').__energy.morph);if(++frames<65)requestAnimationFrame(read);else resolve(samples)};requestAnimationFrame(read)}));
 assert.ok(morphs.some(m=>m>.05&&m<.9));assert.ok(Math.max(...morphs.slice(1).map((m,i)=>Math.abs(m-morphs[i])))<.35,'The same mesh must morph continuously');await page.keyboard.press('Escape');await page.keyboard.up('Space');await page.waitForTimeout(700);
 const root=page.locator('[data-win]').last();for(const [edge,kind] of [['e','ew'],['n','ns'],['ne','nesw'],['se','nwse']]){
  const box=await root.locator(`.rz-${edge}`).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.waitForFunction(kind=>document.querySelector('.iridescent-cursor').dataset.kind===kind,kind);
  assert.equal(await page.locator('.iridescent-cursor svg').evaluate(el=>getComputedStyle(el).overflow),'visible');
 }
 await page.getByRole('button',{name:'AquaWindow',exact:true}).hover();await page.waitForFunction(()=>document.querySelector('.iridescent-cursor').dataset.kind==='pointer');
 assert.deepEqual(errors,[]);console.log('PASS: supersampled non-black cursor contour, partial-alpha edge pixels, continuous GPU cursor/core morph and unclipped horizontal/vertical/diagonal/hand shapes.');
}finally{await browser.close();}
