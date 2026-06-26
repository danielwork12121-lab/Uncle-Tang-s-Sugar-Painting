/**
 * Scene 6 — Video cutscene after Scene 5 candy painting success
 *
 * Video assets:
 *   public/assets/scene6/scene6-first.mp4 (optimized, 1080p, H.264, faststart)
 *   public/assets/scene6/scene6-second.mp4 (optimized, 720p, H.264, faststart)
 *
 * Behavior:
 *   1. Full-screen video player on launch.
 *   2. Autoplay if allowed; otherwise "Click to Start" overlay.
 *   3. During video: show "点击任意处跳过" at bottom.
 *   4. Preload second video in background when first video starts.
 *   5. When intro video ends, immediately play connect video.
 *   6. When connect video ends, switch to Scene 7.
 *
 * Audio:
 *   - Stop Scene 5 background music when Scene 6 starts.
 *   - Let the video audio play normally.
 *
 * State machine:
 *   - "introVideo": Intro video is playing or can be skipped
 *   - "connectVideo": Connect video is playing or can be skipped
 *   - "finished": Scene 6 complete, transitioning to Scene 7
 */

// --- Asset paths served by Vite from /public ---
const SCENE6_VIDEO_SRC = '/assets/scene6/scene6-first.mp4';
const SCENE6_CONNECT_VIDEO_SRC = '/assets/scene6/scene6-second.mp4';

export class Scene6 {
  constructor(containerEl, onComplete) {
    this.container = containerEl;
    this.onComplete = onComplete;
    this._phase = "introVideo";  // State machine: introVideo, connectVideo, finished

    // Preload video element for second video
    this._preloadVideo = null;
    this._preloadTimeout = null;

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

    // --- Video element (full-size, centered, preserve aspect ratio) ---
    this.video = document.createElement('video');
    this.video.style.cssText = `
      width: 100%; height: 100%; object-fit: contain;
      display: block; pointer-events: none;
    `;
    this.video.controls = false;
    this.video.muted = false;
    this.video.playsInline = true;
    this.video.preload = 'auto';

    // Set video source
    console.log('[Scene6Video] loading first video:', SCENE6_VIDEO_SRC);
    this.video.src = SCENE6_VIDEO_SRC;

    this.video.addEventListener('loadeddata', () => {
      console.log('[Scene6Video] first video ready');
    });

    this.video.addEventListener('error', (e) => {
      console.error('[Scene6Video] video error:', SCENE6_VIDEO_SRC, e);
    });

    // When video ends, transition to next video or switch to Scene 7
    this._onVideoEnded = () => {
      console.log('[Scene6Video] first video ended, phase:', this._phase);
      if (this._phase === "introVideo") {
        // Intro video ended, start connect video immediately
        this._startConnectVideo();
      } else if (this._phase === "connectVideo") {
        // Connect video ended, switch to Scene 7
        console.log('[Scene6Video] second video ended');
        this._phase = "finished";
        if (this.onComplete) {
          this.onComplete();
        }
      }
    };
    this.video.addEventListener('ended', this._onVideoEnded);

    this.wrapper.appendChild(this.video);

    // --- Skip hint (visible during playback) ---
    this.skipHint = document.createElement('div');
    this.skipHint.textContent = '点击任意处跳过';
    this.skipHint.style.cssText = `
      position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,0.5); font-family: sans-serif; font-size: 14px;
      cursor: pointer; user-select: none; z-index: 10;
      transition: opacity 0.3s;
    `;
    this.wrapper.appendChild(this.skipHint);

    // --- Click handler (state machine based) ---
    this._clickHandler = (e) => {
      console.log('[Scene6] Click handler, phase:', this._phase);

      // Guard: only handle clicks when Scene 6 is active
      if (this._phase === "finished") {
        // Already finished, don't replay video
        console.log("[Scene6] Already finished, ignoring click");
        return;
      }

      if (this._phase === "introVideo") {
        // Skip intro video: jump to end, which will trigger connect video
        console.log('[Scene6] Skipping intro video');
        this.video.currentTime = this.video.duration;
        // Don't pause - let it end naturally to trigger the ended event
      } else if (this._phase === "connectVideo") {
        // Skip connect video: jump to end, which will trigger Scene 7 switch
        console.log('[Scene6] Skipping connect video');
        this.video.currentTime = this.video.duration;
        // Don't pause - let it end naturally to trigger the ended event
      }
    };
    this.wrapper.addEventListener('click', this._clickHandler);

    // --- Autoplay ---
    this.video.play().then(() => {
      console.log('[Scene6Video] first video started');
      // Start preloading second video after first video starts playing
      this._preloadSecondVideo();
    }).catch(() => {
      // Autoplay blocked — show a "Click to Start" overlay
      console.log('[Scene6] Autoplay blocked, showing start overlay');
      this._showStartOverlay();
    });
  }

  // ================================================================
  //  Preload second video in background
  // ================================================================

