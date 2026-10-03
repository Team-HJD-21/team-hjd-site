// Hero-only ambient movement. Artwork, text and controls remain in front.
(() => {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const layer = document.createElement('div');
  layer.className = 'meteor-layer';
  // Prevent a cached/failed stylesheet from turning decoration into a grid cell.
  layer.style.cssText = 'position:absolute;top:0;bottom:0;left:50%;width:100vw;transform:translateX(-50%);overflow:hidden;pointer-events:none;z-index:0;contain:strict';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  hero.prepend(layer);
  for (const content of hero.querySelectorAll('.hero-copy,.game-visual')) {
    content.style.position = 'relative';
    content.style.zIndex = '1';
  }
  const actors = new Set();
  let assets = [];
  let inView = false;
  let generation = 0;
  let resizeFrame;
  let lastWidth = 0, lastHeight = 0;
  const random = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);
  const enabled = () => assets.length && inView && !document.hidden;
  function clear() {
    generation++;
    for (const actor of actors) { actor.animation.cancel(); actor.element.remove(); }
    actors.clear();
    layer.hidden = true;
  }
  function spawn(visit, spread = false) {
    if (visit !== generation || !enabled()) return;
    const width = layer.clientWidth, height = layer.clientHeight;
    if (!width || !height) return;
    const asset = assets[Math.floor(Math.random() * assets.length)];
    const mobile = width < 600;
    const size = asset.big ? random(30, mobile ? 54 : 78) : random(12, mobile ? 30 : 42);
    const spriteHeight = size * asset.ratio;
    const fromLeft = Math.random() < .5;
    const x1 = fromLeft ? -size * 1.5 : width + size * .5;
    const x2 = fromLeft ? width + size * .5 : -size * 1.5;
    const y1 = random(-spriteHeight * .5, height - spriteHeight * .5);
    const y2 = Math.max(-spriteHeight, Math.min(height, y1 + random(-height * .35, height * .35)));
    const angle = motion.matches ? 0 : random(0, 360);
    const spin = motion.matches ? 0 : random(-150, 150);
    const duration = motion.matches ? random(30000, 45000) : random(11000, 21000);
    const opacity = random(.32, .5);
    const element = document.createElement('div');
    element.className = 'meteor';
    element.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;background-size:100% 100%;background-repeat:no-repeat;image-rendering:pixelated;opacity:0';
    element.style.width = `${size}px`;
    element.style.height = `${spriteHeight}px`;
    element.style.backgroundImage = `url("${asset.src}")`;
    layer.append(element);
    const animation = element.animate([
      {transform:`translate(${x1}px, ${y1}px) rotate(${angle}deg)`,opacity:0,offset:0},
      {opacity,offset:.12},
      {opacity,offset:.88},
      {transform:`translate(${x2}px, ${y2}px) rotate(${angle+spin}deg)`,opacity:0,offset:1}
    ], {duration,easing:'linear',fill:'forwards'});
    // Begin at different points so the background feels continuous on arrival.
    if (spread) animation.currentTime = random(duration * .12, duration * .8);
    const actor = {element,animation};
    actors.add(actor);
    animation.finished.then(() => {
      element.remove();
      actors.delete(actor);
      if (visit === generation) spawn(visit);
    }).catch(() => { /* Expected when the hero leaves view or motion is disabled. */ });
  }
  function refresh() {
    clear();
    if (!enabled()) return;
    layer.hidden = false;
    const visit = generation;
    const count = motion.matches ? 2 : (innerWidth < 600 ? 3 : 5);
    for (let index = 0; index < count; index++) spawn(visit, true);
  }
  const observer = new IntersectionObserver(entries => {
    const next = entries[0].isIntersecting;
    if (next !== inView) { inView = next; refresh(); }
  });
  observer.observe(hero);
  new ResizeObserver(entries => {
    const {width,height} = entries[0].contentRect;
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width; lastHeight = height;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(refresh);
  }).observe(hero);
  Promise.allSettled([
    {src:'assets/meteor-big.png',big:true},
    {src:'assets/meteor-small.png',big:false}
  ].map(async asset => {
    const image = new Image();
    image.src = asset.src;
    await image.decode();
    return {...asset,ratio:image.naturalHeight/image.naturalWidth};
  })).then(results => {
    assets = results.filter(result=>result.status==='fulfilled').map(result=>result.value);
    refresh();
  });
  motion.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', refresh);
  addEventListener('pagehide', clear);
  addEventListener('pageshow', refresh);
})();
