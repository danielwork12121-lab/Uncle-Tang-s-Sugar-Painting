/**
 * Scene 9 — End screen sequence
 *
 * Image assets:
 *   Before market: public/assets/button9/BeforeButton9.jpg
 *   Final market: public/assets/button9/Button9.jpg
 *
 * Behavior:
 *   1. Display the "before market" image first.
 *   2. Click anywhere to continue to final market image.
 *   3. Display the final bustling market end image.
 *   4. Ignore clicks on final image (end of game).
 *   5. No popup, no market locked UI, no upgrade cards.
 */

// --- Asset paths served by Vite from /public ---
const SCENE9_BEFORE_IMAGE_SRC = '/assets/button9/BeforeButton9.jpg';
const SCENE9_FINAL_IMAGE_SRC = '/assets/button9/Button9.jpg';

export class Scene9 {
  constructor(containerEl, onComplete) {
    this.container = containerEl;
    this.onComplete = onComplete;
    this._phase = 'beforeMarket';  // 'beforeMarket' | 'finalMarket'

    this._build();
  }

  _build() {
    this.container.innerHTML = '';

    // --- Wrapper fills the viewport ---
    this.wrapper = document.createElement('div');
    this.wrapper.style.cssText = `
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: #000; position: relative; overflow: hidden;
      cursor: pointer;
    `;
    this.container.appendChild(this.wrapper);

    // --- Show first image (before market) ---
    this._showBeforeMarketImage();

    // --- Click handler (state machine based) ---
    this._clickHandler = (e) => {
      console.log('[Scene9] Click handler, phase:', this._phase);

      if (this._phase === 'beforeMarket') {
        // Switch to final market image
        this._phase = 'finalMarket';
        this._showFinalMarketImage();
      } else if (this._phase === 'finalMarket') {
        // Ignore clicks on final image
        console.log('[Scene9] Final image displayed, ignoring click');
      }
    };
    this.wrapper.addEventListener('click', this._clickHandler);

    console.log('[Scene9] Before market image displayed, waiting for click...');
  }

  _showBeforeMarketImage() {
    // Clear wrapper
    while (this.wrapper.firstChild) {
      this.wrapper.removeChild(this.wrapper.firstChild);
    }

    // --- Before market image ---
    this._currentImage = document.createElement('img');
    this._currentImage.style.cssText = `
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    `;
    this._currentImage.alt = 'Before Market';

    // Handle image load error
    this._currentImage.onerror = () => {
      console.error('[Scene9] Failed to load image:', SCENE9_BEFORE_IMAGE_SRC);
      this._showFallback('无法加载图片');
    };

    this._currentImage.src = SCENE9_BEFORE_IMAGE_SRC;
    this.wrapper.appendChild(this._currentImage);

    // --- Click hint ---
    this._clickHint = document.createElement('div');
    this._clickHint.textContent = '点击任意处继续';
    this._clickHint.style.cssText = `
      position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,0.7); font-family: serif; font-size: 18px;
      text-align: center;
      text-shadow: 0 2px 8px rgba(0,0,0,0.7);
      z-index: 35; pointer-events: none;
      animation: scene9FadeInOut 2s ease-in-out infinite;
    `;
    this.wrapper.appendChild(this._clickHint);

    // Add fade animation (only once)
    if (!this._fadeStyleAdded) {
      const fadeStyle = document.createElement('style');
      fadeStyle.textContent = `
        @keyframes scene9FadeInOut {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `;
      this.wrapper.appendChild(fadeStyle);
      this._fadeStyleAdded = true;
    }
  }

  _showFinalMarketImage() {
    // Clear wrapper
    while (this.wrapper.firstChild) {
      this.wrapper.removeChild(this.wrapper.firstChild);
    }

    // --- Final market image ---
    this._currentImage = document.createElement('img');
    this._currentImage.style.cssText = `
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    `;
    this._currentImage.alt = 'Final Market';

    // Handle image load error
    this._currentImage.onerror = () => {
      console.error('[Scene9] Failed to load image:', SCENE9_FINAL_IMAGE_SRC);
      this._showFallback('游戏结束');
    };

    this._currentImage.src = SCENE9_FINAL_IMAGE_SRC;
    this.wrapper.appendChild(this._currentImage);

    // Remove cursor pointer on final image
    this.wrapper.style.cursor = 'default';

    console.log('[Scene9] Final market image displayed (end of game)');
  }

  _showFallback(text) {
    // Remove image if present
    if (this._currentImage) {
      this._currentImage.remove();
      this._currentImage = null;
    }

    // Remove click hint
    if (this._clickHint) {
      this._clickHint.remove();
      this._clickHint = null;
    }

    // Create simple fallback
    const fallback = document.createElement('div');
    fallback.style.cssText = `
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: #000;
      color: #fff; font-family: serif; font-size: 24px;
    `;
    fallback.textContent = text || '游戏结束';
    this.wrapper.appendChild(fallback);
  }

  // ================================================================
  //  Cleanup
  // ================================================================

  destroy() {
    console.log('[Scene9] Destroying, phase:', this._phase);

    // Remove click handler from wrapper
    if (this.wrapper && this._clickHandler) {
      this.wrapper.removeEventListener('click', this._clickHandler);
      this._clickHandler = null;
    }

    // Clear image reference
    if (this._currentImage) {
      this._currentImage.src = '';
      this._currentImage = null;
    }

    // Clear click hint
    if (this._clickHint) {
      this._clickHint = null;
    }

    // Remove all DOM elements
    if (this.wrapper) {
      this.wrapper.remove();
      this.wrapper = null;
    }

    // Clear all references
    this._fadeStyleAdded = null;
    this._phase = null;

    // Clear container
    this.container.innerHTML = '';

    console.log('[Scene9] Destroy complete');
  }
}