  _preloadSecondVideo() {
    console.log('[Scene6Video] preloading second video:', SCENE6_CONNECT_VIDEO_SRC);

    // Create a hidden video element for preloading
    this._preloadVideo = document.createElement('video');
    this._preloadVideo.src = SCENE6_CONNECT_VIDEO_SRC;
    this._preloadVideo.preload = 'auto';
    this._preloadVideo.style.display = 'none';
    document.body.appendChild(this._preloadVideo);

    this._preloadVideo.addEventListener('loadeddata', () => {
      console.log('[Scene6Video] second video ready');
    });

    this._preloadVideo.addEventListener('error', (e) => {
      console.error('[Scene6Video] second video error:', SCENE6_CONNECT_VIDEO_SRC, e);
    });

    // Timeout fallback: if second video doesn't load within 10 seconds,
    // we'll still try to play it when needed (browser will handle it)
    this._preloadTimeout = setTimeout(() => {
      console.log('[Scene6Video] second video preload timeout (will still try to play)');
    }, 10000);
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
      animation: scene6Pulse 2s infinite;
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
      @keyframes scene6Pulse {
        0%, 100% { transform: scale(1); opacity: 0.7; }
        50% { transform: scale(1.1); opacity: 1; }
      }
    `;
    this._startOverlay.appendChild(style);

    this._startOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this._startOverlay.remove();
      this._startOverlay = null;
      this.video.play().then(() => {
        console.log('[Scene6Video] Video started playing after user gesture');
        // Start preloading second video after first video starts playing
        this._preloadSecondVideo();
      }).catch((e) => {
        console.error('[Scene6] Video play failed:', e);
      });
    });

    this.wrapper.appendChild(this._startOverlay);
  }

  // ================================================================
  //  Start connect video (second video)
  // ================================================================

  _startConnectVideo() {
    console.log('[Scene6] Starting connect video');
    this._phase = "connectVideo";

    // Clear preload timeout if still pending
    if (this._preloadTimeout) {
      clearTimeout(this._preloadTimeout);
      this._preloadTimeout = null;
    }

    // Remove skip hint from intro video
    if (this.skipHint) {
      this.skipHint.remove();
      this.skipHint = null;
    }

    // Update skip hint for connect video
    this.skipHint = document.createElement('div');
    this.skipHint.textContent = '点击任意处跳过';
    this.skipHint.style.cssText = `
      position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,0.5); font-family: sans-serif; font-size: 14px;
      cursor: pointer; user-select: none; z-index: 10;
      transition: opacity 0.3s;
    `;
    this.wrapper.appendChild(this.skipHint);

    // Use preloaded video if available, otherwise load from scratch
    if (this._preloadVideo && this._preloadVideo.readyState >= 2) {
      console.log('[Scene6Video] Using preloaded second video');
      // Swap video sources
      this.video.src = SCENE6_CONNECT_VIDEO_SRC;
      this.video.load();
    } else {
      console.log('[Scene6Video] Loading second video from scratch');
    }

    // Load connect video
    this.video.src = SCENE6_CONNECT_VIDEO_SRC;
    this.video.load();

    // Play connect video
    this.video.play().then(() => {
      console.log('[Scene6Video] second video started');
    }).catch((e) => {
      console.error('[Scene6Video] Connect video autoplay failed:', e);
      // If autoplay fails, show start overlay for connect video
      this._showConnectStartOverlay();
    });
  }

  // ================================================================
  //  Show start overlay for connect video (if autoplay blocked)
  // ================================================================

  _showConnectStartOverlay() {
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
      animation: scene6Pulse 2s infinite;
    `;
    this._startOverlay.appendChild(icon);

    const text = document.createElement('div');
    text.textContent = '点击开始连接视频';
    text.style.cssText = `
      color: #e8c170; font-family: serif; font-size: 28px;
      text-shadow: 0 0 12px rgba(232,193,112,0.5);
    `;
    this._startOverlay.appendChild(text);

    // Pulse keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes scene6Pulse {
        0%, 100% { transform: scale(1); opacity: 0.7; }
        50% { transform: scale(1.1); opacity: 1; }
      }
    `;
    this._startOverlay.appendChild(style);

    this._startOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this._startOverlay.remove();
      this._startOverlay = null;
      this.video.play().then(() => {
        console.log('[Scene6Video] Connect video started playing after user gesture');
      }).catch((e) => {
        console.error('[Scene6] Connect video play failed:', e);
        // Don't get stuck - allow click to skip
        this._phase = "finished";
        if (this.onComplete) {
          this.onComplete();
        }
      });
    });

    this.wrapper.appendChild(this._startOverlay);
  }

  // ================================================================
  //  Cleanup
  // ================================================================

  destroy() {
    console.log('[Scene6] Destroying, phase:', this._phase);

    // Clear preload timeout
    if (this._preloadTimeout) {
      clearTimeout(this._preloadTimeout);
      this._preloadTimeout = null;
    }

    // Remove preloaded video element
    if (this._preloadVideo) {
      this._preloadVideo.remove();
      this._preloadVideo = null;
    }

    // Remove click handler from wrapper
    if (this.wrapper && this._clickHandler) {
      this.wrapper.removeEventListener('click', this._clickHandler);
      this._clickHandler = null;
    }

    // Remove video ended listener
    if (this.video && this._onVideoEnded) {
      this.video.removeEventListener('ended', this._onVideoEnded);
      this._onVideoEnded = null;
    }

    // Pause and clean up video
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.video.load();
      this.video = null;
    }

    // Remove all DOM elements
    if (this.wrapper) {
      this.wrapper.remove();
      this.wrapper = null;
    }

    // Clear all references
    this._startOverlay = null;
    this._skipHint = null;
    this._phase = null;

    // Clear container
    this.container.innerHTML = '';

    console.log('[Scene6] Destroy complete');
  }
}
