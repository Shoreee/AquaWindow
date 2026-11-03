import {useEffect} from 'react';
import type {WindowState} from '../kernel/types';
import {useStore} from '../system/createStore';
import {fileTaskStore,applyFileLayout,openFileTask} from '../study/workspaces';
import {studyTask} from './data/studies';

export default function FileStudyGuide({win:_win}:{win:WindowState}){
 const study=useStore(fileTaskStore,state=>state);
 const task=studyTask(study.current);
 useEffect(()=>{
  let frame=0;
  const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>applyFileLayout());};
  window.addEventListener('resize',resize);
  return ()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);};
 },[]);
 return <div className="file-study-guide">
  {study.submitted&&task.id==='task3'?<><h2>已提交</h2><p>本轮答案已记录。请根据研究人员的安排填写量表。</p><button className="chip" onClick={()=>openFileTask(task.id)}>返回实验设置</button></>:<>
  <p>{task.instruction}</p>
  <p>{study.mode==='primary-secondary'?'点击右侧文件，切换到主窗口查看。':'三份文件可分别查看。'}{task.id==='task2'&&study.mode==='primary-secondary'?'发票默认整张显示，可放大核对细节。':''}在你认定的文件中点击“选择此文件并提交”。</p>
  </>}
 </div>;
}
