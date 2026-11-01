import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { StudyResource } from '../study/tasks';

GlobalWorkerOptions.workerSrc=workerUrl;
const sharedPdfs=new Map<string,Promise<PDFDocumentProxy>>();
const loadPdf=(url:string)=>{
  let promise=sharedPdfs.get(url);
  if(!promise){
    promise=getDocument({url}).promise;
    sharedPdfs.set(url,promise);
    promise.catch(()=>{if(sharedPdfs.get(url)===promise)sharedPdfs.delete(url);});
  }
  return promise;
};

export default function StudyPdf({url,title,focused,related=[],relatedLabel='相关材料',onOpenRelated,onReturnToSource}:{url:string;title:string;focused:boolean;related?:StudyResource[];relatedLabel?:string;onOpenRelated?:(id:string)=>void;onReturnToSource?:()=>void}){
  const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const savedScroll=useRef(0),restoringScroll=useRef(false);
  const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null);
  const [page,setPage]=useState(1),[zoom,setZoom]=useState(1),[width,setWidth]=useState(0),[error,setError]=useState(''),[rendered,setRendered]=useState(false);
  const [relatedOpen,setRelatedOpen]=useState(false);
  useLayoutEffect(()=>{
    restoringScroll.current=true;
    if(host.current)host.current.scrollTop=savedScroll.current;
    const frame=requestAnimationFrame(()=>{
      if(host.current)host.current.scrollTop=savedScroll.current;
      restoringScroll.current=false;
    });
    return ()=>cancelAnimationFrame(frame);
  },[focused]);
  useEffect(()=>{
    let mounted=true;
    const promise=loadPdf(url);
    promise.then(doc=>{if(mounted)setPdf(doc);}).catch(reason=>{if(mounted)setError(String(reason));});
    return ()=>{mounted=false;};
  },[url]);
  useEffect(()=>{
    const element=host.current;if(!element)return;
    const observer=new ResizeObserver(()=>setWidth(element.clientWidth));
    observer.observe(element);setWidth(element.clientWidth);
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!pdf||!canvas.current||!width)return;
    setRendered(false);
    let cancelled=false;
    let renderTask:ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>|null=null;
    void pdf.getPage(page).then(p=>{
      if(cancelled)return;
      const base=p.getViewport({scale:1});
      const scale=Math.max(.25,(width-28)/base.width)*zoom;
      const viewport=p.getViewport({scale});
      const element=canvas.current!,context=element.getContext('2d');
      if(!context)return;
      const dpr=Math.min(window.devicePixelRatio||1,2);
      element.width=Math.round(viewport.width*dpr);
      element.height=Math.round(viewport.height*dpr);
      element.style.width=viewport.width+'px';
      element.style.height=viewport.height+'px';
      renderTask=p.render({canvas:element,canvasContext:context,viewport,transform:[dpr,0,0,dpr,0,0]});
      void renderTask.promise.then(()=>{if(!cancelled)setRendered(true);}).catch(reason=>{if(!cancelled&&reason?.name!=='RenderingCancelledException')setError(String(reason));});
    }).catch(reason=>{if(!cancelled)setError(String(reason));});
    return ()=>{cancelled=true;renderTask?.cancel();};
  },[pdf,page,zoom,width]);
  return <div className="study-pdf-reader">
    <div className="study-pdf-toolbar">
      <button onClick={()=>setPage(value=>Math.max(1,value-1))} disabled={page<=1} aria-label="上一页">‹</button>
      <label>第 <input aria-label="页码" type="number" min="1" max={pdf?.numPages??1} value={page} onChange={event=>setPage(Math.max(1,Math.min(pdf?.numPages??1,Number(event.target.value)||1)))}/> / {pdf?.numPages??'…'} 页</label>
      <button onClick={()=>setPage(value=>Math.min(pdf?.numPages??value,value+1))} disabled={!pdf||page>=pdf.numPages} aria-label="下一页">›</button>
      {onReturnToSource&&<button type="button" className="study-pdf-return" onClick={onReturnToSource}>返回 AutoUE</button>}
      <span className="study-pdf-spacer"/>
      <button onClick={()=>setZoom(value=>Math.max(.5,value-.2))} aria-label="缩小">−</button>
      <span>{Math.round(zoom*100)}%</span>
      <button onClick={()=>setZoom(value=>Math.min(2.5,value+.2))} aria-label="放大">+</button>
      {related.length>0&&<div className="study-pdf-related">
        <button type="button" aria-expanded={relatedOpen} onClick={()=>setRelatedOpen(value=>!value)}>{relatedLabel} ▾</button>
        {relatedOpen&&<div className="study-pdf-related-menu">{related.map(item=><button key={item.id} type="button" onClick={()=>{setRelatedOpen(false);onOpenRelated?.(item.id);}}>{item.title}</button>)}</div>}
      </div>}
    </div>
    <div className="study-pdf-scroll" ref={host} onScroll={event=>{if(!restoringScroll.current)savedScroll.current=event.currentTarget.scrollTop;}}>
      {!error&&!rendered&&<p className="study-pdf-loading">正在打开 {title} · 首次加载可能需要片刻</p>}
      {error?<p role="alert">PDF 加载失败：{error}</p>:<canvas ref={canvas} style={{visibility:rendered?'visible':'hidden'}}/>}
    </div>
  </div>;
}
