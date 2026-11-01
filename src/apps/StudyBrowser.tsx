import { useEffect, useRef, useState, type FormEvent } from 'react';
import {kernel} from '../system/kernel';

const root=`${import.meta.env.BASE_URL}study/external/`;
const pages=[
  {
    id:'bilibili',
    site:'bilibili.com',
    title:'AutoUE: Automated 3D Game Generation in Unreal Engine via Multi-Agent Systems · Bilibili',
    url:root+encodeURIComponent('AutoUE_ Automated 3D Game Generation in Unreal Engine via Multi-Agent Systems_哔哩哔哩_bilibili.html'),
    keywords:'autoue bilibili 哔哩哔哩 演示视频 演示 视频 automated game generation',
  },
  {
    id:'github',
    site:'github.com/Pluto156/AutoUE',
    title:'Pluto156/AutoUE · GitHub',
    url:root+'Pluto156_AutoUE.html',
    keywords:'autoue github pluto156 项目 仓库 代码',
  },
] as const;
type SavedBrowser={draft:string;query:string;selectedId:string|null;scroll:number};
const browserState=new Map<string,SavedBrowser>();
kernel.onEvent(event=>{if(event.type==='reset')browserState.clear();});
export function copyStudyBrowserState(sourceId:string,copyId:string){
  const state=browserState.get(sourceId);
  if(state)browserState.set(copyId,{...state});
}

export default function StudyBrowser({windowId}:{windowId:string}){
  const [draft,setDraft]=useState(()=>browserState.get(windowId)?.draft??'');
  const [query,setQuery]=useState(()=>browserState.get(windowId)?.query??'');
  const [selected,setSelected]=useState<(typeof pages)[number]|null>(()=>pages.find(page=>page.id===browserState.get(windowId)?.selectedId)??null);
  const detach=useRef<(()=>void)|null>(null);
  useEffect(()=>{browserState.set(windowId,{draft,query,selectedId:selected?.id??null,scroll:browserState.get(windowId)?.scroll??0});},[windowId,draft,query,selected]);
  useEffect(()=>()=>detach.current?.(),[]);
  const onFrameLoad=(frame:HTMLIFrameElement)=>{
    detach.current?.();
    try{
      const view=frame.contentWindow;if(!view)return;
      const scroll=browserState.get(windowId)?.scroll??0;
      requestAnimationFrame(()=>view.scrollTo(0,scroll));
      const remember=()=>{const state=browserState.get(windowId);if(state)browserState.set(windowId,{...state,scroll:view.scrollY});};
      view.addEventListener('scroll',remember,{passive:true});
      detach.current=()=>view.removeEventListener('scroll',remember);
    }catch{/* A browser may block scroll access to an external page. */}
  };
  const search=(event:FormEvent)=>{
    event.preventDefault();
    detach.current?.();
    setQuery(draft.trim());
    setSelected(null);
    browserState.set(windowId,{draft,query:draft.trim(),selectedId:null,scroll:0});
  };
  const tokens=query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const results=tokens.length?pages.filter(page=>{
    const haystack=`${page.title} ${page.site} ${page.keywords}`.toLocaleLowerCase();
    return tokens.every(token=>haystack.includes(token));
  }):[];
  return <div className="study-browser">
    <form className="study-browser-bar" onSubmit={search}>
      <input aria-label="搜索网页" value={draft} onChange={event=>setDraft(event.target.value)} placeholder="搜索网页或输入地址"/>
      <button type="submit">搜索</button>
    </form>
    {selected?<>
      <div className="study-browser-page-label">{selected.site} · 离线网页存档{selected.id==='bilibili'?' · 视频不可播放':''}</div>
      <iframe key={selected.id} src={selected.url} title={selected.title} sandbox="allow-same-origin" referrerPolicy="no-referrer" onLoad={event=>onFrameLoad(event.currentTarget)}/>
    </>:<div className="study-browser-results">
      {!query?<div className="study-browser-empty"><span aria-hidden="true">◌</span><h2>浏览器</h2><p>输入网页名称或地址以查找材料。</p></div>:
        results.length?results.map(page=><button type="button" key={page.id} onClick={()=>setSelected(page)}><small>{page.site}</small><strong>{page.title}</strong><span>本地保存的网页内容</span></button>):<p className="study-browser-no-results">没有找到与“{query}”匹配的本地网页。</p>}
    </div>}
  </div>;
}
