/**
 * Act 1 Scene — Plays a start video, pauses for click, then plays the main cutscene.
 *
 * Video assets:
 *   Start video: public/assets/start/Start video.MP4
 *   Main cutscene: public/assets/animations/act1/final-beginning-scene.mp4
 *   (copied from Animations/Act 1/Final beginning scene.MP4)
 *
 * Hand pointer asset:
 *   public/assets/ui/handpointer.png
 *   (copied from Animations/Assets/handPointer.png)
 *
 * Behavior:
 *   1. Play start video first.
 *   2. Show "点击任意处继续" during start video (to skip).
 *   3. When start video ends, pause and show "点击任意处继续" (simple text, no emoji).
 *   4. Click anywhere to start main cutscene.
 *   5. Full-screen video player for main cutscene.
 *   6. Autoplay if allowed; otherwise "Click to Start" overlay.
 *   7. When main cutscene ends, keep final frame visible (video stays at end).
 *   8. Show hand pointer image above the copper pot, bobbing up/down.
 *   9. Click anywhere on screen → transition to Scene 2.
 *
 * Pointer placement (responsive):
 *   Target: center-upper area of copper pot
 *   CSS: left:50%, top:47%, transform:translate(-35%,-10%)
 *   Hand image width: ~100px (responsive)
 *
 * TODO later: replace hard-coded asset paths with a config/constants file
 * TODO later: add audio (background music, sound effects)
 */

// --- Asset paths served by Vite from /public ---
const START_VIDEO_SRC = '/assets/start/Start video.mov';
const VIDEO_SRC = '/assets/animations/act1/final-beginning-scene.mp4';
// Cache-busting query param ensures the updated hand pointer is loaded
const HAND_POINTER_SRC = '/assets/ui/handpointer.png';

export class Act1Scene {
  constructor(containerEl, onComplete) {
    this.container = containerEl;
    this.onComplete = onComplete;
    this._videoEnded = false;
    this._transitioned = false;
    this._phase = 'startVideo';  // 'startVideo' | 'waitingClickToSecondVideo' | 'scene1Cutscene'
    this._buildStartVideo();
  }

  // ================================================================
  //  Start Video Phase
  // ================================================================

  _buildStartVideo() {
    this.container.innerHTML = '';

    // --- Wrapper fills the viewport ---
    this.wrapper = document.createElement('div');
    this.wrapper.style.cssText = `
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: #000; position: relative; overflow: hidden;
    `;
    this.container.appendChild(this.wrapper);

    // --- Start video element (full-size, centered) ---
    this.startVideo = document.createElement('video');
    this.startVideo.style.cssText = `
      width: 100%; height: 100%; object-fit: contain;
      display: block;
    `;
    this.startVideo.controls = false;
    this.startVideo.muted = false;
    this.startVideo.playsInline = true;
    this.startVideo.preload = 'auto';

    // Set start video source
    this.startVideo.src = START_VIDEO_SRC;

    this.startVideo.addEventListener('error', (e) => {
      console.error('[Act1Scene] Start video failed to load:', START_VIDEO_SRC, e);
      // If start video fails, skip to main cutscene
      this._transitionToMainCutscene();
    });

    // When start video ends, pause and show click prompt
    this.startVideo.addEventListener('ended', () => {
      if (this._phase === 'startVideo') {
        this._showStartVideoClickPrompt();
      }
    });

    this.wrapper.appendChild(this.startVideo);

    // --- Click-to-continue hint (visible during start video) ---
    this.startVideoHint = document.createElement('div');
    this.startVideoHint.textContent = '点击任意处跳过';
    this.startVideoHint.style.cssText = `
      position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,0.5); font-family: sans-serif; font-size: 14px;
      cursor: pointer; user-select: none; z-index: 10;
      transition: opacity 0.3s;
    `;
    this.wrapper.appendChild(this.startVideoHint);

    // --- Click handler for start video phase ---
    this._startVideoClickHandler = (e) => {
      if (this._transitioned) return;
      if (this._phase !== 'startVideo' && this._phase !== 'waitingClickToSecondVideo') return;

      if (this._phase === 'startVideo') {
        // Skip start video: pause and show prompt
        if (this.startVideo) {
          this.startVideo.pause();
        }
        this._showStartVideoClickPrompt();
      } else if (this._phase === 'waitingClickToSecondVideo') {
        // Player clicked to start main cutscene
        this._transitionToMainCutscene();
      }
    };
    this.wrapper.addEventListener('click', this._startVideoClickHandler);

    // --- Autoplay start video ---
    this.startVideo.play().catch(() => {
      // Autoplay blocked — show a "Click to Start" overlay
      this._showStartVideoOverlay();
    });
  }

