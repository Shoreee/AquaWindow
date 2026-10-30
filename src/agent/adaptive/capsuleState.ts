import type {KernelState,WindowState} from '../../kernel/types';
import type {CapsuleSnapshot} from './types';
import {capsuleSize} from './capsuleGeometry';
export const restoredCapsuleMember=(member:WindowState,snapshot:CapsuleSnapshot):WindowState=>({...member,form:member.form==='capsule'?'capsule':'normal',minimized:false,props:{...member.props,restoreScroll:snapshot.scroll[member.id]??0,restoreToken:performance.now()}});

/** Pure split: the container gets a new identity if its original host page is taken out. */
export function extractCapsuleState(state:KernelState,id:string,memberId:string){
 const host=state.windows[id],snapshot=host?.props.agentCapsule as CapsuleSnapshot|undefined;
 const member=snapshot?.members.find(w=>w.id===memberId);if(!host||!snapshot||!member)return null;
 const source=host.capsuleRect??host.rect,remaining=snapshot.members.filter(w=>w.id!==memberId),windows={...state.windows};
 let carrierId:string|undefined=id;
 if(remaining.length){
  const size=capsuleSize(remaining.length),old=capsuleSize(snapshot.members.length);
  const rect={...source,w:source.w*size.w/old.w,h:source.h*size.h/old.h};
  if(id===memberId){carrierId=`capsule:${id}:${Math.round(performance.now())}`;delete windows[id];}
  windows[carrierId]={...host,id:carrierId,capsuleRect:rect,props:{...host.props,agentCapsule:{...snapshot,members:remaining},agentCapsuleBusy:false}};
 }else{delete windows[id];carrierId=undefined;}
 windows[memberId]=restoredCapsuleMember(member,snapshot);
 const order=[...state.order.filter(key=>windows[key]&&key!==memberId),...(carrierId&&!state.order.includes(carrierId)?[carrierId]:[]),memberId];
 return {state:{...state,windows,order,focusedId:memberId},carrierId,source,member:windows[memberId]};
}

