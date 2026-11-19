/** A scheduled or previous-round timestamp must never amplify an emissive pulse. */
export function visualPulse(now:number, timestamp:number, duration:number):number {
  const age=now-timestamp;
  if(!Number.isFinite(age)||duration<=0||age<0||age>=duration)return 0;
  return 1-age/duration;
}
