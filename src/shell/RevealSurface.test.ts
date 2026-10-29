import {describe,it,expect} from 'vitest';
import {revealContour} from './revealGeometry';
import type {AgentView} from '../agent/adaptive/types';
const view={revealMode:'hole',edge:'right',extent:.32,revealRegion:{x:.25,y:.3,w:.5,h:.4}} as AgentView;
describe('transparent reveal contours',()=>{
 it('never produces invalid geometry while opening or closing either kind of reveal',()=>{
  for(const mode of ['hole','edge'] as const)for(let p=0;p<=1;p+=.1)for(let a=0;a<=1;a+=.1){
   const geometry=revealContour({view:{...view,revealMode:mode},width:550,height:600,progress:p,closure:{edge:'left',amount:a}},3.2);
   expect(geometry.path).not.toMatch(/NaN|Infinity/);
  }
  expect(revealContour({view,width:550,height:600,progress:1,closure:{edge:'left',amount:1}},0).active).toBe(false);
 });
 it('keeps the central opening rectangular with long near-straight sides and rounded corners',()=>{
  const g=revealContour({view,width:550,height:600,progress:1},.5);
  expect(g.path).toContain('Q');expect(g.rimPath).toBe(g.path);
  const coordinates=[...g.path.matchAll(/Q([\d.-]+) ([\d.-]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);
  const top=coordinates.filter(q=>q[0]>190&&q[0]<360&&q[1]<190);
  expect(top.length).toBeGreaterThan(8);expect(Math.max(...top.map(q=>q[1]))-Math.min(...top.map(q=>q[1]))).toBeLessThan(8);
 });
 it('opens an edge reveal through the outside corner instead of rounding it into an enclosed hole',()=>{
  const geometry=revealContour({view:{...view,revealMode:'edge'},width:550,height:600,progress:1},.5);
  const coordinates=[...geometry.path.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);
  expect(coordinates.some(q=>q[0]>550&&q[1]<0)).toBe(true);
  expect(geometry.rh).toBeLessThan(600/2);expect(geometry.rimPath.endsWith('Z')).toBe(false);
 });
 it('moves the dragged boundary while preserving the opposite edge of a central opening',()=>{
  const base={view,width:550,height:600,progress:1};
  const before=revealContour(base,0),after=revealContour({...base,closure:{edge:'left',amount:.5}},0);
  expect(after.handles[1][0]).toBe(before.handles[1][0]);expect(after.rw).toBe(before.rw/2);
  expect(after.handles[0][0]).toBeGreaterThan(Number(before.handles[0][0]));
 });
});
