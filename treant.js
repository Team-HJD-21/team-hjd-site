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
}
function startVisit() {
  stopVisit();
  if (reducedMotion.matches || document.hidden) return;
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
    if (visitGeneration !== generation || reducedMotion.matches || document.hidden) return;
    visitor.classList.toggle('treant-infected', infected);
    normalVisitsLeft = infected ? 1 + Math.floor(Math.random() * 3) : Math.max(0, normalVisitsLeft - 1);
    visitor.hidden = false;
    const started = performance.now();
    const width = innerWidth;
    function walk(now) {
      if (reducedMotion.matches || document.hidden) { stopVisit(); return; }
      const progress = Math.min((now - started) / 10000, 1);
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
