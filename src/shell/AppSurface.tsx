import {memo} from 'react';
import {APPS} from '../apps/registry';
import type {WindowState} from '../kernel/types';
import {sameAppContent} from './appContent';
export const AppSurface=memo(function AppSurface({win,peripheral}:{win:WindowState;peripheral:boolean}){
  const App=APPS[win.appId]?.Component;
  return App?<App win={win} peripheral={peripheral}/>:<div className="empty">Unknown app {win.appId}</div>;
},(a,b)=>a.peripheral===b.peripheral&&sameAppContent(a.win,b.win));

