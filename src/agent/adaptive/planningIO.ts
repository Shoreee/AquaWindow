import type {AgentContext,AgentPlan} from './types';
export type PlanningMessage={role:'system'|'user'|'assistant';content:string};
export type ContextDelta={globals:Partial<Omit<AgentContext,'windows'|'sources'>>;windows:{remove:string[];order?:string[];upsert:AgentContext['windows']};sources:{remove:string[];order?:string[];upsert:AgentContext['sources']}};
export type PlanningPacket={context:AgentContext}|{baseId:string;delta:ContextDelta};
export interface PlanningRecord {context:AgentContext;messages:PlanningMessage[];output:{plans:AgentPlan[];interpretation?:unknown}}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const globalKeys=['version','key','semanticKey','task','selectedIds','focusedId','work','activity','feedback','workspace'] as const;
export function contextDelta(before:AgentContext,after:AgentContext):ContextDelta{
 const globals:ContextDelta['globals']={};
 for(const key of globalKeys)if(!equal(before[key],after[key]))Object.assign(globals,{[key]:after[key]});
 const collection=<T extends {id:string}>(old:T[],next:T[])=>({remove:old.filter(item=>!next.some(n=>n.id===item.id)).map(item=>item.id),...(!equal(old.map(i=>i.id),next.map(i=>i.id))?{order:next.map(i=>i.id)}:{}),upsert:next.filter(item=>!equal(item,old.find(o=>o.id===item.id)))});
 return {globals,windows:collection(before.windows,after.windows),sources:collection(before.sources,after.sources)};
}
export function applyContextDelta(base:AgentContext,value:unknown):AgentContext{
 const d=value as ContextDelta;
 if(!d||typeof d!=='object'||!d.globals||typeof d.globals!=='object'||Object.keys(d.globals).some(key=>!globalKeys.includes(key as typeof globalKeys[number])))throw new Error('invalid');
 const apply=<T extends {id:string}>(old:T[],patch:{remove:string[];order?:string[];upsert:T[]},max:number)=>{
  if(!patch||!Array.isArray(patch.remove)||!Array.isArray(patch.upsert)||patch.remove.length>max||patch.upsert.length>max||!patch.remove.every(id=>typeof id==='string')||!patch.upsert.every(item=>item&&typeof item.id==='string'))throw new Error('invalid');
  const map=new Map(old.map(item=>[item.id,item]));for(const id of patch.remove)map.delete(id);for(const item of patch.upsert)map.set(item.id,item);if(patch.order){if(!Array.isArray(patch.order)||patch.order.length!==map.size||new Set(patch.order).size!==map.size||!patch.order.every(id=>map.has(id)))throw new Error('invalid');return patch.order.map(id=>map.get(id)!);}return [...map.values()];
 };
 return {...base,...d.globals,windows:apply(base.windows,d.windows,8),sources:apply(base.sources,d.sources,40)};
}
/** A shared, identical protocol for the local server and visitor-key direct API route.
 * Delta requests reference an actual model conversation, never a fictional remembered state. */
export class PlanningMemory {
 private records=new Map<string,PlanningRecord>();
 prepare(packet:PlanningPacket,system:string){
  if('baseId' in packet){
   const previous=this.records.get(packet.baseId);if(!previous)throw Object.assign(new Error('base_missing'),{status:409});
   const context=applyContextDelta(previous.context,packet.delta);
   // Bound history; preserve a cacheable prefix for incremental turns, periodically rebase.
   const messages:PlanningMessage[]=previous.messages[0]?.content===system&&previous.messages.length<7&&previous.messages.reduce((sum,message)=>sum+message.content.length,0)<16000
    ?[...previous.messages,{role:'assistant',content:JSON.stringify(previous.output)},{role:'user',content:JSON.stringify({mode:'update',delta:packet.delta})}]
    :[{role:'system',content:system},{role:'user',content:JSON.stringify({mode:'full',context})}];
   return {context,messages};
  }
  return {context:packet.context,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify({mode:'full',context:packet.context})}] as PlanningMessage[]};
 }
 remember(record:PlanningRecord){const id=crypto.randomUUID();this.records.set(id,record);while(this.records.size>32)this.records.delete(this.records.keys().next().value!);return id;}
 clear(){this.records.clear();}
}
