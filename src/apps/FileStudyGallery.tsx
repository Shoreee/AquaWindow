import type {WindowState} from '../kernel/types';
import {useStore} from '../system/createStore';
import {fileGalleryStore,openFileCapture} from '../study/fileGallery';
import {fileTaskStore} from '../study/workspaces';

export function FileStudyCapture({win}:{win:WindowState}){return <div className="study-captured-image"><img src={String(win.props.imageUrl??'')} alt="文件截图"/></div>}
export default function FileStudyGallery(){
 const items=useStore(fileGalleryStore,s=>s.items),taskId=useStore(fileTaskStore,s=>s.current),shown=items.filter(item=>item.taskId===taskId);
 return <div className="study-gallery"><h2>图库</h2>{shown.length?<div className="study-gallery-grid">{shown.map(item=><button key={item.id} type="button" onClick={()=>openFileCapture(item.id)} aria-label={`打开${item.title}`}><img src={item.url} alt=""/><span>{item.title}</span></button>)}</div>:<p>当前任务还没有截图。打开文件后按 Shift+S 框选。</p>}</div>;
}
