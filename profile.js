// Progressive enhancement: the photo, content and real links work without JS.
(() => {
  const card = document.querySelector('[data-tilt]');
  if (!card) return;
  const stage = card.closest('.portrait-stage');
  const motion = matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const flipper = card.querySelector('.portrait-flipper');
  const properties = ['--rx', '--ry', '--mx', '--my', '--px', '--py'];
  let frame = 0, lastTime, inside = false;
  const intro = flipper?.getAnimations?.().find(animation => animation.animationName === 'portrait-arrive');
  let revealing = Boolean(intro && intro.playState === 'running') && !reduced.matches;
  const current = {x: 0, y: 0}, target = {x: 0, y: 0};

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
    if (!frame && !revealing && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function reset() {
    cancelAnimationFrame(frame);
    frame = 0; lastTime = undefined; inside = false;
    current.x = current.y = target.x = target.y = 0;
    card.classList.remove('is-tracking');
    clearStyles();
  }
  function leave() {
    inside = false;
    target.x = target.y = 0;
    card.classList.remove('is-tracking');
    if (motion.matches && !revealing) {
      card.classList.add('is-settling');
      start();
    } else reset();
  }
  stage.addEventListener('pointermove', event => {
    if (!motion.matches || event.pointerType === 'touch') return;
    // Measure the untransformed stage so the tilted surface cannot feed back into its own input.
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    target.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    target.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    inside = true;
    if (!revealing) {
      card.classList.remove('is-settling');
      card.classList.add('is-tracking');
      start();
    }
  });
  flipper?.addEventListener('animationend', event => {
    if (event.animationName !== 'portrait-arrive') return;
    revealing = false;
    if (inside && motion.matches) { card.classList.add('is-tracking'); start(); }
  });
  stage.addEventListener('pointerleave', leave);
  stage.addEventListener('pointercancel', reset);
  window.addEventListener('blur', reset);
  motion.addEventListener('change', reset);
  reduced.addEventListener('change', () => { revealing = false; reset(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
})();
