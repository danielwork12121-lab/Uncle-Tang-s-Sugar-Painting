/**
 * Scene 4 — Video cutscene after Scene 3 candy pouring success
 *
 * Video asset:
 *   public/assets/scene4/candy-finished-cutscene.mp4
 *   (copied from Animations/Assets/Candy pouring and cutting mini Games/CUT SCENE/Candy finished cut scene.MP4)
 *
 * Hand pointer asset:
 *   public/assets/ui/handpointer.png
 *   (reused from Act1Scene)
 *
 * Behavior:
 *   1. Full-screen video player on launch.
 *   2. Autoplay if allowed; otherwise "Click to Start" overlay.
 *   3. When video ends, keep final frame visible.
 *   4. Show hand pointer image with bobbing animation.
 *   5. Show "点击任意处继续" text prompt.
 *   6. Click anywhere on screen → transition to candy making game.
 *
 * Audio:
 *   - Stop Scene 3 background music when Scene 4 starts.
 *   - Let the video audio play normally.
 *   - Do not play extra game background music during this video.
 */

// --- Asset paths served by Vite from /public ---
const SCENE4_VIDEO_SRC = '/assets/scene4/candy-finished-cutscene.mp4';
const SCENE4_HAND_POINTER_SRC = '/assets/ui/handpointer.png';

