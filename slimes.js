// Decorative click visitors; links and controls retain their normal behavior.
(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const actors = new Set();
  let ready = false;
  let lastSpawn = -Infinity;
  Promise.all(['tentacle', 'king'].map(kind => {
    const image = new Image();
    image.src = `assets/slime-${kind}-walk.png`;
    return image.decode();
  })).then(() => { ready = true; }).catch(() => {});
  function remove(actor) {
    cancelAnimationFrame(actor.animation);
    actor.element.remove();
    actors.delete(actor);
  }
  function clear() { for (const actor of actors) remove(actor); }
  document.addEventListener('click', event => {
    if (!ready || motion.matches || document.hidden || event.detail === 0 ||
        event.target.closest('a, button, input, select, textarea, summary, [role="button"]') ||
        getSelection()?.toString()) return;
    const start = performance.now();
    if (start - lastSpawn < 100) return;
    lastSpawn = start;
    if (actors.size >= 12) remove(actors.values().next().value);
    const king = Math.random() < .05;
    const angle = Math.random() * Math.PI * 2;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const row = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
    const element = document.createElement('div');
    element.className = `slime-visitor${king ? ' slime-king' : ''}`;
    element.setAttribute('aria-hidden', 'true');
    element.style.setProperty('--slime-row', `${-48 - row * 192}px`);
    document.body.append(element);
    const actor = {element, animation: null};
    actors.add(actor);
    const speed = king ? 45 : 70;
    function move(now) {
      const seconds = (now - start) / 1000;
      const x = event.clientX + dx * speed * seconds;
      const y = event.clientY + dy * speed * seconds;
      element.style.transform = `translate(${x - 48}px, ${y - 48}px)`;
      element.style.opacity = String(Math.min(1, 8 - seconds));
      if (seconds >= 8 || x < -96 || x > innerWidth + 96 || y < -96 || y > innerHeight + 96) remove(actor);
      else actor.animation = requestAnimationFrame(move);
    }
    move(start);
    // Best-effort, once per spawned slime, within the real user's click.
    // Unsupported or blocked vibration must never interrupt the animation.
    if (event.isTrusted && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(20); } catch { /* Device/browser policy may block it. */ }
    }
  });
  motion.addEventListener('change', () => { if (motion.matches) clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
})();
