import {describe,it,expect} from 'vitest';
import {WindowKernel} from '../../kernel/kernel';
import {extractCapsuleState} from './capsuleState';
import {capsuleSize,capsuleOverstretch} from './capsuleGeometry';
import type {CapsuleSnapshot} from './types';
function setup(){
 const k=new WindowKernel();const first=k.open({appId:'writer',title:'notes',rect:{x:200,y:80,w:500,h:500},props:{docId:'draft',edited:'keep'}}),second=k.open({appId:'preview',title:'paper',rect:{x:40,y:60,w:500,h:550},props:{paperId:'2403.11872'}});
 const base=k.getState(),snapshot:CapsuleSnapshot={title:'session',members:[base.windows[first],base.windows[second]],order:base.order,focusedId:first,scroll:{[first]:87,[second]:92}};
 k.previewState({...base,windows:{...base.windows,[first]:{...base.windows[first],form:'capsule',capsuleRect:{x:600,y:80,...capsuleSize(2)},props:{...base.windows[first].props,agentCapsule:snapshot}},[second]:{...base.windows[second],minimized:true}}});
 return {k,first,second};
}
describe('segmented session capsule',()=>{
 it('grows per page and permits ordinary resizing before rupture',()=>{
  expect(capsuleSize(3).w).toBeGreaterThan(capsuleSize(2).w);expect(capsuleSize(3).w).toBeLessThan(290);
  expect(capsuleOverstretch({x:0,y:0,...capsuleSize(3)},3)).toBeLessThan(1);
  expect(capsuleOverstretch({x:0,y:0,w:500,h:240},3)).toBeGreaterThan(1);
 });
 it('can take out the original host without losing the remaining container or content',()=>{
  const {k,first,second}=setup(),old=k.get(first).capsuleRect!;
  const split=extractCapsuleState(k.getState(),first,first)!;
  expect(split.carrierId).not.toBe(first);expect(split.state.windows[first].form).toBe('normal');
  expect(split.state.windows[first].props.edited).toBe('keep');expect(split.state.windows[first].props.restoreScroll).toBe(87);
  const carrier=split.state.windows[split.carrierId!];expect((carrier.props.agentCapsule as CapsuleSnapshot).members.map(w=>w.id)).toEqual([second]);expect(carrier.capsuleRect!.w).toBeLessThan(old.w);
  expect(new Set(split.state.order).size).toBe(split.state.order.length);
  const last=extractCapsuleState(split.state,carrier.id,second)!;
  expect(last.carrierId).toBeUndefined();expect(Object.values(last.state.windows).filter(w=>w.form==='capsule')).toHaveLength(0);
  expect(last.state.windows[second].props.restoreScroll).toBe(92);
 });
});
