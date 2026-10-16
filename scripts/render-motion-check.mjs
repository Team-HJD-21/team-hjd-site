// Local-only UI harness: permission and orientation are simulated, never real device proof.
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
const buildRoot = path.resolve(process.argv[2] || '_site');
let html = readFileSync(path.join(buildRoot, 'team/yang-hyunseok/index.html'), 'utf8');
const mock = `<script>
const originalMatchMedia = window.matchMedia.bind(window);
window.matchMedia = query => {
  if (query === '(hover: none), (pointer: coarse)') return {matches:true,addEventListener(){}};
  if (query.includes('pointer: fine')) return {matches:false,addEventListener(){}};
  return originalMatchMedia(query);
};
const permissionScenario = new URL(location.href).searchParams.get('permission') || 'granted';
let simulatedTap = false;
document.addEventListener('click', () => {simulatedTap=true;setTimeout(()=>{simulatedTap=false;},0);},true);
const request = () => !simulatedTap && permissionScenario !== 'pregranted' ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(permissionScenario === 'pregranted' ? 'granted' : permissionScenario);
window.DeviceOrientationEvent = permissionScenario === 'motion-only' || permissionScenario === 'unsupported' ? undefined : {requestPermission:request};
window.DeviceMotionEvent = permissionScenario === 'motion-only' ? {requestPermission:()=>!simulatedTap?Promise.reject(new Error('NotAllowedError')):Promise.resolve('granted')} : undefined;
document.addEventListener('DOMContentLoaded', () => {
  const input = document.querySelector('#qa-roll');
  function sample() {
    const motionOnly = permissionScenario === 'motion-only';
    const event = new Event(motionOnly ? 'devicemotion' : 'deviceorientation');
    Object.assign(event, motionOnly ? {accelerationIncludingGravity:{x:-Math.sin(Number(input.value)*Math.PI/180)*9.8,y:6.5,z:6.5}} : {alpha:0,beta:40,gamma:Number(input.value)});
    window.dispatchEvent(event);
  }
  input.addEventListener('input', sample);
  document.querySelector('[data-tilt]').addEventListener('click', () => {if(permissionScenario!=='unsupported')setTimeout(sample,0);});
  if (permissionScenario === 'pregranted') sample();
});
</script>`;
html = html.replace('<head>', '<head>' + mock).replace(/(<body[^>]*>)/, '$1<div style="padding:12px 20px;background:#253523;color:#d9eea6;font:12px system-ui"><strong>LOCAL SIMULATED SENSOR</strong> — no real iPhone/Android sensor is being tested.<br><label for="qa-roll">Simulated roll</label> <input id="qa-roll" type="range" min="-40" max="40" value="0" step="10"></div>');
const folder = path.join(buildRoot, 'qa/device-tilt');
mkdirSync(folder, {recursive:true});
writeFileSync(path.join(folder,'index.html'), html);
console.log('Local simulated sensor UI:', path.join(folder,'index.html'));
