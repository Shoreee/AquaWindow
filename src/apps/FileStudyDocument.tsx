import {useState} from 'react';
import type {WindowState} from '../kernel/types';
import {useStore} from '../system/createStore';
import {studyDocument} from './data/studies';
import {fileTaskStore,submitFileDocument} from '../study/workspaces';
import StudyPdf from './StudyPdf';

export default function FileStudyDocument({win}:{win:WindowState}){
 const doc=studyDocument(String(win.props.studyDocumentId));
 const study=useStore(fileTaskStore,s=>s);
 const [zoom,setZoom]=useState(1),[fit,setFit]=useState(true);
 if(!doc)return <div className="study-pdf-loading">文件不存在</div>;
 return <div className="file-study-document">
  {doc.imageUrl?<><div className="file-study-tools"><button onClick={()=>{setFit(true);setZoom(1)}}>整张显示</button><button onClick={()=>{setFit(false);setZoom(1)}}>适应宽度</button><button disabled={zoom<=1&&fit} onClick={()=>{setFit(false);setZoom(v=>Math.max(1,v-.5))}}>缩小</button><button onClick={()=>{setFit(false);setZoom(v=>Math.min(3,v+.5))}}>放大</button><span>{fit?'完整预览':`${Math.round(zoom*100)}%`}</span></div><div className={`file-study-image${fit?' fit':''}`}><img src={import.meta.env.BASE_URL+doc.imageUrl} alt={doc.file} style={{width:fit?'auto':`${zoom*100}%`}}/></div></>:<div className="file-study-pdf"><StudyPdf windowId={win.id} url={import.meta.env.BASE_URL+doc.pdfUrl} title={doc.file} focused={true}/></div>}
  <div className="file-study-submit"><span>{doc.file}</span><button disabled={!study.running||study.submitted||!studyDocument(String(win.props.studyDocumentId))||!doc.id.startsWith(study.current)} onClick={()=>submitFileDocument(doc.id)}>选择此文件并提交</button></div>
 </div>;
}
