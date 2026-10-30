import {describe,it,expect} from 'vitest';
import {fusionPlacement,seamGeometry,splitProgress,surfaceComponent,type SurfaceBond} from './surfaceBondGeometry';
import type {KernelState,WindowState} from '../kernel/types';
describe('surface tension bonds',()=>{
 it('places a window against an edge without changing either size',()=>{
  const moving={x:777,y:120,w:550,h:610},fixed={x:150,y:63,w:580,h:650},work={x:8,y:36,w:1424,h:778};
  const next=fusionPlacement(moving,fixed,work);expect(next.axis).toBe('x');expect(next.rect.x-fixed.x-fixed.w).toBe(4);expect(next.rect.w).toBe(moving.w);expect(next.rect.h).toBe(moving.h);
  expect(seamGeometry(fixed,next.rect,'x').length).toBeGreaterThan(400);
 });
 it('never treats an almost completed opening as reaching the endpoint',()=>{
  expect(splitProgress(599,100,600,false)).toBeLessThan(1);expect(splitProgress(600,100,600,false)).toBe(1);
  expect(splitProgress(101,100,600,true)).toBeLessThan(1);expect(splitProgress(100,100,600,true)).toBe(1);
 });
 it('finds the two independent sides after removing a bond from a group',()=>{
  const ab:SurfaceBond={id:'ab',a:'a',b:'b',axis:'x',createdAt:0},bc:SurfaceBond={id:'bc',a:'b',b:'c',axis:'x',createdAt:0};
  const win=(id:string,bonds:SurfaceBond[])=>({id,appId:'writer',title:id,rect:{x:0,y:0,w:300,h:300},depth:0,role:'primary',createdAt:0,lastFocusedAt:0,maximized:false,form:'normal',minimized:false,importance:[],props:{surfaceBonds:bonds}} as WindowState);
  const state={windows:{a:win('a',[ab]),b:win('b',[ab,bc]),c:win('c',[bc])}} as unknown as KernelState;
  expect(surfaceComponent(state,'a').sort()).toEqual(['a','b','c']);expect(surfaceComponent(state,'b','ab').sort()).toEqual(['b','c']);
 });
});
