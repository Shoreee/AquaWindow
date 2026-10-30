import {chromium} from 'playwright-core';
import {mkdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const url=process.env.AW_URL??'http://127.0.0.1:4177/',browser=await chromium.launch({channel:'chrome',headless:true});
await mkdir('screenshots/readme-video',{recursive:true});await mkdir('docs/figures',{recursive:true});
async function record(name,perform){
 const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:'screenshots/readme-video',size:{width:1440,height:900}}}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url);await page.getByRole('button',{name:'AquaWindow',exact:true}).waitFor();await page.waitForTimeout(900);
 await perform(page);await page.waitForTimeout(700);const video=page.video();await context.close();
 if(errors.length)throw new Error(errors.join('\n'));
 const file=`docs/figures/${name}.gif`;
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','0.6','-i',await video.path(),'-filter_complex','[0:v]fps=10,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=5','-loop','0',file]);
 console.log(`${file}: ${((await stat(file)).size/1024/1024).toFixed(2)} MiB`);
}
try{
 await record('agent-interaction',async p=>{
  await p.mouse.move(1070,760,{steps:16});await p.waitForTimeout(450);await p.keyboard.down('Space');
  const title=await p.locator('[data-win]').last().locator('.aw-title').boundingBox();await p.mouse.click(title.x+150,title.y+20);
  await p.locator('.agent-candidate-tabs').waitFor();await p.waitForTimeout(2600);await p.keyboard.press('ArrowRight');await p.waitForTimeout(2200);await p.keyboard.up('Space');await p.waitForTimeout(800);
 });
 await record('manual-membrane',async p=>{
  const root=p.locator('[data-win]').last(),title=await root.locator('.aw-title').boundingBox();await p.mouse.move(title.x+170,title.y+20,{steps:18});await p.waitForTimeout(400);await p.mouse.down();
  await p.mouse.move(title.x+235,title.y+48,{steps:18});await p.waitForTimeout(1250);await p.mouse.move(title.x+195,title.y+80,{steps:25});await p.waitForTimeout(450);await p.mouse.up();await p.waitForTimeout(850);
 });
 await record('surface-fusion',async p=>{
  const root=p.locator('[data-win]').last();await root.locator('.aw-title').click({button:'right'});await p.getByRole('menuitem',{name:'与相关窗口融合',exact:true}).click();await p.waitForTimeout(1100);
  const title=await root.locator('.aw-title').boundingBox();await p.mouse.move(title.x+160,title.y+20);await p.mouse.down();await p.mouse.move(title.x+190,title.y+38,{steps:20});await p.mouse.up();await p.waitForTimeout(1600);
  const seam=()=>p.locator('[data-surface-bond] .surface-seam-hit').first();let r=await seam().boundingBox();
  await p.mouse.move(r.x+r.width/2,r.y+2);await p.mouse.down();await p.mouse.move(r.x+r.width/2,r.y+r.height*.66,{steps:35});await p.waitForTimeout(350);await p.mouse.up();await p.waitForTimeout(800);
  r=await seam().boundingBox();await p.mouse.move(r.x+r.width/2,r.y+2,{steps:15});await p.mouse.down();await p.mouse.move(r.x+r.width/2,Math.ceil(r.y+r.height)+3,{steps:48});await p.mouse.up();await p.waitForTimeout(850);
  const next=await root.locator('.aw-title').boundingBox();await p.mouse.move(next.x+160,next.y+20);await p.mouse.down();await p.mouse.move(next.x+205,next.y+35,{steps:18});await p.mouse.up();await p.waitForTimeout(1000);
 });
 await record('recursive-capsules',async p=>{
  const writer=p.locator('[data-win^="writer-"]'),preview=p.locator('[data-win^="preview-"]'),finder=p.locator('[data-win^="finder-"]');
  const writerId=await writer.getAttribute('data-win');
  const pack=async root=>{await root.locator('.aw-title').click({button:'right',position:{x:130,y:20}});await p.getByRole('menuitem',{name:'收为胶囊',exact:true}).click();await root.locator('.session-capsule').waitFor();await p.waitForTimeout(200);};
  await pack(writer);let r=await writer.boundingBox(),title=await preview.locator('.aw-title').boundingBox();
  await p.mouse.move(r.x+r.width/2,r.y+35);await p.mouse.down();await p.mouse.move(title.x+title.width*.55,title.y+18,{steps:25});await p.mouse.up();await p.locator(`[data-capsule-id="${writerId}"]`).waitFor();await p.waitForTimeout(500);
  let chip=await p.locator(`[data-capsule-id="${writerId}"]`).boundingBox(),f=await finder.locator('.aw-title').boundingBox();
  await p.mouse.move(f.x+80,f.y+20);await p.mouse.down();await p.mouse.move(chip.x+chip.width/2,chip.y+chip.height/2,{steps:30});await p.mouse.up();await p.waitForTimeout(1200);
  await pack(preview);chip=await p.locator(`[data-capsule-id="${writerId}"]`).boundingBox();
  await p.mouse.move(chip.x+20,chip.y+10);await p.mouse.down();await p.mouse.move(900,480,{steps:25});await p.mouse.up();await p.waitForTimeout(500);
  r=await writer.boundingBox();const parent=await preview.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+35);await p.mouse.down();await p.mouse.move(parent.x+parent.width*.45,parent.y+parent.height/2,{steps:30});await p.mouse.up();await p.waitForTimeout(1200);await preview.locator('.capsule-page').last().hover();await p.waitForTimeout(700);
 });

}finally{await browser.close();}
