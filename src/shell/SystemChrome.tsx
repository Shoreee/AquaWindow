import {memo,useEffect,useRef,useState} from 'react';
import {cancelSurfaceInteraction} from './surfaceFusion';
import {cancelCapsuleMotion} from '../agent/adaptive/capsule';
import {cancelManualWindowMotion} from '../agent/adaptive/manualMotion';
import {credentialState} from '../agent/adaptive/credentials';
import {adaptation,planBuffer,serviceStore,setDeepSeekEnabled,setDeepSeekApiKey} from '../agent/adaptive/runtime';
import {useStore} from '../system/createStore';
import {agent,kernel,ui,undo,useKernelState} from './hooks';
import {CONDITIONS} from '../techniques/techniques';
import {openExperiment,restoreStudyWorkspace,fileTaskStore,openFileTask} from '../study/workspaces';
import {studyTechniques,type StudyInteractionModeId} from '../study/interactionModes';
import {experimentFlow} from '../study/flow';
import {openStudyResource} from '../apps/StudyMaterials';
import {openApp} from './Chrome';
import {DesktopAppIcon} from './DesktopAppIcon';

function cancelGestures(){cancelSurfaceInteraction();cancelCapsuleMotion();cancelManualWindowMotion();adaptation.cancel(true);}
export function bootDesktop(studyMode:StudyInteractionModeId|null=ui.get().studyMode){
 cancelGestures();agent.stop();
 if(ui.get().experimentOpen)restoreStudyWorkspace({windows:{},order:[],focusedId:null,screen:kernel.getState().screen,rev:0});else kernel.closeAll();
 ui.set({scenarioId:null,strategyId:null,scenarioPanel:false,agentEnabled:false,autonomy:'off',studyMode,tech:ui.get().experimentOpen?studyTechniques(studyMode):{...CONDITIONS[3].techniques,yield:'none',cutout:true}});
 if(ui.get().studyEnvironment==='files')openFileTask(fileTaskStore.get().current);
}
function launchExperiment(){cancelGestures();if(!ui.get().experimentOpen)experimentFlow.set({view:'hub'});openExperiment();}
function useOutside(ref:{current:HTMLDivElement|null},close:()=>void){
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))close();};const key=(event:KeyboardEvent)=>{if(event.key==='Escape')close();};window.addEventListener('pointerdown',outside);window.addEventListener('keydown',key);return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',key);};},[ref,close]);
}
function AgentSettings(){
 const enabled=useStore(ui,s=>s.agentEnabled),remote=useStore(serviceStore,s=>s.remoteEnabled),hasKey=useStore(credentialState,s=>s.hasKey);
 const [draft,setDraft]=useState('');
 const toggle=()=>{
  if(enabled){ui.set({agentEnabled:false,autonomy:'off'});adaptation.cancel(true);setDeepSeekEnabled(false);planBuffer.entries.clear();agent.stop();agent.reset();}
  else{ui.set({agentEnabled:true,autonomy:'preview'});agent.start();}
 };
 return <section className="agent-settings"><header><span className={`system-mark ${enabled?'enabled':''}`}/>AquaWindow</header>
  <button role="switch" aria-label="Agent 功能" aria-checked={enabled} onClick={toggle}>Agent<span className={`deepseek-toggle ${enabled?'on':''}`}><i/></span></button>
  {enabled&&<><button role="switch" aria-label="接入 DeepSeek" aria-checked={remote} onClick={()=>setDeepSeekEnabled(!remote)}>DeepSeek 布局建议<span className={`deepseek-toggle ${remote?'on':''}`}><i/></span></button>
  <form className="deepseek-key-form" onSubmit={event=>{event.preventDefault();if(draft.trim()){setDeepSeekApiKey(draft);setDraft('');}}}><label htmlFor="deepseek-api-key">DeepSeek API Key</label><input id="deepseek-api-key" type="password" autoComplete="off" spellCheck={false} value={draft} onChange={event=>setDraft(event.target.value)} placeholder={hasKey?'已保存':'输入 Key'}/><div className="deepseek-key-actions"><button disabled={!draft.trim()}>保存</button>{hasKey&&<button type="button" onClick={()=>setDeepSeekApiKey('')}>清除</button>}</div><small>仅本次使用，刷新清除。</small></form></>}
 </section>;
}
function SystemTray(){
 const [open,setOpen]=useState(false),[now,setNow]=useState(new Date());const root=useRef<HTMLDivElement>(null);
 const focused=useKernelState(s=>s.focusedId);const undoable=useKernelState(()=>kernel.canUndo());
 useOutside(root,()=>setOpen(false));useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer);},[]);
 const action=(fn:()=>void)=>()=>{fn();setOpen(false);};
 return <div className="taskbar-tray" ref={root}>
  <button className="tray-trigger" aria-label="系统控制" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><img src={`${import.meta.env.BASE_URL}harmony/settings.svg`} alt=""/></button>
  <time className="taskbar-clock" dateTime={now.toISOString()}><span>{now.toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false})}</span><span>{now.toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})}</span></time>
  {open&&<div className="system-controls" role="dialog" aria-label="系统控制面板"><AgentSettings/><div className="settings-divider"/>
   <button onClick={action(()=>ui.set({missionControl:true}))}><img src={`${import.meta.env.BASE_URL}harmony/windows.svg`} alt=""/>所有窗口</button>
   <button disabled={!undoable} onClick={action(undo)}><img src={`${import.meta.env.BASE_URL}harmony/undo.svg`} alt=""/>撤销 <kbd>Ctrl Z</kbd></button>
   <button onClick={action(()=>window.dispatchEvent(new Event('study:screenshot:start')))}><img src={`${import.meta.env.BASE_URL}harmony/screenshot.svg`} alt=""/>截图 <kbd>Ctrl Shift S</kbd></button>
   <button disabled={!focused} onClick={action(()=>focused&&kernel.minimize(focused))}><img src={`${import.meta.env.BASE_URL}harmony/minimize.svg`} alt=""/>最小化</button>
   <button onClick={action(()=>bootDesktop())}><img src={`${import.meta.env.BASE_URL}harmony/reset.svg`} alt=""/>重置桌面</button>
  </div>}
 </div>;
}
function SystemDockImpl(){
 const environment=useStore(ui,s=>s.studyEnvironment),experimentOpen=useStore(ui,s=>s.experimentOpen);
 const [startOpen,setStartOpen]=useState(false);const root=useRef<HTMLDivElement>(null);useOutside(root,()=>setStartOpen(false));
 const apps=environment==='paper'?[{id:'finder',label:'文件',resource:'files'},{id:'browser',label:'浏览器',resource:'browser'},{id:'writer',label:'笔记',resource:'notes'},{id:'chat',label:'AI 问答',resource:'qa'},{id:'gallery',label:'图库',resource:'gallery'}]:[{id:'finder',label:'文件',resource:'finder'}];
 const running=useKernelState(s=>apps.reduce((bits,app,index)=>Object.values(s.windows).some(win=>environment==='paper'?win.appId==='study'&&win.props.resource===app.resource:win.appId===app.id)?bits|(1<<index):bits,0));
 const launch=(app:typeof apps[number])=>{setStartOpen(false);environment==='paper'?openStudyResource(app.resource,app.label):openApp(app.id);};
 return <div className="dock-wrap" ref={root}>
  {startOpen&&<div className="desktop-start-menu" role="dialog" aria-label="开始菜单">{apps.map(app=><button key={app.id} onClick={()=>launch(app)}><DesktopAppIcon id={app.id}/>{app.label}</button>)}<button onClick={()=>{setStartOpen(false);launchExperiment();}}><DesktopAppIcon id="experiment"/>实验</button></div>}
  <div className="dock system-dock"><button className="taskbar-start" aria-label="开始" aria-expanded={startOpen} onClick={()=>setStartOpen(value=>!value)}><i/><i/><i/><i/></button>
   {apps.map((app,index)=><button className="dock-i" key={app.id} aria-label={`打开${app.label}`} title={app.label} onClick={()=>launch(app)}><DesktopAppIcon id={app.id}/>{(running&(1<<index))!==0&&<span className="dock-dot"/>}</button>)}
   <button className="dock-i experiment-launcher" aria-label="打开实验" title="实验" onClick={launchExperiment}><DesktopAppIcon id="experiment"/>{experimentOpen&&<span className="dock-dot"/>}</button>
  </div><SystemTray/>
 </div>;
}
export const SystemDock=memo(SystemDockImpl);
