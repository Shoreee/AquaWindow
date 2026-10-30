import type {KernelState,WindowState} from '../../kernel/types';
import type {CapsuleSnapshot} from './types';
import {capsuleSize} from './capsuleGeometry';
export const capsuleSnapshot=(w?:WindowState)=>w?.props.agentCapsule as CapsuleSnapshot|undefined;
export const dockParent=(w?:WindowState)=>(w?.props.capsuleDock as {parentId:string}|undefined)?.parentId;
/** Include both contained pages and title-bar attachments in cycle detection. */
export function capsuleGraphContains(state:KernelState,root:string,needle:string){
 const seen=new Set<string>();
 const visit=(w:WindowState|undefined):boolean=>{if(!w)return false;if(w.id===needle)return true;if(seen.has(w.id))return false;seen.add(w.id);
  return (capsuleSnapshot(w)?.members??[]).some(visit)||Object.values(state.windows).filter(child=>dockParent(child)===w.id).some(visit);
 };return visit(state.windows[root]);
}
export function canPutInCapsule(state:KernelState,sourceId:string,targetId:string){
 const source=state.windows[sourceId],target=state.windows[targetId];return !!source&&!!capsuleSnapshot(target)&&sourceId!==targetId&&!capsuleGraphContains(state,sourceId,targetId)&&!capsuleGraphContains(state,targetId,sourceId);
}
export function insertCapsuleState(state:KernelState,sourceIds:string[],targetId:string){
 const target=state.windows[targetId],snapshot=capsuleSnapshot(target);if(!target||!snapshot||!sourceIds.length||sourceIds.some(id=>!canPutInCapsule(state,id,targetId)))return null;
 const members=sourceIds.map(id=>{const w=state.windows[id],props={...w.props};delete props.capsuleDock;delete props.agentMotion;delete props.agentQueue;delete props.agentCapsuleBusy;return {...w,minimized:false,props};});
 const updated={...snapshot,members:[...snapshot.members,...members],order:[...new Set([...snapshot.order,...state.order])],scroll:{...snapshot.scroll}};
 const windows={...state.windows},oldSize=capsuleSize(snapshot.members.length),size=capsuleSize(updated.members.length),from=target.capsuleRect??target.rect;
 windows[targetId]={...target,capsuleRect:{...from,w:from.w*size.w/oldSize.w,h:from.h*size.h/oldSize.h},props:{...target.props,agentCapsule:updated}};
 for(const id of sourceIds)windows[id]={...windows[id],minimized:true,props:{...windows[id].props,capsuleDock:undefined}};
 return {...state,windows,focusedId:dockParent(target)??targetId};
}
export function dockCapsuleState(state:KernelState,id:string,parentId:string){
 const child=state.windows[id],parent=state.windows[parentId];if(!capsuleSnapshot(child)||!parent||parent.form!=='normal'||capsuleGraphContains(state,id,parentId))return null;
 return {...state,windows:{...state.windows,[id]:{...child,minimized:false,props:{...child.props,capsuleDock:{parentId},agentCapsuleBusy:undefined}}},focusedId:parentId};
}
