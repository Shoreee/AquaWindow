/** Layered optical membranes share their geometry with extracted silk and host imprints. */
export interface FlowLink {
  selection: boolean;
  coordinator?: boolean;
  withdrawing?:boolean;
  highlight?:number;
  transport: number;
  transportProgress: number;
  side: number;
  carrier: [number,number,number,number];
  opacity: number;
  landing: number;
  birthTime: number;
  birthFlow: number;
  poseBlend: number;
  previousPose: [number, number, number, number];
  previousSeed: number;
  impact: number;
  budding: boolean;
  gesture: number;
  action: number;
  seed: number;
  extent: number;
  from: [number, number];
  layer: number;
  to: [number, number];
  progress: number;
  tail: number;
  root: number;
  width: number;
  returning: number;
  phase: number;
  feedback: number;
  arrival: number;
  crawl: number;
  bound: number;
  beat: number;
  sever: number;
  bite: number;
  entry: number;
  host: [number, number, number, number];
  impactHost: [number, number, number, number];
  impactOccluders: [number, number, number, number][];
  normal: [number, number];
  occluders: [number, number, number, number][];
}
export interface EnergyScene {
  x: number;
  y: number;
  morph: number;
  energy: number;
  pull: [number, number];
  velocity: [number, number];
  shellOffset: [number, number];
  burst: number;
  drain: number;
  depletion: [number, number, number];
  roots: [number, number, number];
  transport: number;
  core: boolean;
  links: FlowLink[];
}
const vertex = `#version 300 es
precision highp float;
precision highp int;
in vec2 aUv;
uniform vec2 uResolution,uOrigin,uPull,uVelocity,uFrom,uTo,uNormal;
uniform float uTime,uMorph,uEnergy,uBurst,uProgress,uWidth,uReturning,uPhase,uRoot,uTail,uDrain,uTransport,uLayer,uFeedback,uLoss,uSever;
uniform int uMode;
uniform vec4 uHost;
uniform float uEntry,uCrawl,uBound,uBeat,uBite,uGesture,uAction,uSeed,uExtent,uImpact,uOpacity,uLanding,uBirthTime,uBirthFlow,uPoseBlend,uPreviousSeed,uTransportCover,uCarryProgress,uSide,uSelection,uWithdraw,uHighlight;
uniform vec4 uCarrier;
uniform vec4 uPreviousPose;
uniform vec2 uShellOffset;
out vec2 vUv;out vec3 vPosition;flat out vec2 vBubble;
const float PI=3.14159265359;
float sq(float x){return x*x;}
vec2 boundary(float t){
 vec2 p[7]=vec2[7](vec2(0,0),vec2(1,22),vec2(7,16),vec2(11,25),vec2(15,23),vec2(11,15),vec2(21,14));
 float f=fract(t)*7.;int i=int(floor(f));return mix(p[i],p[(i+1)%7],fract(f));
}
// Restored from the 17:15–17:19 local implementation; numerical fixes retained.
vec3 orbital(vec2 uv,float materialTime,float materialFlow){
 float time=materialTime, t=uv.x*2.*PI, k=uLayer*2.0944;
 // Material circulates non-uniformly. Travelling compression packets plunge through
 // the centre, then release into asymmetric outer curls; no rigid rotation transform.
 float flow=materialFlow*.24;
 float orbit=t+flow+k*.37+.42*sin(t*3.-time*1.7+k)+.20*sin(t*2.+time*1.1);
 float packet=pow(.5+.5*cos(t*2.-flow*1.35+k),3.);
 float phase=fract(time*.83-uLayer*.065);
 float recoil=exp(-sq((phase-.44)/.075))-.48*exp(-sq((phase-.59)/.105));
 float radius=24.+9.*sin(t*2.-time*1.8+k)+5.*cos(t*3.+time*.93-k);
 radius*=1.-packet*(.56+.08*sin(time*1.3+k));
 radius*=1.-recoil*.19-uLoss*.15;
 float fold=orbit*2.+.8*sin(t*3.-flow*.7)+k;
 float width=(6.7+3.7*sin(t*3.-flow*1.15+k))*(.9+uEnergy*.16)*(1.-uLoss*.72);
 width*=1.+packet*.35-recoil*.2;
 vec3 p=vec3(cos(orbit)*radius,sin(orbit)*radius*(.66+.10*sin(time*1.4+k)),
   9.*sin(t*2.-time*1.6+k)+5.*cos(t*3.+flow*.6));
 vec3 crossSection=vec3(cos(orbit)*cos(fold),sin(orbit)*cos(fold),sin(fold));
 p+=crossSection*uv.y*width;
 // Each circulation changes its own plane and curvature out of phase with its neighbours.
 float tilt=.5+sin(k)*.65+.26*sin(time*.82+k);
 p.yz=mat2(cos(tilt),-sin(tilt),sin(tilt),cos(tilt))*p.yz;
 p.xy=mat2(cos(k*.53),-sin(k*.53),sin(k*.53),cos(k*.53))*p.xy;
 p.xy+=vec2(p.z*.29,-p.z*.22);
 p.xy*=1.24+uEnergy*.07+uBurst*.08-uDrain*.14;
 // Short, staggered inward kicks, followed by a looser rebound, give the brew its rhythm.
 p.xy+=vec2(sin(time*2.3+k),cos(time*1.9-k))*recoil*2.8;
 vec2 direction=normalize(uPull+vec2(.001));
 float facing=pow(max(0.,dot(normalize(p.xy+vec2(.001)),direction)),4.);
 p.xy+=uPull*(.18+facing*(.7+uDrain*.65));
 p.xy+=uVelocity*.008*(.5+.5*sin(t+k));
 float strain=smoothstep(34.,53.,length(p.xy))*smoothstep(.55,1.,abs(uv.y));
 p.xy+=normalize(p.xy+vec2(.001))*strain*(1.5+1.2*sin(t*17.-time*3.7));
 return p+vec3(38.,32.,0.);
}
vec3 membrane(vec2 uv){return orbital(uv,uTime,uTransport);}
vec3 coreSurface(vec2 uv){
 vec2 cursor=mix(vec2(8.,14.),boundary(uv.x),(uv.y+1.)*.5);
 cursor+=vec2(sin(uTime*2.8+uv.x*6.283),cos(uTime*2.1+uv.x*6.283))*.42*smoothstep(5.,18.,cursor.y);
 return vec3(uOrigin,0.)+mix(vec3(cursor,0.),membrane(uv),uMorph);
}
vec3 departure(){
 if(uGesture==7. || uGesture==6.)return vec3(uFrom,0.);
 return vec3(uFrom,0.)+orbital(vec2(uRoot,0.),uBirthTime,uBirthFlow);
}
vec2 flightPoint(float q){
 vec2 root=departure().xy,d=uTo-root;float len=max(length(d),1.);
 vec2 n=vec2(-d.y,d.x)/len;
 float envelope=sin(PI*q),side=sin(uRoot*47.+uLayer*3.)>0.?1.:-1.;
 float curl=sin(q*2.*PI+uRoot*6.283)*envelope*min(75.,len*.19);
 float wave=sin(q*11.-uTime*3.2+uRoot*19.)*envelope*min(8.,len*.025);
 return mix(root,uTo,q)+n*(side*envelope*min(110.,len*.32)+curl+wave);
}
vec4 perimeter(float fraction);
// Selection traces a tilted spatial circuit before diving into its sampled boundary point.
vec3 selectionPoint(float q){
 vec2 centre=uHost.xy+uHost.zw*.5;
 float phase=clamp((q-.22)/.60,0.,1.);
 // A vertical orbital plane: the broad excursion is depth, never a tabletop loop.
 float theta=phase*2.*PI;
 float radius=uHost.z*.5+32.;
 float z=sin(theta)*radius*.78;
 vec2 first=vec2(centre.x+radius,centre.y);
 float perspective=760./(760.-z);
 vec3 orbit=vec3(centre+vec2(cos(theta)*radius,sin(theta)*min(26.,uHost.w*.045))*perspective,z);
 vec3 root=departure();

 float approach=smoothstep(0.,.24,q);
 vec2 n=normalize(vec2(-(first-root.xy).y,(first-root.xy).x)+vec2(.001));
 vec3 approaching=vec3(mix(root.xy,first,approach)+n*sin(approach*PI)*min(80.,length(first-root.xy)*.18),root.z*(1.-approach));
 vec3 result=mix(approaching,orbit,smoothstep(.20,.27,q));
 float dive=smoothstep(.82,1.,q);
 return mix(result,vec3(uTo,0.),dive);
}
vec3 hostSurface(vec2 uv);
vec3 hostPose(vec2 uv,float gesture,float action,float entry,float extent,float seed);
vec3 linkSurface(vec2 uv){
 // At birth every child vertex is the SAME donor vertex (same layer, sector and cross-section).
 // That material patch stretches out, forms a neck, and finally separates as its tail departs.
 vec3 donor=coreSurface(vec2(uRoot+uv.x*.18,uv.y));
 vec3 root=departure();
 vec3 rootCross=coreSurface(vec2(uRoot,uv.y))-coreSurface(vec2(uRoot,0.));
 if(uGesture==7. || uGesture==6.){donor=root+vec3(uv.y*uWidth,0.,0.);rootCross=vec3(uv.y*uWidth,0.,0.);}
 float q=mix(uTail,uProgress,uv.x);
 vec2 d=uTo-root.xy;float len=max(length(d),1.);vec2 n=vec2(-d.y,d.x)/len;
 float envelope=sin(PI*q);
 float wave=sin(q*8.-uTime*2.8+uPhase*.12)*envelope*min(17.,len*.05);
 vec2 bend=n*(envelope*min(40.,len*.11)+wave);
 float width=uWidth*(.45+.55*sin(PI*q))*(1.+.25*sin(q*15.-uTransport*.8));
 float twist=q*9.-uTime*1.3+uFeedback*sin(q*12.-uTime*9.);
 vec3 crossSection=mix(rootCross,vec3(n*uv.y*width*(.42+.58*cos(twist)),uv.y*width*sin(twist)),smoothstep(0.,.2,q));
 float neck=1.-uSever*(1.-smoothstep(0.,.13,q))*.985;
 vec3 path=vec3(mix(root.xy,uTo,q)+bend,mix(root.z,0.,q)+envelope*8.)+crossSection*neck;
 if(uSelection>.5 && uWithdraw<.5){
  vec3 centre=selectionPoint(q);
  vec2 tangent=selectionPoint(min(1.,q+.001)).xy-selectionPoint(max(0.,q-.001)).xy;
  vec2 normal=normalize(vec2(-tangent.y,tangent.x)+vec2(.001));
  path=centre+vec3(normal*uv.y*width*(.72+.28*cos(twist)),uv.y*width*sin(twist)*.4)*neck;
 }
 if(uWithdraw>.5){
  float rq=1.-q;
  vec2 centre=flightPoint(rq);
  vec2 tangent=flightPoint(min(1.,rq+.001))-flightPoint(max(0.,rq-.001));
  vec2 normal=normalize(vec2(-tangent.y,tangent.x)+vec2(.001));
  vec3 recovered=vec3(centre+normal*uv.y*uWidth*(.4+.6*sin(PI*uv.x)),sin(PI*q)*12.);
  vec3 attachment=hostPose(uv,uPreviousPose.x,uPreviousPose.y,uPreviousPose.z,uPreviousPose.w,uPreviousSeed);
  return mix(attachment,recovered,smoothstep(0.,.24,uProgress));
 }
 return mix(mix(donor,path,smoothstep(0.,.65,uProgress)),hostSurface(uv),uLanding);
}
// Arc length, including the corners, makes the crawl continuous around every window shape.
vec4 perimeter(float fraction){
 vec2 size=uHost.zw;float r=min(22.,min(size.x,size.y)*.5);
 float h=size.x-2.*r,v=size.y-2.*r,a=PI*r*.5;
 float d=fract(fraction)*(2.*h+2.*v+4.*a),theta;
 if(d<=h)return vec4(uHost.xy+vec2(r+d,0.),0.,-1.);d-=h;
 if(d<=a){theta=-PI*.5+d/r;return vec4(uHost.xy+vec2(size.x-r,r)+vec2(cos(theta),sin(theta))*r,cos(theta),sin(theta));}d-=a;
 if(d<=v)return vec4(uHost.xy+vec2(size.x,r+d),1.,0.);d-=v;
 if(d<=a){theta=d/r;return vec4(uHost.xy+size-vec2(r)+vec2(cos(theta),sin(theta))*r,cos(theta),sin(theta));}d-=a;
 if(d<=h)return vec4(uHost.xy+vec2(size.x-r-d,size.y),0.,1.);d-=h;
 if(d<=a){theta=PI*.5+d/r;return vec4(uHost.xy+vec2(r,size.y-r)+vec2(cos(theta),sin(theta))*r,cos(theta),sin(theta));}d-=a;
 if(d<=v)return vec4(uHost.xy+vec2(0.,size.y-r-d),-1.,0.);d-=v;
 theta=PI+d/r;return vec4(uHost.xy+vec2(r)+vec2(cos(theta),sin(theta))*r,cos(theta),sin(theta));
}
vec3 hostPose(vec2 uv,float gesture,float action,float entry,float extent,float seed){
 if(gesture>0.){
  float theta=uv.x*2.*PI,r=(uv.y+1.)*.5;
  vec2 circle=vec2(cos(theta),sin(theta));
  float peristalsis=sin(uv.x*13.-uTime*9.+seed);
  float pulse=1.+.1*sin(theta*3.-uTime*2.+seed);
  vec4 edge=perimeter(entry);
  vec2 centre=edge.xy;
  if(gesture==2.)return vec3(centre+vec2(-edge.w,edge.z)*(uv.x-.5)*22.+edge.zw*uv.y*(2.+sin(PI*uv.x)),0.);
  if(gesture==3.){
   // First spread under the content, then contract into a thick waving peel seam.
   float spread=smoothstep(0.,.32,action),contract=smoothstep(.28,1.,action);
   float side=extent<0.?-1.:1.;
   float width=uHost.z*abs(extent);
   vec2 start=uHost.xy+uHost.zw*.5;
   vec2 backdrop=uHost.xy+vec2(.5+cos(theta)*r*.49,.5+sin(theta)*r*.48)*uHost.zw;
   float seamX=side>0.?uHost.z-width*contract:width*contract;
   vec2 seam=uHost.xy+vec2(seamX+uv.y*(18.+9.*sin(PI*uv.x))+sin(uv.x*18.-uTime*4.)*9.,42.+uv.x*(uHost.w-42.));
   return vec3(mix(mix(start+circle*r*14.,backdrop,spread),seam,contract),0.);
  }
  if(gesture==4.){
   // The parasite occupies one straight side only; it never travels around a corner.
   float lengthwise=.08+uv.x*.84;
   vec2 p;
   float wave=sin(uv.x*17.-uTime*8.)*2.5;
   float thickness=(8.+7.*sin(PI*uv.x))*(.9+.1*peristalsis);
   if(uSide<.5)p=uHost.xy+vec2(uv.y*thickness+wave,uHost.w*lengthwise);
   else if(uSide<1.5)p=uHost.xy+vec2(uHost.z+uv.y*thickness+wave,uHost.w*lengthwise);
   else if(uSide<2.5)p=uHost.xy+vec2(uHost.z*lengthwise,uv.y*thickness+wave);
   else p=uHost.xy+vec2(uHost.z*lengthwise,uHost.w+uv.y*thickness+wave);
   return vec3(p,0.);
  }
  if(gesture==5.){
   float wrap=smoothstep(0.,.8,action);
   vec4 skin=perimeter(entry+uv.x*max(.025,wrap));
   vec2 c=uHost.xy+uHost.zw*.5;
   float thickness=8.+sin(PI*uv.x)*16.;
   vec2 p=skin.xy+skin.zw*uv.y*thickness*(1.+.12*peristalsis);
   float closure=smoothstep(.72,1.,action);
   return vec3(mix(p,c+(skin.xy-c)*.23+skin.zw*uv.y*24.,closure),0.);
  }
  if(gesture==6. || gesture==7.){
   vec4 skin=perimeter(entry+uv.x);
   return vec3(skin.xy+skin.zw*uv.y*(2.+.6*peristalsis),0.);
  }
  if(gesture==8.){
   centre=uHost.xy+uHost.zw*.5;
   float radius=mix(min(uHost.z,uHost.w)*.3,22.,action);
   return vec3(centre+circle*r*radius*pulse,0.);
  }
  // Translation is swallowed into a carrying body; its working lane can peel concurrently.
  return vec3(uHost.xy+uHost.zw*.5+circle*r*18.*pulse,0.);
 }

  float span=min(.12,action);
  float gaitPhase=uv.x+.028*sin(uv.x*6.283-uTime*15.)*sin(PI*uv.x);
  float q=entry+action-(1.-gaitPhase)*span;
  vec4 edge=perimeter(q);
  float belly=pow(max(0.,sin(PI*uv.x)),.65);
  float twist=uv.x*8.-uTime*14.;
  float width=(3.+belly*13.)*(.90+.10*cos(twist));
  float gait=sin(twist)*belly*3.4;
  float mouth=0.;
  vec3 crawling=vec3(edge.xy+edge.zw*(uv.y*width+gait-mouth),uv.y*width*sin(twist));
  float theta=uv.x*2.*PI,r=(uv.y+1.)*.5;vec4 anchor=perimeter(entry);
  vec2 field=anchor.xy+vec2(cos(theta),sin(theta))*r*(15.+2.*sin(uTime*2.+seed));
  vec2 slit=anchor.xy+vec2(-anchor.w,anchor.z)*(uv.x-.5)*20.+anchor.zw*uv.y*2.;
  return mix(crawling,vec3(slit,0.),smoothstep(.97,1.,action));

}
vec3 hostSurface(vec2 uv){
 vec3 current=hostPose(uv,uGesture,uAction,uEntry,uExtent,uSeed);
 vec3 previous=hostPose(uv,uPreviousPose.x,uPreviousPose.y,uPreviousPose.z,uPreviousPose.w,uPreviousSeed);
 return mix(previous,current,uPoseBlend);
}
vec3 surface(vec2 uv){
 if(uMode==1)return linkSurface(uv);
 if(uMode==4)return hostSurface(uv);
 if(uMode==5){vec4 edge=perimeter(uEntry+uv.x*uCrawl);return vec3(edge.xy+edge.zw*uv.y*1.1,0.);}
 if(uMode==2)return vec3(uOrigin+vec2(38.,32.)*uMorph+(vec2(uv.x,(uv.y+1.)*.5)*2.-1.)*vec2(90.)*uMorph,0.);
 if(uMode==6)return linkSurface(vec2(uv.x,uv.y*1.28));
 if(uMode==8){
  return vec3(uCarrier.xy-vec2(26.)+vec2(uv.x,(uv.y+1.)*.5)*(uCarrier.zw+vec2(52.)),0.);
 }
 if(uMode==7){float radius=35.+clamp(uImpact,0.,1.5)*120.;return vec3(uTo+(vec2(uv.x,(uv.y+1.)*.5)*2.-1.)*radius,0.);}
 if(uMode==9)return vec3(uHost.xy-vec2(46.)+vec2(uv.x,(uv.y+1.)*.5)*(uHost.zw+vec2(92.)),0.);
 if(uMode==3)return vec3(uHost.xy+vec2(uv.x,(uv.y+1.)*.5)*uHost.zw,0.);
 return coreSurface(uv);
}
void main(){
 vec3 p=surface(aUv);vPosition=p;vUv=aUv;
 vBubble=vec2(0.);
 gl_Position=vec4(p.x/uResolution.x*2.-1.,1.-p.y/uResolution.y*2.,0,1);
}`;
const fragment = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;in vec3 vPosition;flat in vec2 vBubble;
uniform float uTime,uMorph,uEnergy,uBurst,uReturning,uPhase,uDrain,uTransport,uRoot,uLayer,uFeedback,uArrival,uProgress,uTail;
uniform float uEntry,uCrawl,uBound,uBeat,uBite,uLoss,uSever,uGesture,uAction,uSeed,uExtent,uImpact,uOpacity,uLanding,uBirthTime,uBirthFlow,uPoseBlend,uPreviousSeed,uTransportCover,uCarryProgress,uSide,uSelection,uWithdraw,uHighlight;
uniform vec4 uCarrier;
uniform vec4 uPreviousPose;
uniform vec2 uShellOffset,uVelocity;
uniform vec2 uTo,uNormal,uOrigin,uPull;uniform vec4 uHost,uOccluders[8];uniform int uMode,uOccluderCount;
layout(location=0) out vec4 base;layout(location=1) out vec4 emission;
float sq(float x){return x*x;}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.07+3.1;a*=.5;}return s;}
float roundedRect(vec2 p,vec4 rect){
 vec2 halfSize=rect.zw*.5;float r=min(22.,min(halfSize.x,halfSize.y));
 vec2 q=abs(p-rect.xy-halfSize)-halfSize+vec2(r);
 return length(max(q,0.))+min(max(q.x,q.y),0.)-r;
}
float softUnion(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float motherSkin(vec2 p){
 p-=uShellOffset;
 vec2 axis=normalize(uVelocity+uShellOffset*24.+vec2(.001));
 float stretch=min(.18,length(uShellOffset)*.008+length(uVelocity)*.00009);
 vec2 q=p-axis*dot(p,axis)*stretch;
 float angle=atan(q.y,q.x);
 float tide=.7*sin(angle*3.-uTime*.9)+.4*sin(angle*5.+uTime*.7);
 float tug=pow(max(0.,dot(normalize(p+vec2(.001)),normalize(uPull+vec2(.001)))),4.);
 return length(q)-(48.+1.1*sin(uTime*1.4))-tide-tug*min(7.,length(uPull)*.15)+uDrain*.8;
}
// Every fold carries white light. R/Y/B are a low-chroma, advected interference within it,
// with no permanent hue assigned to a layer or to material extracted from that layer.
vec3 laneColor(){return vec3(.975,.985,1.);}
vec3 laneDensity(float density){
 float p=vUv.x*9.-uTransport*.14+uLayer*1.7;
 float warp=fbm(vPosition.xy*.025+vec2(uTime*.13,-uTime*.09))*4.;
 vec3 variation=vec3(sin(p+warp+uTime*.31),sin(p*1.17-warp-uTime*.23),cos(p*.83+warp*.6+uTime*.37));
 float chroma=uMode==1?.48:.72;
 return density*(vec3(.82)+variation*chroma);
}
vec3 spectrum(float t){return laneColor()*(.97+.03*sin(t));}
float cursorEdgeDistance(vec2 p){
 vec2 edges[7]=vec2[7](vec2(0,0),vec2(1,22),vec2(7,16),vec2(11,25),vec2(15,23),vec2(11,15),vec2(21,14));
 float nearest=1000.;
 for(int i=0;i<7;i++){vec2 a=edges[i],b=edges[(i+1)%7],d=b-a;float q=clamp(dot(p-a,d)/max(.001,dot(d,d)),0.,1.);nearest=min(nearest,length(p-a-d*q));}
 return nearest;
}
vec3 cursorInk(float phase){
 return mix(vec3(.28,.41,.36),vec3(.54,.29,.42),.5+.5*sin(phase*1.7));
}
vec2 livingField(vec2 p,float gesture,float action,float extent,float seed){
  vec2 c=uHost.xy+uHost.zw*.5;
  float d=1000.,strength=.40;
  float wave=sin((p.x+p.y)*.035-uTime*4.+seed);
  if(gesture==3.){
   float gt=clamp((action-.12)/.88,0.,1.);
   float growth=gt*gt*gt*(gt*(gt*6.-15.)+10.);
   float y=clamp((p.y-uHost.y)/max(1.,uHost.w),0.,1.);
   float bite=uHost.z*abs(extent)*growth*sqrt(max(0.,1.-y*y));
   float scallop=(2.2*sin(y*37.-uTime*3.)+1.2*sin(y*71.+uTime*2.))*growth;
   float x=extent<0.?uHost.x+bite+scallop:uHost.x+uHost.z-bite-scallop;
   d=max(abs(p.x-x)-2.1,max(uHost.y-p.y,p.y-uHost.y-uHost.w+4.));
   strength=.17*growth;
  }else if(gesture==4.){
   vec2 a,b;
   if(uSide<.5){a=uHost.xy+vec2(0.,uHost.w*.08);b=uHost.xy+vec2(0.,uHost.w*.92);}
   else if(uSide<1.5){a=uHost.xy+vec2(uHost.z,uHost.w*.08);b=uHost.xy+vec2(uHost.z,uHost.w*.92);}
   else if(uSide<2.5){a=uHost.xy+vec2(uHost.z*.08,0.);b=uHost.xy+vec2(uHost.z*.92,0.);}
   else {a=uHost.xy+vec2(uHost.z*.08,uHost.w);b=uHost.xy+vec2(uHost.z*.92,uHost.w);}
   vec2 segment=b-a;float along=clamp(dot(p-a,segment)/max(1.,dot(segment,segment)),0.,1.);
   float belly=sin(along*3.14159),peristalsis=sin(along*17.-uTime*6.);
   d=length(p-a-segment*along)-(5.+belly*(7.+2.*peristalsis));
  }else if(gesture==5.){
   float skin=roundedRect(p,uHost);
   float angle=mod(atan(p.y-c.y,p.x-c.x)+6.283185,6.283185)/6.283185;
   float wrap=smoothstep(0.,.80,action);
   float sector=1.-smoothstep(wrap-.018,wrap+.018,angle);
   d=abs(skin)-(2.+.8*wave);
   strength*=sector*.5;
   strength*=1.-smoothstep(.86,1.,action);
  }else if(gesture==6. || gesture==7.){
   // Division belongs to the window skin, never to a pair of independent worms.
   float skin=roundedRect(p,uHost);
   float pulse=sin((p.x+p.y)*.045-uTime*5.+seed)*1.8;
   d=abs(skin-pulse)-1.7;
   strength=.18*sin(action*3.14159);
  }else if(gesture==8.){
   d=roundedRect(p,uHost)+mix(8.,28.,action)+2.*wave;
   strength=.06*(1.-smoothstep(.72,1.,action));
  }else{
   d=1000.;strength=0.;
  }
 return vec2(d,strength);
}
void main(){
 // Bypass surface derivatives on the collapsed cursor fan, where triangles can be degenerate.
 if(uMode==0 && uMorph<.0001){
  float edge=1.-smoothstep(.55,1.8,cursorEdgeDistance(vPosition.xy-uOrigin));
  vec3 color=mix(vec3(1.),cursorInk(vUv.x*4.-uTime*.7),edge);
  float distance=cursorEdgeDistance(vPosition.xy-uOrigin);
  float aa=clamp(fwidth(distance),.24,1.0);
  float coverage=smoothstep(-aa,aa,distance);
  // Three donor sheets coincide in the cursor pose; preserve one anti-aliased silhouette.
  float alpha=1.-pow(max(0.,1.-coverage),1./3.);
  base=vec4(color*alpha,alpha);emission=vec4(0.);return;
 }
 if(uMode==2){
  float distance=motherSkin(vPosition.xy-uOrigin-vec2(38.,32.));
  float rim=exp(-sq(distance/1.05));
  float inner=(1.-smoothstep(-1.,1.,distance))*.012;
  float alpha=(rim*.5+inner)*uMorph;
  base=vec4(vec3(1.)*alpha,alpha);emission=vec4(vec3(rim*.38)*uMorph,0.);return;
 }
 if(uMode==6){
  float rim=exp(-sq((abs(vUv.y)-.79)/.11));
  float cap=pow(max(0.,sin(vUv.x*3.14159)),.5);
  float alpha=(rim*.19+.016)*cap*uOpacity*(1.-uLanding);
  base=vec4(vec3(1.)*alpha,alpha);emission=vec4(vec3(alpha*.45),0.);return;
 }
 if(uMode==7){
  float age=uImpact,clip=1.-smoothstep(-1.,1.,roundedRect(vPosition.xy,uHost));
  for(int i=0;i<8;i++){if(i>=uOccluderCount)break;clip*=smoothstep(-1.,1.,roundedRect(vPosition.xy,uOccluders[i]));}
  float distance=length((vPosition.xy-uTo)*vec2(1.,.88)),rings=0.;
  for(int i=0;i<3;i++){
   float life=age-float(i)*.14;
   float radius=8.+max(0.,life)*112.;
   rings+=exp(-sq((distance-radius)/1.8))*exp(-max(0.,life)*2.8)*step(0.,life);
  }
  float alpha=uOpacity*rings*.26*(1.-smoothstep(1.,1.45,age))*clip;
  base=vec4(vec3(.92,.96,1.)*alpha,alpha);emission=vec4(vec3(alpha*.7),0.);return;
 }
 if(uMode==9){
  vec2 p=vPosition.xy;
  vec2 current=livingField(p,uGesture,uAction,uExtent,uSeed);
  vec2 prior=livingField(p,uPreviousPose.x,uPreviousPose.y,uPreviousPose.w,uPreviousSeed);
  float aa=1.;
  float now=(1.-smoothstep(-aa,aa,current.x))*current.y+exp(-sq(current.x/2.))*.15;
  float before=(1.-smoothstep(-aa,aa,prior.x))*prior.y+exp(-sq(prior.x/2.))*.15;
  float opacity=mix(before,now,uPoseBlend)*uOpacity*uLanding;
  if(uGesture==6. || uGesture==7.){
   opacity*=1.-smoothstep(.88,1.,uAction);
   opacity*=.75+.25*sin(p.x*.065-uTime*5.+sin(p.y*.09));
  }
  for(int i=0;i<8;i++){if(i>=uOccluderCount)break;opacity*=smoothstep(-1.,1.,roundedRect(p,uOccluders[i]));}
  if(uGesture==8.){
   float inward=-roundedRect(p,uHost);
   float ripple=exp(-sq((inward-8.-uAction*46.)/2.2))+.55*exp(-sq((inward-25.-uAction*46.)/2.8));
   opacity+=ripple*.26*sin(uAction*3.14159)*uOpacity*uLanding;
  }
  base=vec4(vec3(.97,.985,1.)*opacity,opacity);
  emission=vec4(vec3(opacity*.62),0.);return;
 }
 if(uMode==8){
  // A living membrane grows from the top-left corner and carries a full-size readable window.
  vec2 p=vPosition.xy,local=p-uCarrier.xy;
  float contour=roundedRect(p,uCarrier);
  float edgeWave=2.3*sin((local.x+local.y)*.036-uTime*4.)+1.1*sin((local.x-local.y)*.061+uTime*2.8);
  float skin=contour-edgeWave;
  vec2 corner=uCarrier.xy+vec2(14.);
  float diagonal=length(uCarrier.zw)+48.;
  float front=length(p-corner)-uTransportCover*diagonal;
  front-=4.*sin((local.x-local.y)*.023-uTime*3.);
  float covered=1.-smoothstep(-2.,2.,max(skin-3.,front));
  float rim=exp(-sq(skin/1.35))*(1.-smoothstep(-2.,4.,front));
  float wavefront=exp(-sq(front/2.8))*(1.-smoothstep(-1.,4.,skin));
  float flow=.70+.30*sin((local.x+local.y)*.047-uTime*5.2);
  float alpha=(covered*.012+rim*.20*flow+wavefront*.10)*uOpacity;
  float visible=1.;
  for(int i=0;i<8;i++){if(i>=uOccluderCount)break;visible*=smoothstep(-1.,1.,roundedRect(p,uOccluders[i]));}
  alpha*=visible;
  base=vec4(vec3(.97,.99,1.)*alpha,alpha);
  emission=vec4(vec3(.88,.94,1.)*(rim*.13*flow+wavefront*.06)*uOpacity*visible,0.);return;
 }
 if(uMode==5){
  float thread=exp(-vUv.y*vUv.y*3.);
  float alpha=(.17+uBound*.12)*thread*uArrival*uOpacity;
  float visible=1.;
  for(int i=0;i<8;i++){if(i>=uOccluderCount)break;visible*=mix(1.,smoothstep(-1.,1.,roundedRect(vPosition.xy,uOccluders[i])),uLanding);}
  vec3 tint=laneColor();
  base=vec4(tint*alpha,alpha)*visible;
  emission=vec4(laneDensity(thread*(.10+uBeat*.12)*uArrival*uOpacity)*visible,0.);return;
 }
 if(uMode==3){
  // Selected hosts breathe from their entire inner perimeter. No permanent entry mark.
  float sdf=roundedRect(vPosition.xy,uHost);
  float clip=1.-smoothstep(-1.,1.,sdf);
  for(int i=0;i<8;i++){
   if(i>=uOccluderCount)break;
   clip*=smoothstep(-1.,1.,roundedRect(vPosition.xy,uOccluders[i]));
  }
  float depth=max(0.,-sdf);
  if(depth>115.)discard;
  vec2 cell=floor((vPosition.xy-uHost.xy)/7.);
  float seed=hash(cell+uRoot*31.);
  float wave=.5+.5*sin(depth*.075-uTime*2.6+uRoot*19.);
  float envelope=exp(-depth/62.)*(.45+.55*wave);
  vec2 dotUv=fract((vPosition.xy-uHost.xy)/7.)-.5;
  float radius=.09+.13*hash(cell+7.);
  float dots=1.-smoothstep(radius-.035,radius+.035,length(dotUv));
  float keep=smoothstep(.48,.76,seed+.13*sin(uTime*1.7+seed*12.));
  vec2 gridUv=abs(fract((vPosition.xy-uHost.xy)/28.)-.5);
  float grid=smoothstep(.475,.495,max(gridUv.x,gridUv.y));
  float gridPatch=smoothstep(.63,.83,noise(vPosition.xy*.019+uTime*.055));
  float ink=(dots*keep*.07+grid*gridPatch*.018)*envelope*clip*uArrival*uHighlight*(1.-uTransportCover);
  float contourWave=.65+.35*sin((vPosition.x+vPosition.y)*.045-uTime*5.5);
  float rim=exp(-sq(sdf/2.2))*(.30+.26*contourWave)*uArrival*uHighlight*(uGesture==0.?1.:0.);
  base=vec4(vec3(.94,.98,1.)*rim+vec3(.26,.34,.43)*ink,clamp(rim+ink,0.,1.));
  emission=vec4(mix(vec3(rim*.65),laneDensity(rim*.65),.18)+laneDensity(ink*.8),0.);return;

 }
 vec3 crossNormal=cross(dFdx(vPosition),dFdy(vPosition));
 vec3 N=crossNormal*inversesqrt(max(dot(crossNormal,crossNormal),.00000001));
 if(any(isnan(N))||any(isinf(N)))N=vec3(0.,0.,1.);
 float m=uMode==0?uMorph:1.,clock=uMode==1?uPhase:uTransport;
 float longitudinal=uMode==1?mix(uTail,uProgress,vUv.x):vUv.x;
 vec2 uv=vec2(longitudinal*10.-clock*.23,vUv.y*2.+uLayer*3.);
 vec2 warp=vec2(fbm(uv*.7+vec2(0,uTime*.09)),fbm(uv*.8+vec2(5.3,-uTime*.08)))-.5;
 // Smooth optical coverage survives thinning without high-frequency filament masks.
 float fade=1.-smoothstep(.62,1.,abs(vUv.y));
 float fresnel=pow(max(0.,1.-min(1.,abs(N.z))),2.3);
 float densityWave=.68+.32*sin(longitudinal*9.-clock*.72+uLayer*2.0944);
 float coverage=(.46+.12*abs(N.z))*fade*densityWave;
 float rootDistance=min(abs(vUv.x-uRoot),1.-abs(vUv.x-uRoot));
 float rootFocus=uMode==0?exp(-rootDistance*rootDistance/.004)*uDrain:0.;
 float donorDistance=fract(vUv.x-uRoot+1.);
 float donorSector=smoothstep(0.,.025,donorDistance)*(1.-smoothstep(.145,.18,donorDistance));
 float scar=uMode==0?donorSector*smoothstep(.05,.55,uLoss):0.;
 coverage=(.46+.12*abs(N.z))*fade*densityWave*(1.-scar);
 vec3 pigment=laneColor();
 float convergence=uMode==0?exp(-dot(vPosition.xy-uOrigin-vec2(38.,32.),vPosition.xy-uOrigin-vec2(38.,32.))/240.):0.;
 float photons=.23+convergence*.3+fresnel*.09+rootFocus*.4;
 float echo=uMode==1?exp(-sq((longitudinal-(1.-fract(uTime*.75)))/.09))*uFeedback:0.;
 float alpha=mix(1.,coverage,m);
 
 if(uMode==1)alpha*= (uGesture>0.?1.-uLanding:1.)*.95*smoothstep(0.,.16,uProgress)*pow(max(.001,sin(vUv.x*3.14159)),.35);
 if(uMode==1 || uMode==4){
  float rest=(uGesture==0.?0.:(uGesture==2.?1.:0.))*uLanding;
  float radial=(vUv.y+1.)*.5;
  float energyField=(.25+.5*pow(.5+.5*sin(radial*17.-uTime*5.+vUv.x*8.),3.))*(1.-smoothstep(.6,1.,radial));
  alpha=mix(alpha,energyField*.48,rest);
  float head=exp(-sq((vUv.x-.84)/.13));
  photons+=head*(.5+uBeat*.35);
  float visible=1.;

  if(uGesture==8.)visible*=.45+.55*sin(uAction*3.14159);
  for(int i=0;i<8;i++){if(i>=uOccluderCount)break;visible*=mix(1.,smoothstep(-1.,1.,roundedRect(vPosition.xy,uOccluders[i])),uLanding);}
  alpha*=visible;photons*=visible;
 }
 // Pearl highlights sit on a translucent absorptive body; broad bloom stays restrained.
 vec3 color=mix(vec3(1.),pigment,m);
 // The idle pointer has a dark, flowing outline. Those same vertices hatch into the core.
 float cursorEdge=mix(1.-smoothstep(.55,1.8,cursorEdgeDistance(vPosition.xy-uOrigin)),smoothstep(.70,.94,vUv.y),smoothstep(.02,.18,uMorph))*(1.-smoothstep(.02,.75,uMorph));
 vec3 ink=cursorInk(vUv.x*4.-uTime*.7);
 if(uMode==0)color=mix(color,ink,cursorEdge);
 if(uMode==1){
  float neck=(1.-smoothstep(0.,.16,longitudinal))*uSever;
  alpha*=1.-neck*.82*(1.-uLanding);
 }
 if(uMode!=0)alpha*=uOpacity;
 if(uSelection>.5 && uMode==1)alpha*=1.+uLanding*.38;
 if(uSelection>.5 && uMode==1){
  float behind=1.-smoothstep(-8.,8.,vPosition.z);
  float hostMask=smoothstep(-1.,1.,roundedRect(vPosition.xy,uHost));
  alpha*=mix(1.,hostMask,behind*(1.-uLanding))*(1.-behind*.24*(1.-uLanding));
 }
 base=vec4(color*alpha,alpha);
 emission=vec4(laneDensity((.85+photons*.5+echo*.3)*m*alpha),0.);
}`;
const postVertex = `#version 300 es
precision highp float;out vec2 vUv;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=p;gl_Position=vec4(p*2.-1.,0,1);}`;
const blurFragment = `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uImage;uniform vec2 uStep;out vec4 outColor;
void main(){vec3 c=texture(uImage,vUv).rgb*.227027;c+=(texture(uImage,vUv+uStep*1.384615).rgb+texture(uImage,vUv-uStep*1.384615).rgb)*.316216;c+=(texture(uImage,vUv+uStep*3.230769).rgb+texture(uImage,vUv-uStep*3.230769).rgb)*.070270;outColor=vec4(c,1.);}`;
const compositeFragment = `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uBase,uGlow,uEmission;uniform vec2 uResolution;uniform float uMorph,uTime;out vec4 outColor;
// White interference from three fluctuating spectral densities. Colour is an undertone,
// never a solid coloured ribbon; overlap increases luminous density and cool-white light.
vec3 lightColor(vec3 d){
 float total=d.r+d.g+d.b;
 if(max(d.r,max(d.g,d.b))-min(d.r,min(d.g,d.b))<max(.00001,total*.012))return vec3(.995,1.,1.);
 // Thin optical veils retain colour; dense folds and overlaps build a white luminous core.
 // Square only the relative spectral weights, keeping colour local and continuously advected.
 vec3 weights=d*d*vec3(1.,1.,1.45);weights/=max(.0001,weights.r+weights.g+weights.b);
 vec3 colored=vec3(.98,.36,.46)*weights.r+vec3(.86,.96,.32)*weights.g+vec3(.12,.64,1.)*weights.b;
 float white=.24+.72*smoothstep(.30,1.55,total);
 return mix(colored,vec3(.965,.985,1.),white);
}
void main(){
 vec4 surface=texture(uBase,vUv);
 vec3 sharp=texture(uEmission,vUv).rgb;
 if(any(isnan(sharp))||any(isinf(sharp)))sharp=vec3(0.);
 if(any(isnan(surface))||any(isinf(surface)))surface=vec4(0.);
 float px=(2.8+.5*sin(uTime*.9))*uMorph;
 vec3 soft=vec3(texture(uGlow,vUv+vec2(px,px*.35)/uResolution).r,
   texture(uGlow,vUv-vec2(0.,px*.55)/uResolution).g,
   texture(uGlow,vUv-vec2(px,px*.35)/uResolution).b);
 if(any(isnan(soft))||any(isinf(soft)))soft=vec3(0.);
 float total=soft.r+soft.g+soft.b;
 float halo=(1.-exp(-total*1.4))*.58*smoothstep(.002,.018,total);
 // Absorptive glass stays transparent and dark; infinitesimal emission must not paint it cyan.
 float lit=smoothstep(.006,.16,max(sharp.r,max(sharp.g,sharp.b)));
 vec3 body=mix(surface.rgb,lightColor(sharp)*surface.a,uMorph*lit);
 vec3 glow=lightColor(soft)*halo;
 float alpha=clamp(surface.a+(1.-surface.a)*halo*.8,0.,1.);
 vec3 color=body+glow*(1.-surface.a*.85);
 // Canvas uses premultiplied alpha. RGB beyond opacity became white specks on release.
 if(alpha<.001){outColor=vec4(0.);return;}
 outColor=vec4(min(max(color,vec3(0.)),vec3(alpha)),alpha);
}`;

export function createAgentRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;
  const hdr = !!gl.getExtension("EXT_color_buffer_float");
  const programs: WebGLProgram[] = [],
    shaders: WebGLShader[] = [];
  const program = (v: string, f: string) => {
    const p = gl.createProgram()!;
    for (const [type, text] of [
      [gl.VERTEX_SHADER, v],
      [gl.FRAGMENT_SHADER, f],
    ] as const) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, text);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? "Shader");
      shaders.push(s);
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p) ?? "Shader link");
    programs.push(p);
    return p;
  };
  const mesh = program(vertex, fragment),
    blur = program(postVertex, blurFragment),
    composite = program(postVertex, compositeFragment);
  const locations = (p: WebGLProgram, names: string[]) =>
    Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
  const u = locations(mesh, [
    "uResolution",
    "uOrigin",
    "uPull",
    "uVelocity",
    "uFrom",
    "uTo",
    "uTime",
    "uMorph",
    "uEnergy",
    "uBurst",
    "uProgress",
    "uWidth",
    "uReturning",
    "uPhase",
    "uRoot",
    "uTail",
    "uDrain",
    "uTransport",
    "uMode",
    "uLayer",
    "uFeedback",
    "uArrival",
    "uHost",
    "uNormal",
    "uOccluders[0]",
    "uOccluderCount",
    "uEntry",
    "uCrawl",
    "uBound",
    "uBeat",
    "uBite",
    "uLoss",
    "uSever",
    "uGesture",
    "uAction",
    "uSeed",
    "uExtent",
    "uImpact",
    "uOpacity",
    "uLanding",
    "uBirthTime",
    "uBirthFlow",
    "uPoseBlend",
    "uPreviousPose",
    "uShellOffset",
    "uPreviousSeed",
    "uTransportCover",
    "uCarryProgress",
    "uSide",
    "uSelection",
    "uWithdraw",
    "uHighlight",
    "uCarrier",
  ]);
  const ub = locations(blur, ["uImage", "uStep"]),
    uc = locations(composite, ["uBase", "uGlow", "uEmission", "uResolution", "uMorph", "uTime"]);
  const vao = gl.createVertexArray()!,
    buffer = gl.createBuffer()!,
    indexBuffer = gl.createBuffer()!;
  const grid: number[] = [],
    indices: number[] = [],
    segments = 112,
    cross = 20;
  for (let i = 0; i <= segments; i++)
    for (let j = 0; j <= cross; j++)
      grid.push(i / segments, (j / cross) * 2 - 1);
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < cross; j++) {
      const a = i * (cross + 1) + j,
        b = a + cross + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(grid), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW,
  );
  const attribute = gl.getAttribLocation(mesh, "aUv");
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  const quadVao = gl.createVertexArray()!, quadBuffer = gl.createBuffer()!;
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,-1,1,-1,0,1,1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  // The perimeter needs finer arc sampling, but only two cross-strip vertices.
  const rimVao = gl.createVertexArray()!, rimBuffer = gl.createBuffer()!, rimIndex = gl.createBuffer()!;
  const rimGrid: number[] = [], rimIndices: number[] = [];
  for (let i=0;i<=384;i++) { rimGrid.push(i/384,-1,i/384,1); if(i<384){const a=i*2;rimIndices.push(a,a+2,a+1,a+1,a+2,a+3);} }
  gl.bindVertexArray(rimVao);
  gl.bindBuffer(gl.ARRAY_BUFFER,rimBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(rimGrid),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,rimIndex);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(rimIndices),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  const drawSurface = (mode: number) => {
    gl.uniform1i(u.uMode, mode);
    const flat = mode === 2 || mode === 3 || mode === 7 || mode === 8 || mode === 9;
    gl.bindVertexArray(flat ? quadVao : mode === 5 ? rimVao : vao);
    if (flat) gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    else gl.drawElements(gl.TRIANGLES,mode === 5 ? rimIndices.length : indices.length,gl.UNSIGNED_SHORT,0);
  };
  const textures: WebGLTexture[] = [],
    framebuffers: WebGLFramebuffer[] = [];
  const texture = () => {
    const t = gl.createTexture()!;
    textures.push(t);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const color = texture(),
    light = texture(),
    ping = texture(),
    pong = texture();
  const framebuffer = (ts: WebGLTexture[]) => {
    const f = gl.createFramebuffer()!;
    framebuffers.push(f);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    ts.forEach((t, i) =>
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + i,
        gl.TEXTURE_2D,
        t,
        0,
      ),
    );
    gl.drawBuffers(ts.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    return f;
  };
  const scene = framebuffer([color, light]),
    pingFbo = framebuffer([ping]),
    pongFbo = framebuffer([pong]);
  let width = 0,
    height = 0,
    previous = { x: 0, y: 0, w: 0, h: 0 };
  const bind = (t: WebGLTexture, unit: number) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
  };
  const allocate = (t: WebGLTexture, w: number, h: number, high: boolean) => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      high && hdr ? gl.RGBA16F : gl.RGBA8,
      w,
      h,
      0,
      gl.RGBA,
      high && hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null,
    );
  };
  return {
    render(s: EnergyScene, time: number, quality: number) {
      const cursorOnly=s.morph<.12&&s.links.length===0;
      const dpr = cursorOnly?Math.max(2,Math.min(devicePixelRatio||1,2.5)):Math.min(devicePixelRatio || 1, quality);
      const w = Math.round(innerWidth * dpr),
        h = Math.round(innerHeight * dpr);
      if (width !== w || height !== h) {
        width = w;
        height = h;
        canvas.width = w;
        canvas.height = h;
        allocate(color, w, h, false);
        allocate(light, w, h, true);
        allocate(ping, Math.ceil(w / 2), Math.ceil(h / 2), true);
        allocate(pong, Math.ceil(w / 2), Math.ceil(h / 2), true);
      }
      let x0 = s.x - 95,
        y0 = s.y - 95,
        x1 = s.x + 155,
        y1 = s.y + 145;
      for (const link of s.links) {
        x0 = Math.min(x0, link.host[0] - 150);
        y0 = Math.min(y0, link.host[1] - 150);
        x1 = Math.max(x1, link.host[0] + link.host[2] + 150);
        y1 = Math.max(y1, link.host[1] + link.host[3] + 150);
      }
      const bounds = {
        x: Math.max(0, Math.floor(x0 * dpr)),
        y: Math.max(0, Math.floor((innerHeight - y1) * dpr)),
        w: Math.min(w, Math.ceil((x1 - x0) * dpr)),
        h: Math.min(h, Math.ceil((y1 - y0) * dpr)),
      };
      const scissor = (r: typeof bounds, half = false) => {
        const k = half ? 0.5 : 1;
        gl.scissor(
          Math.floor(r.x * k),
          Math.floor(r.y * k),
          Math.ceil(r.w * k),
          Math.ceil(r.h * k),
        );
      };
      gl.enable(gl.SCISSOR_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      scissor(previous);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!s.core && !s.links.length) {
        previous = { x: 0, y: 0, w: 0, h: 0 };
        return;
      }
      previous = bounds;
      scissor(bounds);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene);
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(mesh);
      gl.bindVertexArray(vao);
      gl.uniform2f(u.uResolution, innerWidth, innerHeight);
      gl.uniform2f(u.uOrigin, s.x, s.y);
      gl.uniform2f(u.uPull, ...s.pull);
      gl.uniform2f(u.uVelocity, ...s.velocity);
      gl.uniform2f(u.uShellOffset,...s.shellOffset);
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uMorph, s.morph);
      gl.uniform1f(u.uEnergy, s.energy);
      gl.uniform1f(u.uBurst, s.burst);
      gl.uniform1f(u.uDrain, s.drain);
      gl.uniform1f(u.uTransport, s.transport);
      gl.uniform1f(u.uLayer, 0);
      gl.uniform1f(u.uFeedback, 0);
      gl.uniform1f(u.uRoot, 0);
      gl.uniform1f(u.uLoss, 0);
      for (const link of s.links) {
        gl.uniform1i(u.uMode, 1);
        gl.uniform1f(u.uGesture, link.gesture);
        gl.uniform1f(u.uAction, link.action);
        gl.uniform1f(u.uSeed, link.seed);
        gl.uniform1f(u.uExtent, link.extent);
        gl.uniform1f(u.uImpact, link.impact);
        gl.uniform1f(u.uTransportCover,link.transport);
        gl.uniform1f(u.uCarryProgress,link.transportProgress);
        gl.uniform1f(u.uSide,link.side);
        gl.uniform1f(u.uSelection,link.selection?1:0);
        gl.uniform1f(u.uWithdraw,link.withdrawing?1:0);
        gl.uniform1f(u.uHighlight,link.highlight??link.opacity);
        gl.uniform4f(u.uCarrier,...link.carrier);
        gl.uniform1f(u.uOpacity,link.opacity);
        gl.uniform1f(u.uLanding,link.landing);
        gl.uniform1f(u.uBirthTime,link.birthTime);
        gl.uniform1f(u.uBirthFlow,link.birthFlow);
        gl.uniform1f(u.uPoseBlend,link.poseBlend);
        gl.uniform4f(u.uPreviousPose,...link.previousPose);
        gl.uniform1f(u.uPreviousSeed,link.previousSeed);
        gl.uniform1f(u.uLayer, link.layer);
        gl.uniform1f(u.uLoss, s.depletion[link.layer]);
        gl.uniform2f(u.uFrom, ...link.from);
        gl.uniform2f(u.uTo, ...link.to);
        gl.uniform1f(u.uProgress, link.progress);
        gl.uniform1f(u.uWidth, link.width);
        gl.uniform1f(u.uReturning, link.returning);
        gl.uniform1f(u.uPhase, link.phase);
        gl.uniform1f(u.uRoot, link.root);
        gl.uniform1f(u.uTail, link.tail);
        gl.uniform1f(u.uFeedback, link.feedback);
        gl.uniform1f(u.uEntry, link.entry);
        gl.uniform1f(u.uCrawl, link.crawl);
        gl.uniform1f(u.uBound, link.bound);
        gl.uniform1f(u.uBeat, link.beat);
        gl.uniform1f(u.uSever, link.sever);
        gl.uniform1f(u.uBite, link.bite);
        gl.uniform4f(u.uHost, ...link.host);
        gl.uniform1f(u.uArrival, link.arrival);
        gl.uniform2f(u.uNormal, ...link.normal);
        gl.uniform1i(u.uOccluderCount, link.occluders.length);
        if (link.occluders.length) gl.uniform4fv(u["uOccluders[0]"], link.occluders.flat());
        // Transport deforms the actual DOM window skin; no painted carrier strip.
        if(link.opacity>.001 && link.progress>.0001){
          const merging=link.gesture===7 && !link.budding;
          if(merging){
            gl.uniform4f(u.uHost,...link.impactHost);
            gl.uniform1i(u.uOccluderCount,link.impactOccluders.length);
            if(link.impactOccluders.length)gl.uniform4fv(u["uOccluders[0]"],link.impactOccluders.flat());
          }

          if(link.landing<.999)drawSurface(1);
          if(link.landing>.001 && [5,8].includes(link.gesture))drawSurface(9);
          if(link.landing>.001 && link.gesture===0)drawSurface(1);
          if(merging){
            gl.uniform4f(u.uHost,...link.host);
            gl.uniform1i(u.uOccluderCount,link.occluders.length);
            if(link.occluders.length)gl.uniform4fv(u["uOccluders[0]"],link.occluders.flat());
          }
        }
        if (link.impact >= 0 && link.impact < 1.45) {
          gl.uniform4f(u.uHost, ...link.impactHost);
          gl.uniform1i(u.uOccluderCount, link.impactOccluders.length);
          if (link.impactOccluders.length) gl.uniform4fv(u["uOccluders[0]"], link.impactOccluders.flat());
          drawSurface(7);
          gl.uniform4f(u.uHost, ...link.host);
          gl.uniform1i(u.uOccluderCount, link.occluders.length);
          if (link.occluders.length) gl.uniform4fv(u["uOccluders[0]"], link.occluders.flat());
        }
        if (link.arrival > .001 && (link.highlight??link.opacity)>.001) {
          drawSurface(3);
          // Keep the original surface crawl after the separate depth approach.
          if(link.selection && link.crawl>0. && link.crawl<1.)drawSurface(5);
        }
      }
      if (s.core) {
        gl.uniform1i(u.uMode, 0);
        gl.uniform1f(u.uReturning, 0);
        gl.uniform1f(u.uPhase, 0);
        gl.uniform1f(u.uFeedback, s.drain);
        gl.uniform1f(u.uSelection,0.);
        gl.uniform1f(u.uWithdraw,0.);
        gl.uniform1f(u.uOpacity,1.);
        gl.uniform1f(u.uLanding,0.);
        // The 17:22 core had no enclosing bubble. Keep the restored folds unobstructed.
        // Ordered optical layers, each with its own folds and travelling reveal masks.
        const layers = s.morph < 0.001 ? 1 : 3;
        for (let layer = layers - 1; layer >= 0; layer--) {
          gl.uniform1f(u.uLayer, layer);
          gl.uniform1f(u.uLoss, s.depletion[layer]);
          gl.uniform1f(u.uRoot, s.roots[layer]);
          drawSurface(0);
        }
      }
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
      gl.useProgram(blur);
      gl.uniform1i(ub.uImage, 0);
      gl.viewport(0, 0, Math.ceil(w / 2), Math.ceil(h / 2));
      scissor(bounds, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pingFbo);
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
      bind(light, 0);
      gl.uniform2f(ub.uStep, 3.8 / w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pongFbo);
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
      bind(ping, 0);
      gl.uniform2f(ub.uStep, 0, 3.8 / h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      scissor(bounds);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(composite);
      bind(color, 0);
      bind(pong, 1);
      bind(light, 2);
      gl.uniform1i(uc.uBase, 0);
      gl.uniform1i(uc.uGlow, 1);
      gl.uniform1i(uc.uEmission, 2);
      gl.uniform2f(uc.uResolution, w, h);
      gl.uniform1f(uc.uMorph, s.morph);
      gl.uniform1f(uc.uTime, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteBuffer(rimBuffer);
      gl.deleteBuffer(rimIndex);
      gl.deleteVertexArray(rimVao);
      gl.deleteBuffer(quadBuffer);
      gl.deleteVertexArray(quadVao);
      gl.deleteBuffer(buffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteVertexArray(vao);
      for (const p of programs) gl.deleteProgram(p);
      for (const s of shaders) gl.deleteShader(s);
      for (const t of textures) gl.deleteTexture(t);
      for (const f of framebuffers) gl.deleteFramebuffer(f);
    },
  };
}
