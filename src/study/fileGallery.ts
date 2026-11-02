import {createStore} from '../system/createStore';
import {kernel,workArea} from '../system/kernel';
import type {Rect} from '../kernel/types';
import type {StudyTaskId} from '../apps/data/studies';

export type FileCapture={id:string;url:string;title:string;taskId:StudyTaskId;sourceId:string};
export const fileGalleryStore=createStore<{items:FileCapture[]}>({items:[]});
export function saveFileCapture(blob:Blob,taskId:StudyTaskId,sourceId:string){
 const items=fileGalleryStore.get().items,item:FileCapture={id:crypto.randomUUID(),url:URL.createObjectURL(blob),title:`文件截图 ${items.length+1}`,taskId,sourceId};
 fileGalleryStore.set({items:[...items,item]});return item;
}
export function openFileCapture(id:string,rect?:Rect){
 const item=fileGalleryStore.get().items.find(entry=>entry.id===id);if(!item)return null;
 const existing=kernel.list().find(win=>win.appId==='file-study-capture'&&win.props.captureId===id);
 if(existing){kernel.focus(existing.id);return existing.id;}
 const area=workArea(),w=Math.min(420,area.w),h=Math.min(440,area.h);
 return kernel.open({appId:'file-study-capture',title:item.title,role:'reference',rect:rect??{x:area.x+(area.w-w)/2,y:area.y+(area.h-h)/2,w,h},props:{captureId:id,imageUrl:item.url,fileTaskId:item.taskId},openedFrom:item.sourceId});
}
