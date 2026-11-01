import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react';
import type { StudyAnswerExample } from '../study/tasks';
import {kernel} from '../system/kernel';

type Attachment = { name: string; url: string };
type Message = { role: 'user' | 'assistant'; text: string; attachments: Attachment[]; sentences?: string[] };
type SavedQa={messages:Message[];draft:string;pending:Attachment[]};
const qaState=new Map<string,SavedQa>(),objectUrls=new Map<string,Set<string>>();
kernel.onEvent(event=>{if(event.type==='reset'){for(const urls of objectUrls.values())for(const url of urls)URL.revokeObjectURL(url);objectUrls.clear();qaState.clear();}});

export default function StudyQa({windowId,example}:{windowId:string;example?:StudyAnswerExample}){
  const [messages,setMessages]=useState<Message[]>(()=>qaState.get(windowId)?.messages??(example?[
    {role:'user',text:example.question,attachments:[]},
    {role:'assistant',text:'',sentences:example.sentences,attachments:[]},
  ]:[]));
  const [draft,setDraft]=useState(()=>qaState.get(windowId)?.draft??'');
  const [pending,setPending]=useState<Attachment[]>(()=>qaState.get(windowId)?.pending??[]);
  const [dragging,setDragging]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{qaState.set(windowId,{messages,draft,pending});},[windowId,messages,draft,pending]);

  const attach=(files:FileList|File[])=>{
    const images=Array.from(files).filter(file=>file.type.startsWith('image/'));
    if(!images.length)return false;
    const next=images.map(file=>{
      const url=URL.createObjectURL(file);
      if(!objectUrls.has(windowId))objectUrls.set(windowId,new Set());
      objectUrls.get(windowId)!.add(url);
      return {name:file.name||'截图',url};
    });
    setPending(current=>[...current,...next]);
    return true;
  };
  const paste=(event:ClipboardEvent<HTMLDivElement>)=>{
    if(attach(event.clipboardData.files))event.preventDefault();
  };
  const drop=(event:DragEvent<HTMLDivElement>)=>{
    event.preventDefault();
    setDragging(false);
    attach(event.dataTransfer.files);
  };
  const send=(event:FormEvent)=>{
    event.preventDefault();
    if(!draft.trim()&&!pending.length)return;
    setMessages(current=>[...current,{role:'user',text:draft.trim(),attachments:pending}]);
    setDraft('');
    setPending([]);
  };

  return <div className={`study-qa${dragging?' dragging':''}`}
    onPaste={paste}
    onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();setDragging(true);}}}
    onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragging(false);}}
    onDrop={drop}>
    <div className="study-qa-messages">
      {messages.length===0&&<div className="study-qa-intro">
        <span className="study-qa-symbol" aria-hidden="true">✦</span>
        <h2>AI 问答</h2>
        <p>在论文中截图后，可以粘贴、拖入或选择图片。</p>
        <small>此窗口用于实验中的截图与提问操作，暂未接入自动回答。</small>
      </div>}
      {messages.map((message,index)=><div className={`study-qa-message ${message.role}`} key={index}>
        {message.role==='assistant'&&<small className="study-qa-message-label">实验示例回答 · 非实时生成</small>}
        {message.text&&<p>{message.text}</p>}
        {message.sentences?.map((sentence,sentenceIndex)=><p className="study-qa-sentence" key={sentence}><span>{sentenceIndex+1}</span>{sentence}</p>)}
        {message.attachments.map(image=><img key={image.url} src={image.url} alt={image.name}/>)}
      </div>)}
    </div>
    <form className="study-qa-composer" onSubmit={send}>
      {pending.length>0&&<div className="study-qa-pending">{pending.map(image=><button key={image.url} type="button" title={`移除 ${image.name}`} onClick={()=>setPending(current=>current.filter(item=>item.url!==image.url))}><img src={image.url} alt={image.name}/><span aria-hidden="true">×</span></button>)}</div>}
      <div className="study-qa-input-row">
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={event=>{if(event.target.files)attach(event.target.files);event.target.value='';}}/>
        <button type="button" className="study-qa-attach" aria-label="添加图片" title="添加图片" onClick={()=>input.current?.click()}>＋</button>
        <textarea aria-label="输入问题" placeholder="输入问题，或粘贴截图…" value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}/>
        <button className="study-qa-send" type="submit" disabled={!draft.trim()&&!pending.length}>发送</button>
      </div>
    </form>
    {dragging&&<div className="study-qa-drop-hint">将图片放入 AI 问答窗口</div>}
  </div>;
}
