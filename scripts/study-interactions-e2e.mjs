import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],agentCalls=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('request',request=>{if(request.url().includes('/api/agent/'))agentCalls.push(request.url());});
  await page.goto(process.env.AW_URL??'http://127.0.0.1:5174/');
  await page.waitForFunction(()=>!!window.__aw);
  const selectMode=async(label,id)=>{
    await page.locator('.study-mode-trigger').click();
    await page.locator('.system-drop.study-mode .study-mode-option').filter({hasText:label}).click();
    await page.waitForFunction(mode=>window.__aw.ui.get().studyMode===mode,id);
    assert.equal(await page.locator('[data-win]').count(),0,'Mode switching resets windows');
  };
  const openPair=()=>page.evaluate(()=>{
    const k=window.__aw.kernel;
    const a=k.open({appId:'study',title:'方法论',rect:{x:170,y:140,w:440,h:500},props:{resource:'methodology',taskId:'comparison'}});
    const b=k.open({appId:'study',title:'架构图',rect:{x:620,y:140,w:440,h:500},props:{resource:'architecture',taskId:'comparison'}});
    return {a,b};
  });
  const root=id=>page.locator(`[data-win="${id}"]`);
  assert.equal(await page.evaluate(()=>window.__aw.ui.get().studyMode),null);
  assert.equal(await page.locator('.study-mode-trigger').textContent(),'交互形式：请选择');

  await selectMode('边界退让','yield');
  let ids=await openPair();
  const dragTitle=await root(ids.a).locator('.aw-title').boundingBox();
  await page.mouse.move(dragTitle.x+180,dragTitle.y+20);await page.mouse.down();
  await page.mouse.move(dragTitle.x+145,dragTitle.y+20,{steps:5});
  await page.waitForFunction(()=>document.documentElement.classList.contains('agent-cursor-enabled'));
  await page.mouse.up();
  await page.waitForFunction(id=>!window.__aw.kernel.get(id)?.props.agentMotion,ids.a);
  await page.evaluate(id=>window.__aw.kernel.setRect(id,{x:170,y:140,w:440,h:500}),ids.a);
  await page.evaluate(({b})=>{const k=window.__aw.kernel;k.setRect(b,{x:515,y:170,w:440,h:500});k.focus(b);},ids);
  await root(ids.a).locator('.aw-title').click({button:'right'});
  assert.equal(await page.getByRole('menuitem',{name:'框选重要区域'}).count(),0);
  assert.equal(await page.getByRole('menuitem',{name:'收为胶囊…'}).count(),0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(id=>document.querySelector(`[data-win="${id}"]`)?.classList.contains('dented'),ids.a);

  await selectMode('重要区域透出','reveal');
  ids=await openPair();
  await root(ids.a).locator('.aw-title').click({button:'right'});
  await page.getByRole('menuitem',{name:'框选重要区域'}).click();
  const content=await root(ids.a).locator('.aw-content').boundingBox();
  await page.mouse.move(content.x+90,content.y+100);await page.mouse.down();
  await page.mouse.move(content.x+270,content.y+230,{steps:8});await page.mouse.up();
  await page.evaluate(({b})=>{const k=window.__aw.kernel;k.setRect(b,{x:315,y:240,w:440,h:500});k.focus(b);},ids);
  await page.waitForFunction(()=>!!document.querySelector('.cut-rim'));
  assert.equal(await root(ids.a).evaluate(element=>element.classList.contains('dented')),false);

  await selectMode('融合与拆分','fusion');
  ids=await openPair();
  await root(ids.a).locator('.aw-title').click({button:'right'});
  await page.getByRole('menuitem',{name:'与相邻窗口融合'}).click();
  await page.waitForFunction(({a,b})=>{const s=window.__aw.kernel.getState();return s.windows[a].group?.startsWith('surface:')&&s.windows[a].group===s.windows[b].group;},ids);
  await page.waitForFunction(()=>!Object.values(window.__aw.kernel.getState().windows).some(w=>w.props.surfaceAnimating));
  const seam=await page.locator('.surface-seam-hit').first().boundingBox();
  assert.ok(seam,'Fusion has a draggable seam');
  if(seam.height>seam.width){await page.mouse.move(seam.x+seam.width/2,seam.y+3);await page.mouse.down();await page.mouse.move(seam.x+seam.width/2,seam.y+seam.height+8,{steps:15});}
  else{await page.mouse.move(seam.x+3,seam.y+seam.height/2);await page.mouse.down();await page.mouse.move(seam.x+seam.width+8,seam.y+seam.height/2,{steps:15});}
  await page.mouse.up();
  await page.waitForFunction(({a,b})=>!window.__aw.kernel.get(a)?.group&&!window.__aw.kernel.get(b)?.group,ids);

  await selectMode('抖动分裂','shake');
  ids=await openPair();
  await page.locator('.study-mode-trigger').click();
  await page.getByRole('button',{name:'准备已融合窗口'}).click();
  await page.waitForFunction(({a,b})=>{const s=window.__aw.kernel.getState();return s.windows[a].group?.startsWith('surface:')&&s.windows[a].group===s.windows[b].group;},ids);
  await page.waitForFunction(()=>!Object.values(window.__aw.kernel.getState().windows).some(w=>w.props.surfaceAnimating));
  assert.equal(await page.locator('.surface-seam-hit').first().evaluate(element=>getComputedStyle(element).pointerEvents),'none');
  const title=await root(ids.a).locator('.aw-title').boundingBox(),x=title.x+180,y=title.y+20;
  await page.mouse.move(x,y);await page.mouse.down();
  for(const delta of [65,-65,65,-65,65])await page.mouse.move(x+delta,y,{steps:5});
  await page.mouse.up();
  await page.waitForFunction(({a,b})=>!window.__aw.kernel.get(a)?.group&&!window.__aw.kernel.get(b)?.group,ids);

  await selectMode('胶囊与提案预览','capsule');
  const pdfId=await page.evaluate(()=>window.__aw.kernel.open({appId:'study',title:'AutoUE.pdf',rect:{x:250,y:105,w:660,h:620},props:{resource:'pdf',taskId:'comparison'}}));
  const pdfWindow=root(pdfId);
  await page.waitForFunction(id=>document.querySelectorAll(`[data-win="${id}"] .study-pdf-page`).length>2,pdfId);
  await pdfWindow.locator('.study-pdf-scroll').hover();
  await page.mouse.wheel(0,520);
  await page.waitForFunction(id=>document.querySelector(`[data-win="${id}"] .study-pdf-scroll`)?.scrollTop>400,pdfId);
  await pdfWindow.locator('.study-pdf-page[data-page="2"]').evaluate(element=>{element.parentElement.scrollTop=element.offsetTop;});
  await page.waitForFunction(id=>document.querySelector(`[data-win="${id}"] .study-pdf-toolbar [aria-label="当前页"]`)?.textContent?.startsWith('第 2 /'),pdfId);
  await pdfWindow.getByRole('button',{name:'放大'}).click();
  await page.waitForFunction(id=>{const win=document.querySelector(`[data-win="${id}"]`);return win?.querySelector('.study-pdf-page[data-page="2"] canvas')?.style.visibility==='visible'&&Array.from(win.querySelectorAll('.study-pdf-toolbar span')).at(-1)?.textContent==='120%';},pdfId);
  const pdfScroll=pdfWindow.locator('.study-pdf-scroll');
  const beforeScroll=await pdfScroll.evaluate(element=>element.scrollTop);
  await pdfWindow.locator('.study-pdf-page[data-page="2"] canvas').click({button:'right'});
  await page.getByRole('menuitem',{name:'复制窗口'}).click();
  const copyId=await page.evaluate(id=>window.__aw.kernel.list().find(win=>win.id!==id)?.id,pdfId);
  assert.ok(copyId,'Copy creates a second window');
  const copyWindow=root(copyId);
  await page.waitForFunction(id=>document.querySelector(`[data-win="${id}"] .study-pdf-page[data-page="2"] canvas`)?.style.visibility==='visible',copyId);
  assert.ok((await copyWindow.locator('[aria-label="当前页"]').textContent())?.startsWith('第 2 /'));
  assert.equal(await copyWindow.locator('.study-pdf-toolbar span').last().textContent(),'120%');
  assert.ok(Math.abs((await copyWindow.locator('.study-pdf-scroll').evaluate(element=>element.scrollTop))-beforeScroll)<8,'Copy keeps PDF reading position');
  await copyWindow.locator('.study-pdf-page[data-page="3"]').evaluate(element=>{element.parentElement.scrollTop=element.offsetTop;});
  assert.ok((await pdfWindow.locator('[aria-label="当前页"]').textContent())?.startsWith('第 2 /'),'Copy has independent reading state');
  await page.evaluate(id=>window.__aw.kernel.close(id),copyId);
  await pdfWindow.locator('.aw-title').click({button:'right'});
  assert.equal(await page.getByRole('menuitem',{name:'框选重要区域'}).count(),0);
  await page.getByRole('menuitem',{name:'收为胶囊…'}).click();
  assert.equal(await page.locator('.study-capsule-target').count(),1);
  await page.getByRole('button',{name:'确认收纳'}).click();
  await page.waitForFunction(id=>window.__aw.kernel.get(id).form==='capsule',pdfId);
  await pdfWindow.getByRole('button',{name:'释放胶囊中的全部窗口'}).click();
  await page.waitForFunction(id=>!window.__aw.kernel.get(id)?.props.agentRelease&&window.__aw.kernel.get(id)?.form==='normal',pdfId);
  await page.waitForFunction(id=>document.querySelector(`[data-win="${id}"] .study-pdf-page[data-page="2"] canvas`)?.style.visibility==='visible',pdfId);
  assert.ok((await pdfWindow.locator('[aria-label="当前页"]').textContent())?.startsWith('第 2 /'));
  assert.equal(await pdfWindow.locator('.study-pdf-toolbar span').last().textContent(),'120%');
  assert.ok(Math.abs((await pdfScroll.evaluate(element=>element.scrollTop))-beforeScroll)<8,'PDF reading position survives capsule restoration');
  assert.deepEqual(errors,[]);assert.deepEqual(agentCalls,[]);
  console.log('PASS: five isolated interaction modes, worm cursor, gestures, window copying, PDF restoration and agent-off isolation.');
}finally{await browser.close();}