export class Scene4 {
  constructor(containerEl, onComplete) {
    this.container = containerEl;
    this.onComplete = onComplete;
    this._videoEnded = false;
    this._transitioned = false;
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
    `;
    this.container.appendChild(this.wrapper);

    // --- Video element (full-size, centered) ---
    this.video = document.createElement('video');
    this.video.style.cssText = `
      width: 100%; height: 100%; object-fit: contain;
      display: block;
    `;
    this.video.controls = false;
    this.video.muted = false;
    this.video.playsInline = true;
    this.video.preload = 'auto';

    // Set video source
    this.video.src = SCENE4_VIDEO_SRC;

    this.video.addEventListener('error', (e) => {
      console.error('[Scene4] Video failed to load:', SCENE4_VIDEO_SRC, e);
    });

    // When video ends, keep the final frame and show the hand pointer
    this.video.addEventListener('ended', () => {
      this._videoEnded = true;
      this._showHandPointer();
    });

    this.wrapper.appendChild(this.video);

    // --- Click-to-skip hint (visible during playback) ---
    this.skipHint = document.createElement('div');
    this.skipHint.textContent = '点击跳过 ▶';
    this.skipHint.style.cssText = `
      position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,0.5); font-family: sans-serif; font-size: 14px;
      cursor: pointer; user-select: none; z-index: 10;
      transition: opacity 0.3s;
    `;
    this.wrapper.appendChild(this.skipHint);

    // --- Click handler (skip during video, or transition after video ends) ---
    this._clickHandler = (e) => {
      if (this._transitioned) return;

      if (!this._videoEnded) {
        // Skip: jump to end and show hand pointer
        this.video.currentTime = this.video.duration;
        this.video.pause();
        this._videoEnded = true;
        if (this.skipHint) this.skipHint.remove();
        this._showHandPointer();
      } else {
        // Video already ended — transition to candy making game
        this._transitionToCandyMaking();
      }
    };
    this.wrapper.addEventListener('click', this._clickHandler);

    // --- Autoplay ---
    this.video.play().catch(() => {
      // Autoplay blocked — show a "Click to Start" overlay
      this._showStartOverlay();
    });
  }

  // ================================================================
  //  Click to Start overlay (when autoplay is blocked)
  // ================================================================

  _showStartOverlay() {
    if (this._startOverlay) return;

    this._startOverlay = document.createElement('div');
    this._startOverlay.style.cssText = `
      position: absolute; inset: 0; z-index: 20;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.75); cursor: pointer;
    `;

    const icon = document.createElement('div');
    icon.innerHTML = '▶';
    icon.style.cssText = `
      font-size: 64px; color: #e8c170; margin-bottom: 20px;
      animation: scene4Pulse 2s infinite;
    `;
    this._startOverlay.appendChild(icon);

    const text = document.createElement('div');
    text.textContent = '点击开始';
    text.style.cssText = `
      color: #e8c170; font-family: serif; font-size: 28px;
      text-shadow: 0 0 12px rgba(232,193,112,0.5);
    `;
    this._startOverlay.appendChild(text);

    // Pulse keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes scene4Pulse {
        0%, 100% { transform: scale(1); opacity: 0.7; }
        50% { transform: scale(1.1); opacity: 1; }
      }
    `;
    this._startOverlay.appendChild(style);

    this._startOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this._startOverlay.remove();
      this._startOverlay = null;
      this.video.play();
    });

    this.wrapper.appendChild(this._startOverlay);
  }

  // ================================================================
  //  Hand pointer on final frame (reused from Act1Scene)
  // ================================================================

  _showHandPointer() {
    if (this._handPointerEl) return;

    // Remove skip hint
    if (this.skipHint) {
      this.skipHint.remove();
      this.skipHint = null;
    }

    // Remove start overlay if still present
    if (this._startOverlay) {
      this._startOverlay.remove();
      this._startOverlay = null;
    }

    // --- Hand pointer image ---
    this._handPointerEl = document.createElement('img');
    this._handPointerEl.src = SCENE4_HAND_POINTER_SRC;
    this._handPointerEl.alt = '点击继续';
    this._handPointerEl.style.cssText = `
      position: absolute;
      left: 50%;
      top: 47%;
      transform: translate(-35%, -10%);
      width: min(100px, 12vw);
      height: auto;
      z-index: 40;
      pointer-events: none;
      animation: scene4HandBob 1s ease-in-out infinite;
      filter: drop-shadow(0 0 8px rgba(255,215,0,0.7));
    `;

    this._handPointerEl.addEventListener('error', () => {
      console.warn('[Scene4] Hand pointer image failed to load:', SCENE4_HAND_POINTER_SRC);
      // Fallback: show an emoji pointer
      if (this._handPointerEl) {
        this._handPointerEl.remove();
        this._handPointerEl = null;
      }
      this._showFallbackPointer();
    });

    this.wrapper.appendChild(this._handPointerEl);

    // --- Bobbing animation ---
    const animStyle = document.createElement('style');
    animStyle.textContent = `
      @keyframes scene4HandBob {
        0%, 100% { transform: translate(-35%, -10%) translateY(0px); }
        50% { transform: translate(-35%, -10%) translateY(-14px); }
      }
    `;
    this.wrapper.appendChild(animStyle);
    this._animStyle = animStyle;

    // --- "点击任意处继续" text ---
    this._clickPrompt = document.createElement('div');
    this._clickPrompt.textContent = '点击任意处继续';
    this._clickPrompt.style.cssText = `
      position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,0.6); font-family: serif; font-size: 18px;
      z-index: 35; pointer-events: none;
      animation: scene4FadeInOut 2s ease-in-out infinite;
    `;
    this.wrapper.appendChild(this._clickPrompt);

    const fadeStyle = document.createElement('style');
    fadeStyle.textContent = `
      @keyframes scene4FadeInOut {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
    `;
    this.wrapper.appendChild(fadeStyle);
  }

  _showFallbackPointer() {
    // Emoji fallback if handpointer.png fails to load
    this._fallbackPointer = document.createElement('div');
    this._fallbackPointer.innerHTML = '👆';
    this._fallbackPointer.style.cssText = `
      position: absolute;
      left: 50%;
      top: 47%;
      transform: translate(-50%, -20%);
      font-size: min(48px, 8vw);
      z-index: 40;
      pointer-events: none;
      animation: scene4HandBob 1s ease-in-out infinite;
      filter: drop-shadow(0 0 6px rgba(255,215,0,0.6));
    `;
    this.wrapper.appendChild(this._fallbackPointer);

    if (!this._animStyle) {
      const s = document.createElement('style');
      s.textContent = `
        @keyframes scene4HandBob {
          0%, 100% { transform: translate(-50%, -20%) translateY(0px); }
          50% { transform: translate(-50%, -20%) translateY(-14px); }
        }
      `;
      this.wrapper.appendChild(s);
      this._animStyle = s;
    }
  }

  // ================================================================
  //  Transition to candy making game
  // ================================================================

  _transitionToCandyMaking() {
    if (this._transitioned) return;
    this._transitioned = true;

    // Fade out everything
    this.wrapper.style.transition = 'opacity 0.5s ease';
    this.wrapper.style.opacity = '0';

    // After fade, call onComplete
    this._transitionTimeout = setTimeout(() => {
      if (this.onComplete) this.onComplete();
    }, 500);
  }

  // ================================================================
  //  Cleanup
  // ================================================================

  destroy() {
    // Clear transition timeout if pending
    if (this._transitionTimeout) {
      clearTimeout(this._transitionTimeout);
      this._transitionTimeout = null;
    }

    // Clean up video
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.video.load();
      this.video = null;
    }

    // Clean up hand pointer image (cancel any pending image load)
    if (this._handPointerEl) {
      this._handPointerEl.src = '';
      this._handPointerEl = null;
    }

    // Clean up fallback pointer
    if (this._fallbackPointer) {
      this._fallbackPointer = null;
    }

    // Clean up click prompt
    if (this._clickPrompt) {
      this._clickPrompt = null;
    }

    // Clean up anim style
    if (this._animStyle) {
      this._animStyle = null;
    }

    // Remove click handler
    if (this.wrapper && this._clickHandler) {
      this.wrapper.removeEventListener('click', this._clickHandler);
      this._clickHandler = null;
    }

    // Clear container
    this.container.innerHTML = '';
  }
}
