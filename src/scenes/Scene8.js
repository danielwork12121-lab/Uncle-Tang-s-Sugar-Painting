/**
 * Scene 8 — Reward video scene after Scene 7 dragon drawing
 *
 * Video asset:
 *   public/assets/button8/dragon-drawing.mp4
 *
 * Behavior:
 *   1. Full-screen video player on launch.
 *   2. Autoplay if allowed; otherwise "Click to Start" overlay.
 *   3. During video: show "点击任意处跳过" at bottom.
 *   4. At ~8s video time: show money bar and tick rewards.
 *   5. After reward sequence (~10-12s): hide money bar.
 *   6. Video continues playing normally.
 *   7. When video ends: switch to Scene 9.
 *
 * Reward sequence (triggered at ~8s video time):
 *   +7, +7, +20 with 600ms delays between ticks
 *   HUD disappears after ~2s
 *
 * State machine:
 *   - "video": Video is playing or can be skipped
 *   - "reward": Reward sequence is playing
 *   - "rewardDone": Reward sequence complete, video still playing
 *   - "finished": Scene 8 complete, transitioning to Scene 9
 */
import { getMoney, addMoney } from '../state/GameEconomy.js';

// --- Asset paths served by Vite from /public ---
const SCENE8_VIDEO_SRC = '/assets/button8/dragon-drawing.mp4';
const SCENE8_MONEY_PNG = '/assets/scene6/money/Money counter.png';

// --- Reward timing ---
const REWARD_TRIGGER_TIME = 8.0; // seconds
const REWARD_TICK_DELAY = 600; // ms between ticks
const REWARD_HIDE_DELAY = 2000; // ms after final tick to hide HUD

