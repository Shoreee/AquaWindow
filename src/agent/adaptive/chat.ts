import {getSessionKey} from './credentials';
import {ui} from '../../system/ui';
export type ChatMessage={role:'user'|'assistant';content:string|({type:'text';text:string}|{type:'image_url';image_url:{url:string}})[]};
const errors:Record<string,string>={disabled:'Agent 权限未开启，请在右下角设置中开启。',unconfigured:'请在右下角设置中填写 DeepSeek Key。',auth:'DeepSeek Key 无效，请重新填写。',limited:'请求过于频繁，请稍后重试。',busy:'DeepSeek 服务繁忙，请稍后重试。',upstream:'DeepSeek 暂时无法响应，请重试。',timeout:'请求超时，请重试。',invalid:'返回内容为空，请重试。',body_limit:'图片过大，请缩小后重试。'};
export async function askDeepSeek(messages:ChatMessage[],signal:AbortSignal){
 if(!ui.get().agentEnabled)throw new Error(errors.disabled);
 const key=getSessionKey();
 const response=await fetch(key?'https://api.deepseek.com/chat/completions':'/api/agent/chat',{
  method:'POST',signal:AbortSignal.any([signal,AbortSignal.timeout(60000)]),
  headers:{'content-type':'application/json',...(key?{authorization:`Bearer ${key}`}:{'x-aw-agent':'enabled'})},
  body:JSON.stringify(key?{model:'deepseek-flash',messages:[{role:'system',content:'你是工作空间中的 AI 助手。用用户的语言简洁准确地回答。不能读取未提供的窗口或文档，不要编造来源。'},...messages],thinking:{type:'disabled'},max_tokens:2048}:{messages}),
 });
 const data=await response.json().catch(()=>{throw new Error(response.ok?errors.invalid:errors.upstream);});
 if(!response.ok)throw new Error(errors[data.error]??(response.status===401?errors.auth:response.status===429?errors.limited:response.status===503?errors.busy:errors.upstream));
 const text=key?data.choices?.[0]?.message?.content:data.text;
 if(typeof text!=='string'||!text.trim())throw new Error(errors.invalid);
 return text as string;
}
