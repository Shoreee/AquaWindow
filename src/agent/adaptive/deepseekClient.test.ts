import {afterEach,describe,it,expect,vi} from 'vitest';
import {agentFetch} from './deepseekClient';
import {credentialState,getSessionKey,setSessionKey} from './credentials';
afterEach(()=>{setSessionKey('');vi.unstubAllGlobals();});
describe('session-only visitor credentials',()=>{
 it('stores only a presence flag and never calls the API when the request is disabled',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);setSessionKey('  visitor-fixture  ');
  expect(credentialState.get()).toEqual({hasKey:true});expect(getSessionKey()).toBe('visitor-fixture');
  expect((await agentFetch('/api/agent/plan')).status).toBe(403);expect(fetcher).not.toHaveBeenCalled();
 });
 it('sends the visitor key only to DeepSeek, outside the context, and returns no secret',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'{"plans":[]}'},finish_reason:'stop'}]})));vi.stubGlobal('fetch',fetcher);setSessionKey('visitor-fixture');
  const response=await agentFetch('/api/agent/plan',{headers:{'x-aw-deepseek':'enabled'},body:JSON.stringify({context:{key:'workspace'}})});
  expect(fetcher.mock.calls[0][0]).toBe('https://api.deepseek.com/chat/completions');
  expect(fetcher.mock.calls[0][1].headers.authorization).toBe('Bearer visitor-fixture');expect(fetcher.mock.calls[0][1].body).not.toContain('visitor-fixture');
  expect(await response.json()).toEqual({plans:[],model:'deepseek-flash'});
 });
 it('sanitizes upstream errors without echoing credentials',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('visitor-fixture',{status:401})));setSessionKey('visitor-fixture');
  const response=await agentFetch('/api/agent/plan',{headers:{'x-aw-deepseek':'enabled'},body:'{"context":{}}'});expect(await response.json()).toEqual({error:'auth'});
 });
});
