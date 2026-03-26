/**
 * cursor.js — V6: Robust cursor with fallback
 */

export class CatCursor {
  constructor() {
    this.dot = document.createElement('div');
    this.dot.className = 'custom-cursor-dot';
    this.ring = document.createElement('div');
    this.ring.className = 'custom-cursor-ring';
    this.enabled = true;
    this.isVisible = false;

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
    if (enabled) {
      this.dot.style.opacity = '1';
      this.ring.style.opacity = '1';
    } else {
      this.dot.style.opacity = '0';
      this.ring.style.opacity = '0';
    }
  }

  initEvents() {
    window.addEventListener('mousemove', e => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      
      if (!this.isVisible) {
        this.isVisible = true;
        this.dot.style.opacity = '1';
        this.ring.style.opacity = '1';
      }
      
      this.dot.style.transform = `translate(${this.mouseX}px, ${this.mouseY}px) translate(-50%, -50%)`;
    }, { passive: true });

    const interactiveSelectors = 'button, a, input, [role="button"], [role="tab"], [tabindex="0"], .day-card, .pro-type-badge, .shift-pill, .seg-btn, .mini-item';
    
    document.addEventListener('mouseover', e => {
      if (e.target.closest(interactiveSelectors)) {
        this.dot.classList.add('cursor-dot-hover');
        this.ring.classList.add('cursor-ring-hover');
      }
    });

    document.addEventListener('mouseout', e => {
      if (e.target.closest(interactiveSelectors)) {
        this.dot.classList.remove('cursor-dot-hover');
        this.ring.classList.remove('cursor-ring-hover');
      }
    });
    
    document.addEventListener('mouseleave', () => {
      this.isVisible = false;
      this.dot.style.opacity = '0';
      this.ring.style.opacity = '0';
    });
    
    document.addEventListener('mouseenter', () => {
      this.isVisible = true;
      this.dot.style.opacity = '1';
      this.ring.style.opacity = '1';
    });
  }

  loop() {
    const lerp = 0.2;
    this.ringX += (this.mouseX - this.ringX) * lerp;
    this.ringY += (this.mouseY - this.ringY) * lerp;

    if (this.enabled) {
      this.ring.style.transform = `translate(${this.ringX}px, ${this.ringY}px) translate(-50%, -50%)`;
    }

    requestAnimationFrame(() => this.loop());
  }
}
