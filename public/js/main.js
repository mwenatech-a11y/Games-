// Simple slideshow logic
function cycleSlideshow(selector, interval=3000){
  const el = document.querySelector(selector);
  if (!el) return;
  const imgs = el.querySelectorAll('img');
  let idx = 0;
  setInterval(()=> {
    imgs[idx].classList.remove('active');
    idx = (idx + 1) % imgs.length;
    imgs[idx].classList.add('active');
  }, interval);
}

document.addEventListener('DOMContentLoaded', ()=> {
  cycleSlideshow('#main-slideshow', 3500);
  cycleSlideshow('#game-slideshow', 3000);
});
