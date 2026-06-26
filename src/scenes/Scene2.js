/**
 * Scene 2 — Sugar-Boiling Mini-Game
 *
 * Top-down / god's-eye view of a copper pot.
 * Three phases:
 *   1. Sugar pouring — drag sugar bottle over the pot (4 real visual states + tilt)
 *   2. Heating — red stove button, Chinese status text, timing challenge
 *   3. Continue — click anywhere to proceed (ladle area as visual hint only)
 *
 * Real assets:
 *   public/assets/scene2/pots/median-graphics-lightness.jpg       — full-screen background
 *   public/assets/scene2/sugar-bottles/sugar-bottle-desk.png     — desk/resting
 *   public/assets/scene2/sugar-bottles/sugar-in-pouring-motion.png — lifted/dragged
 *   public/assets/scene2/sugar-bottles/sugar-being-poured.png    — pouring
 *   public/assets/scene2/sugar-bottles/sugar-being-poured-quick.png — fast/extreme pouring
 *   public/assets/scene2/ui/sugar-bar-empty.png                  — sugar bar frame PNG
 *   public/assets/scene2/pots/sugar-in-pot-filled-enough.png     — pot sugar filled state
 *   public/assets/scene2/pots/sugar-in-pot-boiling.png           — pot sugar boiling state
 *
 * Sugar bottle visual states:
 *   A. Desk/resting   → sugar-bottle-desk.png
 *   B. Lifted/dragged → sugar-in-pouring-motion.png
 *   C. Pouring        → sugar-being-poured.png (tilt increases toward pot center)
 *   D. Fast pouring   → sugar-being-poured-quick.png (near max tilt / deep in pot)
 *
 * Pouring mechanic:
 *   - Outside pot: no sugar added
 *   - Inside pot (edge): starts pouring immediately with slight tilt, slow rate (0.5x)
 *   - Deeper in pot: more tilt, faster rate
 *   - Near center: strong tilt, fast-pouring PNG, full rate (1.0x)
 *   - Tilt is gradual from 0 (edge) to ~81° (center)
 *
 * Visual layering (back to front):
 *   Layer 1 — Full pot background image (_drawBackground)
 *   Layer 2 — Liquid/sugar surface overlay covering visible water area (_drawLiquidSurface)
 *   Layer 3 — Bubble / boil effect layer (_drawBoilEffects)
 *     TODO: Replace code-drawn bubbles with PNG/JPEG assets:
 *           - this.images.bubbleTex   → small bubble texture
 *           - this.images.foamTex     → foam/white-edge texture
 *           - this.images.boilTex     → boiling turbulence texture
 *           - this.images.sugarSurfaceTex → sugar/syrup surface texture
 *   Layer 4 — Flame & smoke effects (_drawFlame, _drawSmoke)
 *   Layer 5 — Golden glow overlay (_drawGoldenGlow)
 *   Layer 6 — Sugar pouring particles (_drawSugarParticles)
 *   Layer 7 — Sugar bottle (_drawSugarBottle)
 *   Layer 8 — UI: sugar meter, stove button, status text, notifications
 */

// --- Constants ---
const CANVAS_W = 1024;
const CANVAS_H = 768;

// Shared failure overlay placement (all failure PNGs use the same slot)
const FAIL_OVERLAY_CENTER_X = 0.50;   // 50% horizontal
const FAIL_OVERLAY_CENTER_Y = 0.455;  // ~45.5% vertical (moved up from 0.45/0.55)
const FAIL_OVERLAY_MAX_W = 0.55;       // 55% of viewport width (was 0.4–0.5)
const FAIL_OVERLAY_MAX_H = 0.40;       // 40% of viewport height (was 0.25–0.30)

// Sugar target: ~70% full (0.60–0.80)
const TARGET_SUGAR_MIN = 0.60;
const TARGET_SUGAR_MAX = 0.80;
const POUR_RATE = 0.003; // sugarAmount increase per frame at 60fps (noticeably slower)

// Heating timing (slower: ~2× the original pace)
const HEAT_SPEED = 0.002;              // heatingProgress increment per frame at 60fps (2× slower)
const COUNTDOWN_START = 0.75;          // heatingProgress where 3-2-1 countdown begins
const COUNTDOWN_DURATION = 90;         // frames for 3-2-1 countdown (~1.5s)
const READY_WINDOW_START = 0.75;       // same as countdown start (visual)
const READY_WINDOW_DURATION = 60;      // frames for actual "好了！关火！" window (~1.0s)

// Audio volumes (0–1)
const SUGAR_POUR_VOLUME = 0.45;
const STOVE_ON_VOLUME = 0.55;
const STOVE_OFF_VOLUME = 0.55;
const BOILING_BASE_VOLUME = 0.08;
const BOILING_MAX_VOLUME = 0.55;

// Cooking set dimensions
const IMG_W = 1671;   // pot background natural width
const IMG_H = 941;    // pot background natural height
const CANVAS_RATIO = CANVAS_W / CANVAS_H;  // 1.333...

