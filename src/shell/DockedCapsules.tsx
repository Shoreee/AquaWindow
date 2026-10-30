import {useState} from 'react';
import {createPortal} from 'react-dom';
import {useKernel} from '../system/kernel';
import {useStore} from '../system/createStore';
import {beginUndock,capsuleDropUi,restoreCapsule} from '../agent/adaptive/capsule';
import {capsuleSnapshot,dockParent} from '../agent/adaptive/capsuleTree';
export function DockedCapsules({parentId}:{parentId:string}){
 const state=useKernel(s=>s),children=Object.values(state.windows).filter(w=>dockParent(w)===parentId&&!w.minimized);
 const drop=useStore(capsuleDropUi,s=>s.target?.id===parentId&&s.target.kind==='titlebar'),[peek,setPeek]=useState<{id:string;x:number;y:number}|null>(null);
 const shown=children.find(w=>w.id===peek?.id),snapshot=capsuleSnapshot(shown);
 return <>
  {drop&&<div className="titlebar-capsule-drop" aria-hidden="true">松开，停靠胶囊</div>}
  <div className="window-docked-capsules" onPointerDown={e=>e.stopPropagation()}>
   {children.map(child=><div key={child.id} className="docked-capsule" data-capsule-id={child.id} style={{opacity:1-Number(child.props.agentCapsuleRupture??0)}} role="button" tabIndex={0} aria-label={`附属胶囊：${capsuleSnapshot(child)?.members.length??0} 项`}
    onPointerDown={e=>{e.preventDefault();e.stopPropagation();setPeek(null);if(!child.props.agentCapsuleReceiving)beginUndock(child.id,e.nativeEvent);}}
    onPointerEnter={e=>{if(!e.buttons){const r=e.currentTarget.getBoundingClientRect();setPeek({id:child.id,x:Math.min(r.x,innerWidth-260),y:r.bottom+8});}}} onPointerLeave={()=>setPeek(null)}
    onDoubleClick={e=>{e.stopPropagation();if(!child.props.agentCapsuleReceiving)restoreCapsule(child.id);}} onKeyDown={e=>{if(e.key==='Enter'&&!child.props.agentCapsuleReceiving)restoreCapsule(child.id);}} title="拖动取下或转移 · 双击释放内容">
    <i className="capsule-inner-tide"/><span>{Math.max(1,Math.ceil(Number((child.props.agentQueue as {fill?:number}|undefined)?.fill??capsuleSnapshot(child)?.members.length??0)))} 项</span>
   </div>)}
  </div>
  {peek&&snapshot&&createPortal(<div className="docked-capsule-peek" style={{left:peek.x,top:peek.y}}><b>会话胶囊</b>{snapshot.members.map(member=><span key={member.id}>{capsuleSnapshot(member)?'◉ ':''}{member.title}</span>)}<small>拖动取下 · 双击释放内容</small></div>,document.body)}
 </>;
}
