import {validateInterpretation,type TaskInterpretation} from './interpretation';
import type {KernelState,Rect} from '../../kernel/types';
import type {BusEvent} from '../../system/bus';
import type {AgentContext} from './types';
import {makeContext,hash} from './context';
import {appObservation,forgetObservations} from './observations';

export interface WorkspaceSummary {
 revision:number;semanticRevision:number;
 task?:TaskInterpretation;
 relations:{from:string;to:string;kind:'same-document'|'opened-from';evidence:string}[];
 activity:{type:string;windowId?:string}[];
 changes:{added:string[];removed:string[];updated:string[]};
 constraints:readonly ['explicit-confirmation','preserve-documents','no-automatic-yield'];
}
/** Persistent local workspace memory. Only its relevant projection crosses the model boundary.
 * Jelly's model/specification separation; this is a deterministic model, not an untrained belief estimator. */
export class TaskDrivenWorkspace {
 private task:{semanticKey:string;value:TaskInterpretation}|undefined;
 acceptInterpretation(value:unknown,ctx:AgentContext){const valid=validateInterpretation(value,ctx);if(valid)this.task={semanticKey:ctx.semanticKey,value:valid};}
 private revision=0;private semanticRevision=0;private lastSemantic='';
 private fingerprints=new Map<string,string>();private summary:WorkspaceSummary|undefined;
 context(state:KernelState,work:Rect,selected:string[],events:BusEvent[],feedback:AgentContext['feedback']):AgentContext{
  const visible=state.order.filter(id=>{const w=state.windows[id];return w&&!w.minimized&&w.form==='normal'&&w.role!=='system'&&w.appId!=='experiment'&&!w.props.agentBranch;});
  const available=new Set(visible),explicit=selected.filter(id=>available.has(id)).slice(0,8);
  const focus=available.has(state.focusedId??'')?state.focusedId!:visible.at(-1);
  const subjects=explicit.length?explicit:focus?[focus]:[];
  const identity=(id:string)=>appObservation(id)?.documentId??String(state.windows[id].props.docId??state.windows[id].props.studyDocumentId??(state.windows[id].props.resource?`${state.windows[id].props.taskId??''}:${state.windows[id].props.resource}`:''));
  const relations:WorkspaceSummary['relations']=[];
  for(const id of visible){const w=state.windows[id];
   if(w.openedFrom&&available.has(w.openedFrom))relations.push({from:w.openedFrom,to:id,kind:'opened-from',evidence:'window.openedFrom'});
   for(const other of visible)if(id<other&&identity(id)&&identity(id)===identity(other))relations.push({from:id,to:other,kind:'same-document',evidence:'application document identity'});
  }
  const related=relations.filter(r=>subjects.includes(r.from)||subjects.includes(r.to)).flatMap(r=>[r.from,r.to]);
  const recent=[...events].reverse().map(e=>e.windowId).filter((id):id is string=>!!id&&available.has(id));
  const relevant=[...new Set([...subjects,...related,...recent,...visible.slice().reverse()])].slice(0,Math.max(4,subjects.length));
  const projected={...state,focusedId:focus??null,order:state.order.filter(id=>relevant.includes(id))};
  const ctx=makeContext(projected,work,explicit,events,feedback);
  const next=new Map(visible.map(id=>[id,hash({window:{...state.windows[id],props:Object.fromEntries(Object.entries(state.windows[id].props).filter(([key])=>!key.startsWith('agent')))},observation:appObservation(id)})]));
  const changes={added:visible.filter(id=>!this.fingerprints.has(id)),removed:[...this.fingerprints.keys()].filter(id=>!next.has(id)),updated:visible.filter(id=>this.fingerprints.has(id)&&this.fingerprints.get(id)!==next.get(id))};
  if(changes.added.length||changes.removed.length||changes.updated.length||!this.summary){this.revision++;this.fingerprints=next;}
  if(ctx.semanticKey!==this.lastSemantic){this.semanticRevision++;this.lastSemantic=ctx.semanticKey;}
  this.summary={...(this.task?.semanticKey===ctx.semanticKey?{task:this.task.value}:{}),revision:this.revision,semanticRevision:this.semanticRevision,relations:relations.filter(r=>relevant.includes(r.from)&&relevant.includes(r.to)),activity:events.slice(-6).map(e=>({type:e.type,windowId:e.windowId})),changes,constraints:['explicit-confirmation','preserve-documents','no-automatic-yield']};
  forgetObservations(new Set(Object.keys(state.windows)));
  return {...ctx,workspace:this.summary};
 }
 reset(){this.task=undefined;this.revision=0;this.semanticRevision=0;this.lastSemantic='';this.fingerprints.clear();this.summary=undefined;forgetObservations();}
}
/** Stateless API calls receive a self-contained compact model, never an orphan delta.
 * Stable prompt prefix enables provider caching; local full content remains available to adapters. */
export function compactContext(ctx:AgentContext):AgentContext{
 let remaining=3200;
 const sources=ctx.sources.map(source=>{const text=source.text.slice(0,Math.min(1000,Math.max(0,remaining)));remaining-=text.length;return {...source,text};}).filter(s=>s.text);
 const ids=new Set(sources.map(s=>s.id));
 return {...ctx,sources,windows:ctx.windows.map(w=>({...w,sourceIds:w.sourceIds.filter(id=>ids.has(id))})),activity:ctx.activity.slice(-6),feedback:{accepted:ctx.feedback.accepted.slice(-3),rejected:ctx.feedback.rejected.slice(-3)}};
}
