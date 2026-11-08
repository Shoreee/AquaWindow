import {observeApp} from '../agent/adaptive/observations';
import {useEffect,useState} from 'react';
import {kernel} from '../system/kernel';
import {galleryDropImage} from '../study/gallery';
type Note={text:string;images:{url:string;name:string}[]};
const notes=new Map<string,Note>(),urls=new Set<string>();
kernel.onEvent(event=>{if(event.type==='reset'){notes.clear();for(const url of urls)URL.revokeObjectURL(url);urls.clear();}});
export function copyStudyNotesState(sourceId:string,copyId:string){const note=notes.get(sourceId);if(note)notes.set(copyId,{text:note.text,images:[...note.images]});}
export default function StudyNotes({windowId}:{windowId:string}){
  const [note,setNote]=useState<Note>(()=>notes.get(windowId)??{text:'',images:[]});
  useEffect(()=>{notes.set(windowId,note);observeApp(windowId,{title:'笔记',kind:'note',availability:'content',text:note.text,editable:true});},[windowId,note]);
  const attach=(data:DataTransfer)=>{
    const gallery=galleryDropImage(data);
    const images=gallery?[gallery]:Array.from(data.files).filter(file=>file.type.startsWith('image/')).map(file=>{const url=URL.createObjectURL(file);urls.add(url);return {url,name:file.name||'截图'};});
    if(!images.length)return false;
    setNote(current=>({...current,images:[...current.images,...images]}));return true;
  };
  return <div className="study-notes" onPaste={event=>{if(attach(event.clipboardData))event.preventDefault();}} onDragOver={event=>{if(event.dataTransfer.types.some(type=>type==='Files'||type==='application/x-aquawindow-capture'))event.preventDefault();}} onDrop={event=>{event.preventDefault();attach(event.dataTransfer);}}>
    <textarea aria-label="实验笔记" placeholder="在这里记录笔记，或粘贴、拖入截图…" value={note.text} onChange={event=>setNote(current=>({...current,text:event.target.value}))}/>
    {note.images.map((image,index)=><figure key={`${image.url}-${index}`}><img src={image.url} alt={image.name}/><button type="button" aria-label={`移除图片 ${index+1}`} onClick={()=>setNote(current=>({...current,images:current.images.filter((_,i)=>i!==index)}))}>移除图片</button></figure>)}
  </div>;
}
