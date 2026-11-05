import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldAutoRefresh,AUTO_REFRESH_MS} from './refresh-policy.mjs';
test('leaving the dashboard open never dispatches periodic workflows by default',()=>{
 assert.equal(shouldAutoRefresh({now:86400000}),false);
});
test('an explicit opt-in waits five minutes and only runs while visible and idle',()=>{
 const f={enabled:true,lastRefresh:1000};
 assert.equal(shouldAutoRefresh({...f,now:1000+AUTO_REFRESH_MS-1}),false);
 assert.equal(shouldAutoRefresh({...f,now:1000+AUTO_REFRESH_MS}),true);
 for(const state of [{hidden:true},{busy:true},{enabled:false}])assert.equal(shouldAutoRefresh({...f,now:1000+AUTO_REFRESH_MS,...state}),false);
});
