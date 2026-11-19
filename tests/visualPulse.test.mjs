import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visualPulse} from '../src/visualPulse.ts';
test('old-round and future scheduled timestamps cannot overexpose the display',()=>{
 for(const timestamp of [100,5000,60000,Infinity,-Infinity,NaN])assert.equal(visualPulse(0,timestamp,100),0);
 assert.equal(visualPulse(500,550,100),0);
});
test('pulse decays within its intended bounds and expires',()=>{
 assert.equal(visualPulse(500,500,100),1);assert.equal(visualPulse(550,500,100),.5);assert.equal(visualPulse(600,500,100),0);assert.equal(visualPulse(700,500,100),0);
 for(let age=-1000;age<1000;age++){const pulse=visualPulse(1000+age,1000,100);assert.ok(pulse>=0&&pulse<=1);}
});
