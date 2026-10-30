import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],calls=[];page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(r.url().includes('/api/agent/')||r.url().includes('api.deepseek.com'))calls.push(r.url())});
 await page.goto(process.env.AW_URL??'http://127.0.0.1:5175/');await page.waitForFunction(()=>window.__aw?.planBuffer.entries.size);
 const ids=await page.evaluate(()=>Object.fromEntries(window.__aw.kernel.list().map(w=>[w.appId,w.id]))),root=id=>page.locator(`[data-win="${id}"]`),win=id=>page.evaluate(id=>window.__aw.kernel.get(id),id);
 const original=await page.evaluate(()=>window.__aw.kernel.getState().windows);
 assert.equal(await page.locator('.tb-right').count(),0);
 // Shrinking uses the same session container as Space, with an intact original snapshot.
 const r=await root(ids.writer).boundingBox(),edge=await root(ids.writer).locator('.rz-se').boundingBox();await page.mouse.move(edge.x+3,edge.y+3);await page.mouse.down();await page.mouse.move(edge.x+3-r.width+100,edge.y+3-r.height+75,{steps:18});await page.locator('.collapse-hint').waitFor();await page.mouse.up();
 await page.waitForFunction(id=>window.__aw.kernel.get(id).form==='capsule',ids.writer);assert.equal((await win(ids.writer)).props.agentCapsule.members[0].rect.w,original[ids.writer].rect.w);await page.keyboard.press('Escape');await page.waitForFunction(id=>window.__aw.kernel.get(id).form==='normal',ids.writer);
 async function pack(id){await root(id).locator('.aw-title').click({button:'right',position:{x:130,y:20}});await page.getByRole('menuitem',{name:'收为胶囊',exact:true}).click();await page.waitForFunction(id=>window.__aw.kernel.get(id).form==='capsule',id);await page.waitForTimeout(100);}
 await pack(ids.writer);
 const cap=await root(ids.writer).boundingBox(),title=await root(ids.preview).locator('.aw-title').boundingBox();await page.mouse.move(cap.x+cap.width*.5,cap.y+35);await page.mouse.down();await page.mouse.move(title.x+title.width*.55,title.y+18,{steps:22});await page.mouse.up();
 await page.waitForFunction(({child,parent})=>window.__aw.kernel.get(child).props.capsuleDock?.parentId===parent,{child:ids.writer,parent:ids.preview});assert.equal(await root(ids.writer).count(),0);await page.locator(`[data-capsule-id="${ids.writer}"]`).waitFor();
 // Put a normal page back into an attached capsule.
 const slot=await page.locator(`[data-capsule-id="${ids.writer}"]`).boundingBox(),finderTitle=await root(ids.finder).locator('.aw-title').boundingBox();await page.mouse.move(finderTitle.x+80,finderTitle.y+20);await page.mouse.down();await page.mouse.move(slot.x+slot.width/2,slot.y+slot.height/2,{steps:25});await page.mouse.up();
 await page.waitForFunction(id=>window.__aw.kernel.get(id).props.agentCapsule.members.length===2&&!window.__aw.kernel.get(id).props.agentCapsuleReceiving,ids.writer);assert.equal((await win(ids.finder)).minimized,true);await page.screenshot({path:'screenshots/qa/capsule-titlebar-attached.png'});
 // The parent can itself become a capsule without losing its attached child.
 await pack(ids.preview);await root(ids.preview).locator(`[data-capsule-id="${ids.writer}"]`).waitFor();
 const childSlot=await page.locator(`[data-capsule-id="${ids.writer}"]`).boundingBox();await page.mouse.move(childSlot.x+20,childSlot.y+10);await page.mouse.down();await page.mouse.move(900,480,{steps:18});await page.mouse.up();
 await page.waitForFunction(id=>{const w=window.__aw.kernel.get(id);return !w.props.capsuleDock&&!w.props.agentCapsuleBusy&&w.form==='capsule';},ids.writer);
 const child=await root(ids.writer).boundingBox(),parent=await root(ids.preview).boundingBox();await page.mouse.move(child.x+child.width*.5,child.y+35);await page.mouse.down();await page.mouse.move(parent.x+parent.width*.45,parent.y+parent.height*.5,{steps:24});
await page.mouse.up();
 await page.waitForFunction(id=>window.__aw.kernel.get(id).minimized,ids.writer);const nested=(await win(ids.preview)).props.agentCapsule.members.find(w=>w.id===ids.writer);assert.equal(nested.form,'capsule');assert.equal(nested.props.agentCapsule.members.length,2);await page.screenshot({path:'screenshots/qa/capsule-recursive.png'});
 // Option-drag a nested capsule: it must remain a capsule, not flatten into a document.
 const segment=await root(ids.preview).locator(`[data-capsule-page="${ids.writer}"]`).boundingBox();await page.keyboard.down('Alt');await page.mouse.move(segment.x+segment.width/2,segment.y+segment.height/2);await page.mouse.down();await page.mouse.move(880,510,{steps:22});await page.mouse.up();await page.keyboard.up('Alt');await page.waitForTimeout(650);
 assert.equal((await win(ids.writer)).form,'capsule');assert.equal((await win(ids.writer)).props.agentCapsule.members.length,2);assert.equal((await win(ids.preview)).props.agentCapsule.members.length,1);
 await page.keyboard.press('Escape');await page.waitForTimeout(100);assert.equal((await win(ids.writer)).minimized,true);
 await root(ids.preview).getByRole('button',{name:'释放胶囊中的全部窗口'}).click();await page.waitForFunction(id=>window.__aw.kernel.get(id).form==='normal',ids.preview);await page.waitForTimeout(1100);assert.equal((await win(ids.writer)).form,'capsule');assert.equal((await win(ids.writer)).minimized,false);
 await root(ids.writer).getByRole('button',{name:'释放胶囊中的全部窗口'}).click();await page.waitForFunction(()=>window.__aw.kernel.list().every(w=>!w.minimized&&w.form==='normal'));assert.deepEqual((await page.evaluate(()=>window.__aw.kernel.list().map(w=>w.id))).sort(),Object.keys(original).sort());
 assert.deepEqual(errors,[]);assert.deepEqual(calls,[]);console.log('PASS: tiny-resize collection, unified capsules, normal-page insertion, title-bar docking, attached parent collection, undocking, nested capsules, intact extraction/release, undo and zero provider calls.');
}finally{await browser.close();}
