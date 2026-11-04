import {useLayoutEffect,useRef,useState} from 'react';
import {log} from './logger';

const references=[
  {id:'2',text:'[2] Neural Machine Translation by Jointly Learning to Align and Translate'},
  {id:'11',text:'[11] Deep Residual Learning for Image Recognition'},
  {id:'1',text:'[1] Layer Normalization'},
] as const;
const claims=[
  {id:'11',text:'在编码器和解码器的子层周围使用残差连接'},
  {id:'1',text:'残差连接之后对每个子层的输出做归一化'},
  {id:'2',text:'与点积注意力比较的加性注意力及序列对齐'},
] as const;
type Point={x:number;y:number};

export function TaskFourMatching({onSubmitted}:{onSubmitted:(done:boolean)=>void}){
  const [pairs,setPairs]=useState<Record<string,string>>({});
  const [selected,setSelected]=useState<string|null>(null);
  const [submitted,setSubmitted]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [points,setPoints]=useState<{left:Record<string,Point>;right:Record<string,Point>}>({left:{},right:{}});
  const board=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const root=board.current;if(!root)return;
    const measure=()=>{
      const rect=root.getBoundingClientRect();
      const left:Record<string,Point>={},right:Record<string,Point>={};
      root.querySelectorAll<HTMLElement>('[data-side][data-id]').forEach(element=>{
        const r=element.getBoundingClientRect(),id=element.dataset.id!,side=element.dataset.side!;
        (side==='left'?left:right)[id]={x:(side==='left'?r.right:r.left)-rect.left,y:r.top+r.height/2-rect.top};
      });
      setPoints({left,right});
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(root);return()=>observer.disconnect();
  },[]);
  const connect=(right:string)=>{
    if(!selected||submitted)return;
    setPairs(current=>({...Object.fromEntries(Object.entries(current).filter(([left,value])=>left===selected||value!==right)),[selected]:right}));
    setSelected(null);setFeedback('');onSubmitted(false);
  };
  const count=Object.keys(pairs).length;
  return <section className="study-matching" aria-label="引用与论点连线">
    <h3>引用与论点连线</h3>
    <p>点选左侧文献，再点选右侧论点。</p>
    <div className="study-matching-board" ref={board}>
      <svg aria-hidden="true"><title>连线</title>{Object.entries(pairs).map(([left,right])=>{const a=points.left[left],b=points.right[right];return a&&b?<line key={left} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>:null})}</svg>
      <div className="study-matching-column">{references.map(item=><button type="button" key={item.id} data-side="left" data-id={item.id} className={`${selected===item.id?'active ':''}${pairs[item.id]?'connected':''}`} aria-pressed={selected===item.id} disabled={submitted} onClick={()=>{setSelected(item.id);setFeedback('');}}>{item.text}</button>)}</div>
      <div className="study-matching-column">{claims.map(item=><button type="button" key={item.id} data-side="right" data-id={item.id} className={Object.values(pairs).includes(item.id)?'connected':''} disabled={submitted} onClick={()=>connect(item.id)}>{item.text}</button>)}</div>
    </div>
    <p className="study-quiz-progress">{count}/3 已连线</p>
    {feedback&&<p className="study-matching-feedback" role="status">{feedback}</p>}
    <div className="study-quiz-actions"><button type="button" disabled={count!==references.length||submitted} onClick={()=>{
      const score=references.filter(item=>pairs[item.id]===item.id).length;
      log({src:'study',type:'citation.match.submit',data:{score,total:references.length,pairs}});
      if(score===references.length){setSubmitted(true);setFeedback('全部对应正确');onSubmitted(true);}else setFeedback(`已匹配 ${score}/3 组，请重新连线。`);
    }}>提交连线</button><button type="button" onClick={()=>{setPairs({});setSelected(null);setSubmitted(false);setFeedback('');onSubmitted(false);}}>重做</button></div>
  </section>;
}
