import test from 'node:test';
import assert from 'node:assert/strict';
import {readOnlyFetch} from './audit-no-send.mjs';
test('diagnostic transport cannot call mail, authenticated, private or non-GET endpoints',async()=>{
 let requests=0;const recorded=[],get=readOnlyFetch(async()=>{requests++;return new Response('ok');},recorded);
 for(const [url,options] of [['https://tech.teamhjd.com/api/internal/deliver',{method:'POST'}],['https://api.resend.com/emails',{}],['https://tech.teamhjd.com/api/status',{}],['https://tech.teamhjd.com/',{headers:{Authorization:'not-a-real-token'}}],['https://tech.teamhjd.com/',{method:'PUT'}]])await assert.rejects(get(url,options),/policy/);
 assert.equal(requests,0);await get('https://tech.teamhjd.com/publication.json');assert.equal(requests,1);assert.deepEqual(recorded,[{method:'GET',path:'/publication.json'}]);
});