  // ================================================================
  //  Show click prompt after start video ends (simple text, no emoji)
  // ================================================================

  _showStartVideoClickPrompt() {
    if (this._phase === 'waitingClickToSecondVideo') return;
    this._phase = 'waitingClickToSecondVideo';

    console.log('[Act1Scene] Start video ended, showing click prompt');

    // Remove skip hint
    if (this.startVideoHint) {
      this.startVideoHint.remove();
      this.startVideoHint = null;
    }

    // Show simple text prompt (no emoji, no bouncing hand)
    if (!this._clickPrompt) {
      this._clickPrompt = document.createElement('div');
      this._clickPrompt.textContent = '点击任意处继续';
      this._clickPrompt.style.cssText = `
        position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%);
        color: rgba(255,255,255,0.7); font-family: serif; font-size: 18px;
        text-align: center;
        text-shadow: 0 2px 8px rgba(0,0,0,0.7);
        z-index: 35; pointer-events: none;
        animation: act1FadeInOut 2s ease-in-out infinite;
      `;
      this.wrapper.appendChild(this._clickPrompt);

      // Add fade animation (only once)
      if (!this._fadeStyleAdded) {
        const fadeStyle = document.createElement('style');
        fadeStyle.textContent = `
          @keyframes act1FadeInOut {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
        `;
        this.wrapper.appendChild(fadeStyle);
        this._fadeStyleAdded = true;
      }
    }

    console.log('[Act1Scene] Click prompt shown, waiting for player click...');
  }

  _showStartVideoOverlay() {
    if (this._startVideoOverlay) return;

    this._startVideoOverlay = document.createElement('div');
    this._startVideoOverlay.style.cssText = `
      position: absolute; inset: 0; z-index: 20;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.75); cursor: pointer;
    `;

    const icon = document.createElement('div');
    icon.innerHTML = '▶';
    icon.style.cssText = `
      font-size: 64px; color: #e8c170; margin-bottom: 20px;
      animation: act1Pulse 2s infinite;
    `;
    this._startVideoOverlay.appendChild(icon);

    const text = document.createElement('div');
    text.textContent = 'Click to Start';
    text.style.cssText = `
      color: #e8c170; font-family: serif; font-size: 28px;
      text-shadow: 0 0 12px rgba(232,193,112,0.5);
    `;
    this._startVideoOverlay.appendChild(text);

    // Pulse keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes act1Pulse {
        0%, 100% { transform: scale(1); opacity: 0.7; }
        50% { transform: scale(1.1); opacity: 1; }
      }
    `;
    this._startVideoOverlay.appendChild(style);

    this._startVideoOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this._startVideoOverlay.remove();
      this._startVideoOverlay = null;
      if (this.startVideo) {
        this.startVideo.play();
      }
    });

    this.wrapper.appendChild(this._startVideoOverlay);
  }

  _transitionToMainCutscene() {
    if (this._phase === 'scene1Cutscene') return;
    this._phase = 'scene1Cutscene';

    // Clean up start video
    if (this.startVideo) {
      this.startVideo.pause();
      this.startVideo.src = '';
      this.startVideo.load();
      this.startVideo = null;
    }
    if (this.startVideoHint) {
      this.startVideoHint.remove();
      this.startVideoHint = null;
    }
    if (this._startVideoOverlay) {
      this._startVideoOverlay.remove();
      this._startVideoOverlay = null;
    }
    if (this._clickPrompt) {
      this._clickPrompt.remove();
      this._clickPrompt = null;
    }

    // Remove start video click handler
    if (this._startVideoClickHandler) {
      this.wrapper.removeEventListener('click', this._startVideoClickHandler);
      this._startVideoClickHandler = null;
    }

    // Build main cutscene
    this._build();
  }

  // ================================================================
  //  Main Cutscene Phase (existing logic)
  // ================================================================

  _build() {
    // Clear wrapper (keep it)
    while (this.wrapper.firstChild) {
      this.wrapper.removeChild(this.wrapper.firstChild);
    }

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

    // Set video source (clean alias from public/)
    this.video.src = VIDEO_SRC;

    this.video.addEventListener('error', (e) => {
      console.error('[Act1Scene] Video failed to load:', VIDEO_SRC, e);
    });

    // When video ends, keep the final frame and show the hand pointer
    this.video.addEventListener('ended', () => {
      this._videoEnded = true;
      this._showHandPointer();
    });

    this.wrapper.appendChild(this.video);

    // --- Click-to-skip hint (visible during playback) ---
    this.skipHint = document.createElement('div');
    this.skipHint.textContent = 'Click anywhere to skip ▶';
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
      if (this._phase !== 'scene1Cutscene') return;

      if (!this._videoEnded) {
        // Skip: jump to end and show hand pointer
        this.video.currentTime = this.video.duration;
        this.video.pause();
        this._videoEnded = true;
        if (this.skipHint) this.skipHint.remove();
        this._showHandPointer();
      } else {
        // Video already ended — transition to Scene 2
        this._transitionToScene2();
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
      animation: act1Pulse 2s infinite;
    `;
    this._startOverlay.appendChild(icon);

