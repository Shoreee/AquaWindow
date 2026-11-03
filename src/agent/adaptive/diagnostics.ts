import type {AgentContext,AgentPlan} from './types';
import type {PlanRejection} from './protocol';
export interface AgentDiagnostic {at:string;event:'request'|'response'|'reuse'|'present'|'adopt'|'timeout'|'error';contextKey:string;traceId?:string;requestMode?:'full'|'delta';rawIds?:string[];acceptedIds?:string[];rejections?:PlanRejection[];windowCount?:number;sourceCharacters?:number;message?:string}
const records:AgentDiagnostic[]=[];
/** Engineering diagnostics: IDs/counts/reasons, never keys, document text or experiment scores. */
export function diagnose(event:AgentDiagnostic['event'],ctx:AgentContext,detail:Omit<AgentDiagnostic,'at'|'event'|'contextKey'>={}){
 const item:AgentDiagnostic={at:new Date().toISOString(),event,contextKey:ctx.key,...detail};
 if(JSON.stringify(records.at(-1)?.event===event?{...records.at(-1),at:undefined}:null)===JSON.stringify({...item,at:undefined}))return;
 records.push(item);if(records.length>100)records.shift();
 if(import.meta.env.DEV&&typeof window!=='undefined')void fetch('/api/agent/diagnostic',{method:'POST',headers:{'content-type':'application/json','x-aw-diagnostic':'enabled'},body:JSON.stringify(item)}).catch(()=>{});
}
export const agentDiagnostics={snapshot:()=>records.map(r=>({...r})),export(){const url=URL.createObjectURL(new Blob([JSON.stringify(records,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='aquaw-agent-diagnostics.json';a.click();URL.revokeObjectURL(url);}};
export function planIds(plans:AgentPlan[]){return plans.map(p=>p.id);}
