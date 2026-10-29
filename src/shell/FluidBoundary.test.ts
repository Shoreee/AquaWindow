import {describe,it,expect} from 'vitest';
import {leadingEdges,boundaryEnvelope,fluidGeometry} from './FluidBoundary';
import type {AgentMotion} from '../agent/adaptive/choreography';
describe('a window skin under tension',()=>{
 it('pulls only the leading side or its adjacent pair, never opposite edges',()=>{
   expect(leadingEdges([1,0])).toEqual(['right']);
   expect(leadingEdges([-.7,-.8])).toEqual(['left','top']);
   expect(leadingEdges([.1,-1])).toEqual(['top']);
   expect(leadingEdges([0,0],'bottom')).toEqual(['bottom']);
   for(let a=0;a<6.28;a+=.05)expect(leadingEdges([Math.cos(a),Math.sin(a)]).length).toBeLessThanOrEqual(2);
 });
 it('relaxes the actual boundary before its operation is replaced',()=>{
   const motion={primitive:'arrange',transport:{active:true,progress:0}} as AgentMotion;
   expect(boundaryEnvelope(motion)).toBe(0);
   expect(boundaryEnvelope({...motion,transport:{active:true,progress:.5,coverage:1}})).toBe(1);
   expect(boundaryEnvelope({...motion,transport:{active:true,progress:1,coverage:0}})).toBe(0);
 });
 it('uses a finite vector silhouette with tension reaching past the corner',()=>{
   const motion={primitive:'yield',edge:'right',direction:[1,0],elapsed:.3,action:.5,transport:{active:false,progress:.5,coverage:1}} as AgentMotion;
   const result=fluidGeometry(500,400,motion)!;
   expect(result.clipPath.startsWith("path('")).toBe(true);
   expect(result.clipPath).not.toMatch(/NaN|Infinity/);
   expect(result.points.every(p=>p.x>-12&&p.x<512&&p.y>-12&&p.y<412)).toBe(true);
   expect(result.points.some(p=>p.x>440&&p.y<0)).toBe(true);
   expect(result.points.filter(p=>p.x<30&&p.y>30&&p.y<370).every(p=>Math.abs(p.x)<.01)).toBe(true);
   expect(fluidGeometry(500,400,{...motion,transport:{active:true,progress:1,coverage:0}})).toBeUndefined();
 });

 it('keeps a carried window free of yielding waves',()=>{
  const motion={primitive:'arrange',edge:'right',direction:[1,1],elapsed:.5,action:.5,transport:{active:true,coverage:1,progress:.5}} as AgentMotion;
  const geometry=fluidGeometry(500,400,motion)!;
  expect(geometry.carrying).toBe(true);
  expect(geometry.points.every(p=>p.x>=0&&p.x<=500&&p.y>=0&&p.y<=400)).toBe(true);
 });
 it('lets a yielding left edge ripple only inward, leaving the opposite edge at rest',()=>{
  const motion={primitive:'yield',edge:'left',direction:[1,0],elapsed:.3,action:.5,transport:{active:false,progress:.5,coverage:0}} as AgentMotion;
  for(let t=0;t<2;t+=.13){const points=fluidGeometry(500,400,{...motion,elapsed:t})!.points;
   const active=points.filter(p=>p.x<30&&p.y>30&&p.y<370),opposite=points.filter(p=>p.x>490&&p.y>30&&p.y<370);
   expect(active.length).toBeGreaterThan(5);expect(active.every(p=>p.x>=0)).toBe(true);
   expect(opposite.every(p=>Math.abs(p.x-500)<.01)).toBe(true);
  }
 });

});
