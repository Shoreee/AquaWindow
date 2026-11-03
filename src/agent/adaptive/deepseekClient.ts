import {PlanningMemory,type PlanningPacket} from './planningIO';
import {credentialState} from './credentials';
const planningMemory=new PlanningMemory();
credentialState.subscribe(()=>planningMemory.clear());
import {getSessionKey} from './credentials';
const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
/** A visitor's key is sent only to DeepSeek over HTTPS; GitHub Pages needs no shared secret. */
export async function agentFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const key=getSessionKey();
 if(!key)return fetch(input,init);
 if(new Headers(init?.headers).get('x-aw-deepseek')!=='enabled')return json(403,{error:'disabled'});
 try{
  const {ADAPTIVE_PROMPT}=await import('./prompt');
  const prepared=planningMemory.prepare(JSON.parse(String(init?.body??'{}')) as PlanningPacket,ADAPTIVE_PROMPT);
  const response=await fetch('https://api.deepseek.com/chat/completions',{
   method:'POST',signal:init?.signal,headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},
   body:JSON.stringify({model:'deepseek-flash',messages:prepared.messages,response_format:{type:'json_object'},thinking:{type:'disabled'},max_tokens:2048}),
  });
  if(!response.ok)return json(response.status,{error:response.status===401?'auth':response.status===429?'limited':response.status===503?'busy':'upstream'});
  const data=await response.json(),choice=data.choices?.[0];
  if(!choice?.message?.content||choice.finish_reason==='length')return json(502,{error:'invalid'});
  const output=JSON.parse(choice.message.content);if(!Array.isArray(output?.plans))return json(502,{error:'invalid'});
  const referenceId=planningMemory.remember({...prepared,output:{plans:output.plans,interpretation:output.interpretation}});
  return json(200,{referenceId,interpretation:output.interpretation,plans:output.plans,model:'deepseek-flash'});
 }catch(error){if((error as Error).message==='base_missing')return json(409,{error:'base_missing'});if((error as Error).name==='AbortError'||error instanceof TypeError)throw error;return json(502,{error:'invalid'});}
}
