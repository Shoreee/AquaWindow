import {syncFusedPdfScroll} from '../study/syncScroll';
import {observeApp} from '../agent/adaptive/observations';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {kernel} from '../system/kernel';
import {useStore} from '../system/createStore';
import {ui} from '../system/ui';

GlobalWorkerOptions.workerSrc=workerUrl;
const sharedPdfs=new Map<string,Promise<PDFDocumentProxy>>();
const readingState=new Map<string,{zoom:number;scroll:number}>();
// Page 3: include the figure caption (baseline 412pt), stop before body text at 444pt.
const architectureFigureTop=70/792;
const architectureFigureBottom=420/792;
kernel.onEvent(event=>{if(event.type==='reset')readingState.clear();});
export function copyStudyPdfState(sourceId:string,copyId:string){
  const state=readingState.get(sourceId);if(state)readingState.set(copyId,{...state});
}
const loadPdf=(url:string)=>{
  let promise=sharedPdfs.get(url);
  if(!promise){promise=getDocument({url}).promise;sharedPdfs.set(url,promise);promise.catch(()=>{if(sharedPdfs.get(url)===promise)sharedPdfs.delete(url);});}
  return promise;
};

function PdfPage({pdf,number,width,zoom,ratio,scrollRoot}:{pdf:PDFDocumentProxy;number:number;width:number;zoom:number;ratio:number;scrollRoot:{current:HTMLDivElement|null}}){
  const holder=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const [visible,setVisible]=useState(false),[rendered,setRendered]=useState(false);
  useEffect(()=>{
    const element=holder.current,root=scrollRoot.current;if(!element||!root)return;
    const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)setVisible(true);},{root,rootMargin:'900px 0px'});
    observer.observe(element);return()=>observer.disconnect();
  },[scrollRoot]);
  useEffect(()=>{
    if(!visible||!width||!canvas.current)return;
    let cancelled=false;
    let task:ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>|null=null;
    setRendered(false);
    void pdf.getPage(number).then(page=>{
      if(cancelled||!canvas.current)return;
      const base=page.getViewport({scale:1}),scale=Math.max(.25,(width-28)/base.width)*zoom,viewport=page.getViewport({scale});
      const element=canvas.current,context=element.getContext('2d');if(!context)return;
      const dpr=Math.min(window.devicePixelRatio||1,2);
      element.width=Math.round(viewport.width*dpr);element.height=Math.round(viewport.height*dpr);
      element.style.width=viewport.width+'px';element.style.height=viewport.height+'px';
      task=page.render({canvas:element,canvasContext:context,viewport,transform:[dpr,0,0,dpr,0,0]});
      void task.promise.then(()=>{if(!cancelled)setRendered(true);}).catch(()=>{});
    }).catch(()=>{});
    return()=>{cancelled=true;task?.cancel();};
  },[pdf,number,width,zoom,visible]);
  return <div className="study-pdf-page" data-page={number} ref={holder} style={{minHeight:Math.round((width-28)*ratio*zoom)+28}}>
    <canvas ref={canvas} style={{visibility:rendered?'visible':'hidden'}}/>
    <small>第 {number} 页</small>
  </div>;
}

function PinnedPdfFigure({pdf,width,zoom,ratio,offset}:{pdf:PDFDocumentProxy;width:number;zoom:number;ratio:number;offset:number|null}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    let cancelled=false;
    let task:ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>|undefined;
    void pdf.getPage(3).then(page=>{
      if(cancelled||!canvas.current)return;
      const element=canvas.current,context=element.getContext('2d');if(!context)return;
      const base=page.getViewport({scale:1});
      const viewport=page.getViewport({scale:Math.max(.25,(width-28)/base.width)*zoom});
      const dpr=Math.min(window.devicePixelRatio||1,2);
      element.width=Math.round(viewport.width*dpr);element.height=Math.round(viewport.height*dpr);
      element.style.width=viewport.width+'px';element.style.height=viewport.height+'px';
      task=page.render({canvas:element,canvasContext:context,viewport,transform:[dpr,0,0,dpr,0,0]});
      void task.promise.catch(()=>{});
    });
    return()=>{cancelled=true;task?.cancel();};
  },[pdf,width,zoom]);
  return <div className="study-pdf-pin-anchor" style={{visibility:offset===null?'hidden':'visible'}} aria-hidden="true">
    <div className="study-pdf-pinned-figure" style={{width:(width-28)*zoom,height:(width-28)*ratio*zoom*(architectureFigureBottom-architectureFigureTop),transform:`translateY(${offset??0}px)`}}>
      <canvas ref={canvas} style={{transform:`translateY(${-((width-28)*ratio*zoom*architectureFigureTop)}px)`}}/>
    </div>
  </div>;
}

