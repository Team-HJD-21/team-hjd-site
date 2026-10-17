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
  if (person.image?.src) {
    for (const image of [person.image, ...(person.image.alternatives || [])]) assert.ok(existsSync(image.src), `Missing supplied portrait: ${person.id}: ${image.src}`);
  }
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
  let userActivation = false;
  const sensorAPI = (enabled,permission) => !enabled ? undefined : !permission ? {} : {requestPermission:()=>{
    if (!userActivation) return options.probe ? options.probe() : options.pregranted ? Promise.resolve('granted') : Promise.reject(new Error('NotAllowedError'));
    return permission();
  }};
  const status = {hidden:true,textContent:''}, hint = {hidden:true,textContent:''}, attributes = new Map(), stageClasses = new Set();
  const screenOrientation = {angle:0,addEventListener:(name,fn)=>events.set('screenchange',fn)};
  const flipper = {getAnimations:() => introRunning ? [{animationName:'portrait-arrive',playState:'running'}] : [],addEventListener:(name,fn) => events.set(name,fn)};
  const stage = {classList:{toggle:(name,value)=>value?stageClasses.add(name):stageClasses.delete(name)},querySelector:selector=>selector==='[data-motion-hint]'?hint:status,setPointerCapture:()=>{},addEventListener:(name,fn) => events.set(name,fn),getBoundingClientRect:() => ({left:0,top:0,width:400,height:500})};
  const card = {closest:() => stage,querySelector:() => flipper,setAttribute:(key,value)=>attributes.set(key,value),addEventListener:(name,fn)=>events.set(name,fn),classList:{add:name => classes.add(name),remove:name => classes.delete(name),toggle:(name,value)=>value?classes.add(name):classes.delete(name)},style:{setProperty:(key,value) => styles.set(key,value),removeProperty:key => styles.delete(key)}};
  const documentMock = {hidden:false,documentElement:{lang:'ko'},querySelector:() => card,addEventListener:(name,fn) => events.set(name,fn)};
  vm.runInNewContext(readFileSync('profile.js','utf8'), {
    document:documentMock,window:{isSecureContext:true,navigator:{userActivation:{get isActive(){return userActivation;}}},DeviceOrientationEvent:sensorAPI(options.sensor,options.permission),DeviceMotionEvent:sensorAPI(options.motion,options.motionPermission),screen:{orientation:screenOrientation},addEventListener:(name,fn) => events.set(name,fn),removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);}},
    matchMedia:query => query.includes('pointer: coarse') ? {get matches(){return mobileEnabled;},addEventListener:(name,fn)=>events.set('mobilechange',fn)} : query.includes(': reduce)')
      ? {get matches(){return reduced;},addEventListener:(name,fn) => events.set('reducedchange',fn)}
      : {get matches(){return allowed && !reduced && !mobileEnabled;},addEventListener:(name,fn) => events.set('motionchange',fn)},
    requestAnimationFrame:fn => {const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id => frames.delete(id),
    setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:clock+delay});return id;},clearTimeout:id=>timers.delete(id),
  });
  return {events,styles,classes,frames,status,hint,timers,attributes,stageClasses,
    point:(pointerType='mouse') => events.get('pointermove')({clientX:400,clientY:0,pointerType}),
    step:(count,interval=1000/60) => {for(let index=0;index<count;index++){clock+=interval;const queued=[...frames.values()];frames.clear();for(const fn of queued)fn(clock);}},
    reduce:() => {reduced=true;events.get('reducedchange')();},
    disableHover:() => {allowed=false;events.get('motionchange')();},
    click:()=>{userActivation=true;const result=events.get('click')({detail:1});userActivation=false;return result;},
    flush:async()=>{for(let index=0;index<5;index++)await Promise.resolve();},
    gravity:(x,y,z)=>events.get('devicemotion')?.({accelerationIncludingGravity:{x,y,z}}),
    orient:(beta,gamma,alpha=0)=>events.get('deviceorientation')?.({beta,gamma,alpha}),
    rotate:angle=>{screenOrientation.angle=angle;events.get('screenchange')();},
    hide:()=>{documentMock.hidden=true;events.get('visibilitychange')();},
    show:()=>{documentMock.hidden=false;events.get('visibilitychange')();},
    expire:()=>{const queued=[...timers.values()];timers.clear();for(const {fn} of queued)fn();},
    advance:ms=>{clock+=ms;for(const [id,timer] of [...timers])if(timer.at<=clock+1e-6){timers.delete(id);timer.fn();}},
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
stable.orient(45,0); stable.advance(1000); stable.orient(45,12); stable.step(30);
const heldTilt = Number.parseFloat(stable.styles.get('--ry'));
stable.advance(500); stable.orient(45,13); stable.advance(499);
assert.equal(Number.parseFloat(stable.styles.get('--ry')),heldTilt,'Moving outside the cone restarts the 1.5-second wait');
stable.advance(1); stable.step(180);
assert.equal(Number.parseFloat(stable.styles.get('--ry')),0,'Small jitter stays inside the stable cone and recalibrates');
const android = motionHarness(false,{mobile:true,sensor:true});
assert.ok(android.events.has('deviceorientation'),'Auto-listen where no permission API is required');
android.orient(45,0); android.orient(45,20); android.step(60);
assert.equal(Number.parseFloat(android.styles.get('--ry')),16,'Device tilt should have twice the desktop rotation range');
assert.ok(Math.abs(Number.parseFloat(android.styles.get('--rx')))<0.1);
android.advance(499);
assert.equal(Number.parseFloat(android.styles.get('--ry')),16,'Do not recalibrate before 1.5 stable seconds');
android.advance(1);
assert.equal(Number.parseFloat(android.styles.get('--ry')),16,'Recalibration must not snap the current transform');
android.step(1);
assert.ok(Number.parseFloat(android.styles.get('--ry'))>13 && Number.parseFloat(android.styles.get('--ry'))<16,'Interpolate slowly toward the new baseline');
android.orient(45,20); android.step(180);
assert.equal(Number.parseFloat(android.styles.get('--ry')),0,'Automatically recenter at the stable current attitude');
android.rotate(90); android.orient(45,0); android.orient(45,20); android.step(180);
assert.ok(Math.abs(Number.parseFloat(android.styles.get('--ry')))<0.1);
assert.equal(Number.parseFloat(android.styles.get('--rx')),12,'Keep the amplified tilt after landscape rotation');
android.hide(); assert.equal(android.events.has('deviceorientation'),false); assert.equal(android.frames.size,0);
android.show(); assert.equal(android.events.has('deviceorientation'),true);
android.orient(179,0); android.orient(-179,0); android.step(90);
assert.ok(Math.abs(Number.parseFloat(android.styles.get('--ry'))-1.6)<0.1,'Treat the +/-180 degree boundary as a two-degree change with doubled tilt');
android.reduce(); assert.equal(android.events.has('deviceorientation'),false); assert.equal(android.timers.size,0);
let permissions = 0;
const iphone = motionHarness(false,{mobile:true,sensor:true,permission:()=>{permissions++;return Promise.resolve('granted');}});
assert.equal(permissions,0,'Never prompt for sensor permission on page load');
assert.equal(iphone.events.has('deviceorientation'),true,'Passively detect already granted permission without prompting');
assert.equal(iphone.hint.hidden,true,'Do not flash TOUCH ME while the existing permission is being checked');
await iphone.flush(); iphone.advance(500);
assert.equal(iphone.hint.hidden,false); assert.equal(iphone.hint.textContent,'TOUCH ME!');
await iphone.click(); assert.equal(permissions,1); iphone.orient(70,0); iphone.orient(80,0); iphone.step(90);
assert.ok(Math.abs(Number.parseFloat(iphone.styles.get('--rx')) + 6)<0.1,'Amplify the same phone pitch by two');
assert.equal(iphone.attributes.get('aria-pressed'),'false','The permission-unlock tap must keep the photo facing forward');
assert.equal(iphone.hint.hidden,true); assert.equal(iphone.stageClasses.has('is-motion-ready'),true,'Permission grant activates the halo');
await iphone.click(); assert.equal(iphone.events.has('deviceorientation'),true,'Flipping the card must keep sensors active');
assert.equal(iphone.attributes.get('aria-pressed'),'true'); assert.equal(permissions,1,'Do not prompt again on each flip');
let priorPermissionCalls = 0;
const prior = motionHarness(false,{mobile:true,sensor:true,pregranted:true,permission:()=>{priorPermissionCalls++;return Promise.resolve('granted');}});
assert.equal(prior.hint.hidden,true,'An existing grant starts with the invitation hidden');
await prior.flush();
assert.equal(prior.hint.hidden,true); assert.equal(prior.stageClasses.has('is-motion-ready'),true,'Previously granted data activates the halo on page load');
await prior.click(); assert.equal(prior.attributes.get('aria-pressed'),'true'); assert.equal(priorPermissionCalls,0,'Already granted users can flip immediately');
let slowPermission;
const slowGrant = motionHarness(false,{mobile:true,sensor:true,permission:()=>Promise.resolve('granted'),probe:()=>new Promise(resolve=>{slowPermission=resolve;})});
slowGrant.advance(1000); assert.equal(slowGrant.hint.hidden,true,'A slow existing-permission check must never flash TOUCH ME');
slowPermission('granted'); await slowGrant.flush(); assert.equal(slowGrant.hint.hidden,true); assert.equal(slowGrant.stageClasses.has('is-motion-ready'),true);
const denied = motionHarness(false,{mobile:true,sensor:true,permission:()=>Promise.resolve('denied')});
await denied.click(); assert.equal(denied.events.has('deviceorientation'),false); assert.equal(denied.status.hidden,false);
denied.events.get('pointerdown')({pointerType:'touch',pointerId:1,clientX:100,clientY:100});
denied.events.get('pointermove')({pointerType:'touch',pointerId:1,clientX:240,clientY:100}); denied.step(90);
assert.equal(Number.parseFloat(denied.styles.get('--ry')),8,'Denied permissions must retain the drag fallback');
denied.events.get('pointerup')({pointerId:1}); denied.step(90); assert.equal(denied.styles.size,0);
await denied.click(); assert.equal(denied.attributes.get('aria-pressed'),'false','Dragging must not accidentally flip the card');
await denied.click(); assert.equal(denied.attributes.get('aria-pressed'),'true','Denied users retain normal flips after the initial permission tap');
let motionRequests = 0;
const motionOnlyPermission = motionHarness(false,{mobile:true,sensor:true,motion:true,motionPermission:()=>{motionRequests++;return Promise.resolve('granted');}});
await motionOnlyPermission.flush(); motionOnlyPermission.advance(500);
assert.equal(motionOnlyPermission.hint.hidden,false,'A missing orientation permission method must not hide the invitation');
await motionOnlyPermission.click();
assert.equal(motionRequests,1); assert.equal(motionOnlyPermission.attributes.get('aria-pressed'),'false','Request motion permission before flipping');
motionOnlyPermission.gravity(0,6.94,6.94); motionOnlyPermission.gravity(-3,6.6,6.6); motionOnlyPermission.step(90);
assert.ok(Number.parseFloat(motionOnlyPermission.styles.get('--ry'))>10,'Use gravity when orientation data is absent');
motionOnlyPermission.orient(45,0); motionOnlyPermission.step(90);
const orientationTilt = motionOnlyPermission.styles.get('--ry');
motionOnlyPermission.gravity(-6,5,5); motionOnlyPermission.step(90);
assert.equal(motionOnlyPermission.styles.get('--ry'),orientationTilt,'Prefer orientation data once it is available');
const unsupported = motionHarness(false,{mobile:true}); unsupported.advance(500);
assert.equal(unsupported.hint.hidden,false,'Do not hide the initial touch path just because sensor APIs are absent');
await unsupported.click(); assert.equal(unsupported.attributes.get('aria-pressed'),'false');
assert.ok(unsupported.status.textContent.includes('브라우저'),'Explain unavailable sensors instead of silently flipping');
const absent = motionHarness(false,{mobile:true,sensor:true}); absent.orient(null,null); absent.expire();
assert.equal(absent.events.has('deviceorientation'),false,'No-data fallback must remove its listener');
let grant;
const pending = motionHarness(false,{mobile:true,sensor:true,permission:()=>new Promise(resolve=>{grant=resolve;})});
const pendingRequest = pending.click();
assert.equal(pending.hint.textContent,'ONE MOMENT…');
await pending.click(); assert.equal(pending.attributes.get('aria-pressed'),'false','Repeated taps during permission must not flip');
pending.hide(); grant('granted'); await pendingRequest;
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
