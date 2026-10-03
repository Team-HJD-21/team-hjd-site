// A single brief visit, triggered by scrolling. Never intercepts page interaction.
const visitor = document.querySelector('.treant-visitor');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let visited = false;
let animation;
function stopVisit() {
  cancelAnimationFrame(animation);
  visitor.hidden = true;
}
function onScroll() {
  if (visited || reducedMotion.matches || scrollY < Math.min(innerHeight * .7, 500)) return;
  visited = true;
  const image = new Image();
  image.src = 'assets/treant-walk.png';
  image.decode().then(() => {
    if (reducedMotion.matches || document.hidden) return;
    visitor.hidden = false;
    const started = performance.now();
    const width = innerWidth;
    function walk(now) {
      if (reducedMotion.matches || document.hidden) { stopVisit(); return; }
      const progress = Math.min((now - started) / 10000, 1);
      visitor.style.transform = `translateX(${-110 + (width + 220) * progress}px)`;
      if (progress < 1) animation = requestAnimationFrame(walk);
      else stopVisit();
    }
    animation = requestAnimationFrame(walk);
  }).catch(() => { /* An unavailable decorative asset must not break the page. */ });
}
addEventListener('scroll', onScroll, {passive: true});
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopVisit(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopVisit(); });
