// Repeated visits never intercept page interaction.
(() => {
const visitor = document.querySelector('.treant-visitor');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let timer;
let animation;
let generation = 0;
// First visit is normal; infected visitors recur during the same page session.
let normalVisitsLeft = 2 + Math.floor(Math.random() * 3);
function stopVisit() {
  generation++;
  cancelAnimationFrame(animation);
  clearTimeout(timer);
  visitor.hidden = true;
  visitor.classList.remove('treant-idle');
}
function startVisit() {
  stopVisit();
  if (document.hidden) return;
  const visitGeneration = generation;
  let infected = normalVisitsLeft === 0;
  const image = new Image();
  image.src = infected ? 'assets/treant-infected-walk.png' : 'assets/treant-walk.png';
  image.decode().catch(error => {
    if (!infected) throw error;
    infected = false;
    image.src = 'assets/treant-walk.png';
    return image.decode();
  }).then(() => {
    if (visitGeneration !== generation || document.hidden) return;
    visitor.classList.toggle('treant-infected', infected);
    const idleImage = new Image();
    idleImage.src = infected ? 'assets/treant-infected-idle.png' : 'assets/treant-idle.png';
    let idleReady = false;
    idleImage.decode().then(() => { idleReady = true; }).catch(() => {});
    normalVisitsLeft = infected ? 1 + Math.floor(Math.random() * 3) : Math.max(0, normalVisitsLeft - 1);
    visitor.hidden = false;
    const started = performance.now();
    const duration = reducedMotion.matches ? 20000 : 10000;
    const width = innerWidth;
    // Keep the whole visitor visible while it looks toward the viewer.
    const pauseX = 16 + Math.random() * Math.max(0, width - 128);
    const pauseAt = (pauseX + 110) / (width + 220) * duration;
    const pauseDuration = 1800 + Math.random() * 2200;
    let pausedFor = 0;
    let pauseStarted;
    let pauseComplete = false;
    function walk(now) {
      if (document.hidden) { stopVisit(); return; }
      const elapsed = now - started;
      if (!pauseComplete && idleReady && elapsed >= pauseAt) {
        pauseStarted ??= now;
        if (now - pauseStarted < pauseDuration) {
          visitor.classList.add('treant-idle');
          visitor.style.transform = `translateX(${pauseX}px)`;
          animation = requestAnimationFrame(walk);
          return;
        }
        pausedFor = now - pauseStarted;
        pauseComplete = true;
        visitor.classList.remove('treant-idle');
      }
      const progress = Math.min((elapsed - pausedFor) / duration, 1);
      visitor.style.transform = `translateX(${-110 + (width + 220) * progress}px)`;
      if (progress < 1) animation = requestAnimationFrame(walk);
      else visitor.hidden = true;
    }
    animation = requestAnimationFrame(walk);
    timer = setTimeout(startVisit, 30000);
  }).catch(() => { /* An unavailable decorative asset must not break the page. */ });
}
startVisit();
reducedMotion.addEventListener('change', startVisit);
document.addEventListener('visibilitychange', startVisit);
})();
