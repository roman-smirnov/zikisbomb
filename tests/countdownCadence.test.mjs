import {test} from 'node:test';import assert from 'node:assert/strict';
import {countdownInterval} from '../src/soundPalette.ts';
test('beep cadence stretches with round duration and keeps the same boundary ordering',()=>{
 for(const duration of [60000,90000]){
  assert.equal(countdownInterval(duration,duration),1200);
  assert.equal(countdownInterval(duration/2+1,duration),1200);
  assert.equal(countdownInterval(duration/2,duration),850);
  assert.equal(countdownInterval(duration/4,duration),500);
  assert.equal(countdownInterval(duration/12,duration),250);
  assert.equal(countdownInterval(0,duration),250);
 }
});
