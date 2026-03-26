/**
 * cursor.js — Centered dot cursor
 */

const dot = document.createElement('div');
const ring = document.createElement('div');

dot.style.cssText = 'position:fixed;width:8px;height:8px;background:#333;border-radius:50%;pointer-events:none;z-index:99999;left:50%;top:50%;margin-left:-4px;margin-top:-4px;';

ring.style.cssText = 'position:fixed;width:32px;height:32px;border:2px solid rgba(50,50,50,0.5);border-radius:50%;pointer-events:none;z-index:99998;left:0;top:0;';

document.body.appendChild(dot);
document.body.appendChild(ring);

// Mouse position
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let ringX = mouseX;
let ringY = mouseY;

document.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  
  // Dot always centered
  dot.style.left = mouseX + 'px';
  dot.style.top = mouseY + 'px';
});

const interactive = 'button, a, input, select, textarea, [role="button"], [tabindex="0"]';

document.addEventListener('mouseover', e => {
  if (e.target.closest(interactive)) {
    ring.style.width = '48px';
    ring.style.height = '48px';
    ring.style.border = '2px solid #007AFF';
    ring.style.background = 'rgba(0,122,255,0.15)';
  }
});

document.addEventListener('mouseout', e => {
  if (e.target.closest(interactive)) {
    ring.style.width = '32px';
    ring.style.height = '32px';
    ring.style.border = '2px solid rgba(50,50,50,0.5)';
    ring.style.background = 'transparent';
  }
});

function animate() {
  // Smooth ring follow
  ringX += (mouseX - ringX) * 0.2;
  ringY += (mouseY - ringY) * 0.2;
  
  ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
  
  requestAnimationFrame(animate);
}
animate();

export class CatCursor {}
