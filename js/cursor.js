/**
 * cursor.js — V4: Premium iOS/macOS Fluid Ring Cursor
 */

export class CatCursor {
  constructor() {
    this.dot = document.createElement('div');
    this.dot.className = 'custom-cursor-dot';
    this.ring = document.createElement('div');
    this.ring.className = 'custom-cursor-ring';
    this.enabled = true;

    document.body.appendChild(this.dot);
    document.body.appendChild(this.ring);

    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.ringX = this.mouseX;
    this.ringY = this.mouseY;

    this.initEvents();
    this.loop();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.dot.style.display = enabled ? 'block' : 'none';
    this.ring.style.display = enabled ? 'block' : 'none';
  }

  initEvents() {
    window.addEventListener('mousemove', e => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (this.enabled) {
        this.dot.style.transform = `translate(calc(${this.mouseX}px - 50%), calc(${this.mouseY}px - 50%))`;
      }
    }, { passive: true });

    const interactiveSelectors = 'button, a, input, [role="button"], [role="tab"], [tabindex="0"], .day-card, .pro-type-badge, .shift-pill, .seg-btn, .mini-item';
    
    document.body.addEventListener('mouseover', e => {
      if (e.target.closest(interactiveSelectors)) {
        document.body.classList.add('cursor-hover');
      }
    });

    document.body.addEventListener('mouseout', e => {
      if (e.target.closest(interactiveSelectors)) {
        document.body.classList.remove('cursor-hover');
      }
    });

    document.body.addEventListener('mouseleave', () => {
      this.dot.style.opacity = '0';
      this.ring.style.opacity = '0';
    });
    document.body.addEventListener('mouseenter', () => {
      if (this.enabled) {
        this.dot.style.opacity = '1';
        this.ring.style.opacity = '1';
      }
    });
  }

  loop() {
    const lerp = 0.25;
    this.ringX += (this.mouseX - this.ringX) * lerp;
    this.ringY += (this.mouseY - this.ringY) * lerp;

    if (this.enabled) {
      this.ring.style.transform = `translate(calc(${this.ringX}px - 50%), calc(${this.ringY}px - 50%))`;
    }

    requestAnimationFrame(() => this.loop());
  }
}
