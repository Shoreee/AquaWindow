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
  // Extend beyond both outside edges. Smoothing a closed cut inside the window
  // used to round it into an enclosed hole instead of opening the corner.
  const left=view.edge==='left',size=Math.min(280,Math.max(155,w*view.extent))*p*(1-a);
  const height=Math.min(220,h*.43)*p*(1-a),outside=left?-24:w+24;
  const inner=Array.from({length:49},(_,i):[number,number]=>{const t=i/48,bite=size*Math.pow(1-t,.85)+livingWave(t*height,time)*Math.sin(t*Math.PI)*p*(1-a);return [left?bite:w-bite,t*height];});
  const rimPath=inner.map((q,i)=>`${i?'L':'M'}${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join('');
  const path=`M${outside} -24L${inner[0][0].toFixed(2)} -24${rimPath.replace(/^M/,'L')}L${outside} ${(height+24).toFixed(2)}Z`;
  const handle=inner[24];
  return {path,rimPath,active:p>.0001&&a<.9999,handles:[[handle[0],handle[1],view.edge]],rw:size,rh:height};
 }
 const path=smoothClosed(points.map(q=>({x:q[0],y:q[1]})));
 const rimPath=view.revealMode==='hole'?path:points.slice(1).map((q,i)=>`${i?'L':'M'}${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join('');
 return {path,rimPath,active:p>.0001&&a<.9999,handles:view.revealMode==='hole'?[[x,y+rh/2,'left'],[x+rw,y+rh/2,'right'],[x+rw/2,y,'top'],[x+rw/2,y+rh,'bottom']]:[[view.edge==='left'?rw:w-rw,h*.3,view.edge]],rw,rh};
}
