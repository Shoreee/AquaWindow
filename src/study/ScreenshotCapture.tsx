import {useEffect,useState} from 'react';
import {kernel,workArea} from '../system/kernel';
import {ui,toast} from '../system/ui';
import {beginWindowMotion} from '../agent/adaptive/manualMotion';

type Point={x:number;y:number};
const urls=new Set<string>();
kernel.onEvent(event=>{if(event.type==='reset'){for(const url of urls)URL.revokeObjectURL(url);urls.clear();}});
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
function sourceWindow(){
  return [...kernel.list()].reverse().find(win=>win.appId==='study'&&!win.minimized&&win.form==='normal'&&!!document.querySelector(`[data-win="${CSS.escape(win.id)}"] .study-pdf-reader`));
}
function capture(rect:{x:number;y:number;w:number;h:number},sourceId:string){
  const root=document.querySelector<HTMLElement>(`[data-win="${CSS.escape(sourceId)}"]`);
  if(!root)return null;
  const canvases=[...root.querySelectorAll<HTMLCanvasElement>('.study-pdf-page canvas')].filter(canvas=>canvas.width&&canvas.height&&canvas.style.visibility!=='hidden');
  const output=document.createElement('canvas');output.width=Math.round(rect.w*devicePixelRatio);output.height=Math.round(rect.h*devicePixelRatio);
  const context=output.getContext('2d');if(!context)return null;
  context.scale(devicePixelRatio,devicePixelRatio);
  context.fillStyle='#fff';context.fillRect(0,0,rect.w,rect.h);
  let covered=false;
  for(const canvas of canvases){
    const box=canvas.getBoundingClientRect(),x=Math.max(rect.x,box.left),y=Math.max(rect.y,box.top),right=Math.min(rect.x+rect.w,box.right),bottom=Math.min(rect.y+rect.h,box.bottom);
    if(right<=x||bottom<=y)continue;
    const scaleX=canvas.width/box.width,scaleY=canvas.height/box.height;
    context.drawImage(canvas,(x-box.left)*scaleX,(y-box.top)*scaleY,(right-x)*scaleX,(bottom-y)*scaleY,x-rect.x,y-rect.y,right-x,bottom-y);
    covered=true;
  }
  return covered?output:null;
}
export function ScreenshotCapture(){
  const [start,setStart]=useState<Point|null>(null),[end,setEnd]=useState<Point|null>(null),[sourceId,setSourceId]=useState<string|null>(null);
  useEffect(()=>{
    const activate=()=>{
      if(ui.get().studyMode!=='screenshot')return;
      const source=sourceWindow();
      if(!source){toast('请先打开论文窗口');return;}
      kernel.focus(source.id);setSourceId(source.id);setStart(null);setEnd(null);
    };
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setSourceId(null);return;}
      if(event.metaKey&&event.shiftKey&&event.key.toLowerCase()==='s'&&ui.get().studyMode==='screenshot'){
        event.preventDefault();activate();
      }
    };
    window.addEventListener('study:screenshot:start',activate);
    window.addEventListener('keydown',key,true);
    return()=>{window.removeEventListener('study:screenshot:start',activate);window.removeEventListener('keydown',key,true);};
  },[]);
  useEffect(()=>{if(ui.get().studyMode!=='screenshot')setSourceId(null);},[sourceId]);
  if(!sourceId)return null;
  const area=start&&end?{x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(start.x-end.x),h:Math.abs(start.y-end.y)}:null;
  const finish=(point:Point)=>{
    if(!start)return;
    const selection={x:Math.min(start.x,point.x),y:Math.min(start.y,point.y),w:Math.abs(start.x-point.x),h:Math.abs(start.y-point.y)};
    setSourceId(null);setStart(null);setEnd(null);
    if(selection.w<24||selection.h<24)return;
    const bitmap=capture(selection,sourceId);
    if(!bitmap){toast('请在已显示的论文页面内框选截图');return;}
    bitmap.toBlob(blob=>{
      if(!blob||ui.get().studyMode!=='screenshot')return;
      const source=kernel.get(sourceId);if(!source)return;
      const url=URL.createObjectURL(blob);urls.add(url);
      const bounds=workArea(),w=Math.min(390,Math.max(240,selection.w+32)),h=Math.min(430,Math.max(180,selection.h*w/selection.w+64));
      const right=source.rect.x+source.rect.w+18,left=source.rect.x-w-18;
      const x=right+w<=bounds.x+bounds.w?right:left>=bounds.x?left:clamp(right,bounds.x,bounds.x+bounds.w-w);
      const target={x,y:clamp(source.rect.y,bounds.y,bounds.y+bounds.h-h),w,h};
      const initial={x:clamp(selection.x,bounds.x,bounds.x+bounds.w-w),y:clamp(selection.y,bounds.y,bounds.y+bounds.h-h),w,h};
      const id=kernel.open({appId:'study',title:'论文截图',rect:initial,role:'reference',props:{resource:'capture',taskId:source.props.taskId,imageUrl:url},openedFrom:sourceId});
      const motion=beginWindowMotion([id],'move',{x:selection.x+selection.w/2,y:selection.y+selection.h/2});
      motion.update(id,target);window.setTimeout(()=>motion.finish(),550);
    },'image/png');
  };
  return <div className="study-screenshot-overlay" onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);setStart({x:event.clientX,y:event.clientY});setEnd({x:event.clientX,y:event.clientY});}} onPointerMove={event=>{if(start)setEnd({x:event.clientX,y:event.clientY});}} onPointerUp={event=>finish({x:event.clientX,y:event.clientY})}>
    <div className="study-screenshot-hint">在论文页面拖动框选 · Esc 取消</div>
    {area&&<div className="study-screenshot-selection" style={{left:area.x,top:area.y,width:area.w,height:area.h}}/>}
  </div>;
}
