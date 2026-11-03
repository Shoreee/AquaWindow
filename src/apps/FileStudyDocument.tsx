import {useLayoutEffect,useRef,useState} from 'react';
import type {WindowState} from '../kernel/types';
import {useStore} from '../system/createStore';
import {studyDocument} from './data/studies';
import type {StudyDocument} from './data/task1';
import {fileTaskStore,promoteFileDocument,submitFileDocument} from '../study/workspaces';
import StudyPdf from './StudyPdf';

function OriginalTaskThreeDocument({doc}:{doc:StudyDocument}){
 const study=useStore(fileTaskStore,state=>state);
 const compact=study.running&&study.mode==='primary-secondary'&&doc.id!==study.mainDocumentId;
 const [zoom,setZoom]=useState(1);
 const surface=useRef<HTMLDivElement>(null),scrollPosition=useRef(0);
 useLayoutEffect(()=>{
  const page=surface.current?.querySelector<HTMLElement>('.task1-paper');
  if(page)page.scrollTop=compact?0:scrollPosition.current;
 },[compact]);
 return <div ref={surface} className={`pv task1-native-document file-study-task3${compact?' task1-native-compact':''}`}
  onScrollCapture={event=>{if(!compact)scrollPosition.current=(event.target as HTMLElement).scrollTop;}}>
  <div className="task1-native-page" aria-hidden={compact||undefined} inert={compact||undefined}>
   <article className="pv-page task1-paper">
    <div className="study-image-tools">
     <button className="chip" disabled={zoom<=1} onClick={()=>setZoom(value=>Math.max(1,value-.5))}>缩小</button>
     <button className="chip" onClick={()=>setZoom(1)}>适应宽度</button>
     <button className="chip" disabled={zoom>=3} onClick={()=>setZoom(value=>Math.min(3,value+.5))}>放大</button>
     <span>{Math.round(zoom*100)}%</span>
    </div>
    <div className="study-image-viewport"><img className="study-document-image" style={{width:`${zoom*100}%`}} src={import.meta.env.BASE_URL+doc.imageUrl} alt={doc.title} draggable={false}/></div>
    <div className="task1-paper-actions"><a href={import.meta.env.BASE_URL+doc.imageUrl} download={doc.file}>下载原图</a><button className="chip" disabled={!study.running||study.submitted||!doc.id.startsWith(study.current)} onClick={()=>submitFileDocument(doc.id)}>选择此文件并提交</button></div>
   </article>
  </div>
  {compact&&<button data-agent-result className="task1-native-promote" aria-label={`放大阅读 ${doc.file}`} onClick={event=>promoteFileDocument(doc.id,{x:event.clientX,y:event.clientY})}><span className="chip">点击放大 ↗</span></button>}
 </div>;
}

export default function FileStudyDocument({win}:{win:WindowState}){
 const doc=studyDocument(String(win.props.studyDocumentId));
 const study=useStore(fileTaskStore,s=>s);
 const [zoom,setZoom]=useState(1),[fit,setFit]=useState(true);
 if(!doc)return <div className="study-pdf-loading">文件不存在</div>;
 if(doc.id.startsWith('task3-'))return <OriginalTaskThreeDocument doc={doc}/>;
 if(study.running&&study.mode==='primary-secondary'&&doc.id!==study.mainDocumentId)return <button className="file-study-compact" type="button" onClick={()=>promoteFileDocument(doc.id)}><strong>{doc.file}</strong>{doc.imageUrl?<img src={import.meta.env.BASE_URL+doc.imageUrl} alt=""/>:<div className="file-study-compact-text"><h2>{doc.title}</h2><p>{doc.abstract.slice(0,160)}…</p></div>}<span>点击切换为主文件</span></button>;
 return <div className="file-study-document">
  {doc.imageUrl?<><div className="file-study-tools"><button onClick={()=>{setFit(true);setZoom(1)}}>整张显示</button><button onClick={()=>{setFit(false);setZoom(1)}}>适应宽度</button><button disabled={zoom<=1&&fit} onClick={()=>{setFit(false);setZoom(v=>Math.max(1,v-.5))}}>缩小</button><button onClick={()=>{setFit(false);setZoom(v=>Math.min(3,v+.5))}}>放大</button><span>{fit?'完整预览':`${Math.round(zoom*100)}%`}</span></div><div className={`file-study-image${fit?' fit':''}`}><img src={import.meta.env.BASE_URL+doc.imageUrl} alt={doc.file} style={{width:fit?'auto':`${zoom*100}%`}}/></div></>:<div className="file-study-pdf"><StudyPdf windowId={win.id} url={import.meta.env.BASE_URL+doc.pdfUrl} title={doc.file} focused={true}/></div>}
  <div className="file-study-submit"><span>{doc.file}</span><button disabled={!study.running||study.submitted||!studyDocument(String(win.props.studyDocumentId))||!doc.id.startsWith(study.current)} onClick={()=>submitFileDocument(doc.id)}>选择此文件并提交</button></div>
 </div>;
}
