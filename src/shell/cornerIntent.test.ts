import {expect,it} from 'vitest';
import {cornerIntent,cornerMetrics} from './cornerIntent';
it('reserves the outside edge for resize and the inner corner for peel',()=>{
 expect(cornerIntent(384,284,400,300)).toEqual({kind:'peel',corner:[400,300]});
 expect(cornerIntent(398,298,400,300).kind).toBe('resize');
 expect(cornerIntent(404,304,400,300).kind).toBe('resize');
 expect(cornerIntent(200,150,400,300).kind).toBe('none');
 expect(cornerIntent(16,16,400,300)).toEqual({kind:'peel',corner:[0,0]});
});
it('scales the hint with the real window dimensions',()=>{
 expect(cornerMetrics(240,180).preview).toBeLessThan(cornerMetrics(600,500).preview*.5);
 expect(cornerMetrics(240,180).radius).toBeLessThan(cornerMetrics(600,500).radius);
});
