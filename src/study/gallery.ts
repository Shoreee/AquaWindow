import {createStore} from '../system/createStore';
import {kernel,workArea} from '../system/kernel';
import type {Rect} from '../kernel/types';
import type {StudyTaskId} from './tasks';

export type GalleryCapture={id:string;url:string;title:string;taskId:StudyTaskId;sourceId:string;createdAt:number};
export const galleryStore=createStore<{items:GalleryCapture[]}>({items:[]});
kernel.onEvent(event=>{
  if(event.type!=='reset')return;
  for(const item of galleryStore.get().items)URL.revokeObjectURL(item.url);
  galleryStore.set({items:[]});
});
export function saveGalleryCapture(blob:Blob,taskId:StudyTaskId,sourceId:string){
  const items=galleryStore.get().items;
  const item:GalleryCapture={id:crypto.randomUUID(),url:URL.createObjectURL(blob),title:`论文截图 ${items.length+1}`,taskId,sourceId,createdAt:Date.now()};
  galleryStore.set({items:[...items,item]});
  return item;
}
export function openGalleryCapture(id:string,rect?:Rect){
  const item=galleryStore.get().items.find(entry=>entry.id===id);if(!item)return null;
  const existing=kernel.list().find(win=>win.appId==='study'&&win.props.resource==='capture'&&win.props.captureId===id);
  if(existing){kernel.focus(existing.id);return existing.id;}
  const area=workArea(),w=Math.min(420,area.w),h=Math.min(440,area.h);
  return kernel.open({appId:'study',title:item.title,role:'reference',rect:rect??{x:area.x+(area.w-w)/2,y:area.y+(area.h-h)/2,w,h},props:{resource:'capture',taskId:item.taskId,captureId:id,imageUrl:item.url},openedFrom:item.sourceId});
}
