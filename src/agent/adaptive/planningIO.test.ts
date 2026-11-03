import {describe,it,expect} from 'vitest';
import {PlanningMemory,contextDelta} from './planningIO';
import {canReuseContext} from './reuse';
import {CandidateBuffer} from './buffer';
import type {AgentContext,AgentPlan} from './types';
const ctx:AgentContext={version:1,key:'first',semanticKey:'same-content',task:'papers',selectedIds:[],focusedId:'note',work:{x:0,y:0,w:1400,h:800},windows:[{id:'note',app:'study',title:'笔记',role:'primary',rect:{x:100,y:80,w:500,h:600},depth:0,focused:true,sourceIds:['note:text'],scroll:0}],sources:[{id:'note:text',windowId:'note',kind:'note',title:'笔记',text:'保留的正文'.repeat(500)}],activity:[],feedback:{accepted:[],rejected:[]}};
const plan:AgentPlan={id:'model-plan',title:'聚焦笔记',rationale:'保留笔记内容。',priority:.8,confidence:.7,primaryTargets:['note'],supportTargets:[],steps:[{type:'arrange',targets:['note'],layout:'focus'}],artifacts:[]};
describe('real model reuse and versioned delta I/O',()=>{
 it('reuses a small layout change but rejects a large move or changed document',()=>{
  const small={...ctx,windows:ctx.windows.map(w=>({...w,rect:{...w.rect,x:110}}))};
  const large={...ctx,windows:ctx.windows.map(w=>({...w,rect:{...w.rect,x:700}}))};
  expect(canReuseContext(ctx,small)).toBe(true);expect(canReuseContext(ctx,large)).toBe(false);
  expect(canReuseContext(ctx,{...ctx,semanticKey:'different-content'})).toBe(false);
  const buffer=new CandidateBuffer();buffer.setRemoteEnabled(true);buffer.entries.set(ctx.key,{context:ctx,plans:[plan],generatedAt:performance.now()});
  expect(buffer.get(small)?.[0].origin).toBe('deepseek');expect(buffer.get(large)).toBeNull();buffer.stop();
 });
 it('sends only changed fields and restores the exact model context with a real conversation prefix',()=>{
  const memory=new PlanningMemory(),first=memory.prepare({context:ctx},'system');
  const reference=memory.remember({...first,output:{plans:[plan]}});
  const next={...ctx,key:'second',windows:ctx.windows.map(w=>({...w,rect:{...w.rect,x:700}}))};
  const delta=contextDelta(ctx,next),packet={baseId:reference,delta};
  expect(delta.sources.upsert).toEqual([]);expect(JSON.stringify(packet)).not.toContain(ctx.sources[0].text);
  expect(JSON.stringify(packet).length).toBeLessThan(JSON.stringify({context:next}).length/2);
  const prepared=memory.prepare(packet,'system');expect(prepared.context).toEqual(next);
  expect(prepared.messages.slice(0,first.messages.length)).toEqual(first.messages);
  expect(prepared.messages.at(-1)!.content).not.toContain(ctx.sources[0].text);
 });
 it('rebases when the active system instructions change',()=>{
  const memory=new PlanningMemory(),first=memory.prepare({context:ctx},'old restricted prompt');
  const reference=memory.remember({...first,output:{plans:[plan]}});
  const next={...ctx,key:'updated'};
  const prepared=memory.prepare({baseId:reference,delta:contextDelta(ctx,next)},'current native capabilities');
  expect(prepared.messages).toHaveLength(2);
  expect(prepared.messages[0].content).toBe('current native capabilities');
  expect(JSON.parse(prepared.messages[1].content)).toEqual({mode:'full',context:next});
  expect(JSON.stringify(prepared.messages)).not.toContain('old restricted prompt');
 });
 it('includes changed content and removals and rejects unknown baseline IDs',()=>{
  const memory=new PlanningMemory(),first=memory.prepare({context:ctx},'system'),reference=memory.remember({...first,output:{plans:[plan]}});
  const next={...ctx,sources:[{...ctx.sources[0],text:'变化后的正文'}]};
  const delta=contextDelta(ctx,next);expect(delta.sources.upsert).toEqual(next.sources);
  expect(memory.prepare({baseId:reference,delta},'system').context).toEqual(next);
  expect(()=>memory.prepare({baseId:'missing',delta},'system')).toThrow('base_missing');
  expect(()=>memory.prepare({baseId:reference,delta:{...delta,globals:JSON.parse('{"__proto__":{}}')}},'system')).toThrow('invalid');
 });
 it('uses a delta packet after a real response, never synthesizes a result before the next response',async()=>{
  const requests:unknown[]=[];const buffer=new CandidateBuffer(async(_url,init)=>{requests.push(JSON.parse(String(init?.body)));return new Response(JSON.stringify({plans:[plan],referenceId:'server-reference'}));});
  buffer.setRemoteEnabled(true);buffer.request(ctx,true);await new Promise(r=>setTimeout(r,0));
  const large={...ctx,windows:ctx.windows.map(w=>({...w,rect:{...w.rect,x:700}}))};
  expect(buffer.get(large)).toBeNull();buffer.request(large,true);await new Promise(r=>setTimeout(r,0));
  expect(requests[1]).toMatchObject({baseId:'server-reference',delta:{sources:{upsert:[]}}});
  expect(requests[1]).not.toHaveProperty('context');expect(buffer.get(large)?.[0].id).toBe('model-plan');buffer.stop();
 });
});
