import {observeApp} from '../agent/adaptive/observations';
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react';
import type { StudyAnswerExample } from '../study/tasks';
import {kernel} from '../system/kernel';
import {ui} from '../system/ui';
import {useStore} from '../system/createStore';
import {credentialState} from '../agent/adaptive/credentials';
import {askDeepSeek,type ChatMessage} from '../agent/adaptive/chat';

type Attachment = { name: string; url: string };
type Message = { role: 'user' | 'assistant'; text: string; attachments: Attachment[]; sentences?: string[] };
type SavedQa={messages:Message[];draft:string;pending:Attachment[]};
const qaState=new Map<string,SavedQa>(),objectUrls=new Map<string,Set<string>>();
kernel.onEvent(event=>{if(event.type==='reset'){for(const urls of objectUrls.values())for(const url of urls)URL.revokeObjectURL(url);objectUrls.clear();qaState.clear();}});
export function copyStudyQaState(sourceId:string,copyId:string){
  const state=qaState.get(sourceId);
  if(state)qaState.set(copyId,{messages:state.messages.map(message=>({...message,attachments:[...message.attachments],sentences:message.sentences?[...message.sentences]:undefined})),draft:state.draft,pending:[...state.pending]});
}

export default function StudyQa({windowId,example}:{windowId:string;example?:StudyAnswerExample}){
  const [messages,setMessages]=useState<Message[]>(()=>qaState.get(windowId)?.messages??(example?[
    {role:'user',text:example.question,attachments:[]},
    {role:'assistant',text:'',sentences:example.sentences,attachments:[]},
  ]:[]));
  const [draft,setDraft]=useState(()=>qaState.get(windowId)?.draft??'');
  const [pending,setPending]=useState<Attachment[]>(()=>qaState.get(windowId)?.pending??[]);
  const [dragging,setDragging]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const enabled=useStore(ui,s=>s.agentEnabled),credentialRevision=useStore(credentialState,s=>s.revision);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  useEffect(()=>{if(!enabled){request.current?.abort();setBusy(false);}},[enabled]);
  useEffect(()=>{request.current?.abort();setBusy(false);},[credentialRevision]);
  useEffect(()=>()=>request.current?.abort(),[]);

  useEffect(()=>{qaState.set(windowId,{messages,draft,pending});},[windowId,messages,draft,pending]);

  useEffect(()=>observeApp(windowId,{title:'AI 问答',kind:'chat',availability:messages.length?'content':'empty',text:messages.length?messages.slice(-4).map(m=>`${m.role}: ${m.text||m.sentences?.join(' ')||''}`).join('\n').slice(0,2400):'尚未开始对话。'}),[windowId,messages]);
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
  const send=async(event:FormEvent)=>{
    event.preventDefault();
    if(!enabled){setError('Agent 权限未开启，请在右下角设置中开启。');return;}
    if(busy||(!draft.trim()&&!pending.length))return;
    const outgoing:Message={role:'user',text:draft.trim(),attachments:[...pending]};
    const next=[...messages,outgoing];
    const controller=new AbortController();request.current=controller;setBusy(true);setError('');
    try{
      const wire:ChatMessage[]=await Promise.all(next.slice(-20).map(async message=>({role:message.role,content:message.attachments.length?[
        {type:'text' as const,text:message.text||'请分析这张图片。'},
        ...await Promise.all(message.attachments.map(async attachment=>{
          const blob=await (await fetch(attachment.url,{signal:controller.signal})).blob();
          if(blob.size>4_000_000)throw new Error('图片过大，请缩小后重试。');
          const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(blob);});
          return {type:'image_url' as const,image_url:{url}};
        })),
      ]:message.sentences?.join('\n')||message.text})));
      setMessages(next);setDraft('');setPending([]);
      const text=await askDeepSeek(wire,controller.signal);
      if(!controller.signal.aborted&&ui.get().agentEnabled)setMessages([...next,{role:'assistant',text,attachments:[]}]);
    }catch(err){if(!controller.signal.aborted){setError(err instanceof Error?(err.name==='TimeoutError'?'请求超时，请重试。':err.name==='TypeError'?'无法连接 DeepSeek，请检查网络。':err.message):'连接失败，请重试。');setMessages(messages);setDraft(outgoing.text);setPending(outgoing.attachments);}}
    finally{if(request.current===controller){request.current=null;setBusy(false);}}
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
        <p>向 DeepSeek 提问，或附上截图。</p>

      </div>}
      {messages.map((message,index)=><div className={`study-qa-message ${message.role}`} key={index}>
        {message.role==='assistant'&&message.sentences&&<small className="study-qa-message-label">实验示例回答 · 非实时生成</small>}
        {message.text&&<p>{message.text}</p>}
        {message.sentences?.map((sentence,sentenceIndex)=><p className="study-qa-sentence" key={sentence}><span>{sentenceIndex+1}</span>{sentence}</p>)}
        {message.attachments.map(image=><img key={image.url} src={image.url} alt={image.name}/>)}
      </div>)}
    </div>
    {busy&&<p className="qa-status" role="status">正在回答…</p>}
    {(!enabled||error)&&<p className="qa-error" role="alert">{!enabled?'Agent 权限未开启，请在右下角设置中开启。':error}</p>}
    <form className="study-qa-composer" onSubmit={send}>
      {pending.length>0&&<div className="study-qa-pending">{pending.map(image=><button key={image.url} type="button" title={`移除 ${image.name}`} onClick={()=>setPending(current=>current.filter(item=>item.url!==image.url))}><img src={image.url} alt={image.name}/><span aria-hidden="true">×</span></button>)}</div>}
      <div className="study-qa-input-row">
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={event=>{if(event.target.files)attach(event.target.files);event.target.value='';}}/>
        <button type="button" className="study-qa-attach" aria-label="添加图片" title="添加图片" onClick={()=>input.current?.click()}>＋</button>
        <textarea aria-label="输入问题" placeholder="输入问题，或粘贴截图…" value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}/>
        <button className="study-qa-send" type="submit" disabled={busy||(!draft.trim()&&!pending.length)}>{busy?'回答中':'发送'}</button>
      </div>
    </form>
    {dragging&&<div className="study-qa-drop-hint">将图片放入 AI 问答窗口</div>}
  </div>;
}
