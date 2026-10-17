// Progressive enhancement: the photo, content and real links work without JS.
(() => {
  const card = document.querySelector('[data-tilt]');
  if (!card) return;
  // Choose once per visit, independently of motion preferences and card interaction.
  const portrait = card.querySelector('[data-portrait-options]');
  if (portrait?.dataset?.portraitOptions) {
    const options = JSON.parse(portrait.dataset.portraitOptions);
    const selected = options[Math.floor(Math.random() * options.length)];
    Object.assign(portrait, {src: selected.src, alt: selected.alt, width: selected.width, height: selected.height});
    portrait.style.objectPosition = selected.position;
  }
  const stage = card.closest('.portrait-stage');
  const motion = matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(hover: none), (pointer: coarse)');
  const flipper = card.querySelector('.portrait-flipper');
  const status = stage.querySelector?.('[data-motion-status]');
  const hint = stage.querySelector?.('[data-motion-hint]');
  const properties = ['--rx', '--ry', '--mx', '--my', '--px', '--py', '--glare-angle', '--reflect', '--halo'];
  let frame = 0, lastTime, inside = false;
  const intro = flipper?.getAnimations?.().find(animation => animation.animationName === 'portrait-arrive');
  let revealing = Boolean(intro && intro.playState === 'running') && !reduced.matches;
  const current = {x: 0, y: 0}, target = {x: 0, y: 0};
  let sensorEnabled = false, sensorWanted = false, sensorGranted = false, permissionDenied = false;
  let permissionChecked = false, accessTimer = 0, orientationSeen = false;
  let baseline = null, sensorTimer = 0, permissionPending = false, generation = 0;
  let dragging = null, message = '', flipped = false, tapOrigin = null, suppressTap = false;
  let steadyAnchor = null, latestAttitude = null, steadyTimer = 0, steadyCalibrated = false, recentering = false;
  const Orientation = window.DeviceOrientationEvent;
  const Motion = window.DeviceMotionEvent;
  const permissionAPIs = [Orientation,Motion].filter(api => typeof api?.requestPermission === 'function');
  const canSense = Boolean(Orientation || Motion) && window.isSecureContext !== false;
  const needsPermission = permissionAPIs.length > 0;
  const copy = {
    ko: {activate:'카드를 터치해 기울기 효과 활성화',back:'카드 뒷면 보기',front:'카드 앞면 보기',denied:'센서 권한이 없어 카드 드래그로 사용할 수 있습니다.',missing:'기울기 정보를 받지 못했습니다. 카드를 드래그해 주세요.',unsupported:'이 브라우저에서는 기울기 센서를 사용할 수 없습니다. 카드를 드래그해 주세요.'},
    en: {activate:'Touch the card to enable device tilt',back:'Show card back',front:'Show card front',denied:'Motion access is unavailable. You can drag the card instead.',missing:'No orientation data received. Drag the card instead.',unsupported:'Device tilt is unavailable in this browser. Drag the card instead.'},
    'zh-CN': {activate:'轻触卡片以开启倾斜效果',back:'查看卡片背面',front:'查看卡片正面',denied:'无法访问传感器，可拖动卡片。',missing:'未收到倾斜数据，请拖动卡片。',unsupported:'此浏览器无法使用倾斜传感器，请拖动卡片。'},
  };
  function awaitingActivation() {
    return mobile.matches && !reduced.matches && !sensorGranted && !permissionDenied;
  }
  function renderControls() {
    const words = copy[document.documentElement.lang] || copy.ko;
    const awaiting = awaitingActivation();
    card.setAttribute('aria-label', words[awaiting ? 'activate' : flipped ? 'front' : 'back']);
    card.setAttribute('aria-pressed', String(flipped));
    card.setAttribute('aria-busy', String(permissionPending));
    stage.classList.toggle('awaiting-motion',awaiting);
    stage.classList.toggle('is-motion-ready',mobile.matches && sensorEnabled && Boolean(sensorGranted || baseline));
    if (hint) {
      hint.hidden = !awaiting || !permissionChecked;
      hint.textContent = permissionPending ? 'ONE MOMENT…' : 'TOUCH ME!';
    }
    if (status) {
      status.textContent = words[message] || '';
      status.hidden = !status.textContent;
    }
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
    const follow = 1 - Math.exp(-(recentering ? 4 : inside ? 16 : 10) * dt);
    current.x += (target.x - current.x) * follow;
    current.y += (target.y - current.y) * follow;
    const settled = Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
    if (settled) { current.x = target.x; current.y = target.y; }
    const tiltScale = sensorEnabled ? 2 : 1;
    card.style.setProperty('--rx', `${(-current.y * 6 * tiltScale).toFixed(3)}deg`);
    card.style.setProperty('--ry', `${(current.x * 8 * tiltScale).toFixed(3)}deg`);
    card.style.setProperty('--mx', `${((current.x + 1) * 50).toFixed(2)}%`);
    card.style.setProperty('--my', `${((current.y + 1) * 50).toFixed(2)}%`);
    card.style.setProperty('--px', `${(-current.x * 3).toFixed(3)}px`);
    card.style.setProperty('--py', `${(-current.y * 3).toFixed(3)}px`);
    card.style.setProperty('--glare-angle', `${(115 + current.x * 35 - current.y * 20).toFixed(2)}deg`);
    card.style.setProperty('--reflect', `${(0.2 + Math.min(1, Math.hypot(current.x,current.y)) * 0.35).toFixed(3)}`);
    card.style.setProperty('--halo', `${(0.48 + Math.min(1,Math.hypot(current.x,current.y))*0.25).toFixed(3)}`);
    if (!settled) frame = requestAnimationFrame(tick);
    else {
      lastTime = undefined;
      recentering = false;
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
    recentering = false;
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
    if (tapOrigin && Math.hypot(event.clientX-tapOrigin.x,event.clientY-tapOrigin.y)>8) suppressTap = true;
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
    tapOrigin = {x:event.clientX,y:event.clientY}; suppressTap = false;
    if (!mobile.matches || reduced.matches || sensorEnabled || event.pointerType === 'mouse' || (event.target && !event.target.closest('[data-tilt]'))) return;
    dragging = {id:event.pointerId,x:event.clientX,y:event.clientY};
    card.setPointerCapture?.(event.pointerId);
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
  stage.addEventListener('pointercancel', () => {
    suppressTap = true; tapOrigin = null; dragging = null;
    if (!sensorEnabled) leave();
  });
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
    orientationSeen = true;
    applyAttitude(attitude(event));
  }
  function onMotion(event) {
    if (!sensorEnabled || orientationSeen || !mobile.matches || reduced.matches || document.hidden) return;
    const g = event.accelerationIncludingGravity;
    if (!g || ![g.x,g.y,g.z].every(Number.isFinite)) return;
    const length = Math.hypot(g.x,g.y,g.z);
    if (length < 5 || length > 15) return;
    // Gravity provides a pitch/roll fallback where orientation data is unavailable.
    applyAttitude(attitude({alpha:0,beta:Math.atan2(g.y,g.z)*180/Math.PI,gamma:Math.atan2(-g.x,Math.hypot(g.y,g.z))*180/Math.PI}));
  }
  function applyAttitude(q) {
    clearTimeout(sensorTimer);
    // Receiving real data is proof of access, including an already granted iOS session.
    sensorGranted = true;
    permissionChecked = true;
    latestAttitude = q;
    if (!baseline) { baseline = q; message = ''; renderControls(); }
    trackSteadiness(q);
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
  function trackSteadiness(q) {
    const dot = steadyAnchor ? Math.abs(q.x*steadyAnchor.x+q.y*steadyAnchor.y+q.z*steadyAnchor.z+q.w*steadyAnchor.w) : 0;
    // Stay within a three-degree cone for 1.5 seconds; jitter cannot restart calibration.
    if (steadyAnchor && 2*Math.acos(Math.min(1,dot))*180/Math.PI <= 3) return;
    clearTimeout(steadyTimer);
    steadyAnchor = q; steadyCalibrated = false;
    steadyTimer = setTimeout(() => {
      steadyTimer = 0;
      if (!sensorEnabled || document.hidden || reduced.matches || steadyCalibrated) return;
      baseline = latestAttitude; steadyCalibrated = true;
      recentering = true;
      aim(0,0);
    }, 1500);
  }
  function clearSteadiness() {
    clearTimeout(steadyTimer); steadyTimer = 0;
    steadyAnchor = latestAttitude = null; steadyCalibrated = false;
  }
  function detachSensor() {
    window.removeEventListener('deviceorientation', onOrientation);
    window.removeEventListener('devicemotion', onMotion);
    clearTimeout(sensorTimer);
    sensorTimer = 0; sensorEnabled = false; baseline = null; orientationSeen = false;
    clearSteadiness();
  }
  function attachSensor(userInitiated = false) {
    if (!sensorWanted || !mobile.matches || reduced.matches || document.hidden) return;
    detachSensor(); reset();
    sensorEnabled = true;
    window.addEventListener('deviceorientation', onOrientation, {passive:true});
    window.addEventListener('devicemotion', onMotion, {passive:true});
    message = '';
    sensorTimer = setTimeout(() => {
      if (baseline) return;
      detachSensor(); sensorWanted = false; message = userInitiated ? 'missing' : '';
      reset(); renderControls();
    }, 3000);
    renderControls();
  }
  async function enableSensor() {
    if (permissionPending || !mobile.matches || reduced.matches) return;
    permissionChecked = true;
    if (!canSense) { denySensor(); message = 'unsupported'; renderControls(); return; }
    const attempt = ++generation;
    permissionPending = true; message = ''; renderControls();
    try {
      // This call stays directly inside the click handler to preserve iOS user activation.
      // Start both requests before awaiting either: each must retain the same tap's activation.
      const requests = needsPermission && !sensorGranted
        ? permissionAPIs.map(api => {try {return Promise.resolve(api.requestPermission());} catch(error) {return Promise.reject(error);}})
        : [Promise.resolve('granted')];
      const results = await Promise.allSettled(requests);
      if (attempt !== generation || !mobile.matches || reduced.matches) return;
      if (!results.some(result => result.status === 'fulfilled' && result.value === 'granted')) { denySensor(); return; }
      sensorGranted = true; sensorWanted = true;
      attachSensor(true);
    } catch { if (attempt === generation) denySensor(); }
    finally { if (attempt === generation) { permissionPending = false; renderControls(); } }
  }
  function denySensor() {
    permissionDenied = true; sensorWanted = false;
    detachSensor(); reset(); message = 'denied';
  }
  function suspend(cancelPermission = false) {
    // A native permission sheet may temporarily hide the page. Keep that request
    // alive, but do not subscribe until the page is visible again.
    if (cancelPermission) { ++generation; permissionPending = false; }
    clearTimeout(accessTimer);
    detachSensor(); reset(); renderControls();
  }
  function mobileMode() {
    suspend(true);
    stage.classList.toggle('sensor-mobile', mobile.matches && !reduced.matches);
    // Listen without prompting: WebKit can deliver an existing session's granted data.
    // If access is still undecided, the invitation stays visible until a real card tap.
    if (mobile.matches && !reduced.matches && canSense && !permissionDenied) {
      sensorWanted = true; attachSensor();
    }
    renderControls();
    checkExistingAccess();
  }
  async function checkExistingAccess() {
    if (!mobile.matches || reduced.matches || sensorGranted || permissionDenied || permissionPending || document.hidden) return;
    const attempt = generation;
    clearTimeout(accessTimer);
    // Keep the invitation hidden while checking, so an existing grant never flashes it.
    // Without transient activation the standard API resolves an existing decision,
    // or rejects when a new prompt would be required; it cannot open a new prompt.
    if (needsPermission && !window.navigator?.userActivation?.isActive) {
      const results = await Promise.allSettled(permissionAPIs.map(api => {
        try { return Promise.resolve(api.requestPermission()); } catch(error) { return Promise.reject(error); }
      }));
      if (attempt !== generation || reduced.matches || !mobile.matches) return;
      if (results.some(result => result.status === 'fulfilled' && result.value === 'granted')) {
        clearTimeout(accessTimer);
        sensorGranted = true; sensorWanted = true; permissionChecked = true;
        if (!baseline) attachSensor();
        renderControls(); return;
      }
      permissionChecked = true; renderControls(); return;
    }
    accessTimer = setTimeout(() => {
      if (attempt !== generation || sensorGranted) return;
      permissionChecked = true; renderControls();
    }, 500);
  }
  function activateCard(event) {
    if (event?.detail !== 0 && suppressTap) { suppressTap = false; return; }
    if (permissionPending) return;
    // The first activation unlocks motion and leaves the portrait facing forward.
    // Subsequent activations flip the card once permission has been resolved.
    if (awaitingActivation()) return enableSensor();
    flipped = !flipped;
    card.classList.toggle('is-flipped',flipped);
    renderControls();
    // Card activation is also the user gesture required by iOS. No separate controls.
    if (!sensorWanted && !permissionDenied) return enableSensor();
  }
  card.addEventListener('click', activateCard);
  card.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault(); activateCard({detail:0});
    }
  });
  function recenter() { baseline = null; clearSteadiness(); recentering = true; aim(0,0); }
  window.screen?.orientation?.addEventListener('change', recenter);
  window.addEventListener('orientationchange', recenter);
  mobile.addEventListener('change', mobileMode);
  reduced.addEventListener('change', () => { revealing = false; mobileMode(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspend();
    else { if (sensorWanted) attachSensor(); checkExistingAccess(); }
  });
  window.addEventListener('pagehide', () => suspend());
  window.addEventListener('pageshow', () => { if (sensorWanted) attachSensor(); });
  document.addEventListener('teamhjd:languagechange', renderControls);
  mobileMode();
})();
