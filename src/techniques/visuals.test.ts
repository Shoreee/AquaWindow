import {describe,it,expect} from 'vitest';
import {computeVisuals} from './visuals';
import {BASELINE} from './techniques';
import type {KernelState,WindowState} from '../kernel/types';
const windowState=(id:string,x:number,importance:WindowState['importance']=[]):WindowState=>({id,appId:'writer',title:id,rect:{x,y:80,w:500,h:450},depth:0,minimized:false,maximized:false,form:'normal',role:'primary',importance,props:{},createdAt:0,lastFocusedAt:0});
const scene=(back:WindowState,front:WindowState):KernelState=>({windows:{back,front},order:['back','front'],focusedId:'front',screen:{w:1440,h:900},rev:0});
describe('explicit region compositing without automatic yielding',()=>{
 it('keeps overlapping windows intact even when a legacy condition requests yielding',()=>{
  const back=windowState('back',80),front=windowState('front',440),state=scene(back,front);
  const result=computeVisuals({state,tech:{...BASELINE,yield:'deform'},activeId:'front'});
  expect(result.back.dented).toBe(false);expect(result.back.yieldScale).toBeUndefined();expect(result.back.clipPath).toBeUndefined();
 });
 it('does not punch automatic holes for app-provided default importance',()=>{
  const state=scene(windowState('back',80,[{id:'caret',x:.1,y:.1,w:.8,h:.6,weight:1}]),windowState('front',100));
  expect(computeVisuals({state,tech:{...BASELINE,cutout:true},activeId:null}).front.holes).toEqual([]);
 });
 it('distinguishes preserved content beneath an occluder from a direct hole',()=>{
  const keep={id:'marked:keep',x:.1,y:.1,w:.6,h:.5,weight:1},hole={id:'marked:hole',x:.7,y:.6,w:.2,h:.2,weight:1,kind:'hole' as const};
  const state=scene(windowState('back',80,[keep]),windowState('front',100,[hole]));
  const result=computeVisuals({state,tech:{...BASELINE,cutout:true},activeId:null});
  expect(result.back.holes).toEqual([]);
  expect(result.front.holes.map(h=>[h.ownerId,h.regionId])).toEqual([['front','marked:hole'],['back','marked:keep']]);
  expect(result.front.maskImage).toContain('data:image/svg+xml');
 });
});
