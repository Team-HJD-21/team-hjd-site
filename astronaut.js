// A decorative side visitor, never a click target or a page-layout element.
(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = document.createElement('div');
  stage.className = 'astronaut-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.hidden = true;
  const actor = document.createElement('div');
  actor.className = 'astronaut-peeker';
  const sprite = document.createElement('div');
  sprite.className = 'astronaut-sprite';
  actor.append(sprite);
  stage.append(actor);
  document.body.append(stage);
  let ready = false;
  let timer;
  let animation;
  let generation = 0;

  function reset() {
    generation++;
    clearTimeout(timer);
    animation?.cancel();
    animation = null;
    stage.hidden = true;
  }
  function schedule(first = false) {
    clearTimeout(timer);
    if (!ready || document.hidden) return;
    timer = setTimeout(peek, first ? 12000 + Math.random() * 10000 : 25000 + Math.random() * 25000);
  }
  function peek() {
    reset();
    if (!ready || document.hidden) return;
    const visit = generation;
    const left = Math.random() < .5;
    actor.classList.toggle('from-left', left);
    actor.classList.toggle('from-right', !left);
    // Keep clear of the language menu and bottom-walking treant.
    const height = 94;
    const minimum = Math.min(120, Math.max(12, innerHeight - height - 12));
    const maximum = Math.max(minimum, innerHeight - height - 120);
    actor.style.top = `${Math.round(minimum + Math.random() * (maximum - minimum))}px`;
    stage.hidden = false;
    const sign = left ? -1 : 1;
    animation = actor.animate([
      {transform: `translateX(${sign * 110}%)`, offset: 0},
      {transform: `translateX(${sign * 36}%)`, offset: .2},
      {transform: `translateX(${sign * 36}%)`, offset: .72},
      {transform: `translateX(${sign * 110}%)`, offset: 1}
    ], {duration: motion.matches ? 6000 : 4200, easing: 'ease-in-out', fill: 'forwards'});
    animation.finished.then(() => {
      if (visit !== generation) return;
      stage.hidden = true;
      animation.cancel();
      animation = null;
      schedule();
    }).catch(() => { /* Cancellation during tab/motion changes is expected. */ });
  }
  function restart() { reset(); schedule(true); }
  const image = new Image();
  image.src = 'assets/astronaut-sheet.png';
  image.decode().then(() => { ready = true; restart(); }).catch(() => {
    reset(); // An unavailable decorative image must never interrupt navigation.
  });
  motion.addEventListener('change', restart);
  document.addEventListener('visibilitychange', restart);
  addEventListener('resize', restart);
  addEventListener('pagehide', reset);
  addEventListener('pageshow', restart);
})();
