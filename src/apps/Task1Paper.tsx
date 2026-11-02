import type { StudyDocument } from './data/task1';
import { submitTask1Answer, task1Study } from '../study/task1';
import { useStore } from '../system/createStore';
import {useState} from 'react';
import {studyTask} from './data/studies';

export function Task1DocumentText({doc}:{doc:StudyDocument}){
  return <>
    <div className="pv-head"><h1>{doc.title}</h1></div>
    {doc.paragraphs.map((text,i)=> /^(\d+[ .]|摘要$|参考文献$)/.test(text)
      ? <h2 key={i}>{text}</h2> : <p key={i}>{text}</p>)}
  </>;
}

export default function Task1Paper({doc,fitImage=false}:{doc:StudyDocument;fitImage?:boolean}){
  const study=useStore(task1Study,s=>s);
  const [zoom,setZoom]=useState(1);
  const [fitPage,setFitPage]=useState(fitImage);
  const sameTask=studyTask(study.taskId).documents.some(d=>d.id===doc.id);
  return <article className={`pv-page task1-paper ${fitImage?'study-fit-image':''}`}>
    {doc.imageUrl?<>
      <div className="study-image-tools">
        {fitImage&&<button className={`chip ${fitPage?'on':''}`} onClick={()=>setFitPage(true)}>整张显示</button>}
        <button className="chip" disabled={fitPage||zoom<=1} onClick={()=>setZoom(v=>Math.max(1,v-.5))}>缩小</button>
        <button className="chip" onClick={()=>{setFitPage(false);setZoom(1);}}>适应宽度</button><button className="chip" disabled={!fitPage&&zoom>=3} onClick={()=>{setFitPage(false);setZoom(v=>fitPage?1.5:Math.min(3,v+.5));}}>放大</button><span>{fitPage?'完整预览':`${Math.round(zoom*100)}%`}</span>
      </div>
      <div className={`study-image-viewport ${fitPage?'study-image-fit-page':''}`}>
        <img className="study-document-image" style={{width:fitPage?'100%':`${zoom*100}%`}} src={import.meta.env.BASE_URL+doc.imageUrl} alt={doc.title} draggable={false}/>
      </div>
    </>:<Task1DocumentText doc={doc}/>}
    <div className="task1-paper-actions"><a href={import.meta.env.BASE_URL+(doc.imageUrl??doc.pdfUrl)} download={doc.file}>{doc.imageUrl?'下载原图':'下载 PDF'}</a>
      <button className="chip" disabled={!sameTask||!study.running||study.submitted||!study.appliedModes.length} onClick={()=>submitTask1Answer(doc.id)}>选择此文件并提交</button>
    </div>
  </article>;
}
