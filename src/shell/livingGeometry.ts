export type LivingPoint={x:number;y:number;nx:number;ny:number;s:number};
/** One broad travelling crest, always on the material's stressed side. */
export function livingWave(distance:number,time:number){
 const crest=Math.pow(.5+.5*Math.sin(distance*.018-time*6.7),3);
 const breath=.5+.5*Math.sin(distance*.009+time*2.2);
 return .35+4.8*crest+.65*breath;
}
export function roundedContour(x:number,y:number,width:number,height:number,radius=22):LivingPoint[]{
 const r=Math.max(0,Math.min(radius,width/2,height/2)),out:LivingPoint[]=[];let distance=0;
 const push=(px:number,py:number,nx:number,ny:number)=>{const previous=out.at(-1);if(previous)distance+=Math.hypot(px-previous.x,py-previous.y);out.push({x:px,y:py,nx,ny,s:distance});};
 const side=(ax:number,ay:number,bx:number,by:number,nx:number,ny:number)=>{const count=Math.max(6,Math.ceil(Math.hypot(bx-ax,by-ay)/14));for(let i=0;i<count;i++)push(ax+(bx-ax)*i/count,ay+(by-ay)*i/count,nx,ny);};
 const corner=(cx:number,cy:number,a:number)=>{for(let i=0;i<10;i++){const t=a+i*Math.PI/20;push(cx+Math.cos(t)*r,cy+Math.sin(t)*r,Math.cos(t),Math.sin(t));}};
 side(x+r,y,x+width-r,y,0,-1);corner(x+width-r,y+r,-Math.PI/2);
 side(x+width,y+r,x+width,y+height-r,1,0);corner(x+width-r,y+height-r,0);
 side(x+width-r,y+height,x+r,y+height,0,1);corner(x+r,y+height-r,Math.PI/2);
 side(x,y+height-r,x,y+r,-1,0);corner(x+r,y+r,Math.PI);return out;
}
export function smoothClosed(points:{x:number;y:number}[]){
 const first=points[0],last=points.at(-1)!;let path=`M${((first.x+last.x)/2).toFixed(2)} ${((first.y+last.y)/2).toFixed(2)}`;
 points.forEach((p,i)=>{const next=points[(i+1)%points.length];path+=`Q${p.x.toFixed(2)} ${p.y.toFixed(2)} ${((p.x+next.x)/2).toFixed(2)} ${((p.y+next.y)/2).toFixed(2)}`;});return path+'Z';
}
