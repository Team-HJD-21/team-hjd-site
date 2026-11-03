import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPeople,pagePeople,duration} from './audience.mjs';
test('directory filters full addresses, keeps statuses separate, sorts and clamps pages',()=>{
 const people=Array.from({length:30},(_,i)=>({id:String(i).padStart(2,'0'),email:`reader${i}@example.com`,status:i%2?'pending':'active',createdAt:new Date(1000*i).toISOString(),confirmedAt:i%2?null:new Date(2000*i).toISOString(),mail:{recent:[]}}));
 assert.equal(selectPeople(people,{status:'active'}).length,15);assert.equal(selectPeople(people,{status:'pending'}).length,15);
 assert.equal(selectPeople(people,{status:'all',search:' READER2@EXAMPLE.COM '})[0].id,'02');
 assert.equal(selectPeople(people,{status:'all',sort:'oldest'})[0].id,'00');assert.equal(selectPeople(people,{status:'all',sort:'confirmed'})[0].id,'28');
 const page=pagePeople(selectPeople(people,{status:'all'}),2);assert.equal(page.rows.length,5);assert.equal(page.start,26);assert.equal(page.end,30);
 assert.equal(pagePeople(selectPeople(people,{status:'pending'}),2).page,1);assert.equal(pagePeople([],99).start,0);assert.equal(people[0].id,'00');
 assert.equal(duration(null),'기록 없음');assert.equal(duration(86460),'1일 0시간');
});
