import type {AgentContext} from './types';
export interface TaskInterpretation {intent:string;subjectIds:string[];evidenceIds:string[];status:'tentative';phase?:'lookup'|'compare'|'edit'|'park'|'resume'|'unknown'}
/** Only grounded, bounded model hypotheses enter memory. They never become observed facts. */
export function validateInterpretation(value:unknown,ctx:AgentContext):TaskInterpretation|null{
 if(!value||typeof value!=='object')return null;
 const v=value as Record<string,unknown>,windows=new Set(ctx.windows.map(w=>w.id)),sources=new Set(ctx.sources.map(s=>s.id));
 if(typeof v.intent!=='string'||!v.intent.trim()||v.intent.length>240||!Array.isArray(v.subjectIds)||!v.subjectIds.length||v.subjectIds.length>8||!v.subjectIds.every(id=>typeof id==='string'&&windows.has(id))||!Array.isArray(v.evidenceIds)||!v.evidenceIds.length||v.evidenceIds.length>8||!v.evidenceIds.every(id=>typeof id==='string'&&sources.has(id)))return null;
 return {...(['lookup','compare','edit','park','resume','unknown'].includes(String(v.phase))?{phase:v.phase as TaskInterpretation['phase']}:{}),intent:v.intent,subjectIds:[...new Set(v.subjectIds)] as string[],evidenceIds:[...new Set(v.evidenceIds)] as string[],status:'tentative'};
}
