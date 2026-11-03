import {cancelSurfaceInteraction} from '../shell/surfaceFusion';
import {cancelCapsuleMotion} from '../agent/adaptive/capsule';
import {cancelManualWindowMotion} from '../agent/adaptive/manualMotion';
import {adaptation} from '../agent/adaptive/runtime';
import {agent} from '../system';
import {log} from './logger';
import {ui} from '../system/ui';
import {studyTechniques,type StudyInteractionModeId} from './interactionModes';
export function selectStudyMode(mode:StudyInteractionModeId|null){
 cancelSurfaceInteraction();cancelCapsuleMotion();cancelManualWindowMotion();adaptation.cancel(true);agent.stop();
 ui.set({studyMode:mode,tech:ui.get().studyEnvironment==='files'?{...studyTechniques(mode),depth:true,periphery:true}:studyTechniques(mode),agentEnabled:false,autonomy:'off'});
 log({src:'study',type:'technique.select',data:{mode}});
}
