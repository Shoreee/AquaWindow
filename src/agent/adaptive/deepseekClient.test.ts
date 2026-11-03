import {contextDelta} from './planningIO';
import type {AgentContext} from './types';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {agentFetch} from './deepseekClient';
import {credentialState,getSessionKey,setSessionKey} from './credentials';
afterEach(()=>{setSessionKey('');vi.unstubAllGlobals();});
describe('session-only visitor credentials',()=>{
 it('exposes credential metadata without secrets and never calls the API when disabled',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);setSessionKey('  visitor-fixture  ');
  expect(credentialState.get()).toEqual({hasKey:true,revision:expect.any(Number)});expect(getSessionKey()).toBe('visitor-fixture');
  expect((await agentFetch('/api/agent/plan')).status).toBe(403);expect(fetcher).not.toHaveBeenCalled();
 });
 it('sends the visitor key only to DeepSeek, outside the context, and returns no secret',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'{"plans":[]}'},finish_reason:'stop'}]})));vi.stubGlobal('fetch',fetcher);setSessionKey('visitor-fixture');
  const response=await agentFetch('/api/agent/plan',{headers:{'x-aw-deepseek':'enabled'},body:JSON.stringify({context:{key:'workspace'}})});
  expect(fetcher.mock.calls[0][0]).toBe('https://api.deepseek.com/chat/completions');
  expect(fetcher.mock.calls[0][1].headers.authorization).toBe('Bearer visitor-fixture');expect(fetcher.mock.calls[0][1].body).not.toContain('visitor-fixture');
  expect(await response.json()).toMatchObject({referenceId:expect.any(String),plans:[],model:'deepseek-flash'});
 });
 it('sanitizes upstream errors without echoing credentials',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('visitor-fixture',{status:401})));setSessionKey('visitor-fixture');
  const response=await agentFetch('/api/agent/plan',{headers:{'x-aw-deepseek':'enabled'},body:'{"context":{}}'});expect(await response.json()).toEqual({error:'auth'});
 });
 it('reports provider busy separately and never echoes the provider response',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private provider diagnostics',{status:503})));setSessionKey('visitor-fixture');
  const response=await agentFetch('/api/agent/plan',{headers:{'x-aw-deepseek':'enabled'},body:'{"context":{}}'});
  expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'busy'});
 });

 it('uses actual prior conversation plus a delta on the visitor-key route',async()=>{
  const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({choices:[{message:{content:'{"plans":[]}'},finish_reason:'stop'}]}))));
  vi.stubGlobal('fetch',fetcher);setSessionKey('visitor-fixture');
  const context:AgentContext={version:1,key:'first',semanticKey:'content',task:'papers',selectedIds:[],focusedId:null,work:{x:0,y:0,w:1400,h:800},windows:[],sources:[],activity:[],feedback:{accepted:[],rejected:[]}};
  const first=await (await agentFetch('/api/agent/plan',{headers:{'x-aw-deepseek':'enabled'},body:JSON.stringify({context})})).json();
  const next={...context,key:'next',work:{...context.work,w:1000}};
  const second=await agentFetch('/api/agent/plan',{headers:{'x-aw-deepseek':'enabled'},body:JSON.stringify({baseId:first.referenceId,delta:contextDelta(context,next)})});
  expect(second.status).toBe(200);
  const initialInput=JSON.parse(fetcher.mock.calls[0][1].body),update=JSON.parse(fetcher.mock.calls[1][1].body);
  expect(update.messages.slice(0,2)).toEqual(initialInput.messages);expect(JSON.parse(update.messages.at(-1).content)).toMatchObject({mode:'update',delta:{globals:{key:'next'}}});
  expect(update.thinking.type).toBe('disabled');expect(update.max_tokens).toBe(2048);
 });
 it('does not invent an unknown direct-route baseline or contact the provider for it',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);setSessionKey('visitor-fixture');
  const response=await agentFetch('/api/agent/plan',{headers:{'x-aw-deepseek':'enabled'},body:JSON.stringify({baseId:'missing',delta:{}})});
  expect(response.status).toBe(409);expect(await response.json()).toEqual({error:'base_missing'});expect(fetcher).not.toHaveBeenCalled();
 });

});
