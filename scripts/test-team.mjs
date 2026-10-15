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
function motionHarness(introRunning = false) {
  const events = new Map(), styles = new Map(), classes = new Set(), frames = new Map();
  let serial = 0, clock = 0, reduced = false, allowed = true;
  const flipper = {getAnimations:() => introRunning ? [{animationName:'portrait-arrive',playState:'running'}] : [],addEventListener:(name,fn) => events.set(name,fn)};
  const stage = {addEventListener:(name,fn) => events.set(name,fn),getBoundingClientRect:() => ({left:0,top:0,width:400,height:500})};
  const card = {closest:() => stage,querySelector:() => flipper,classList:{add:name => classes.add(name),remove:name => classes.delete(name)},style:{setProperty:(key,value) => styles.set(key,value),removeProperty:key => styles.delete(key)}};
  vm.runInNewContext(readFileSync('profile.js','utf8'), {
    document:{hidden:false,querySelector:() => card,addEventListener:(name,fn) => events.set(name,fn)},window:{addEventListener:(name,fn) => events.set(name,fn)},
    matchMedia:query => query.includes(': reduce)')
      ? {get matches(){return reduced;},addEventListener:(name,fn) => events.set('reducedchange',fn)}
      : {get matches(){return allowed && !reduced;},addEventListener:(name,fn) => events.set('motionchange',fn)},
    requestAnimationFrame:fn => {const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id => frames.delete(id),
  });
  return {events,styles,classes,frames,
    point:(pointerType='mouse') => events.get('pointermove')({clientX:400,clientY:0,pointerType}),
    step:(count,interval=1000/60) => {for(let index=0;index<count;index++){clock+=interval;const queued=[...frames.values()];frames.clear();for(const fn of queued)fn(clock);}},
    reduce:() => {reduced=true;events.get('reducedchange')();},
    disableHover:() => {allowed=false;events.get('motionchange')();},
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
console.log('PASS: studio leaders, project-only roles, profile content, links, footer and damped motion lifecycle (entry, leave, reduced motion, touch, refresh rate).');