    const text = document.createElement('div');
    text.textContent = 'Click to Start';
    text.style.cssText = `
      color: #e8c170; font-family: serif; font-size: 28px;
      text-shadow: 0 0 12px rgba(232,193,112,0.5);
    `;
    this._startOverlay.appendChild(text);

    // Pulse keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes act1Pulse {
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
  //  Hand pointer on final frame
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
    // Position: center-upper area of the copper pot
    // Normalized: x=50%, y=47%
    // CSS: left:50%, top:47%, transform:translate(-35%,-10%)
    // This places the fingertip near the copper pot center-upper area
    this._handPointerEl = document.createElement('img');
    this._handPointerEl.src = HAND_POINTER_SRC;
    this._handPointerEl.alt = 'Click to continue';
    this._handPointerEl.style.cssText = `
      position: absolute;
      left: 50%;
      top: 47%;
      transform: translate(-35%, -10%);
      width: min(100px, 12vw);
      height: auto;
      z-index: 40;
      pointer-events: none;
      animation: handBob 1s ease-in-out infinite;
      filter: drop-shadow(0 0 8px rgba(255,215,0,0.7));
    `;

    this._handPointerEl.addEventListener('error', () => {
      console.warn('[Act1Scene] Hand pointer image failed to load:', HAND_POINTER_SRC);
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
      @keyframes handBob {
        0%, 100% { transform: translate(-35%, -10%) translateY(0px); }
        50% { transform: translate(-35%, -10%) translateY(-14px); }
      }
    `;
    this.wrapper.appendChild(animStyle);
    this._animStyle = animStyle;

    // --- "Click anywhere to continue" text ---
    this._clickPrompt = document.createElement('div');
    this._clickPrompt.textContent = 'Click anywhere to continue';
    this._clickPrompt.style.cssText = `
      position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,0.6); font-family: serif; font-size: 18px;
      z-index: 35; pointer-events: none;
      animation: act1FadeInOut 2s ease-in-out infinite;
    `;
    this.wrapper.appendChild(this._clickPrompt);

    const fadeStyle = document.createElement('style');
    fadeStyle.textContent = `
      @keyframes act1FadeInOut {
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
      animation: handBob 1s ease-in-out infinite;
      filter: drop-shadow(0 0 6px rgba(255,215,0,0.6));
    `;
    this.wrapper.appendChild(this._fallbackPointer);

    if (!this._animStyle) {
      const s = document.createElement('style');
      s.textContent = `
        @keyframes handBob {
          0%, 100% { transform: translate(-50%, -20%) translateY(0px); }
          50% { transform: translate(-50%, -20%) translateY(-14px); }
        }
      `;
      this.wrapper.appendChild(s);
      this._animStyle = s;
    }
  }

  // ================================================================
  //  Transition to Scene 2
  // ================================================================

  _transitionToScene2() {
    if (this._transitioned) return;
    this._transitioned = true;

    // Fade out everything
    this.wrapper.style.transition = 'opacity 0.5s ease';
    this.wrapper.style.opacity = '0';

    // After fade, call onComplete
    setTimeout(() => {
      if (this.onComplete) this.onComplete();
    }, 500);
  }

  // ================================================================
  //  Cleanup
  // ================================================================

  destroy() {
    // Clean up start video
    if (this.startVideo) {
      this.startVideo.pause();
      this.startVideo.src = '';
      this.startVideo.load();
      this.startVideo = null;
    }

    // Clean up main video
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

    // Remove click handlers
    if (this.wrapper) {
      if (this._startVideoClickHandler) {
        this.wrapper.removeEventListener('click', this._startVideoClickHandler);
        this._startVideoClickHandler = null;
      }
      if (this._clickHandler) {
        this.wrapper.removeEventListener('click', this._clickHandler);
        this._clickHandler = null;
      }
    }

    // Clear container
    this.container.innerHTML = '';
  }
}
