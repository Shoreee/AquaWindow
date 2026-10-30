import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {kernel,workArea} from '../system/kernel';
import {cancelCapsuleMotion,packWindows} from '../agent/adaptive/capsule';
import {cancelManualWindowMotion,maximizeWithMotion} from '../agent/adaptive/manualMotion';
import {cancelSurfaceInteraction,fuseSurfaces,relatedPartner} from './surfaceFusion';
import {surfaceComponent,isSurfaceGroup,surfaceBonds} from './surfaceBondGeometry';
export function WindowMenu({id,x,y,onClose}:{id:string;x:number;y:number;onClose():void}){
 const root=useRef<HTMLDivElement>(null),w=kernel.get(id);
 useEffect(()=>{root.current?.focus();const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))onClose();},key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopImmediatePropagation();onClose();}};
  window.addEventListener('pointerdown',close,true);window.addEventListener('keydown',key,true);return()=>{window.removeEventListener('pointerdown',close,true);window.removeEventListener('keydown',key,true);};},[onClose]);
 if(!w)return null;
 const action=(fn:()=>void)=>()=>{cancelSurfaceInteraction();cancelManualWindowMotion();cancelCapsuleMotion();onClose();fn();};
 const related=relatedPartner(id);
 return createPortal(<div className="window-context-menu" role="menu" aria-label="窗口操作" tabIndex={-1} ref={root} style={{left:Math.min(x,innerWidth-216),top:Math.min(y,innerHeight-230)}} onPointerDown={e=>e.stopPropagation()}>
  <small>{w.title}</small>
  <button role="menuitem" onClick={action(()=>packWindows(surfaceComponent(kernel.getState(),id)))}>收为胶囊</button>
  {isSurfaceGroup(w.group)?<button role="menuitem" onClick={action(()=>{const bond=surfaceBonds(kernel.get(id))[0];if(bond)document.querySelector<SVGElement>(`[data-surface-bond="${CSS.escape(bond.id)}"] .surface-seam-hit`)?.focus();})}>定位分离接缝</button>:<button role="menuitem" disabled={!related} onClick={action(()=>{if(related)fuseSurfaces(id,related);})}>与相关窗口融合</button>}
  <button role="menuitem" onClick={action(()=>maximizeWithMotion(id,workArea()))}>{w.maximized?'还原大小':'最大化'}</button>
  <button role="menuitem" onClick={action(()=>{const state=kernel.getState();kernel.apply(surfaceComponent(state,id).map(windowId=>({windowId,depth:Math.min(1,(state.windows[windowId].depth+.25)%1.01)})),'user','depth');})}>后移一层</button>
  <div className="window-menu-divider"/>
  <button role="menuitem" onClick={action(()=>kernel.close(id))}>关闭窗口</button>
 </div>,document.body);
}