export class Scene8 {
  constructor(containerEl, onComplete) {
    this.container = containerEl;
    this.onComplete = onComplete;
    this._phase = "video";  // State machine: video, reward, rewardDone, finished

    // --- Reward state ---
    this._rewardStarted = false;
    this._rewardIndex = 0;
    this._rewardTicks = [7, 7, 20];
    this._rewardTimeout = null;
    this._hideHUDTimeout = null;

    // --- Money HUD elements ---
    this._moneyHUD = null;
    this._moneyText = null;
    this._moneyBG = null;

    // --- Destroyed flag ---
    this._destroyed = false;

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
    this.video.src = SCENE8_VIDEO_SRC;

    this.video.addEventListener('error', (e) => {
      console.error('[Scene8] Video failed to load:', SCENE8_VIDEO_SRC, e);
    });

    // Monitor video time to trigger reward at 8s
    this._onTimeUpdate = () => {
      if (this._rewardStarted || this._destroyed) return;

      if (this.video && this.video.currentTime >= REWARD_TRIGGER_TIME) {
        this._startRewardSequence();
      }
    };
    this.video.addEventListener('timeupdate', this._onTimeUpdate);

    // When video ends, switch to Scene 9
    this._onVideoEnded = () => {
      console.log('[Scene8] Video ended, phase:', this._phase);
      // Only transition if not already finished
      if (this._phase !== "finished") {
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

    // --- Click handler ---
    this._clickHandler = (e) => {
      console.log('[Scene8] Click handler, phase:', this._phase);

      // Guard: only handle clicks when Scene 8 is active
      if (this._phase === "finished") {
        console.log("[Scene8] Already finished, ignoring click");
        return;
      }

      if (this._phase === "video") {
        // Skip video: jump to reward trigger time or end
        console.log('[Scene8] Skipping video');
        if (this.video && !this._rewardStarted) {
          // Skip to reward trigger time
          this.video.currentTime = Math.min(REWARD_TRIGGER_TIME + 1, this.video.duration);
        } else {
          // Reward already started or video near end, skip to end
          this.video.currentTime = this.video.duration;
        }
      } else if (this._phase === "reward" || this._phase === "rewardDone") {
        // During/after reward, skip to end of video
        console.log('[Scene8] Skipping to end of video');
        if (this.video) {
          this.video.currentTime = this.video.duration;
        }
      }
    };
    this.wrapper.addEventListener('click', this._clickHandler);

    // --- Autoplay ---
    this.video.play().then(() => {
      console.log('[Scene8] Video started playing');
    }).catch(() => {
      // Autoplay blocked — show a "Click to Start" overlay
      console.log('[Scene8] Autoplay blocked, showing start overlay');
      this._showStartOverlay();
    });
  }

  // ================================================================
  //  Start reward sequence at ~8s video time
  // ================================================================

  _startRewardSequence() {
    if (this._rewardStarted || this._destroyed) return;

    console.log('[Scene8] Starting reward sequence at video time:', this.video?.currentTime);
    this._rewardStarted = true;
    this._phase = "reward";

    // Show money HUD
    this._showMoneyHUD();

    // Start reward ticks
    this._rewardIndex = 0;
    this._processNextReward();
  }

  _showMoneyHUD() {
    // --- Money counter HUD (top-left corner, scaled down) ---
    this._moneyHUD = document.createElement('div');
    this._moneyHUD.style.cssText = `
      position: absolute; top: 4px; left: 32px; right: auto; z-index: 30;
      width: 280px; height: auto; pointer-events: none; opacity: 1;
      transform: scale(0.72); transform-origin: top left;
    `;
    this.wrapper.appendChild(this._moneyHUD);

    // Money counter background image
    this._moneyBG = document.createElement('img');
    this._moneyBG.src = SCENE8_MONEY_PNG;
    this._moneyBG.style.cssText = `
      width: 100%; height: auto; display: block;
    `;
    this._moneyHUD.appendChild(this._moneyBG);

    // Money text overlay
    this._moneyText = document.createElement('div');
    this._moneyText.style.cssText = `
      position: absolute; top: calc(50% + 5px); left: calc(50% + 20px);
      color: #fff; font-family: 'Arial', sans-serif; font-size: 32px; font-weight: bold;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5);
      text-align: left; white-space: nowrap;
    `;
    this._moneyText.textContent = `${getMoney()}`;
    this._moneyHUD.appendChild(this._moneyText);

    // CSS animation for money pop effects
    const moneyStyle = document.createElement('style');
    moneyStyle.textContent = `
      @keyframes moneyPopFade {
        0% { opacity: 1; transform: translateX(15px) translateY(-35px) scale(1); }
        50% { opacity: 1; transform: translateX(15px) translateY(-55px) scale(1.2); }
        100% { opacity: 0; transform: translateX(15px) translateY(-75px) scale(0.8); }
      }
    `;
    this._moneyHUD.appendChild(moneyStyle);
  }

  _processNextReward() {
    if (this._rewardIndex >= this._rewardTicks.length) {
      // All rewards processed, hide HUD after delay
      console.log('[Scene8] Reward sequence complete, hiding HUD');
      this._phase = "rewardDone";

      this._hideHUDTimeout = setTimeout(() => {
        this._hideMoneyHUD();
      }, REWARD_HIDE_DELAY);

      return;
    }

    // Add money
    const amount = this._rewardTicks[this._rewardIndex];
    this._addMoney(amount);

    this._rewardIndex++;

    // Schedule next reward
    this._rewardTimeout = setTimeout(() => {
      this._processNextReward();
    }, REWARD_TICK_DELAY);
  }

  _addMoney(amount) {
    if (this._destroyed) return;

    // Update shared economy
    addMoney(amount);

    // Update money text
    if (this._moneyText) {
      this._moneyText.textContent = `${getMoney()}`;
    }

    // Spawn floating +money pop
    this._spawnMoneyPop(amount);
  }

  _spawnMoneyPop(amount) {
    if (!this._moneyHUD) return;

    const pop = document.createElement('div');
    pop.textContent = `+${amount}`;
    pop.style.cssText = `
      position: absolute; top: calc(50% - 20px); right: 110px;
      color: #ffd700; font-family: 'Arial', sans-serif; font-size: 28px; font-weight: bold;
      text-shadow: 0 2px 8px rgba(0,0,0,0.7);
      pointer-events: none; z-index: 31;
      animation: moneyPopFade 800ms ease-out forwards;
    `;

    this._moneyHUD.appendChild(pop);

    // Remove after animation
    setTimeout(() => {
      if (pop.parentNode) pop.parentNode.removeChild(pop);
    }, 800);
  }

  _hideMoneyHUD() {
    // Remove money HUD
    if (this._moneyHUD) {
      this._moneyHUD.remove();
      this._moneyHUD = null;
    }

    // Clear references
    this._moneyText = null;
    this._moneyBG = null;

    console.log('[Scene8] Money HUD hidden, runtime money:', getMoney());
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
      animation: scene8Pulse 2s infinite;
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
      @keyframes scene8Pulse {
        0%, 100% { transform: scale(1); opacity: 0.7; }
        50% { transform: scale(1.1); opacity: 1; }
      }
    `;
    this._startOverlay.appendChild(style);

    this._startOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this._startOverlay.remove();
      this._startOverlay = null;
      if (this.video && !this._destroyed) {
        this.video.play().then(() => {
          console.log('[Scene8] Video started playing after user gesture');
        });
      }
    });

    this.wrapper.appendChild(this._startOverlay);
  }

  // ================================================================
  //  Cleanup
  // ================================================================

  destroy() {
    console.log('[Scene8] Destroying, phase:', this._phase);
    this._destroyed = true;

    // Clear all timeouts
    if (this._rewardTimeout) {
      clearTimeout(this._rewardTimeout);
      this._rewardTimeout = null;
    }
    if (this._hideHUDTimeout) {
      clearTimeout(this._hideHUDTimeout);
      this._hideHUDTimeout = null;
    }

    // Remove click handler from wrapper
    if (this.wrapper && this._clickHandler) {
      this.wrapper.removeEventListener('click', this._clickHandler);
      this._clickHandler = null;
    }

    // Remove video timeupdate listener
    if (this.video && this._onTimeUpdate) {
      this.video.removeEventListener('timeupdate', this._onTimeUpdate);
      this._onTimeUpdate = null;
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
    this._moneyHUD = null;
    this._moneyText = null;
    this._moneyBG = null;
    this._phase = null;

    // Clear container
    this.container.innerHTML = '';

    console.log('[Scene8] Destroy complete');
  }
}
