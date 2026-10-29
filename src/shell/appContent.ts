import type {WindowState} from '../kernel/types';

const presentation=new Set(['agentMotion','agentQueue','agentDivision','agentView','agentBond','agentRevealProgress','agentRevealExit','agentRevealClosure','agentCapsule','agentRelease','agentReentry']);
/** Layout frames must not invalidate document trees. App edits and grouping remain live. */
export function sameAppContent(a:WindowState,b:WindowState){
  if(a.id!==b.id||a.appId!==b.appId||a.title!==b.title||a.group!==b.group||a.role!==b.role||a.openedFrom!==b.openedFrom)return false;
  if(a.props===b.props)return true;
  const keys=new Set([...Object.keys(a.props),...Object.keys(b.props)]);
  for(const key of keys)if(!presentation.has(key)&&!Object.is(a.props[key],b.props[key]))return false;
  return true;
}
