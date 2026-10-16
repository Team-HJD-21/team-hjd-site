// Progressive enhancement: the photo, content and real links work without JS.
(() => {
  const card = document.querySelector('[data-tilt]');
  if (!card) return;
  const stage = card.closest('.portrait-stage');
  const motion = matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(hover: none), (pointer: coarse)');
  const flipper = card.querySelector('.portrait-flipper');
  const controls = stage.querySelector?.('[data-motion-controls]');
  const toggle = controls?.querySelector('[data-sensor-toggle]');
  const center = controls?.querySelector('[data-sensor-center]');
  const status = controls?.querySelector('[data-motion-status]');
  const properties = ['--rx', '--ry', '--mx', '--my', '--px', '--py'];
  let frame = 0, lastTime, inside = false;
  const intro = flipper?.getAnimations?.().find(animation => animation.animationName === 'portrait-arrive');
  let revealing = Boolean(intro && intro.playState === 'running') && !reduced.matches;
  const current = {x: 0, y: 0}, target = {x: 0, y: 0};
  let sensorEnabled = false, sensorWanted = false, sensorGranted = false, userStopped = false;
  let baseline = null, sensorTimer = 0, permissionPending = false, generation = 0;
  let dragging = null, message = '';
  const Orientation = window.DeviceOrientationEvent;
  const canSense = Boolean(Orientation) && window.isSecureContext !== false;
  const needsPermission = typeof Orientation?.requestPermission === 'function';
  const copy = {
    ko: {on:'기울기 효과 켜기',off:'기울기 끄기',center:'기준 재설정',waiting:'휴대폰을 살짝 기울여 주세요.',denied:'센서 권한이 없어 카드 드래그로 사용할 수 있습니다.',missing:'기울기 정보를 받지 못했습니다. 카드를 드래그해 주세요.'},
    en: {on:'Enable device tilt',off:'Turn off tilt',center:'Recenter',waiting:'Gently tilt your phone.',denied:'Motion access is unavailable. You can drag the card instead.',missing:'No orientation data received. Drag the card instead.'},
    'zh-CN': {on:'开启倾斜效果',off:'关闭倾斜',center:'重设基准',waiting:'请轻轻倾斜手机。',denied:'无法访问传感器，可拖动卡片。',missing:'未收到倾斜数据，请拖动卡片。'},
  };
  function renderControls() {
    if (!controls) return;
    const words = copy[document.documentElement.lang] || copy.ko;
    controls.hidden = !mobile.matches || reduced.matches || !canSense;
    toggle.textContent = sensorWanted ? words.off : words.on;
    toggle.disabled = permissionPending;
    toggle.setAttribute('aria-pressed', String(sensorWanted));
    center.textContent = words.center;
    center.hidden = !sensorEnabled || !baseline;
    status.textContent = words[message] || '';
    status.hidden = !status.textContent;
  }
  function aim(x, y) {
    target.x = Math.max(-1, Math.min(1, x));
    target.y = Math.max(-1, Math.min(1, y));
    inside = true;
    if (!revealing) {
      card.classList.remove('is-settling');
      card.classList.add('is-tracking');
      start();
    }
  }

  function clearStyles() {
    for (const property of properties) card.style.removeProperty(property);
    card.classList.remove('is-settling');
  }
  function tick(time) {
    frame = 0;
    // Time-based damping keeps the same weight on 60 Hz and high-refresh screens.
    const dt = Math.min((time - (lastTime ?? time - 1000 / 60)) / 1000, 0.05);
    lastTime = time;
    const follow = 1 - Math.exp(-(inside ? 16 : 10) * dt);
    current.x += (target.x - current.x) * follow;
    current.y += (target.y - current.y) * follow;
    const settled = Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
    if (settled) { current.x = target.x; current.y = target.y; }
    card.style.setProperty('--rx', `${(-current.y * 6).toFixed(3)}deg`);
    card.style.setProperty('--ry', `${(current.x * 8).toFixed(3)}deg`);
    card.style.setProperty('--mx', `${((current.x + 1) * 50).toFixed(2)}%`);
    card.style.setProperty('--my', `${((current.y + 1) * 50).toFixed(2)}%`);
    card.style.setProperty('--px', `${(-current.x * 3).toFixed(3)}px`);
    card.style.setProperty('--py', `${(-current.y * 3).toFixed(3)}px`);
    if (!settled) frame = requestAnimationFrame(tick);
    else {
      lastTime = undefined;
      if (!inside) clearStyles();
    }
  }
  function start() {
    if (!frame && !revealing && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
  }
  function reset() {
    cancelAnimationFrame(frame);
    frame = 0; lastTime = undefined; inside = false; dragging = null;
    current.x = current.y = target.x = target.y = 0;
    card.classList.remove('is-tracking');
    clearStyles();
  }
  function leave() {
    if (sensorEnabled || dragging) return;
    inside = false;
    target.x = target.y = 0;
    card.classList.remove('is-tracking');
    if ((motion.matches || mobile.matches) && !reduced.matches && !revealing) {
      card.classList.add('is-settling');
      start();
    } else reset();
  }
  stage.addEventListener('pointermove', event => {
    if (dragging && event.pointerId === dragging.id) {
      aim((event.clientX - dragging.x) / 140, (event.clientY - dragging.y) / 140);
      return;
    }
    if (!motion.matches || event.pointerType === 'touch') return;
    // Measure the untransformed stage so the tilted surface cannot feed back into its own input.
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    aim((event.clientX - bounds.left) / bounds.width * 2 - 1, (event.clientY - bounds.top) / bounds.height * 2 - 1);
  });
  stage.addEventListener('pointerdown', event => {
    if (!mobile.matches || reduced.matches || sensorEnabled || event.pointerType === 'mouse' || event.target?.closest('button')) return;
    reset();
    dragging = {id:event.pointerId,x:event.clientX,y:event.clientY};
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener('pointerup', event => {
    if (dragging && event.pointerId === dragging.id) { dragging = null; leave(); }
  });
  flipper?.addEventListener('animationend', event => {
    if (event.animationName !== 'portrait-arrive') return;
    revealing = false;
    if (inside && (motion.matches || sensorEnabled || dragging)) { card.classList.add('is-tracking'); start(); }
  });
  stage.addEventListener('pointerleave', leave);
  stage.addEventListener('pointercancel', reset);
  window.addEventListener('blur', reset);
  motion.addEventListener('change', reset);
  // Z-X-Y attitude quaternion. Relative rotation avoids compass-heading dependence
  // and Euler-angle jumps when a phone is held upright or crosses +/-180 degrees.
  function attitude(event) {
    const half = Math.PI / 360;
    const a = (Number.isFinite(event.alpha) ? event.alpha : 0) * half;
    const b = event.beta * half, g = event.gamma * half;
    const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g);
    return {x:ca*sb*cg-sa*cb*sg,y:ca*cb*sg+sa*sb*cg,z:sa*cb*cg+ca*sb*sg,w:ca*cb*cg-sa*sb*sg};
  }
  function onOrientation(event) {
    if (!sensorEnabled || !mobile.matches || reduced.matches || document.hidden || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    clearTimeout(sensorTimer);
    const q = attitude(event);
    if (!baseline) { baseline = q; message = ''; renderControls(); }
    const b = baseline;
    const x=b.w*q.x-b.x*q.w-b.y*q.z+b.z*q.y;
    const y=b.w*q.y+b.x*q.z-b.y*q.w-b.z*q.x;
    const z=b.w*q.z-b.x*q.y+b.y*q.x-b.z*q.w;
    const w=b.w*q.w+b.x*q.x+b.y*q.y+b.z*q.z;
    const pitch = Math.atan2(2*(w*x+y*z),1-2*(x*x+y*y)) * 180 / Math.PI;
    const roll = Math.asin(Math.max(-1,Math.min(1,2*(w*y-z*x)))) * 180 / Math.PI;
    const angle = (window.screen?.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    aim((roll*Math.cos(angle)+pitch*Math.sin(angle))/20, (pitch*Math.cos(angle)-roll*Math.sin(angle))/20);
  }
  function detachSensor() {
    window.removeEventListener('deviceorientation', onOrientation);
    clearTimeout(sensorTimer);
    sensorTimer = 0; sensorEnabled = false; baseline = null;
  }
  function attachSensor(userInitiated = false) {
    if (!sensorWanted || !mobile.matches || reduced.matches || document.hidden) return;
    detachSensor(); reset();
    sensorEnabled = true;
    window.addEventListener('deviceorientation', onOrientation, {passive:true});
    message = userInitiated ? 'waiting' : '';
    sensorTimer = setTimeout(() => {
      if (baseline) return;
      detachSensor(); sensorWanted = false; message = userInitiated ? 'missing' : '';
      reset(); renderControls();
    }, 3000);
    renderControls();
  }
  async function enableSensor() {
    if (permissionPending || !canSense || !mobile.matches || reduced.matches) return;
    const attempt = ++generation;
    permissionPending = true; message = ''; renderControls();
    try {
      // This call stays directly inside the click handler to preserve iOS user activation.
      const permission = needsPermission && !sensorGranted ? await Orientation.requestPermission() : 'granted';
      if (attempt !== generation || !mobile.matches || reduced.matches) return;
      if (permission !== 'granted') { message = 'denied'; return; }
      sensorGranted = true; sensorWanted = true; userStopped = false;
      attachSensor(true);
    } catch { if (attempt === generation) message = 'denied'; }
    finally { if (attempt === generation) { permissionPending = false; renderControls(); } }
  }
  function suspend(cancelPermission = false) {
    // A native permission sheet may temporarily hide the page. Keep that request
    // alive, but do not subscribe until the page is visible again.
    if (cancelPermission) { ++generation; permissionPending = false; }
    detachSensor(); reset(); renderControls();
  }
  function mobileMode() {
    suspend(true);
    stage.classList.toggle('sensor-mobile', mobile.matches && !reduced.matches);
    if (mobile.matches && !reduced.matches && canSense && !userStopped && (!needsPermission || sensorGranted)) {
      sensorWanted = true; attachSensor();
    }
    renderControls();
  }
  toggle?.addEventListener('click', () => {
    if (sensorWanted) { sensorWanted = false; userStopped = true; message = ''; suspend(true); }
    else return enableSensor();
  });
  center?.addEventListener('click', () => { baseline = null; reset(); renderControls(); });
  function recenter() { baseline = null; reset(); renderControls(); }
  window.screen?.orientation?.addEventListener('change', recenter);
  window.addEventListener('orientationchange', recenter);
  mobile.addEventListener('change', mobileMode);
  reduced.addEventListener('change', () => { revealing = false; mobileMode(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspend();
    else if (sensorWanted && !userStopped) attachSensor();
  });
  window.addEventListener('pagehide', () => suspend());
  window.addEventListener('pageshow', () => { if (sensorWanted && !userStopped) attachSensor(); });
  document.addEventListener('teamhjd:languagechange', renderControls);
  mobileMode();
})();
