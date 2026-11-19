import type { Phase } from './game.ts';

export const CAMERA_JOLT_MS = 360;
export const REJECTION_FLASH_MS = 200;
export const DEFUSAL_FLASH_MS = 200;
const clamp = (n:number) => Math.max(0,Math.min(1,n));

/** All effects use the paused game clock, including one-shot envelopes. */
export function visualEffects(phase:Phase, remaining:number, now:number, entered:number, deniedAt:number, reducedMotion=false) {
  const active=phase==='playing'||phase==='incorrectFeedback';
  const stage=phase==='success'?'defused':!active?'idle':remaining<10000?'critical':remaining<30000?'amber':'normal';
  const amber=active?clamp((30000-remaining)/2000):0;
  const critical=active?clamp((10000-remaining)/1500):0;
  const pulse=reducedMotion?.5:(1-Math.cos(now*Math.PI*2/1800))/2;
  const deniedAge=now-deniedAt;
  const rejectionFlash=(active||phase==='failureTransition')&&deniedAge>=0&&deniedAge<REJECTION_FLASH_MS
    ?(deniedAge<20?deniedAge/20:1-(deniedAge-20)/(REJECTION_FLASH_MS-20))*(reducedMotion?.35:1):0;
  const successAge=now-entered;
  const defusalFlash=phase==='success'&&successAge>=0&&successAge<DEFUSAL_FLASH_MS
    ?(successAge<20?successAge/20:1-(successAge-20)/(DEFUSAL_FLASH_MS-20))*(reducedMotion?.35:1):0;
  const jolt=!reducedMotion&&deniedAge>=0&&deniedAge<CAMERA_JOLT_MS&&(active||phase==='failureTransition')
    ?Math.pow(1-deniedAge/CAMERA_JOLT_MS,2):0;
  return {stage,amber,critical,pulse,warning:amber,sweep:reducedMotion?0:Math.sin(now*Math.PI*2/6500),
    jolt,rejectionFlash,defusalFlash,denied:0,deniedProgress:0,success:0,successProgress:0};
}
