import {livingWave,roundedContour,smoothClosed} from './livingGeometry';
import type {AgentView} from '../agent/adaptive/types';
export type RevealClosure={edge:string;amount:number};
interface RevealShape{view:AgentView;width:number;height:number;progress:number;closure?:RevealClosure}
/** Cut the actual page. The luminous void stays transparent to the desktop underneath. */
export function revealContour(c:RevealShape,time:number){
 const {width:w,height:h,view}=c,p=Math.max(0,Math.min(1,c.progress)),a=Math.max(0,Math.min(1,c.closure?.amount??0));
 const region=view.revealRegion??{x:.27,y:.33,w:.46,h:.34};
 let x=region.x*w,y=region.y*h,rw=region.w*w,rh=region.h*h;
 if(c.closure?.edge==='left'){x+=rw*a;rw*=1-a;}else if(c.closure?.edge==='right')rw*=1-a;
 else if(c.closure?.edge==='top'){y+=rh*a;rh*=1-a;}else if(c.closure?.edge==='bottom')rh*=1-a;
 let points:[number,number][]=[];
 if(view.revealMode==='hole'){
  const hw=rw*Math.sqrt(p),hh=rh*p;
  const contour=roundedContour(x+(rw-hw)/2,y+(rh-hh)/2,hw,hh,20);
  points=contour.map(q=>{const wave=livingWave(q.s,time)*p*(1-a);return [q.x+q.nx*wave,q.y+q.ny*wave];});
 }else{
  const left=view.edge==='left',size=Math.min(300,Math.max(180,w*view.extent))*p*(1-a);
  points=[[left?0:w,0],...Array.from({length:65},(_,i):[number,number]=>{const t=i/64;const bite=Math.max(0,size*Math.sqrt(1-t*t)+livingWave(t*h,time)*Math.sin(t*Math.PI)*p*(1-a));return [left?bite:w-bite,t*h];})];
  x=left?0:w-size;y=0;rw=size;rh=h;
 }
 const path=smoothClosed(points.map(q=>({x:q[0],y:q[1]})));
 const rimPath=view.revealMode==='hole'?path:points.slice(1).map((q,i)=>`${i?'L':'M'}${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join('');
 return {path,rimPath,active:p>.0001&&a<.9999,handles:view.revealMode==='hole'?[[x,y+rh/2,'left'],[x+rw,y+rh/2,'right'],[x+rw/2,y,'top'],[x+rw/2,y+rh,'bottom']]:[[view.edge==='left'?rw:w-rw,h*.3,view.edge]],rw,rh};
}