// --- Asset loader ---
function tryLoadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export class Scene2 {
  constructor(containerEl, onComplete) {
    this.container = containerEl;
    this.onComplete = onComplete;

    // --- Phase tracking ---
    this.phase = 'pouring'; // 'pouring' | 'heating' | 'spoon'

    // --- Sugar pouring state ---
    this.sugarAmount = 0;
    this.targetSugarMin = TARGET_SUGAR_MIN;
    this.targetSugarMax = TARGET_SUGAR_MAX;
    this.isSugarCorrect = false;
    this.isSugarTooMuch = false;
    this.isPouring = false;

    // Sugar bottle position — upper-left desk area
    // Center at ~10% canvas width, ~23% canvas height (~125, 205 on 1240x900)
    // For 1024x768: center ~102, ~177
    this.bottleX = 102;
    this.bottleY = 177;
    this.bottleBaseX = 102;
    this.bottleBaseY = 177;

    // Sugar bottle visual state: 'desk' | 'lifted' | 'pouring' | 'pouringFast'
    this.bottleState = 'desk';
    this.bottleTilt = 0; // current tilt angle (0 at edge of pot, max near center)

    // --- Heating state ---
    this.isStoveButtonUnlocked = false;
    this.isHeating = false;
    this.stoveStarting = false;   // true during the 1s delay before stove turns ON
    this.stoveStartTimer = 0;     // counts down ~60 frames
    this.heatingProgress = 0;
    this.heatingStatus = 0;
    this.readyWindowActive = false;    // true only during "好了！关火！" window
    this.countdownActive = false;      // true during 3-2-1 countdown
    this.countdownTimer = 0;
    this.readyWindowDuration = READY_WINDOW_DURATION;
    this.readyWindowTimer = 0;
    this.resultState = null;      // null | 'success' | 'too-early' | 'too-late'
    this.resultTimer = 0;

    // --- Spoon transition state (click-anywhere to continue) ---
    this.canClickAnywhere = false;
    this.heatingSuccess = false;

    // --- Interaction ---
    this.mouse = { x: 0, y: 0, down: false };
    this.dragTarget = null;       // 'sugar' | 'spoon' | null
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    // --- Visuals ---
    this.bubbles = [];
    this.smokeParticles = [];
    this.flameParticles = [];
    this.sugarParticles = [];     // pouring sugar particles
    this.goldenGlowAlpha = 0;
    this.frameTime = 0;
    this.shakeAmount = 0;

    // --- Notification ---
    this.notificationText = '';
    this.notificationTimer = 0;
    this.notificationColor = '#ffd700';
    this._pouringNotifiedLow = false;

    // --- Images ---
    this.images = {};

    // --- Overfill / ruined state ---
    this.isOverfilled = false;
    this.overfillPhase = null;     // 'toomuch' | 'restart' | null
    this.overfillTimer = 0;        // counts down from ~180 frames (3s)
    this._failOverlayBtn = null;   // {x, y, w, h} hitbox for failure overlay restart button

    // --- Success popup state (first minigame success) ---
    this.showSuccessPopup = false;  // true when to show success PNG
    this.successPopupTimer = 0;    // optional timer for auto-proceed

    // --- Sugar-in-pot visual state ---
    // null | 'some' | 'filled' | 'boiling' | 'burnt'
    this.sugarInPotState = null;
    this._isBurnt = false;
    this.burntPhase = null;     // 'overcooked' | 'restart' | null
    this.burntTimer = 0;        // counts down ~150 frames (2.5s)

    // --- Audio systems ---
    this.pourAudio = null;
    this.pourAudioReady = false;
    this.pourAudioTime = 0;
    this.stoveOnAudio = null;
    this.stoveOnAudioReady = false;
    this.stoveOffAudio = null;
    this.stoveOffAudioReady = false;
    this.boilingAudio = null;
    this.boilingAudioReady = false;

    // --- Bubble sprites (PNG-based, more visible than code-drawn particles) ---
    this.bubbleSprites = [];

    // --- Liquid region: true circle (rx == ry), vertical dimension preserved ---
    this.liquidCx = Math.round(CANVAS_W * 0.4995);   // = 512
    this.liquidCy = Math.round(CANVAS_H * 0.4982);   // = 383
    this.liquidRx = Math.round(CANVAS_H * 0.6136 / 2); // = 236 (circle: rx == ry)
    this.liquidRy = Math.round(CANVAS_H * 0.6136 / 2); // = 236

    // Legacy pot aliases (used by _isInPot / _potDepth — now refer to liquid region)
    this.potCx = this.liquidCx;
    this.potCy = this.liquidCy;
    this.potRx = this.liquidRx;
    this.potRy = this.liquidRy;

    // --- Fullscreen layout state (recomputed on resize) ---
    this.vw = 0;                // viewport width (canvas internal)
    this.vh = 0;                // viewport height (canvas internal)
    this.bgScale = 1;           // background scale: vw / IMG_W
    this.bgH = 1;               // background draw height: IMG_H * bgScale
    this.bgY = 0;               // background vertical offset for centering
    this.gameOriginX = 0;       // X offset: maps design-X=0 to screen
    this.gameOriginY = 0;       // Y offset: maps design-Y=0 to screen
    this.gameScale = 1;         // uniform scale: design → screen
    // Derived from old "contain" crop: the portion of the source image that was visible
    this._cropW = IMG_H * CANVAS_RATIO;
    this._cropOff = (IMG_W - this._cropW) / 2;

    this._init();
  }

  async _init() {
    this.container.innerHTML = '';

    // --- Canvas (fills viewport, uses cover-style scaling) ---
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      display: block; cursor: default;
    `;
    this.ctx = this.canvas.getContext('2d');
    this._computeLayout();
    this.container.appendChild(this.canvas);

    // --- Load assets ---
    // Lighter pot background image
    this.images.potBg = await tryLoadImage('/assets/scene2/pots/median-graphics-lightness.jpg');
    // Real sugar bottle assets (all 4 states)
    this.images.bottleDesk = await tryLoadImage('/assets/scene2/sugar-bottles/sugar-bottle-desk.png');
    this.images.bottleLifted = await tryLoadImage('/assets/scene2/sugar-bottles/sugar-in-pouring-motion.png');
    this.images.bottlePour = await tryLoadImage('/assets/scene2/sugar-bottles/sugar-being-poured.png');
    this.images.bottlePourFast = await tryLoadImage('/assets/scene2/sugar-bottles/sugar-being-poured-quick.png');
    // Optional future assets
    this.images.spoon = await tryLoadImage('/assets/scene2/ladle.png');
    // Stove on/off images
    this.images.stoveOff = await tryLoadImage('/assets/scene2/stove/stove-off.png');
    this.images.stoveOn = await tryLoadImage('/assets/scene2/stove/stove-on.png');
    // Overfill / restart assets
    this.images.tooMuchSugar = await tryLoadImage('/assets/scene2/restart/too-much-sugar.png');
    this.images.restartBtn = await tryLoadImage('/assets/scene2/restart/restart.png');
    this.images.overcooked = await tryLoadImage('/assets/scene2/restart/OverCooked.png');
    // Success asset (shown when first minigame completes successfully)
    this.images.successCandy = await tryLoadImage('/assets/scene2/restart/success/Successful candy cooking.png');
    // New sugar bar frame PNG
    this.images.sugarBarEmpty = await tryLoadImage('/assets/scene2/ui/sugar-bar-empty.png');
    // Sugar bar filling PNG
    this.images.sugarBarFilling = await tryLoadImage('/assets/scene2/ui/sugar-bar-filling.png');
    // Sugar-in-pot state PNGs
    this.images.sugarInPotSome = await tryLoadImage('/assets/scene2/pots/sugar-in-pot-some.png');
    this.images.sugarInPotFilled = await tryLoadImage('/assets/scene2/pots/sugar-in-pot-filled-enough.png');
    this.images.sugarInPotBoiling = await tryLoadImage('/assets/scene2/pots/sugar-in-pot-boiling.png');
    this.images.sugarInPotBurnt = await tryLoadImage('/assets/scene2/pots/burnt-sugar.png');
    // Bubble sprite PNGs
    this.images.bubble1 = await tryLoadImage('/assets/scene2/bubbles/bubble-1.png');
    this.images.bubble2 = await tryLoadImage('/assets/scene2/bubbles/bubble-2.png');
    this.images.bubble3 = await tryLoadImage('/assets/scene2/bubbles/bubble-3.png');

    // --- Event listeners ---
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchMove = this._handleTouchMove.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);

    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchmove', this._onTouchMove, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd);

    // --- Window resize handler (recompute layout) ---
    this._onResize = () => this._computeLayout();
    window.addEventListener('resize', this._onResize);

    // --- Start game loop ---
    this._lastTime = performance.now();
    this._raf = requestAnimationFrame((t) => this._loop(t));

    // --- Initialize audio ---
    try {
      this.pourAudio = new Audio('/assets/audio/sugar-pouring.m4a');
      this.pourAudio.volume = SUGAR_POUR_VOLUME;
      this.pourAudio.loop = true;
      this.pourAudioReady = true;
    } catch (e) { console.warn('[Scene2] Could not create pour audio:', e); }
    try {
      this.stoveOnAudio = new Audio('/assets/audio/stove-on.m4a');
      this.stoveOnAudio.volume = STOVE_ON_VOLUME;
      this.stoveOnAudioReady = true;
    } catch (e) { console.warn('[Scene2] Could not create stove on audio:', e); }
    try {
      this.stoveOffAudio = new Audio('/assets/audio/stove-off.m4a');
      this.stoveOffAudio.volume = STOVE_OFF_VOLUME;
      this.stoveOffAudioReady = true;
    } catch (e) { console.warn('[Scene2] Could not create stove off audio:', e); }
    try {
      this.boilingAudio = new Audio('/assets/audio/boiling-water.m4a');
      this.boilingAudio.volume = BOILING_BASE_VOLUME;
      this.boilingAudio.loop = true;
      this.boilingAudioReady = true;
    } catch (e) { console.warn('[Scene2] Could not create boiling audio:', e); }

    // --- Cooking background music ---
    try {
      this.cookingBgMusic = new Audio('/assets/scene2/audio/background-music.mp3');
      this.cookingBgMusic.volume = 0.25;
      this.cookingBgMusic.loop = true;
      this.cookingBgMusicReady = true;
    } catch (e) { console.warn('[Scene2] Could not create cooking background music:', e); }

    // --- Initial prompt ---
    this._showNotification('将糖倒入锅中', '#e8c170', 180);
  }

  /**
   * Recompute fullscreen layout on init and on window resize.
   *
   * Background rule:
   *   - Fills viewport width (left/right edges touch screen)
   *   - Height scales proportionally from natural image dimensions
   *   - Centered vertically (top/bottom may crop)
   *   - No dark side margins
   *
   * Game content uses a uniform transform from design coords (1024×768)
   * to screen space, aligned with the background image's visible area.
   *
   * UI is drawn separately in viewport coordinates (see _draw*UI methods).
   */
  _computeLayout() {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.canvas.width = this.vw;
    this.canvas.height = this.vh;

    // Background: width-cover, proportional height, centered vertically
    this.bgScale = this.vw / IMG_W;
    this.bgH = IMG_H * this.bgScale;
    this.bgY = (this.vh - this.bgH) / 2;

    // Game content transform (design coords → screen coords)
    // The original design showed a cropped portion of the image.
    // We reproduce that crop region on screen using the bgScale.
    this.gameScale = this.bgScale * (IMG_H / CANVAS_H);
    this.gameOriginX = this._cropOff * this.bgScale;
    this.gameOriginY = this.bgY;
  }

  /**
   * Convert viewport coordinates (clientX/Y) to design coordinates for game logic.
   */
  _screenToGame(sx, sy) {
    return {
      x: (sx - this.gameOriginX) / this.gameScale,
      y: (sy - this.gameOriginY) / this.gameScale,
    };
  }

  // ================================================================
  //  INPUT
  // ================================================================

  _getPos(e) {
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return this._screenToGame(cx, cy);
  }

  _handleMouseDown(e) {
    const sx = e.clientX, sy = e.clientY;
    const pos = this._getPos(e);
    this.mouse.down = true;
    this.mouse.x = pos.x;
    this.mouse.y = pos.y;
    this.mouse.sx = sx;
    this.mouse.sy = sy;
    this._startDrag(pos, sx, sy);
  }

  _handleMouseMove(e) {
    const pos = this._getPos(e);
    this.mouse.x = pos.x;
    this.mouse.y = pos.y;
    if (this.mouse.down) this._updateDrag(pos);
  }

  _handleMouseUp(e) {
    const pos = this._getPos(e);
    this.mouse.down = false;
    this._endDrag(pos);
  }

  _handleTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0];
    const sx = t.clientX, sy = t.clientY;
    const pos = this._getPos(e);
    this.mouse.down = true;
    this.mouse.x = pos.x;
    this.mouse.y = pos.y;
    this.mouse.sx = sx;
    this.mouse.sy = sy;
    this._startDrag(pos, sx, sy);
  }

  _handleTouchMove(e) {
    e.preventDefault();
    const pos = this._getPos(e);
    this.mouse.x = pos.x;
    this.mouse.y = pos.y;
    if (this.mouse.down) this._updateDrag(pos);
  }

  _handleTouchEnd(e) {
    const pos = this._getPos(e);
    this.mouse.down = false;
    this._endDrag(pos);
  }

  // Hit test: sugar bottle (larger area for easy grabbing, ~130x150)
  _isInBottle(x, y) {
    const bx = this.bottleX;
    const by = this.bottleY;
    return x >= bx - 65 && x <= bx + 65 && y >= by - 75 && y <= by + 75;
  }

  _isInPot(x, y) {
    const dx = (x - this.potCx) / this.potRx;
    const dy = (y - this.potCy) / this.potRy;
    return (dx * dx + dy * dy) <= 1;
  }

  // Returns 0 at pot edge, 1 at pot center (clamped)
  _potDepth(x, y) {
    const dx = (x - this.potCx) / this.potRx;
    const dy = (y - this.potCy) / this.potRy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Invert: 0 = edge (dist=1), 1 = center (dist=0)
    return Math.max(0, Math.min(1, 1 - dist));
  }

  _isOnStoveButton(sx, sy) {
    // Stove button center aligned with candy bar column: 8.79% width, 84.20% height
    const bx = this.vw * 0.0879;
    const by = this.vh * 0.8420;
    const half = 90;
    return sx >= bx - half && sx <= bx + half && sy >= by - half && sy <= by + half;
  }

  _startDrag(pos, sx, sy) {
    const { x, y } = pos;

    // Success popup: any click dismisses the popup and proceeds
    if (this.showSuccessPopup) {
      this.showSuccessPopup = false;
      if (this.onComplete) {
        this.onComplete();
      }
      return;
    }

    // Burnt sugar restart: only restart during 'restart' phase (after 2.5s Overcooked display)
    if (this._isBurnt) {
      if (this.burntPhase !== 'restart') return; // Still showing Overcooked PNG, ignore click
      if (this._failOverlayBtn) {
        const btn = this._failOverlayBtn;
        if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
          this._restartSugarPouring();
          return;
        }
      }
      // Fallback: any click restarts during restart phase
      this._restartSugarPouring();
      return;
    }

    // Overfill restart: only restart during 'restart' phase (after 3s too-much-sugar display)
    if (this.isOverfilled && this.overfillPhase === 'restart') {
      // Check if click is on the restart PNG button
      if (this._failOverlayBtn) {
        const btn = this._failOverlayBtn;
        if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
          this._restartSugarPouring();
          return;
        }
      }
      // Fallback: any click restarts
      this._restartSugarPouring();
      return;
    }

    // Spoon phase: click anywhere to continue
    if (this.phase === 'spoon' && this.canClickAnywhere) {
      this.dragTarget = 'anywhere';
      return;
    }

    // Sugar bottle drag in pouring phase
    if (this.phase === 'pouring') {
      if (this._isInBottle(x, y)) {
        this.dragTarget = 'sugar';
        this.dragOffsetX = this.bottleX - x;
        this.dragOffsetY = this.bottleY - y;
        // Switch to lifted state
        this.bottleState = 'lifted';
        return;
      }
    }

    // Stove button click (screen coords — button drawn in viewport space)
    if (this.phase === 'pouring' || this.phase === 'heating') {
      if (this._isOnStoveButton(sx, sy)) {
        this.dragTarget = 'button';
        return;
      }
    }
  }

  _updateDrag(pos) {
    if (this.dragTarget === 'sugar') {
      if (this.isOverfilled) return;
      this.bottleX = pos.x + this.dragOffsetX;
      this.bottleY = pos.y + this.dragOffsetY;

      // Determine if pouring (bottle center is inside pot)
      if (this._isInPot(this.bottleX, this.bottleY) && this.sugarAmount < 1) {
        this.isPouring = true;
        const depth = this._potDepth(this.bottleX, this.bottleY);
        const maxTilt = Math.PI * 0.45;
        // Gradual tilt: starts small at edge, increases toward center
        this.bottleTilt = depth * maxTilt;
        // Fast pouring PNG only near center (depth > 0.8)
        this.bottleState = depth > 0.8 ? 'pouringFast' : 'pouring';
      } else {
        this.isPouring = false;
        this.bottleState = 'lifted';
        this.bottleTilt = 0;
      }
    }
  }

  _isNearDesk(x, y) {
    const dx = x - this.bottleBaseX;
    const dy = y - this.bottleBaseY;
    return (dx * dx + dy * dy) < 150 * 150;
  }

  _endDrag(pos) {
    // Success popup: check FIRST before any other handling
    // This prevents the same click that triggered success from also dismissing it
    if (this.showSuccessPopup) {
      // Any click dismisses the success popup and proceeds to Scene 3
      this.showSuccessPopup = false;
      if (this.onComplete) {
        this.onComplete();
      }
      this.dragTarget = null;
      return;
    }

    if (this.dragTarget === 'sugar') {
      if (this.isOverfilled) { this.dragTarget = null; return; }
      if (this._isInPot(this.bottleX, this.bottleY) && this.sugarAmount < 1) {
        // Keep pouring if released inside pot
        this.isPouring = true;
        const depth = this._potDepth(this.bottleX, this.bottleY);
        const maxTilt = Math.PI * 0.45;
        this.bottleTilt = depth * maxTilt;
        this.bottleState = depth > 0.8 ? 'pouringFast' : 'pouring';
      } else if (this._isNearDesk(this.bottleX, this.bottleY)) {
        // Snap back to desk if near desk area
        this.isPouring = false;
        this.bottleX = this.bottleBaseX;
        this.bottleY = this.bottleBaseY;
        this.bottleState = 'desk';
        this.bottleTilt = 0;
      } else {
        // Stay where released, stop pouring
        this.isPouring = false;
        this.bottleState = 'lifted';
        this.bottleTilt = 0;
      }
      this._checkSugarAmount();
    }

    if (this.dragTarget === 'button') {
      this._handleButtonClick();
    }

    if (this.dragTarget === 'anywhere') {
      if (this.onComplete) {
        this.onComplete();
      }
    }

    this.dragTarget = null;
  }

  _handleButtonClick() {
    // Ignore clicks during the pending stove-start delay
    if (this.stoveStarting) return;

    // In pouring phase with correct sugar → start stove-start sequence (off → on)
    if (this.phase === 'pouring' && this.isSugarCorrect) {
      this._playStoveOnClick();
      this.stoveStarting = true;
      this.stoveStartTimer = 60; // ~1 second at 60fps
      this.phase = 'heating';
      this.heatingProgress = 0;
      this.heatingStatus = 0;
      this.resultState = null;
      this._showNotification('开火！', '#ff6644');
      return;
    }

    // In heating phase with fire on → try to stop (on → off, play stove-off sound)
    if (this.phase === 'heating' && this.isHeating) {
      this._playStoveOffClick();
      if (this.readyWindowActive) {
        // Success! Only during "好了！关火！" window
        this.isHeating = false;
        this.resultState = 'success';
        this.resultTimer = 180;
        this.heatingSuccess = true;
        this._showNotification('火候正好！', '#ffd700');
        // Show success popup (no background dimming)
        this.showSuccessPopup = true;
        // Stop boiling audio immediately
        if (this.boilingAudio && !this.boilingAudio.paused) this.boilingAudio.pause();
        // Stop cooking background music
        if (this.cookingBgMusic && !this.cookingBgMusic.paused) this.cookingBgMusic.pause();
      } else if (this.heatingProgress < COUNTDOWN_START) {
        // Too early (before countdown)
        this.resultState = 'too-early';
        this.resultTimer = 120;
        this._showNotification('太早了，糖还没到火候', '#ff8844');
        // Stop boiling audio
        if (this.boilingAudio && !this.boilingAudio.paused) this.boilingAudio.pause();
        // Stop cooking background music
        if (this.cookingBgMusic && !this.cookingBgMusic.paused) this.cookingBgMusic.pause();
      } else if (this.countdownActive) {
        // Too early (during 3-2-1 countdown)
        this.resultState = 'too-early';
        this.resultTimer = 120;
        this._showNotification('太早了，糖还没到火候', '#ff8844');
        // Stop boiling audio
        if (this.boilingAudio && !this.boilingAudio.paused) this.boilingAudio.pause();
        // Stop cooking background music
        if (this.cookingBgMusic && !this.cookingBgMusic.paused) this.cookingBgMusic.pause();
      } else {
        // Too late (missed the ready window)
        this.resultState = 'too-late';
        this.resultTimer = 120;
        this._showNotification('过头了，糖色发苦', '#ff4444');
      }
    }
  }

  /** Play the stove ON click sound once */
  _playStoveOnClick() {
    if (this.stoveOnAudioReady && this.stoveOnAudio) {
      this.stoveOnAudio.currentTime = 0;
      this.stoveOnAudio.play().catch(() => {});
    }
  }

  /** Play the stove OFF click sound once */
  _playStoveOffClick() {
    if (this.stoveOffAudioReady && this.stoveOffAudio) {
      this.stoveOffAudio.currentTime = 0;
      this.stoveOffAudio.play().catch(() => {});
    }
  }

  _checkSugarAmount() {
    const wasCorrect = this.isSugarCorrect;
    this.isSugarCorrect = (this.sugarAmount >= this.targetSugarMin && this.sugarAmount <= this.targetSugarMax);
    this.isSugarTooMuch = this.sugarAmount > this.targetSugarMax;

    if (this.isSugarCorrect && !wasCorrect) {
      this.isStoveButtonUnlocked = true;
      this._showNotification('糖水2:1，成功达到黄金比例！', '#ffd700');
    } else if (this.isSugarTooMuch && wasCorrect) {
      // Overfill! Ruined state
      this._triggerOverfill();
    } else if (!this.isSugarCorrect && !this.isSugarTooMuch && wasCorrect) {
      // Was correct, now too low again
      this.isStoveButtonUnlocked = false;
    }
  }

  _triggerOverfill() {
    this.isOverfilled = true;
    this.overfillPhase = 'toomuch';
    this.overfillTimer = 180; // ~3 seconds at 60fps
    this.isPouring = false;
    this.dragTarget = null;
    this.mouse.down = false;
    this.sugarParticles = [];
    this.bubbles = [];
    this.bubbleSprites = [];
    this.flameParticles = [];
    this.smokeParticles = [];
    // Stop pouring audio
    if (this.pourAudio && !this.pourAudio.paused) {
      this.pourAudioTime = this.pourAudio.currentTime;
      this.pourAudio.pause();
    }
    // Stop boiling audio
    if (this.boilingAudio && !this.boilingAudio.paused) this.boilingAudio.pause();
    this._showNotification('糟糕！糖放多了，会齁甜的！', '#ff4444', 180);
  }

  _restartSugarPouring() {
    // Reset sugar state
    this.sugarAmount = 0;
    this.isSugarCorrect = false;
    this.isSugarTooMuch = false;
    this.isPouring = false;
    this.isOverfilled = false;
    this.overfillPhase = null;
    this.overfillTimer = 0;
    this.stoveStarting = false;
    this._isBurnt = false;
    this.burntPhase = null;
    this.burntTimer = 0;
    this.stoveStartTimer = 0;
    this._failOverlayBtn = null;

    // Reset bottle
    this.bottleX = this.bottleBaseX;
    this.bottleY = this.bottleBaseY;
    this.bottleState = 'desk';
    this.bottleTilt = 0;

    // Reset stove
    this.isStoveButtonUnlocked = false;
    this.isHeating = false;
    // Stop boiling audio on restart
    if (this.boilingAudio && !this.boilingAudio.paused) this.boilingAudio.pause();
    // Stop cooking background music on restart
    if (this.cookingBgMusic && !this.cookingBgMusic.paused) this.cookingBgMusic.pause();

    // Reset particles & effects
    this.sugarParticles = [];
    this.bubbles = [];
    this.bubbleSprites = [];
    this.flameParticles = [];
    this.smokeParticles = [];
    this.goldenGlowAlpha = 0;
    this.shakeAmount = 0;

    // Reset heating state
    this.heatingProgress = 0;
    this.heatingStatus = 0;
    this.countdownActive = false;
    this.countdownTimer = 0;
    this.readyWindowActive = false;
    this.readyWindowTimer = 0;
    this.resultState = null;
    this.resultTimer = 0;
    this.heatingSuccess = false;

    // Reset phase
    this.phase = 'pouring';
    this.canClickAnywhere = false;

    // Stop pouring audio
    if (this.pourAudio && !this.pourAudio.paused) {
      this.pourAudioTime = this.pourAudio.currentTime;
      this.pourAudio.pause();
    }
    // Stop boiling audio
    if (this.boilingAudio && !this.boilingAudio.paused) this.boilingAudio.pause();

    // Reset sugar-in-pot visual state
    this.sugarInPotState = null;

    // Reset drag
    this.dragTarget = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    // Show initial prompt
    this._showNotification('将糖倒入锅中', '#e8c170', 180);
  }

  // ================================================================
  //  UPDATE
  // ================================================================

  _getHeatingStatusText() {
    if (this.resultState === 'success') return '火候正好，可以开始铺糖了';
    if (this.resultState === 'too-early') return '太早了，糖还没到火候';
    if (this.resultState === 'too-late') return '糟糕！过火了！\n过火糖色发苦，难吃呀...';

    const p = this.heatingProgress;
    if (p < 0.18) return '慢慢来，糖还在融化\n熬得太嫩，后面的糖画容易不成型～';
    if (p < 0.55) return '糖正在慢慢融化';
    if (p < COUNTDOWN_START) return '糖丝初现，火候快到了！';
    // Countdown: 3 → 2 → 1
    if (this.countdownActive && this.countdownTimer > 60) return '3';
    if (this.countdownActive && this.countdownTimer > 30) return '2';
    if (this.countdownActive) return '1';
    // Ready window
    if (this.readyWindowActive) return '就是现在！快关火！\n已经能拉丝了！';
    return '慢慢来，糖还在融化\n熬得太嫩，后面的糖画容易不成型～';
  }

  _update(dt) {
    this.frameTime += dt;
    const dtFrames = dt * 60;

    // --- Sugar pouring (constant rate when bottle is over pot) ---
    // Re-evaluate pouring state every frame (bottle may be sitting in pot without drag)
    if (!this.isOverfilled && this.phase === 'pouring' && this.dragTarget !== 'sugar' && this.bottleState !== 'desk') {
      if (this._isInPot(this.bottleX, this.bottleY) && this.sugarAmount < 1) {
        this.isPouring = true;
        // Compute tilt from pot depth, determine fast-pouring threshold
        const depth = this._potDepth(this.bottleX, this.bottleY);
        const maxTilt = Math.PI * 0.45;
        this.bottleTilt = depth * maxTilt;
        this.bottleState = depth > 0.8 ? 'pouringFast' : 'pouring';
      } else {
        this.isPouring = false;
        this.bottleState = 'lifted';
        this.bottleTilt = 0;
        // Smoothly snap back to desk if near the desk area
        if (this._isNearDesk(this.bottleX, this.bottleY)) {
          const lerpSpeed = 0.15 * dtFrames;
          this.bottleX += (this.bottleBaseX - this.bottleX) * lerpSpeed;
          this.bottleY += (this.bottleBaseY - this.bottleY) * lerpSpeed;
          if (Math.abs(this.bottleX - this.bottleBaseX) < 2 &&
              Math.abs(this.bottleY - this.bottleBaseY) < 2) {
            this.bottleX = this.bottleBaseX;
            this.bottleY = this.bottleBaseY;
            this.bottleState = 'desk';
          }
        }
      }
    }
    if (!this.isOverfilled && this.phase === 'pouring' && this.isPouring && this.sugarAmount < 1) {
      // Pour rate scales with depth: slower at edge, faster near center
      const depth = this._potDepth(this.bottleX, this.bottleY);
      const rateMultiplier = 0.5 + depth * 0.5; // 0.5x at edge, 1.0x at center
      this.sugarAmount = Math.min(1, this.sugarAmount + POUR_RATE * rateMultiplier * dtFrames);
      this._checkSugarAmount();
    }

    // --- Low-sugar notification while pouring ---
    if (!this.isOverfilled && this.isPouring && !this.isSugarCorrect && !this.isSugarTooMuch) {
      if (!this._pouringNotifiedLow) {
        this._pouringNotifiedLow = true;
        this._showNotification('糖量不足\n再加一点！', '#ffaa44');
      }
    } else {
      this._pouringNotifiedLow = false;
    }

    // --- Sugar pouring audio (play only while actively pouring) ---
    if (this.pourAudioReady && this.pourAudio) {
      const shouldPlay = !this.isOverfilled && this.phase === 'pouring' && this.isPouring && this.sugarAmount < 1;
      if (shouldPlay && this.pourAudio.paused) {
        // Resume from saved position
        this.pourAudio.currentTime = this.pourAudioTime || 0;
        this.pourAudio.play().catch(() => {});
      } else if (!shouldPlay && !this.pourAudio.paused) {
        // Save position and pause
        this.pourAudioTime = this.pourAudio.currentTime;
        this.pourAudio.pause();
      }
    }

    // --- Sugar particles during pouring (thicker, more visible grains) ---
    if (!this.isOverfilled && this.isPouring && this.sugarAmount < 1) {
      // Denser: spawn more particles per frame
      const spawnRate = this.bottleState === 'pouringFast' ? 0.9 : 0.6;
      if (Math.random() < spawnRate * dtFrames) {
        this.sugarParticles.push({
          x: this.bottleX - 18 + Math.random() * 36,
          y: this.bottleY + 35,
          vx: (Math.random() - 0.5) * 0.8,
          vy: 2.5 + Math.random() * 3.5,       // moderate fall speed
          life: 1,
          size: 2 + Math.random() * 3.5,         // thicker: 2–5.5px grains
        });
      }
    }
    for (let i = this.sugarParticles.length - 1; i >= 0; i--) {
      const p = this.sugarParticles[i];
      p.x += p.vx * dtFrames;
      p.y += p.vy * dtFrames;
      // Check if particle is outside the valid pot/liquid area
      const dx = (p.x - this.liquidCx) / this.liquidRx;
      const dy = (p.y - this.liquidCy) / this.liquidRy;
      const inPotRegion = (dx * dx + dy * dy) <= 1.3; // slight tolerance
      if (!inPotRegion) {
        // Fade out quickly when outside the pot area
        p.life -= 0.08 * dtFrames;
      }
      p.life -= 0.012 * dtFrames;
      if (p.life <= 0) this.sugarParticles.splice(i, 1);
    }

    // --- Overfill timer (3s "Too Much Sugar" display, then switch to restart) ---
    if (this.isOverfilled && this.overfillPhase === 'toomuch') {
      this.overfillTimer -= dtFrames;
      if (this.overfillTimer <= 0) {
        this.overfillPhase = 'restart';
      }
    }

    // --- Burnt timer (2.5s "Overcooked" display, then switch to restart) ---
    if (this._isBurnt && this.burntPhase === 'overcooked') {
      this.burntTimer -= dtFrames;
      if (this.burntTimer <= 0) {
        this.burntPhase = 'restart';
      }
    }

    // --- Stove-start delay timer (1s wait after clicking stove before it turns ON) ---
    if (this.stoveStarting) {
      this.stoveStartTimer -= dtFrames;
      if (this.stoveStartTimer <= 0) {
        this.stoveStarting = false;
        this.isHeating = true; // Now actually start heating
      }
    }

    // --- Notification timer ---
    if (this.notificationTimer > 0 && !this.isOverfilled) {
      this.notificationTimer -= dtFrames;
      if (this.notificationTimer <= 0) this.notificationText = '';
    }

    // --- Result timer ---
    // Only handle too-early and too-late timers, NOT success
    // Success waits for user click (handled in _startDrag)
    if (this.resultTimer > 0 && this.resultState) {
      this.resultTimer -= dtFrames;
      if (this.resultTimer <= 0) {
        if (this.resultState === 'too-early') {
          // Reset for retry
          this.resultState = null;
          this.heatingProgress = 0;
          this.heatingStatus = 0;
          this.countdownActive = false;
          this.countdownTimer = 0;
          this.readyWindowActive = false;
          this.readyWindowTimer = 0;
          this.isHeating = true;
        } else if (this.resultState === 'too-late') {
          // Overcooked
          this.resultState = null;
          this._isBurnt = true;
          this.burntPhase = 'overcooked';
          this.burntTimer = 150;
          // Stop boiling audio
          if (this.boilingAudio && !this.boilingAudio.paused) this.boilingAudio.pause();
          // Stop cooking background music
          if (this.cookingBgMusic && !this.cookingBgMusic.paused) this.cookingBgMusic.pause();
        }
        // NOTE: success case is NOT handled here - it waits for user click
      }
    }

    // --- Phase: heating ---
    if (this.phase === 'heating' && this.isHeating && !this.resultState) {
      this.heatingProgress += HEAT_SPEED * dtFrames;
      if (this.heatingProgress > 1) this.heatingProgress = 1;

      // Start countdown at 75%
      if (this.heatingProgress >= COUNTDOWN_START && !this.countdownActive && !this.readyWindowActive) {
        this.countdownActive = true;
        this.countdownTimer = COUNTDOWN_DURATION;
      }

      // Countdown 3→2→1 (clicking here = too early)
      if (this.countdownActive) {
        this.countdownTimer -= dtFrames;
        if (this.countdownTimer <= 0) {
          // Countdown finished → enter ready window
          this.countdownActive = false;
          this.readyWindowActive = true;
          this.readyWindowTimer = this.readyWindowDuration;
        }
      }

      // Ready window (only here = success)
      if (this.readyWindowActive) {
        this.readyWindowTimer -= dtFrames;
        if (this.readyWindowTimer <= 0) {
          this.readyWindowActive = false;
          this.resultState = 'too-late';
          this.resultTimer = 120;
          this._showNotification('过头了，糖色发苦', '#ff4444');
        }
      }

      if (this.heatingProgress < 0.15) this.heatingStatus = 0;
      else if (this.heatingProgress < 0.35) this.heatingStatus = 1;
      else if (this.heatingProgress < 0.55) this.heatingStatus = 2;
      else if (this.heatingProgress < COUNTDOWN_START) this.heatingStatus = 3;
      else this.heatingStatus = 4;
    }

    // --- Bubble sprites (PNG-based, visible near readiness / during heating) ---
    const bubbleImgs = [this.images.bubble1, this.images.bubble2, this.images.bubble3].filter(Boolean);
    if (bubbleImgs.length > 0 && !this.isOverfilled) {
      // Spawn rate increases near readiness: more bubbles as heating progresses
      let spawnChance = 0;
      if (this.phase === 'heating' && this.isHeating) {
        // Increases as sugar nears caramelization
        spawnChance = 0.02 + this.heatingProgress * 0.12;
      } else if (this.phase === 'spoon' || this.heatingSuccess || this.resultState === 'success') {
        spawnChance = 0.08; // gentle post-success bubbles
      }
      if (Math.random() < spawnChance * dtFrames) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * 0.7;
        const bx = this.liquidCx + Math.cos(angle) * this.liquidRx * radius;
        const by = this.liquidCy + Math.sin(angle) * this.liquidRy * radius;
        this.bubbleSprites.push({
          x: bx,
          y: by,
          img: bubbleImgs[Math.floor(Math.random() * bubbleImgs.length)],
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.02,
          scale: 0.4 + Math.random() * 0.6,
          speed: 0.3 + Math.random() * 0.8,
          drift: (Math.random() - 0.5) * 0.3,
          life: 1,
        });
      }
    }
    for (let i = this.bubbleSprites.length - 1; i >= 0; i--) {
      const bs = this.bubbleSprites[i];
      bs.y -= bs.speed * dtFrames;
      bs.x += bs.drift * dtFrames;
      bs.rotation += bs.rotSpeed * dtFrames;
      bs.life -= 0.012 * dtFrames;
      // Remove if outside pot area
      const dx = (bs.x - this.liquidCx) / this.liquidRx;
      const dy = (bs.y - this.liquidCy) / this.liquidRy;
      if ((dx * dx + dy * dy) > 1.1 || bs.life <= 0) {
        this.bubbleSprites.splice(i, 1);
      }
    }

    // --- Bubbles (spawned inside liquid region only) ---
    // TODO: When replacing with PNG sprites, the spawn/update logic stays
    //       the same — only the _drawBoilEffects() renderer changes.
    if ((this.phase === 'heating' && this.isHeating) || this.sugarAmount > 0.3) {
      const bubbleRate = this.isHeating
        ? 0.5 + this.heatingProgress * 4
        : 0.2;
      if (Math.random() < bubbleRate * 0.06 * dtFrames) {
        // Spawn bubble at a random point within the liquid region ellipse
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()); // sqrt for uniform distribution
        const bx = this.liquidCx + Math.cos(angle) * this.liquidRx * 0.85 * radius;
        const by = this.liquidCy + Math.sin(angle) * this.liquidRy * 0.85 * radius;
        this.bubbles.push({
          x: bx,
          y: by,
          r: 2 + Math.random() * (this.isHeating ? 8 * this.heatingProgress : 3),
          speed: 0.5 + Math.random() * 2,
          life: 1,
        });
      }
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y -= b.speed * dtFrames;
      b.life -= 0.015 * dtFrames;
      if (b.life <= 0) this.bubbles.splice(i, 1);
    }

    // --- Flame particles (below the pot, coming up around edges) ---
    if (this.phase === 'heating' && this.isHeating) {
      if (Math.random() < 0.3 * dtFrames) {
        this.flameParticles.push({
          x: this.liquidCx - 80 + Math.random() * 160,
          y: this.liquidCy + this.liquidRy + 10,
          vx: (Math.random() - 0.5) * 1,
          vy: -2 - Math.random() * 4,
          life: 1,
          size: 8 + Math.random() * 16,
        });
      }
    }
    for (let i = this.flameParticles.length - 1; i >= 0; i--) {
      const f = this.flameParticles[i];
      f.x += f.vx * dtFrames;
      f.y += f.vy * dtFrames;
      f.life -= 0.03 * dtFrames;
      if (f.life <= 0) this.flameParticles.splice(i, 1);
    }

    // --- Smoke (above the liquid when overcooked) ---
    if (this.resultState === 'too-late' || (this.heatingProgress > READY_WINDOW_START + 0.15 && !this.readyWindowActive && this.isHeating)) {
      if (Math.random() < 0.15 * dtFrames) {
        this.smokeParticles.push({
          x: this.liquidCx - 80 + Math.random() * 160,
          y: this.liquidCy - this.liquidRy * 0.5 + Math.random() * 40,
          vx: (Math.random() - 0.5) * 1,
          vy: -1 - Math.random() * 2,
          life: 1,
          size: 12 + Math.random() * 20,
        });
      }
    }
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const s = this.smokeParticles[i];
      s.x += s.vx * dtFrames;
      s.y += s.vy * dtFrames;
      s.life -= 0.01 * dtFrames;
      if (s.life <= 0) this.smokeParticles.splice(i, 1);
    }

    // --- Boiling water audio (loops while heating, volume scales with progress) ---
    const shouldBoil = !this.isOverfilled && this.phase === 'heating' && this.isHeating;
    if (this.boilingAudioReady && this.boilingAudio) {
      if (shouldBoil) {
        if (this.boilingAudio.paused) {
          this.boilingAudio.currentTime = 0;
          this.boilingAudio.play().catch(() => {});
        }
        // Volume ramps with heating progress: from 0.08 to 0.55
        const vol = BOILING_BASE_VOLUME + (BOILING_MAX_VOLUME - BOILING_BASE_VOLUME) * this.heatingProgress;
        this.boilingAudio.volume = vol;
      } else if (!this.boilingAudio.paused) {
        this.boilingAudio.pause();
      }
    }

    // --- Shake ---
    if (this.resultState === 'too-late') {
      this.shakeAmount = 6;
    } else {
      this.shakeAmount = Math.max(0, this.shakeAmount - 0.5 * dtFrames);
    }

    // --- Sugar-in-pot visual state transitions ---
    // States: null → 'some' → 'filled' → 'boiling' → 'burnt'
    if (!this.isOverfilled) {
      if (this._isBurnt) {
        // Burnt: stay burnt
        this.sugarInPotState = 'burnt';
      } else if (this.resultState === 'too-late') {
        // Overcooked! Switch to burnt
        this._isBurnt = true;
        this.burntPhase = 'overcooked';
        this.burntTimer = 150; // ~2.5 seconds at 60fps
        this.sugarInPotState = 'burnt';
        // Stop boiling audio
        if (this.boilingAudio && !this.boilingAudio.paused) this.boilingAudio.pause();
      } else if (this.heatingSuccess || this.resultState === 'success' || this.phase === 'spoon') {
        // Success/final: stay on golden caramelized
        this.sugarInPotState = 'boiling';
      } else if (this.readyWindowActive) {
        this.sugarInPotState = 'boiling';
      } else if (this.phase === 'heating' || this.isHeating) {
        if (this.sugarAmount >= TARGET_SUGAR_MIN) {
          this.sugarInPotState = 'filled';
        } else {
          this.sugarInPotState = 'some';
        }
      } else if (this.sugarAmount >= TARGET_SUGAR_MIN) {
        this.sugarInPotState = 'filled';
      } else if (this.sugarAmount > TARGET_SUGAR_MIN * 0.3) {
        this.sugarInPotState = 'some';
      } else {
        this.sugarInPotState = null;
      }
    }

    // --- Golden glow ---
    if (this.heatingSuccess || this.resultState === 'success') {
      this.goldenGlowAlpha = Math.min(1, this.goldenGlowAlpha + 0.02 * dtFrames);
    } else if (this.readyWindowActive || this.countdownActive) {
      this.goldenGlowAlpha = Math.min(0.6, this.goldenGlowAlpha + 0.01 * dtFrames);
    } else {
      this.goldenGlowAlpha = Math.max(0, this.goldenGlowAlpha - 0.02 * dtFrames);
    }
  }

  // ================================================================
  //  RENDER
  // ================================================================

  _render() {
    const ctx = this.ctx;

    // --- Clear full viewport canvas ---
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.vw, this.vh);

    // ==============================================================
    //  BACKGROUND LAYER — drawn in viewport space, width-cover scale
    //  Image fills viewport width, height scales proportionally,
    //  vertically centered. No dark side margins. Top/bottom may crop.
    // ==============================================================
    this._drawBackground(ctx);

    // ==============================================================
    //  GAME CONTENT LAYER — drawn in design coords via game transform
    //  Liquid, bubbles, flame, smoke, glow, particles, bottle.
    //  All positions in 1024×768 design coords, automatically mapped
    //  to screen via the game transform.
    // ==============================================================
    ctx.save();
    ctx.translate(this.gameOriginX, this.gameOriginY);
    ctx.scale(this.gameScale, this.gameScale);

    const shakeX = (Math.random() - 0.5) * this.shakeAmount;
    const shakeY = (Math.random() - 0.5) * this.shakeAmount;
    ctx.translate(shakeX, shakeY);

    this._drawPotFallback(ctx);
    this._drawLiquidSurface(ctx);
    this._drawBoilEffects(ctx);
    this._drawFlame(ctx);
    this._drawSmoke(ctx);
    if (this.goldenGlowAlpha > 0) this._drawGoldenGlow(ctx);
    this._drawSugarParticles(ctx);
    if (this.phase === 'pouring') this._drawSugarBottle(ctx);

    ctx.restore();

    // ==============================================================
    //  UI LAYER — drawn in viewport coordinates (safe-area anchored)
    //  Sugar meter, stove button, heating status, spoon prompt,
    //  notifications. Never cropped off-screen.
    // ==============================================================
    this._drawSugarMeter(ctx);
    this._drawStoveButton(ctx);
    // Draw heating status during heating phase (hide during failure overlays)
    if (this.phase === 'heating' && !this.isOverfilled && !this._isBurnt) {
      this._drawHeatingStatus(ctx);
    }
    if (this.phase === 'spoon') this._drawSpoon(ctx);
    if (this.notificationText && !this.isOverfilled) this._drawNotification(ctx);
    // Overfill overlay (drawn last, covers everything)
    if (this.isOverfilled) this._drawOverlay(ctx);
    if (this._isBurnt) this._drawBurntOverlay(ctx);
    // Success popup (no background dimming)
    if (this.showSuccessPopup) this._drawSuccessPopup(ctx);
  }

  // ================================================================
  //  BACKGROUND — drawn in viewport space, width-cover
  //  Fills viewport width, scales height proportionally,
  //  centered vertically. Top/bottom may crop. No side margins.
  // ================================================================

  _drawBackground(ctx) {
    if (this.images.potBg) {
      // Draw at viewport width, proportional height, centered vertically
      ctx.drawImage(this.images.potBg, 0, this.bgY, this.vw, this.bgH);
    } else {
      // Fallback gradient fill (viewport-sized)
      const grad = ctx.createLinearGradient(0, 0, 0, this.vh);
      grad.addColorStop(0, '#3d2b1f');
      grad.addColorStop(0.5, '#2a1a0e');
      grad.addColorStop(1, '#1a0e05');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.vw, this.vh);

      const glow = ctx.createRadialGradient(this.vw / 2, this.vh / 2, 50, this.vw / 2, this.vh / 2, 500);
      glow.addColorStop(0, 'rgba(255,140,20,0.15)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
  }

  // ================================================================
  //  POT FALLBACK — only drawn when real background image is missing
  // ================================================================

  _drawPotFallback(ctx) {
    if (this.images.potBg) return;

    const cx = this.liquidCx;
    const cy = this.liquidCy;
    const rx = this.liquidRx;
    const ry = this.liquidRy;

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 25, ry + 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    const potGrad = ctx.createRadialGradient(cx - 30, cy - 30, 20, cx, cy, rx);
    potGrad.addColorStop(0, '#f0c878');
    potGrad.addColorStop(0.4, '#e8a860');
    potGrad.addColorStop(0.7, '#d4894a');
    potGrad.addColorStop(1, '#8b4513');
    ctx.fillStyle = potGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#c8783a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#f0d090';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 8, ry - 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    const innerGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, rx - 15);
    innerGrad.addColorStop(0, '#6b3a2a');
    innerGrad.addColorStop(1, '#3a1a0e');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 12, ry - 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#a0622a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx - rx - 5, cy, 22, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + rx + 5, cy, 22, Math.PI * 0.5, -Math.PI * 0.5);
    ctx.stroke();
  }

  // ================================================================
  //  LIQUID SURFACE — Covers the full visible water area inside the pot
  //  Uses liquidCx/Cy/Rx/Ry to match the visible inner liquid region
  //  from the background image.
  //  TODO: In the future, this can be replaced with a PNG overlay
  //        (e.g. this.images.liquidSurfaceTex) for better visuals.
  // ================================================================

  _drawLiquidSurface(ctx) {
    if (this.sugarAmount <= 0.01) return;

    const cx = this.liquidCx;
    const cy = this.liquidCy;
    const rx = this.liquidRx - 10;
    const ry = this.liquidRy - 10;

    // Determine which sugar-in-pot PNG to show
    let sugarImg = null;
    if (this.sugarInPotState === 'boiling' && this.images.sugarInPotBoiling) {
      sugarImg = this.images.sugarInPotBoiling;
    } else if (this.sugarInPotState === 'filled' && this.images.sugarInPotFilled) {
      sugarImg = this.images.sugarInPotFilled;
    } else if (this.sugarInPotState === 'some' && this.images.sugarInPotSome) {
      sugarImg = this.images.sugarInPotSome;
    } else if (this.sugarInPotState === 'burnt' && this.images.sugarInPotBurnt) {
      sugarImg = this.images.sugarInPotBurnt;
    }

    if (sugarImg) {
      // Scale the PNG to fully cover the circle (cover-fit, not fit-inside)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();

      const targetSize = Math.max(rx * 2, ry * 2);
      const imgAspect = sugarImg.width / sugarImg.height;
      let drawW, drawH;
      if (imgAspect > 1) {
        drawW = targetSize;
        drawH = targetSize / imgAspect;
      } else {
        drawH = targetSize;
        drawW = targetSize * imgAspect;
      }
      ctx.drawImage(sugarImg, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
      ctx.restore();
    } // else: no visible white oval overlay — pour area is invisible but still works internally
  }

  // ================================================================
  //  BOIL EFFECTS — Bubble / foam / boiling visuals
  //
  //  This is a temporary placeholder system using code-drawn circles.
  //
  //  TODO: Replace with real PNG/JPEG sprite assets.
  //  Asset slots (add to _init() asset loading section):
  //    this.images.bubbleTex    → small individual bubble PNG
  //    this.images.foamTex      → white foam ring/edge PNG (overlaid at liquid edge)
  //    this.images.boilTex      → boiling turbulence PNG (animated or static)
  //    this.images.sugarSurfaceTex → sugar/syrup surface texture PNG
  //
  //  To swap: inside the render loop below, replace ctx.arc() calls
  //  with ctx.drawImage(this.images.bubbleTex, b.x, b.y, b.r*2, b.r*2)
  //  The particle system (spawn, move, despawn) stays the same.
  // ================================================================

  _drawBoilEffects(ctx) {
    // --- Bubble sprites (PNG-based, more prominent near readiness) ---
    for (const bs of this.bubbleSprites) {
      const alpha = Math.min(0.9, bs.life * 0.9);
      if (bs.img) {
        ctx.save();
        ctx.translate(bs.x, bs.y);
        ctx.rotate(bs.rotation);
        ctx.globalAlpha = alpha;
        const s = 16 * bs.scale;
        ctx.drawImage(bs.img, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }

    // --- Bubble particles (code-drawn placeholder, kept as background detail) ---
    for (const b of this.bubbles) {
      const alpha = b.life * 0.5;

      // TODO: Replace with sprite draw:
      // if (this.images.bubbleTex) {
      //   ctx.globalAlpha = alpha;
      //   ctx.drawImage(this.images.bubbleTex, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      //   ctx.globalAlpha = 1;
      // } else {
      //   ... fallback code-drawn circle below ...
      // }

      // Fallback: simple white circle with highlight
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      // Small specular highlight
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // TODO: Foam ring overlay (render along the liquid edge)
    // if (this.images.foamTex && this.isHeating) {
    //   // Draw foam texture clipped to liquid region edge
    // }

    // TODO: Boiling turbulence overlay (render during active heating)
    // if (this.images.boilTex && this.isHeating) {
    //   // Draw boiling texture over the liquid surface with animation
    // }
  }

  _drawFlame(ctx) {
    for (const f of this.flameParticles) {
      const alpha = f.life;
      const grad = ctx.createLinearGradient(f.x, f.y, f.x, f.y + f.size);
      grad.addColorStop(0, `rgba(255,200,50,${alpha})`);
      grad.addColorStop(0.4, `rgba(255,120,20,${alpha * 0.8})`);
      grad.addColorStop(1, `rgba(255,30,0,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(f.x - f.size * 0.3, f.y + f.size);
      ctx.quadraticCurveTo(f.x - f.size * 0.1, f.y + f.size * 0.2, f.x, f.y);
      ctx.quadraticCurveTo(f.x + f.size * 0.1, f.y + f.size * 0.2, f.x + f.size * 0.3, f.y + f.size);
      ctx.fill();
    }
  }

  _drawSmoke(ctx) {
    for (const s of this.smokeParticles) {
      ctx.fillStyle = `rgba(40,25,15,${s.life * 0.5})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawSugarParticles(ctx) {
    for (const p of this.sugarParticles) {
      // White crystalline sugar with warm-gold highlight
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, p.life * 0.85)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // Warm golden highlight for depth
      ctx.fillStyle = `rgba(255,240,200,${Math.min(0.6, p.life * 0.5)})`;
      ctx.beginPath();
      ctx.arc(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawGoldenGlow(ctx) {
    const cx = this.liquidCx;
    const cy = this.liquidCy;
    const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 400);
    grad.addColorStop(0, `rgba(255,215,0,${this.goldenGlowAlpha * 0.35})`);
    grad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // ================================================================
  //  SUGAR BOTTLE (4 visual states: desk / lifted / pouring / fast-pouring)
  //  Tilt increases as bottle moves toward pot center
  // ================================================================

  _drawSugarBottle(ctx) {
    const bx = this.bottleX;
    const by = this.bottleY;

    ctx.save();
    ctx.translate(bx, by);

    if (this.bottleState === 'desk') {
      // State A: Desk/resting — Sugar bottle on the desk.png
      if (this.images.bottleDesk) {
        const bw = 120;
        const bh = bw * (this.images.bottleDesk.height / this.images.bottleDesk.width);
        ctx.drawImage(this.images.bottleDesk, -bw / 2, -bh / 2, bw, bh);

        // Always visible pulsing label when bottle is on desk
        const pulse = Math.sin(this.frameTime * 0.05) * 0.15 + 0.85;
        ctx.fillStyle = `rgba(255,215,0,${pulse})`;
        ctx.font = 'bold 16px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 6;
        ctx.fillText('拖动糖瓶', 0, bh / 2 + 6);
        ctx.shadowBlur = 0;
      } else {
        this._drawBottleDeskFallback(ctx);
      }
    } else if (this.bottleState === 'lifted') {
      // State B: Lifted/dragged — Sugar in pouring motion.png (no tilt)
      if (this.images.bottleLifted) {
        const bw = 120;
        const bh = bw * (this.images.bottleLifted.height / this.images.bottleLifted.width);
        ctx.drawImage(this.images.bottleLifted, -bw / 2, -bh / 2, bw, bh);
      } else {
        this._drawBottleLiftedPlaceholder(ctx);
      }
    } else if (this.bottleState === 'pouring') {
      // State C: Pouring — Sugar being poured.png with tilt
      ctx.rotate(this.bottleTilt);
      if (this.images.bottlePour) {
        const bw = 120;
        const bh = bw * (this.images.bottlePour.height / this.images.bottlePour.width);
        ctx.drawImage(this.images.bottlePour, -bw / 2, -bh / 2, bw, bh);
      } else {
        this._drawBottlePouringPlaceholder(ctx);
      }
    } else if (this.bottleState === 'pouringFast') {
      // State D: Fast/Extreme pouring — Sugar being poured quick.png with max tilt
      ctx.rotate(this.bottleTilt);
      if (this.images.bottlePourFast) {
        const bw = 120;
        const bh = bw * (this.images.bottlePourFast.height / this.images.bottlePourFast.width);
        ctx.drawImage(this.images.bottlePourFast, -bw / 2, -bh / 2, bw, bh);
      } else {
        this._drawBottlePouringPlaceholder(ctx);
      }
    }

    ctx.restore();
  }

  // Fallback desk bottle (code-drawn)
  _drawBottleDeskFallback(ctx) {
    // Bottle body
    const bottleGrad = ctx.createLinearGradient(-30, -50, 30, -50);
    bottleGrad.addColorStop(0, '#f0e8d8');
    bottleGrad.addColorStop(0.5, '#fff');
    bottleGrad.addColorStop(1, '#d8d0c0');
    ctx.fillStyle = bottleGrad;
    roundRect(ctx, -30, -50, 60, 80, 8);
    ctx.fill();
    ctx.strokeStyle = '#b0a080';
    ctx.lineWidth = 1.5;
    roundRect(ctx, -30, -50, 60, 80, 8);
    ctx.stroke();

    // Bottle neck
    ctx.fillStyle = '#e8dcc8';
    roundRect(ctx, -12, -65, 24, 20, 4);
    ctx.fill();
    ctx.strokeStyle = '#b0a080';
    ctx.lineWidth = 1.5;
    roundRect(ctx, -12, -65, 24, 20, 4);
    ctx.stroke();

    // Cap
    ctx.fillStyle = '#8B6914';
    roundRect(ctx, -10, -75, 20, 12, 3);
    ctx.fill();

    // Label
    ctx.fillStyle = '#8B6914';
    ctx.font = 'bold 16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('糖', 0, -10);
  }

  // Lifted placeholder (bottle tilted, no desk background)
  _drawBottleLiftedPlaceholder(ctx) {
    // Same bottle shape, slightly different shade to indicate "held"
    const bottleGrad = ctx.createLinearGradient(-30, -50, 30, -50);
    bottleGrad.addColorStop(0, '#e8dcc0');
    bottleGrad.addColorStop(0.5, '#f8f0e0');
    bottleGrad.addColorStop(1, '#d0c8b8');
    ctx.fillStyle = bottleGrad;
    roundRect(ctx, -30, -50, 60, 80, 8);
    ctx.fill();
    ctx.strokeStyle = '#a09070';
    ctx.lineWidth = 2;
    roundRect(ctx, -30, -50, 60, 80, 8);
    ctx.stroke();

    // Neck
    ctx.fillStyle = '#e0d4bc';
    roundRect(ctx, -12, -65, 24, 20, 4);
    ctx.fill();
    ctx.strokeStyle = '#a09070';
    ctx.lineWidth = 2;
    roundRect(ctx, -12, -65, 24, 20, 4);
    ctx.stroke();

    // Cap
    ctx.fillStyle = '#8B6914';
    roundRect(ctx, -10, -75, 20, 12, 3);
    ctx.fill();

    // Label
    ctx.fillStyle = '#6B4914';
    ctx.font = 'bold 16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('糖', 0, -10);
  }

  // Pouring placeholder (strongly tilted, pouring sugar)
  _drawBottlePouringPlaceholder(ctx) {
    // Bottle body — slightly darker when pouring
    const bottleGrad = ctx.createLinearGradient(-30, -50, 30, -50);
    bottleGrad.addColorStop(0, '#d8ccb0');
    bottleGrad.addColorStop(0.5, '#e8dcc8');
    bottleGrad.addColorStop(1, '#c0b8a8');
    ctx.fillStyle = bottleGrad;
    roundRect(ctx, -30, -50, 60, 80, 8);
    ctx.fill();
    ctx.strokeStyle = '#908060';
    ctx.lineWidth = 2;
    roundRect(ctx, -30, -50, 60, 80, 8);
    ctx.stroke();

    // Neck
    ctx.fillStyle = '#d0c4ac';
    roundRect(ctx, -12, -65, 24, 20, 4);
    ctx.fill();
    ctx.strokeStyle = '#908060';
    ctx.lineWidth = 2;
    roundRect(ctx, -12, -65, 24, 20, 4);
    ctx.stroke();

    // Cap
    ctx.fillStyle = '#7B5904';
    roundRect(ctx, -10, -75, 20, 12, 3);
    ctx.fill();

    // Sugar stream from cap opening
    ctx.strokeStyle = 'rgba(245,235,210,0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -73);
    ctx.lineTo(0, -20);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(245,235,210,0.4)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, -73);
    ctx.lineTo(0, -20);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#6B4914';
    ctx.font = 'bold 16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('糖', 0, -10);
  }

  // ================================================================
  //  SUGAR METER
  // ================================================================

  _drawSugarMeter(ctx) {
    // Sugar bar, centered on the fire button column
    const mx = Math.round(this.vw * 0.043);
    const my = Math.round(this.vh * 0.09);
    const mw = Math.round(this.vw * 0.09);
    const mh = Math.round(this.vh * 0.58);

    // Compute frame dimensions (anchored to bar width, scaled to fill height if needed)
    let frameW = mw;
    let frameH = mw;
    if (this.images.sugarBarEmpty) {
      const aspect = this.images.sugarBarEmpty.width / this.images.sugarBarEmpty.height;
      frameH = Math.round(mw / aspect);
      if (frameH < mh) { frameH = mh; frameW = Math.round(mh * aspect); }
    }
    const fcx = mx + (mw - frameW) / 2;
    const fcy = my + (mh - frameH) / 2;

    // --- Fill: revealed from bottom to top, clipped inside the bar ---
    if (this.images.sugarBarFilling && this.sugarAmount > 0) {
      const fillRatio = this.sugarAmount;
      const fillH = fillRatio * mh;
      const fillImg = this.images.sugarBarFilling;

      ctx.save();
      // Clip to the bar's inner tube area
      ctx.beginPath();
      roundRect(ctx, mx, my, mw, mh, 4);
      ctx.clip();

      // Draw bottom fillRatio of the fill image, stretched to fill bottom fillRatio of bar
      const srcY = fillImg.height * (1 - fillRatio);
      const srcH = fillImg.height * fillRatio;
      ctx.drawImage(fillImg, 0, srcY, fillImg.width, srcH,
                    mx, my + mh - fillH, mw, fillH);
      ctx.restore();
    }

    // --- Frame PNG on top ---
    if (this.images.sugarBarEmpty) {
      ctx.drawImage(this.images.sugarBarEmpty, fcx, fcy, frameW, frameH);
    }


  }

  // ================================================================
  //  STOVE BUTTON
  // ================================================================

  _drawStoveButton(ctx) {
    if (this.phase === 'spoon' || this.heatingSuccess || this.isOverfilled) return;

    // Stove button center aligned with candy bar: 8.79% width, 84.20% height
    const bx = this.vw * 0.0879;
    const by = this.vh * 0.8420;
    const size = 300;

    // Determine which stove image to show
    const isHeatingActive = this.phase === 'heating' && this.isHeating;
    const isSugarReady = this.isStoveButtonUnlocked && this.phase === 'pouring';

    // Glow effect when actively heating
    if (isHeatingActive) {
      const glowGrad = ctx.createRadialGradient(bx, by, 30, bx, by, 200);
      glowGrad.addColorStop(0, 'rgba(255,120,30,0.5)');
      glowGrad.addColorStop(1, 'rgba(255,60,30,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(bx, by, 200, 0, Math.PI * 2);
      ctx.fill();
    }

    // Prompt glow when sugar is ready and player should press heat button
    if (isSugarReady && !this.stoveStarting) {
      const pulse = Math.sin(this.frameTime * 0.08) * 0.4 + 0.6;
      // Outer pulsing ring
      ctx.save();
      ctx.strokeStyle = `rgba(255,215,0,${pulse * 0.8})`;
      ctx.lineWidth = 4 + pulse * 3;
      ctx.beginPath();
      ctx.arc(bx, by, 160 + pulse * 20, 0, Math.PI * 2);
      ctx.stroke();
      // Inner golden glow
      const promptGlow = ctx.createRadialGradient(bx, by, 60, bx, by, 180);
      promptGlow.addColorStop(0, `rgba(255,215,0,${pulse * 0.35})`);
      promptGlow.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = promptGlow;
      ctx.beginPath();
      ctx.arc(bx, by, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw the stove image — always full opacity, no transparency
    const img = isHeatingActive ? this.images.stoveOn : this.images.stoveOff;
    if (img) {
      const aspect = img.width / img.height;
      const w = size;
      const h = size / aspect;
      ctx.drawImage(img, bx - w / 2, by - h / 2, w, h);
    }
  }

  // ================================================================
  //  HEATING STATUS
  // ================================================================

  _drawHeatingStatus(ctx) {
    const raw = this._getHeatingStatusText();
    const parts = raw.split('\n');
    const mainText = parts[0];
    const subText = parts.length > 1 ? parts[1] : null;

    // Green guide box: 73.44% left, 77.29% top, 22% width, 16% height
    // Reduced size so bottom-right corner stops at failure overlay boundary
    const boxLeft = Math.round(this.vw * 0.7344);
    const boxTop = Math.round(this.vh * 0.7729);
    const boxW = Math.round(this.vw * 0.22);
    const boxH = Math.round(this.vh * 0.16);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, boxLeft, boxTop, boxW, boxH, 16);
    ctx.fill();

    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 2;
    roundRect(ctx, boxLeft, boxTop, boxW, boxH, 16);
    ctx.stroke();

    // Clip to panel boundary to prevent text from extending beyond
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, boxLeft, boxTop, boxW, boxH, 16);
    ctx.clip();

    const isReady = mainText === '就是现在！快关火！';
    const isCountdown = mainText === '3' || mainText === '2' || mainText === '1';
    const isOvercook = mainText === '糟糕！过火了！';

    const textX = boxLeft + boxW / 2;
    const textY = boxTop + boxH / 2;

    // Helper: draw wrapped text within box width
    const drawWrappedText = (text, x, y, maxWidth, lineHeight) => {
      if (text.length <= 8) {
        // Short text: draw directly
        ctx.fillText(text, x, y);
        return;
      }
      // Break long text into lines that fit within maxWidth
      let line = '';
      const lines = [];
      for (let i = 0; i < text.length; i++) {
        const testLine = line + text[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line.length > 0) {
          lines.push(line);
          line = text[i];
        } else {
          line = testLine;
        }
      }
      lines.push(line);
      // Draw lines centered
      const startY = y - (lines.length - 1) * lineHeight / 2;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x, startY + i * lineHeight);
      }
    };

    if (isReady || isCountdown || isOvercook) {
      // Only shrink the golden ready/warning text
      ctx.fillStyle = isOvercook ? '#ff4444' : '#ffd700';
      ctx.font = 'bold 24px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = isOvercook ? '#ff4444' : '#ffd700';
      ctx.shadowBlur = isReady ? 20 : 12;
      // Use wrapped drawing for potentially long text
      const maxTextW = boxW - 30;
      ctx.font = 'bold 24px serif';
      if (subText) {
        drawWrappedText(mainText, textX, textY - 16, maxTextW, 28);
      } else {
        drawWrappedText(mainText, textX, textY, maxTextW, 28);
      }
      ctx.shadowBlur = 0;
      if (subText) {
        ctx.fillStyle = '#e8c170';
        ctx.font = 'bold 16px serif';
        drawWrappedText(subText, textX, textY + 18, maxTextW, 20);
      }
    } else {
      // Reduced font size to prevent overflow
      ctx.fillStyle = '#e8c170';
      ctx.font = 'bold 22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxTextW = boxW - 30;
      if (subText) {
        drawWrappedText(mainText, textX, textY - 16, maxTextW, 26);
        ctx.font = 'bold 17px serif';
        ctx.fillStyle = '#d4b060';
        drawWrappedText(subText, textX, textY + 18, maxTextW, 21);
      } else {
        drawWrappedText(mainText, textX, textY, maxTextW, 26);
      }
    }

    // Restore context (end clipping)
    ctx.restore();
  }

  // ================================================================
  //  SPOON
  // ================================================================

  _drawSpoon(ctx) {
    // Ladle area golden glow (viewport-relative)
    const sx = this.vw * 0.7;
    const sy = this.vh * 0.65;

    const pulse = Math.sin(this.frameTime * 0.06) * 0.3 + 0.7;
    const glowGrad = ctx.createRadialGradient(sx, sy - 20, 10, sx, sy - 20, 100);
    glowGrad.addColorStop(0, `rgba(255,215,0,${pulse * 0.5})`);
    glowGrad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(sx, sy - 20, 100, 0, Math.PI * 2);
    ctx.fill();

    // Click anywhere prompt (not tied to ladle area)
    const promptPulse = Math.sin(this.frameTime * 0.05) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255,215,0,${promptPulse})`;
    ctx.font = 'bold 20px serif';
    ctx.textAlign = 'center';
    ctx.fillText('点击任意位置继续', this.vw / 2, this.vh - 50);
  }

  // ================================================================
  //  OVERFILL OVERLAY — dark screen + restart button
  // ================================================================

  _drawOverlay(ctx) {
    // Dark translucent overlay over the whole screen
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, this.vw, this.vh);

    // Shared failure overlay slot (same position/size for all failure PNGs)
    const slotCenterX = this.vw * FAIL_OVERLAY_CENTER_X;
    const slotCenterY = this.vh * FAIL_OVERLAY_CENTER_Y;
    const slotMaxW = this.vw * FAIL_OVERLAY_MAX_W;
    const slotMaxH = this.vh * FAIL_OVERLAY_MAX_H;

    const img = this.overfillPhase === 'restart' ? this.images.restartBtn : this.images.tooMuchSugar;
    if (img) {
      const aspect = img.width / img.height;
      let bw = slotMaxW;
      let bh = slotMaxW / aspect;
      if (bh > slotMaxH) { bh = slotMaxH; bw = bh * aspect; }
      const bx = slotCenterX - bw / 2;
      const by = slotCenterY - bh / 2;
      ctx.drawImage(img, bx, by, bw, bh);
      // Store hitbox for click detection
      this._failOverlayBtn = { x: bx, y: by, w: bw, h: bh };
    }
  }

  // ================================================================
  //  BURNT OVERLAY — dark screen + Overcooked/Restart button for overcooked sugar
  // ================================================================

  _drawBurntOverlay(ctx) {
    // Dark translucent overlay
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, this.vw, this.vh);

    // Same shared failure overlay slot as overfill
    const slotCenterX = this.vw * FAIL_OVERLAY_CENTER_X;
    const slotCenterY = this.vh * FAIL_OVERLAY_CENTER_Y;
    const slotMaxW = this.vw * FAIL_OVERLAY_MAX_W;
    const slotMaxH = this.vh * FAIL_OVERLAY_MAX_H;

    // Show Overcooked PNG first, then Restart PNG
    const img = this.burntPhase === 'restart' ? this.images.restartBtn : this.images.overcooked;
    if (img) {
      const aspect = img.width / img.height;
      let bw = slotMaxW;
      let bh = slotMaxW / aspect;
      if (bh > slotMaxH) { bh = slotMaxH; bw = bh * aspect; }
      const bx = slotCenterX - bw / 2;
      const by = slotCenterY - bh / 2;
      ctx.drawImage(img, bx, by, bw, bh);
      // Store hitbox for click detection
      this._failOverlayBtn = { x: bx, y: by, w: bw, h: bh };
    }
  }

  // ================================================================
  //  SUCCESS POPUP — shown when first minigame completes successfully
  //  No background dimming, just the success PNG in the center
  // ================================================================

  _drawSuccessPopup(ctx) {
    // Same placement as failure overlays (center of screen)
    const slotCenterX = this.vw * FAIL_OVERLAY_CENTER_X;
    const slotCenterY = this.vh * FAIL_OVERLAY_CENTER_Y;
    const slotMaxW = this.vw * FAIL_OVERLAY_MAX_W;
    const slotMaxH = this.vh * FAIL_OVERLAY_MAX_H;

    // Show success PNG at 85% size of fail popup
    const img = this.images.successCandy;
    if (img) {
      const aspect = img.width / img.height;
      let bw = slotMaxW * 0.85;  // 85% of fail popup width
      let bh = bw / aspect;
      if (bh > slotMaxH * 0.85) { bh = slotMaxH * 0.85; bw = bh * aspect; }
      const bx = slotCenterX - bw / 2;
      const by = slotCenterY - bh / 2;
      ctx.drawImage(img, bx, by, bw, bh);
    }
  }

  // ================================================================
  //  NOTIFICATION
  // ================================================================

  _drawNotification(ctx) {
    if (!this.notificationText) return;

    const parts = this.notificationText.split('\n');
    const mainText = parts[0];
    const subText = parts.length > 1 ? parts[1] : null;

    const nx = this.vw / 2;
    const ny = this.vh * 0.1;
    const alpha = Math.min(1, this.notificationTimer / 20);

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.font = 'bold 20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textWidth = ctx.measureText(mainText).width;
    const subWidth = subText ? ctx.measureText(subText).width : 0;
    const maxTextW = Math.max(textWidth, subWidth);
    const bw = Math.max(320, maxTextW + 60);
    const boxH = subText ? 68 : 50;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, nx - bw / 2, ny - boxH / 2, bw, boxH, 10);
    ctx.fill();

    ctx.strokeStyle = this.notificationColor;
    ctx.lineWidth = 1.5;
    roundRect(ctx, nx - bw / 2, ny - boxH / 2, bw, boxH, 10);
    ctx.stroke();

    ctx.fillStyle = this.notificationColor;
    ctx.shadowColor = this.notificationColor;
    ctx.shadowBlur = 8;
    ctx.font = 'bold 20px serif';
    ctx.fillText(mainText, nx, subText ? ny - 10 : ny);
    ctx.shadowBlur = 0;
    if (subText) {
      ctx.shadowBlur = 0;
      ctx.font = 'bold 16px serif';
      ctx.fillStyle = this.notificationColor;
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillText(subText, nx, ny + 16);
    }

    ctx.restore();
  }

  // ================================================================
  //  HELPERS
  // ================================================================

  _showNotification(text, color, duration) {
    this.notificationText = text;
    this.notificationColor = color;
    // Auto-compute duration based on text length if not explicitly provided
    if (duration === undefined || duration === null) {
      const len = text.length;
      if (len <= 3) duration = 48;   // short: 3, 2, 1 → ~0.8s
      else if (len <= 8) duration = 90;  // medium-short: ~1.5s
      else if (len <= 15) duration = 150; // medium: ~2.5s
      else if (len <= 25) duration = 210; // long: ~3.5s
      else duration = 260; // very long: ~4.3s
    }
    this.notificationTimer = duration;
  }

  // ================================================================
  //  GAME LOOP
  // ================================================================

  _loop(now) {
    const dt = Math.min(0.1, (now - this._lastTime) / 1000);
    this._lastTime = now;

    this._update(dt);
    this._render();

    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  destroy() {
    cancelAnimationFrame(this._raf);

    // Stop and cleanup ALL audio instances (fix music leak)
    const audioKeys = ['pourAudio', 'stoveOnAudio', 'stoveOffAudio', 'boilingAudio', 'cookingBgMusic'];
    audioKeys.forEach(key => {
      if (this[key]) {
        try {
          this[key].pause();
          this[key].currentTime = 0;
        } catch (e) {
          console.warn('[Scene2] Failed to cleanup audio:', key, e);
        }
      }
    });

    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
    this.container.innerHTML = '';
  }
}

// --- Utility ---
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
