import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {members, projects} from '../data/team.mjs';
import {renderProfileCard, renderProfilePage, renderRoster, renderStudioLeadership} from './team-template.mjs';

const home = readFileSync('index.html', 'utf8');
const member = members[0];
assert.equal(new Set(members.map(person => person.id)).size, members.length);
assert.equal(new Set(members.map(person => person.slug)).size, members.length);
const profile = readFileSync(`team/${member.slug}/index.html`, 'utf8');
assert.equal(profile, renderProfilePage(member, home), 'Generated profile is stale: run node scripts/render-team.mjs');
const profilePages = members.filter(person => person.profileEnabled).map(person => `team/${person.slug}/index.html`);
for (const person of members.filter(person => person.profileEnabled)) {
  const page = readFileSync(`team/${person.slug}/index.html`, 'utf8');
  assert.equal(page, renderProfilePage(person, home), `Stale generated profile: ${person.id}`);
  assert.ok(home.includes(`team/${person.slug}/index.html?from=the-developer`), `Missing roster link: ${person.id}`);
  if (person.image?.src) assert.ok(existsSync(person.image.src), `Missing supplied portrait: ${person.id}`);
  for (const link of person.links || []) assert.ok(page.includes(link.href.replaceAll('&', '&amp;')), `Missing personal link: ${person.id}`);
}
const kimProfile = readFileSync('team/kim-jintae/index.html', 'utf8');
assert.ok(!profile.includes('data-sensor-toggle') && !profile.includes('data-sensor-center'),'Remove standalone mobile sensor controls');
assert.ok(profile.includes('class="portrait-turner"') && profile.includes('role="button" tabindex="0"'),'The card itself must support activation');
assert.ok(kimProfile.includes('<div class="portrait-placeholder"><span>null</span></div>'));
assert.ok(!kimProfile.includes('class="portrait-image"') && !kimProfile.includes('class="member-bio"'), 'Do not fabricate a photo or bio');
assert.ok(home.includes(renderRoster(projects[0])), 'Generated roster is stale');
assert.ok(home.includes('id="leadership-title"') && home.includes(renderStudioLeadership()), 'Restore the studio leadership from member data');
const projectRoster = renderRoster(projects[0]);
assert.ok(!/공동대표|Co-founder|member-title/.test(projectRoster), 'Project roster must show project roles, not company titles');
assert.ok(!home.includes('class="project-team"'));
assert.equal(projects[0].participants.filter(person => person.roles.length > 0).length, 5, 'All five confirmed project roles must be present');
for (const page of ['index.html','press/index.html','games/the-developer/index.html','privacy/index.html','content-policy/index.html',...profilePages]) {
  const source = readFileSync(page, 'utf8');
  const footer = source.match(/<footer\b[\s\S]*?<\/footer>/)[0];
  assert.ok(footer.includes('2026-수원영통-1221호'), `Missing commerce registration: ${page}`);
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, `Duplicate IDs: ${page}`);
  for (const [, url] of source.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|#)/.test(url)) continue;
    const target = path.resolve(path.dirname(page), url.split(/[?#]/)[0]);
    assert.ok(existsSync(target), `Broken local link in ${page}: ${url}`);
  }
}
assert.equal((profile.match(/class="member-links"/g) || []).length, 1);
for (const link of member.links) assert.ok(profile.includes(link.href));
assert.ok(profile.includes(`mailto:${member.contactEmail}`));
const hidden = renderProfileCard({name:'Only a name', shortBio:'X', image:{src:'X'}, contactEmail:'X', interests:['','X'], links:[{href:'javascript:alert(1)',label:'Unsafe'}, {href:'X',label:'X'}]});
assert.ok(!/portrait-stage|member-bio|member-interests|member-connect|javascript:/.test(hidden), 'Hidden values must be omitted from the markup');
assert.ok(hidden.includes('without-photo'));
assert.ok(renderProfileCard({name:'<img onerror=alert(1)>'}).includes('&lt;img'), 'Public data must be escaped');
const repeat = renderRoster({id:'second-project', participants:[{memberId:member.id, roles:['Confirmed role']}]});
assert.ok(repeat.includes(`team/${member.slug}/index.html?from=second-project`));
assert.ok(repeat.includes('Confirmed role'));
assert.ok(!renderRoster(projects[0]).includes('Confirmed role'), 'Project roles must remain independent');

// Run the real controller against a frame queue to check damping, lifecycle and input gates.
function motionHarness(introRunning = false, options = {}) {
  const events = new Map(), styles = new Map(), classes = new Set(), frames = new Map(), timers = new Map();
  let serial = 0, clock = 0, reduced = false, allowed = true;
  let mobileEnabled = Boolean(options.mobile);
  const status = {hidden:true,textContent:''}, attributes = new Map();
  const screenOrientation = {angle:0,addEventListener:(name,fn)=>events.set('screenchange',fn)};
  const flipper = {getAnimations:() => introRunning ? [{animationName:'portrait-arrive',playState:'running'}] : [],addEventListener:(name,fn) => events.set(name,fn)};
  const stage = {classList:{toggle:()=>{}},querySelector:()=>status,setPointerCapture:()=>{},addEventListener:(name,fn) => events.set(name,fn),getBoundingClientRect:() => ({left:0,top:0,width:400,height:500})};
  const card = {closest:() => stage,querySelector:() => flipper,setAttribute:(key,value)=>attributes.set(key,value),addEventListener:(name,fn)=>events.set(name,fn),classList:{add:name => classes.add(name),remove:name => classes.delete(name),toggle:(name,value)=>value?classes.add(name):classes.delete(name)},style:{setProperty:(key,value) => styles.set(key,value),removeProperty:key => styles.delete(key)}};
  const documentMock = {hidden:false,documentElement:{lang:'ko'},querySelector:() => card,addEventListener:(name,fn) => events.set(name,fn)};
  vm.runInNewContext(readFileSync('profile.js','utf8'), {
    document:documentMock,window:{isSecureContext:true,DeviceOrientationEvent:options.sensor ? (options.permission ? {requestPermission:options.permission} : {}) : undefined,screen:{orientation:screenOrientation},addEventListener:(name,fn) => events.set(name,fn),removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);}},
    matchMedia:query => query.includes('pointer: coarse') ? {get matches(){return mobileEnabled;},addEventListener:(name,fn)=>events.set('mobilechange',fn)} : query.includes(': reduce)')
      ? {get matches(){return reduced;},addEventListener:(name,fn) => events.set('reducedchange',fn)}
      : {get matches(){return allowed && !reduced && !mobileEnabled;},addEventListener:(name,fn) => events.set('motionchange',fn)},
    requestAnimationFrame:fn => {const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id => frames.delete(id),
    setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:clock+delay});return id;},clearTimeout:id=>timers.delete(id),
  });
  return {events,styles,classes,frames,status,timers,attributes,
    point:(pointerType='mouse') => events.get('pointermove')({clientX:400,clientY:0,pointerType}),
    step:(count,interval=1000/60) => {for(let index=0;index<count;index++){clock+=interval;const queued=[...frames.values()];frames.clear();for(const fn of queued)fn(clock);}},
    reduce:() => {reduced=true;events.get('reducedchange')();},
    disableHover:() => {allowed=false;events.get('motionchange')();},
    click:()=>events.get('click')({detail:1}),
    orient:(beta,gamma,alpha=0)=>events.get('deviceorientation')?.({beta,gamma,alpha}),
    rotate:angle=>{screenOrientation.angle=angle;events.get('screenchange')();},
    hide:()=>{documentMock.hidden=true;events.get('visibilitychange')();},
    show:()=>{documentMock.hidden=false;events.get('visibilitychange')();},
    expire:()=>{const queued=[...timers.values()];timers.clear();for(const {fn} of queued)fn();},
    advance:ms=>{clock+=ms;for(const [id,timer] of [...timers])if(timer.at<=clock){timers.delete(id);timer.fn();}},
    mobile:value=>{mobileEnabled=value;events.get('mobilechange')();},
  };
}
const motion = motionHarness();
motion.point(); motion.step(1);
assert.ok(Number.parseFloat(motion.styles.get('--ry')) > 0 && Number.parseFloat(motion.styles.get('--ry')) < 8, 'Follow the pointer gradually');
motion.step(90);
assert.equal(Number.parseFloat(motion.styles.get('--ry')),8);
assert.equal(Number.parseFloat(motion.styles.get('--rx')),6);
assert.equal(motion.frames.size,0,'Do not animate at rest');
motion.events.get('pointerleave')();
assert.ok(motion.styles.size > 0,'Return smoothly instead of snapping');
motion.step(90); assert.equal(motion.styles.size,0); assert.equal(motion.frames.size,0);
motion.point('touch'); assert.equal(motion.frames.size,0,'Touch must not create synthetic tilt');
motion.point(); motion.step(2); motion.reduce();
assert.equal(motion.frames.size,0); assert.equal(motion.styles.size,0);
motion.point(); assert.equal(motion.frames.size,0);
const entering = motionHarness(true); entering.point(); assert.equal(entering.frames.size,0,'Hold tilt until entry rotation ends');
entering.events.get('animationend')({animationName:'portrait-arrive'}); entering.step(90);
assert.equal(Number.parseFloat(entering.styles.get('--ry')),8);
entering.events.get('blur')(); assert.equal(entering.styles.size,0); assert.equal(entering.frames.size,0);
const low = motionHarness(), high = motionHarness(); low.point(); high.point(); low.step(18); high.step(36,1000/120);
assert.ok(Math.abs(Number.parseFloat(low.styles.get('--ry')) - Number.parseFloat(high.styles.get('--ry'))) < 0.04, 'Damping must be refresh-rate independent');
assert.ok(low.styles.has('--glare-angle') && Number(low.styles.get('--reflect'))>0.4,'Tilt should move and strengthen the material reflection');
await low.click(); assert.equal(low.classes.has('is-flipped'),true,'Click reveals the logo back');
low.events.get('keydown')({key:'Enter',preventDefault(){}}); assert.equal(low.classes.has('is-flipped'),false,'Keyboard returns to the photo');
const stable = motionHarness(false,{mobile:true,sensor:true});
stable.orient(45,0); stable.advance(2000); stable.orient(45,12); stable.step(60);
const heldTilt = Number.parseFloat(stable.styles.get('--ry'));
stable.advance(1000); stable.orient(45,13); stable.advance(999);
stable.step(1); assert.ok(Number.parseFloat(stable.styles.get('--ry'))>=heldTilt,'Moving outside the cone restarts the three-second wait');
stable.advance(1); stable.step(180);
assert.equal(Number.parseFloat(stable.styles.get('--ry')),0,'Small jitter stays inside the stable cone and recalibrates');
const android = motionHarness(false,{mobile:true,sensor:true});
assert.ok(android.events.has('deviceorientation'),'Auto-listen where no permission API is required');
android.orient(45,0); android.orient(45,20); android.step(90);
assert.equal(Number.parseFloat(android.styles.get('--ry')),24,'Device tilt should have three times the desktop rotation range');
assert.ok(Math.abs(Number.parseFloat(android.styles.get('--rx')))<0.1);
android.advance(1499);
assert.equal(Number.parseFloat(android.styles.get('--ry')),24,'Do not recalibrate before three stable seconds');
android.advance(1);
assert.equal(Number.parseFloat(android.styles.get('--ry')),24,'Recalibration must not snap the current transform');
android.step(1);
assert.ok(Number.parseFloat(android.styles.get('--ry'))>20 && Number.parseFloat(android.styles.get('--ry'))<24,'Interpolate slowly toward the new baseline');
android.orient(45,20); android.step(180);
assert.equal(Number.parseFloat(android.styles.get('--ry')),0,'Automatically recenter at the stable current attitude');
android.rotate(90); android.orient(45,0); android.orient(45,20); android.step(180);
assert.ok(Math.abs(Number.parseFloat(android.styles.get('--ry')))<0.1);
assert.equal(Number.parseFloat(android.styles.get('--rx')),18,'Keep the amplified tilt after landscape rotation');
android.hide(); assert.equal(android.events.has('deviceorientation'),false); assert.equal(android.frames.size,0);
android.show(); assert.equal(android.events.has('deviceorientation'),true);
android.orient(179,0); android.orient(-179,0); android.step(90);
assert.ok(Math.abs(Number.parseFloat(android.styles.get('--ry'))-2.4)<0.1,'Treat the +/-180 degree boundary as a two-degree change with threefold tilt');
android.reduce(); assert.equal(android.events.has('deviceorientation'),false); assert.equal(android.timers.size,0);
let permissions = 0;
const iphone = motionHarness(false,{mobile:true,sensor:true,permission:()=>{permissions++;return Promise.resolve('granted');}});
assert.equal(permissions,0,'Never prompt for sensor permission on page load');
assert.equal(iphone.events.has('deviceorientation'),false);
await iphone.click(); assert.equal(permissions,1); iphone.orient(70,0); iphone.orient(80,0); iphone.step(90);
assert.ok(Math.abs(Number.parseFloat(iphone.styles.get('--rx')) + 9)<0.1,'Amplify the same phone pitch by three');
assert.equal(iphone.attributes.get('aria-pressed'),'true');
await iphone.click(); assert.equal(iphone.events.has('deviceorientation'),true,'Flipping the card must keep sensors active');
assert.equal(iphone.attributes.get('aria-pressed'),'false'); assert.equal(permissions,1,'Do not prompt again on each flip');
const denied = motionHarness(false,{mobile:true,sensor:true,permission:()=>Promise.resolve('denied')});
await denied.click(); assert.equal(denied.events.has('deviceorientation'),false); assert.equal(denied.status.hidden,false);
denied.events.get('pointerdown')({pointerType:'touch',pointerId:1,clientX:100,clientY:100});
denied.events.get('pointermove')({pointerType:'touch',pointerId:1,clientX:240,clientY:100}); denied.step(90);
assert.equal(Number.parseFloat(denied.styles.get('--ry')),8,'Denied permissions must retain the drag fallback');
denied.events.get('pointerup')({pointerId:1}); denied.step(90); assert.equal(denied.styles.size,0);
await denied.click(); assert.equal(denied.attributes.get('aria-pressed'),'true','Dragging must not accidentally flip the card');
const absent = motionHarness(false,{mobile:true,sensor:true}); absent.orient(null,null); absent.expire();
assert.equal(absent.events.has('deviceorientation'),false,'No-data fallback must remove its listener');
let grant;
const pending = motionHarness(false,{mobile:true,sensor:true,permission:()=>new Promise(resolve=>{grant=resolve;})});
const pendingRequest = pending.click(); pending.hide(); grant('granted'); await pendingRequest;
assert.equal(pending.events.has('deviceorientation'),false,'A late permission response must not restart a hidden page');
pending.show();
assert.equal(pending.events.has('deviceorientation'),true,'Resume granted sensor access when returning from a permission prompt');
let foregroundGrant;
const prompt = motionHarness(false,{mobile:true,sensor:true,permission:()=>new Promise(resolve=>{foregroundGrant=resolve;})});
const promptRequest = prompt.click(); prompt.hide(); prompt.show(); foregroundGrant('granted'); await promptRequest;
assert.equal(prompt.events.has('deviceorientation'),true,'A temporary permission-prompt visibility change must not discard the grant');
let reducedGrant;
const cancelled = motionHarness(false,{mobile:true,sensor:true,permission:()=>new Promise(resolve=>{reducedGrant=resolve;})});
const cancelledRequest = cancelled.click(); cancelled.reduce(); reducedGrant('granted'); await cancelledRequest;
assert.equal(cancelled.events.has('deviceorientation'),false,'Reduced motion still cancels a pending request');
console.log('PASS: profiles, roles, links, card flips/keyboard/drag suppression, material reflection, stable-pose auto-calibration and interpolation, cursor/device tilt, permission lifecycle, reduced motion and hidden-page cleanup.');
