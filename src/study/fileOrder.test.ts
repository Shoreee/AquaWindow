import {expect,it} from 'vitest';
import {fileCandidateOrder} from './fileOrder';
it('uses the same four candidates with reproducible placement independent of layout',()=>{
 const order=fileCandidateOrder('task2','P01');expect(new Set(order)).toEqual(new Set(['task2-a','task2-b','task2-c','task2-d']));expect(order).toEqual(fileCandidateOrder('task2','P01'));
});
it('does not always put the correct file first across participants',()=>{
 const positions=Array.from({length:10},(_,i)=>fileCandidateOrder('task2',`P${i+1}`).indexOf('task2-a'));
 expect(new Set(positions).size).toBeGreaterThan(1);
});
