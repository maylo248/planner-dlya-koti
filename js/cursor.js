/**
 * cursor.js — V7: Simple custom cursor
 */

export class CatCursor {
  constructor() {
    this.dot = document.createElement('div');
    this.dot.className = 'custom-cursor-dot';
    this.ring = document.createElement('div');
    this.ring.className = 'custom-cursor-ring';
    
    document.body.appendChild(this.dot);
    document.body.appendChild(this.ring);

    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.ringX = this.mouseX;
    this.ringY = this.mouseY;

    this.initEvents();
    this.loop();
  }

  initEvents() {
    window.addEventListener('mousemove', e => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.dot.style.transform = `translate(${this.mouseX}px, ${this.mouseY}px) translate(-50%, -50%)`;
    }, { passive: true });

    const interactiveSelectors = 'button, a, input, select, textarea, [role="button"], [role="tab"], [tabindex="0"], .day-card, .pro-type-badge, .shift-pill, .seg-btn, .mini-item, label';
    
    document.addEventListener('mouseover', e => {
      if (e.target.closest(interactiveSelectors)) {
        this.ring.classList.add('cursor-ring-hover');
      }
    });

    document.addEventListener('mouseout', e => {
      if (e.target.closest(interactiveSelectors)) {
        this.ring.classList.remove('cursor-ring-hover');
      }
    });
  }

  loop() {
    const lerp = 0.15;
    this.ringX += (this.mouseX - this.ringX) * lerp;
    this.ringY += (this.mouseY - this.ringY) * lerp;
    this.ring.style.transform = `translate(${this.ringX}px, ${this.ringY}px) translate(-50%, -50%)`;
    requestAnimationFrame(() => this.loop());
  }
}
