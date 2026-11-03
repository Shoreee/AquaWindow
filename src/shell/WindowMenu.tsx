import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {kernel,workArea} from '../system/kernel';
import {cancelCapsuleMotion} from '../agent/adaptive/capsule';
import {cancelManualWindowMotion,maximizeWithMotion} from '../agent/adaptive/manualMotion';
import {cancelSurfaceInteraction,fuseSurfaces,relatedPartner} from './surfaceFusion';
import {isSurfaceGroup,surfaceBonds} from './surfaceBondGeometry';
import {copyStudyMaterialState} from '../apps/StudyMaterials';
import type {StudyInteractionModeId} from '../study/interactionModes';
function duplicateWindow(id:string){
 const source=kernel.get(id);if(!source)return;
 const area=workArea(),base=source.maximized&&source.restoreRect?source.restoreRect:source.rect;
 const w=Math.min(base.w,area.w),h=Math.min(base.h,area.h);
 const rect={x:Math.max(area.x,Math.min(area.x+area.w-w,base.x+36)),y:Math.max(area.y,Math.min(area.y+area.h-h,base.y+36)),w,h};
 const props=Object.fromEntries(Object.entries(source.props).filter(([key])=>!key.startsWith('agent')&&!key.startsWith('surface')&&key!=='ghost'&&key!=='capsuleDock'));
 const copyId=`copy-${crypto.randomUUID()}`;
 if(source.appId==='study')copyStudyMaterialState(id,copyId);
 kernel.open({id:copyId,appId:source.appId,title:source.title,rect,role:source.role,depth:0,props,importance:source.importance.map(region=>({...region})),openedFrom:source.openedFrom});
}
export function WindowMenu({id,x,y,onClose,onMarkImportance,onCutHole,onPreviewCapsule,studyMode}:{id:string;x:number;y:number;onClose():void;onMarkImportance():void;onCutHole():void;onPreviewCapsule():void;studyMode?:StudyInteractionModeId|null}){
 const root=useRef<HTMLDivElement>(null),w=kernel.get(id);
 useEffect(()=>{root.current?.focus();const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))onClose();},key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopImmediatePropagation();onClose();}};
  window.addEventListener('pointerdown',close,true);window.addEventListener('keydown',key,true);return()=>{window.removeEventListener('pointerdown',close,true);window.removeEventListener('keydown',key,true);};},[onClose]);
 if(!w)return null;
 const action=(fn:()=>void)=>()=>{cancelSurfaceInteraction();cancelManualWindowMotion();cancelCapsuleMotion();onClose();fn();};
 const related=relatedPartner(id,true,true);
 return createPortal(<div className="window-context-menu" role="menu" aria-label="窗口操作" tabIndex={-1} ref={root} style={{left:Math.max(8,Math.min(x,innerWidth-216)),top:Math.max(32,Math.min(y,innerHeight-370))}} onPointerDown={e=>e.stopPropagation()}>
  <small>{w.title}</small>
  {(studyMode===undefined||studyMode==='peel')&&<button role="menuitem" onClick={action(()=>window.dispatchEvent(new CustomEvent('window:peel',{detail:{id}})))}>掀角查看</button>}
  {(studyMode===undefined||studyMode==='capsule')&&<button role="menuitem" onClick={action(onPreviewCapsule)}>收为胶囊…</button>}
  {(studyMode===undefined||studyMode==='reveal')&&<button role="menuitem" onClick={action(onMarkImportance)}>框选保留区域 <kbd>Shift S</kbd></button>}
  {(studyMode===undefined||studyMode==='reveal')&&<button role="menuitem" onClick={action(onCutHole)}>框选扣洞 <kbd>Alt S</kbd></button>}
  {(studyMode===undefined||studyMode==='reveal')&&w.importance.length>0&&<button role="menuitem" onClick={action(()=>{kernel.beginGesture('importance:clear');kernel.setImportance(id,[]);kernel.endGesture();})}>清除区域</button>}
  {(studyMode===undefined||(studyMode==='fusion'||studyMode==='sync-scroll'))&&(isSurfaceGroup(w.group)?<button role="menuitem" onClick={action(()=>{const bond=surfaceBonds(kernel.get(id))[0];if(bond)document.querySelector<SVGElement>(`[data-surface-bond="${CSS.escape(bond.id)}"] .surface-seam-hit`)?.focus();})}>定位分离接缝</button>:<button role="menuitem" disabled={!related} onClick={action(()=>{if(related)fuseSurfaces(id,related);})}>与相邻窗口融合</button>)}
  <button role="menuitem" onClick={action(()=>duplicateWindow(id))}>复制窗口</button>
  <button role="menuitem" onClick={action(()=>maximizeWithMotion(id,workArea()))}>{w.maximized?'还原大小':'最大化'}</button>
  <div className="window-menu-divider"/>
  <button role="menuitem" onClick={action(()=>kernel.close(id))}>关闭窗口</button>
 </div>,document.body);
}
