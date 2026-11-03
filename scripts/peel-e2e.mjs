import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:process.env.AW_BROWSER??'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(process.env.AW_URL??'http://localhost:5173/');await page.waitForFunction(()=>!!window.__aw);
 const id=await page.evaluate(()=>{const k=window.__aw.kernel;k.open({appId:'study',title:'下层文档',rect:{x:180,y:80,w:650,h:620},props:{resource:'notes'}});return k.open({appId:'study',title:'真实掀角',rect:{x:300,y:150,w:600,h:500},props:{resource:'notes'}});});
 const root=page.locator(`[data-win="${id}"]`);await root.locator('.study-notes').fill('掀角时保留的文档内容');
 await root.locator('.aw-content').evaluate(el=>{window.__peelMutations=0;new MutationObserver(records=>{window.__peelMutations+=records.length}).observe(el,{subtree:true,childList:true,characterData:true});});
 assert.equal(await root.locator('.liquid-peel-handle').count(),0);
 await page.mouse.move(876,626);await page.waitForFunction(id=>document.querySelector(`[data-win="${id}"]`).classList.contains('peel-preview'),id);
 assert.equal(await root.evaluate(el=>el.classList.contains('peeling')),false,'Hover never starts a drag');
 await page.mouse.move(100,800);await page.waitForFunction(id=>getComputedStyle(document.querySelector(`[data-win="${id}"] .liquid-peel`)).visibility==='hidden',id);
 await page.mouse.move(884,634);await page.mouse.down();await page.mouse.move(720,510,{steps:18});
 await page.waitForFunction(id=>document.querySelector(`[data-win="${id}"]`).classList.contains('peel-dragging'),id);await page.waitForTimeout(180);
 const flap=root.locator('[data-peel-flap]'),path=await flap.getAttribute('d');
 const nearest=(path,x,y)=>{const v=path.match(/-?\d+(?:\.\d+)?/g).map(Number);let n=Infinity;for(let i=0;i<v.length;i+=2)n=Math.min(n,Math.hypot(v[i]-x,v[i+1]-y));return n;};
 assert.ok(nearest(path,420,360)<2,'The reflected corner follows the actual pointer');
 assert.equal(await root.locator('.aw-body').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 await page.waitForTimeout(130);assert.notEqual(await flap.getAttribute('d'),path);
 assert.equal(await page.evaluate(()=>window.__peelMutations),0);
 await page.keyboard.down('Shift');await page.mouse.up();await page.keyboard.up('Shift');await page.waitForTimeout(200);
 // Grab farther outside: this must resize, even while a fold is pinned.
 await page.mouse.move(903,653);await page.mouse.down();await page.mouse.move(603,403,{steps:16});await page.mouse.up();
 await page.waitForFunction(id=>Math.abs(window.__aw.kernel.get(id).rect.w-300)<1&&Math.abs(window.__aw.kernel.get(id).rect.h-250)<1&&!window.__aw.kernel.get(id).props.agentMotion,id);
 assert.equal(await root.locator('.liquid-peel').getAttribute('width'),'300');assert.equal(await root.locator('.liquid-peel').getAttribute('height'),'250');
 assert.ok(nearest(await flap.getAttribute('d'),210,180)<2,'Pinned fold scales with the window');
 await page.screenshot({path:'/tmp/aquaw-real-peel.png'});
 await page.keyboard.press('Escape');await page.waitForFunction(id=>!document.querySelector(`[data-win="${id}"]`).classList.contains('peeling'),id);
 assert.equal(await root.locator('.study-notes').innerText(),'掀角时保留的文档内容');
 await root.locator('.aw-title').focus();await page.keyboard.press('Shift+F10');await page.getByRole('menuitem',{name:'掀角查看',exact:true}).click();
 await page.waitForFunction(id=>document.querySelector(`[data-win="${id}"]`).classList.contains('peeling'),id);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('PASS: invisible proximity affordance, inner peel vs outer resize, real fold, scaled pin, unchanged content and keyboard menu.');
}finally{await browser.close();}
