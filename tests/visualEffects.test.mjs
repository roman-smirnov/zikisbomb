import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visualEffects} from '../src/visualEffects.ts';
const fx=(phase='playing',remaining=60000,now=0,entered=0,denied=-Infinity,reduced=false)=>visualEffects(phase,remaining,now,entered,denied,reduced);
test('strict countdown thresholds fade in smoothly and terminal phases stop warnings',()=>{
 assert.equal(fx('playing',60000).warning,0);assert.equal(fx('playing',30000).warning,0);
 assert.equal(fx('playing',29000).warning,.5);assert.equal(fx('playing',28000).warning,1);
 assert.equal(fx('playing',30000).stage,'normal');assert.equal(fx('playing',29999).stage,'amber');
 assert.equal(fx('playing',29000).amber,.5);assert.equal(fx('playing',28000).amber,1);
 assert.equal(fx('playing',10000).stage,'amber');assert.equal(fx('playing',9999).stage,'critical');
 assert.equal(fx('playing',9250).critical,.5);assert.equal(fx('playing',8500).critical,1);
 for(const phase of ['ready','intro','success','failureTransition','missionFailed','educationalReveal'])assert.equal(fx(phase,0).warning,0);
});
test('camera jolt expires, rejects future timestamps and clears on success',()=>{
 for(const now of [0,1000,5000]){assert.equal(fx('playing',60000,now,0,now+1).denied,0);assert.equal(fx('playing',60000,now).jolt,0);}
 assert.equal(fx('incorrectFeedback',30000,325,0,0).denied,0);
 assert.ok(fx('incorrectFeedback',30000,100,0,0).jolt>0);
 assert.equal(fx('incorrectFeedback',30000,360,0,0).jolt,0);
 assert.equal(fx('playing',30000,650,0,0).denied,0);
 assert.equal(fx('success',30000,100,0,0).denied,0);
 assert.ok(fx('failureTransition',0,100,0,0).jolt>0);
});
test('rejection and defusal surface effects stay off throughout their former envelopes',()=>{
 for(const now of [0,100,325,550,650,1100,1300])for(const phase of ['incorrectFeedback','failureTransition','success']){
  const v=fx(phase,30000,now,0,0);assert.equal(v.denied,0);assert.equal(v.success,0);
 }
 assert.deepEqual(fx('playing',5000,1234),fx('playing',5000,1234));
});
test('reduced motion keeps warning colors but removes moving beams and camera jolt',()=>{
 const v=fx('incorrectFeedback',5000,100,0,0,true);
 assert.equal(v.sweep,0);assert.equal(v.pulse,.5);assert.equal(v.jolt,0);assert.equal(v.denied,0);
 assert.equal(fx('success',5000,550,0,0,true).success,0);
});

test('rejection flash is brief, bounded, terminal-safe and gentler under reduced motion',()=>{
 assert.equal(fx('incorrectFeedback',40000,20,0,0).rejectionFlash,1);
 assert.equal(fx('incorrectFeedback',40000,110,0,0).rejectionFlash,.5);
 for(const age of [-1,200,1000])assert.equal(fx('incorrectFeedback',40000,age,0,0).rejectionFlash,0);
 for(const phase of ['ready','intro','success','missionFailed','educationalReveal'])assert.equal(fx(phase,0,20,0,0).rejectionFlash,0);
 assert.equal(fx('failureTransition',0,20,0,0).rejectionFlash,1);
 assert.equal(fx('incorrectFeedback',40000,20,0,0,true).rejectionFlash,.35);
 assert.equal(fx('playing',40000,100).rejectionFlash,0);
});

test('defusal flash is a single green-light envelope with no jolt or stale rejection',()=>{
 for(const [age,level] of [[-1,0],[0,0],[20,1],[110,.5],[200,0],[1200,0]]){
  const v=fx('success',40000,1000+age,1000,900);
  assert.equal(v.defusalFlash,level);assert.equal(v.rejectionFlash,0);assert.equal(v.jolt,0);
 }
 for(const phase of ['ready','intro','playing','incorrectFeedback','failureTransition','missionFailed','educationalReveal'])assert.equal(fx(phase,40000,20,0,0).defusalFlash,0);
 assert.equal(fx('success',40000,20,0,0,true).defusalFlash,.35);
});