export default function StudyPdf({windowId,url,title,focused}:{windowId:string;url:string;title:string;focused:boolean}){
  const host=useRef<HTMLDivElement>(null),savedScroll=useRef(readingState.get(windowId)?.scroll??0),restoringScroll=useRef(false);
  const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[ratio,setRatio]=useState(0),[width,setWidth]=useState(0);
  const [zoom,setZoom]=useState(()=>readingState.get(windowId)?.zoom??1),[currentPage,setCurrentPage]=useState(1),[error,setError]=useState('');
  const [pinnedFigure,setPinnedFigure]=useState<number|null>(null);
  const figurePinEnabled=useStore(ui,state=>state.studyEnvironment==='paper'&&(!state.experimentOpen||state.studyMode==='figure-pin'));
  const supportsFigurePin=figurePinEnabled&&url.endsWith('/attention-zh/Attention-Is-All-You-Need-zh.pdf');
  useEffect(()=>{readingState.set(windowId,{zoom,scroll:savedScroll.current});},[windowId,zoom]);
  useEffect(()=>{
    let mounted=true;
    void loadPdf(url).then(async doc=>{
      const first=await doc.getPage(1),size=first.getViewport({scale:1});
      if(mounted){setRatio(size.height/size.width);setPdf(doc);}
    }).catch(reason=>{if(mounted)setError(String(reason));});
    return()=>{mounted=false;};
  },[url]);
  useEffect(()=>{
    const element=host.current;if(!element)return;
    const observer=new ResizeObserver(()=>setWidth(element.clientWidth));
    observer.observe(element);setWidth(element.clientWidth);
    return()=>observer.disconnect();
  },[]);
  useLayoutEffect(()=>{
    if(!pdf||!ratio||!width||!host.current)return;
    restoringScroll.current=true;host.current.scrollTop=savedScroll.current;
    const frame=requestAnimationFrame(()=>{if(host.current){host.current.scrollTop=savedScroll.current;onScroll(host.current);}restoringScroll.current=false;});
    return()=>cancelAnimationFrame(frame);
  },[pdf,ratio,width,zoom,focused,supportsFigurePin]);
  useEffect(()=>{
    observeApp(windowId,{kind:'pdf',availability:pdf?'content':'loading',title,documentId:url,page:currentPage,scroll:savedScroll.current,editable:false});
    if(!pdf)return;
    let current=true;
    void pdf.getPage(currentPage).then(page=>page.getTextContent()).then(content=>{
      if(current)observeApp(windowId,{kind:'pdf',availability:pdf?'content':'loading',title,documentId:url,page:currentPage,text:content.items.map(item=>'str' in item?item.str:'').join(' ').slice(0,3200)});
    }).catch(()=>{});
    return()=>{current=false;};
  },[pdf,currentPage,windowId,url,title]);
  const changeZoom=(next:number)=>{
    if(!host.current)return;
    savedScroll.current=host.current.scrollTop*next/zoom;setZoom(next);
  };
  const onScroll=(element:HTMLDivElement)=>{
    if(!restoringScroll.current)syncFusedPdfScroll(windowId,element);
    const pages=element.querySelectorAll<HTMLElement>('.study-pdf-page');let visible=1;
    const line=element.getBoundingClientRect().top+element.clientHeight*.35;
    for(const page of pages){if(page.getBoundingClientRect().top<=line)visible=Number(page.dataset.page);else break;}
    setCurrentPage(visible);
    observeApp(windowId,{kind:'pdf',availability:pdf?'content':'loading',title,documentId:url,page:visible,scroll:element.scrollTop,editable:false});
    if(supportsFigurePin){
      const figurePage=element.querySelector<HTMLElement>('.study-pdf-page[data-page="3"]');
      const sectionEndPage=element.querySelector<HTMLElement>('.study-pdf-page[data-page="6"]');
      if(figurePage&&sectionEndPage){
        // Section 4 starts 63.6% down page 6.
        const start=figurePage.offsetTop+(width-28)*ratio*zoom*architectureFigureTop;
        const end=sectionEndPage.offsetTop+(width-28)*ratio*zoom*.636;
        const figureHeight=(width-28)*ratio*zoom*(architectureFigureBottom-architectureFigureTop);
        setPinnedFigure(element.scrollTop>=start&&element.scrollTop<end?Math.min(0,end-element.scrollTop-figureHeight):null);
      }
    }
    if(!restoringScroll.current&&!kernel.get(windowId)?.props.agentQueue){
      savedScroll.current=element.scrollTop;readingState.set(windowId,{zoom,scroll:savedScroll.current});
    }
  };
  return <div className="study-pdf-reader">
    <div className="study-pdf-toolbar">
      <span aria-label="当前页">第 {currentPage} / {pdf?.numPages??'…'} 页</span>
      <span className="study-pdf-spacer"/>
      <button onClick={()=>changeZoom(Math.max(.5,Math.round((zoom-.2)*10)/10))} aria-label="缩小">−</button>
      <span>{Math.round(zoom*100)}%</span>
      <button onClick={()=>changeZoom(Math.min(2.5,Math.round((zoom+.2)*10)/10))} aria-label="放大">+</button>
    </div>
    <div className="study-pdf-scroll" ref={host} onScroll={event=>onScroll(event.currentTarget)}>
      {supportsFigurePin&&pdf&&width>0&&<PinnedPdfFigure pdf={pdf} width={width} zoom={zoom} ratio={ratio} offset={pinnedFigure}/>}
      {!error&&!pdf&&<p className="study-pdf-loading">正在打开 {title} · 首次加载可能需要片刻</p>}
      {error?<p role="alert">PDF 加载失败：{error}</p>:pdf&&ratio>0&&width>0&&Array.from({length:pdf.numPages},(_,index)=><PdfPage key={index+1} pdf={pdf} number={index+1} width={width} zoom={zoom} ratio={ratio} scrollRoot={host}/>)}
    </div>
  </div>;
}
