/**
 * Scene 5 — Candy Painting / Drawing Mini-Game
 *
 * Similar to Scene 3 (sugar-sheet laying), but the player is trying to
 * draw a target shape displayed on the left side of the screen.
 *
 * All player-facing text is Chinese.
 */

const CANVAS_W = 1024;
const CANVAS_H = 768;

// ================================================================
//  Tuning constants for Scene 5 drawing precision
// ================================================================
const SCENE5_GRID_RESOLUTION_MULTIPLIER = 2;  // Double the grid resolution
const SCENE5_SPREAD_STRENGTH = 0.55;          // Lower = more precise (0.55 = 55% of original)

// Drawing grid constants (doubled resolution for more precise drawing)
const GRID_COLS = 27 * SCENE5_GRID_RESOLUTION_MULTIPLIER;  // = 54
const GRID_ROWS = 30 * SCENE5_GRID_RESOLUTION_MULTIPLIER;  // = 60

// Hot-plate drawable region (same as Scene 3)
const SHEET_X = 284;
const SHEET_Y = 105;
const SHEET_W = 476;
const SHEET_H = 585;

// Thickness thresholds (same as Scene 3, but no failure for over-thick)
const THIN_MAX = 1.0;
const IDEAL_MAX = 2.5;
const THICK_MAX = 4.0;

// Max visual darkness (cap rendered darkness so candy never looks brown)
const SCENE5_MAX_VISUAL_THICKNESS = 3.5; // Cap at warm golden/orange, not brown

// No over-thick penalty in Scene 5

// Diffusion
const DIFFUSION_RATE = 0.10;

// Minimum dwell before a cell becomes real candy (1 = ~1 frame, essentially immediate)
const MIN_CANDY_DWELL_FRAMES = 1;

// Dwell thresholds for outward spread (frames at 60fps)
// Slightly reduced from Scene 3 for more precise control
const SPREAD_RING2_DWELL = 20;
const SPREAD_BLOB_DWELL = 50;

// Audio volume (lowered by 25% from 0.3 to 0.225)
const SCENE5_SYRUP_VOLUME = 0.225;

// Task A: Button 5 BGM volume
const SCENE5_BGM_VOLUME = 0.18;

// Task B: Production quantity config
const SCENE5_MIN_PRODUCTION_QUANTITY = 1;
const SCENE5_MAX_PRODUCTION_QUANTITY = 2; // Max 2 circle candies
const SCENE5_REQUIRED_QUANTITY = 2; // Customer wants exactly 2

// ================================================================
//  Screen-space circle mask — true circle using pixel distances
// ================================================================

// Blueprint circle size constants (design units)
// Task A: Resize blueprint to fit under the final candy head
// Task: Additional shrink by 2 pixels on each side (diameter -4, radius -2)
// Target: diameter ~152 design units, radius ~76 design units
const SCENE5_BLUEPRINT_DIAMETER = 152;  // Design units (shrunk by 4 more)
const SCENE5_BLUEPRINT_RADIUS = 76;     // Design units (shrunk by 2 more)
const SCENE5_BLUEPRINT_CENTER_Y_OFFSET = -5;  // Move up by 5 design pixels (unchanged)

// Build a true circle mask using screen-space pixel distances
// This ensures the circle is visually circular even if grid cells are rectangular
// Task A & B: Uses SCENE5_BLUEPRINT_RADIUS for consistent size
// Task B: This same mask is used for both rendering and scoring (single source of truth)
function buildScene5CircleMask(cols, rows, cellW, cellH) {
  const mask = Array.from({ length: rows }, () => Array(cols).fill(0));

  const gridW = cols * cellW;
  const gridH = rows * cellH;

  // Center of the circle in pixel coordinates (same as design coordinates for sheet area)
  const centerXpx = gridW * 0.5;
  const centerYpx = gridH * 0.47 + SCENE5_BLUEPRINT_CENTER_Y_OFFSET; // Moved up by 5 pixels

  // Task A: Use fixed radius in design units (converted to grid pixel coordinates)
  // Since grid pixel coordinates match design coordinates for the sheet area, use directly
  const radiusPx = SCENE5_BLUEPRINT_RADIUS;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Center of this cell in pixel coordinates
      const cellCenterXpx = (x + 0.5) * cellW;
      const cellCenterYpx = (y + 0.5) * cellH;

      const dx = cellCenterXpx - centerXpx;
      const dy = cellCenterYpx - centerYpx;

      // Check if cell center is within the circle
      if (dx * dx + dy * dy <= radiusPx * radiusPx) {
        mask[y][x] = 1;
      }
    }
  }

  return mask;
}

// For easy tweaking later, the guide mask is built per-instance in the constructor.

// Success thresholds (MVP)
const SUCCESS_TARGET_COVERAGE = 0.70;  // 70% of target shape covered
const SUCCESS_MAX_OUTSIDE = 0.35;      // Max 35% outside overdraw

// Thickness gain multiplier — makes sugar darken faster without increasing spread
// Increased by ~20% (from 1.9 to 2.28) for even quicker candy buildup
const SCENE5_THICKNESS_GAIN_MULTIPLIER = 2.28;

// Burnt/overcooked threshold — cells darker than this get a penalty (mild)
const TOO_DARK_THRESHOLD = 0.92;

// Viscous candy flow constants (slow diffusion for medium-dark and very thick candy)
const SCENE5_FLOW_ENABLED = true;
const SCENE5_FLOW_THRESHOLD = 0.62;      // Medium-dark cells flow (0.62 = medium-dark brown)
const SCENE5_FLOW_HOLD_TIME_MS = 300;    // Must hold for 300ms before flow starts
const SCENE5_FLOW_RATE = 0.06;           // Faster relaxation for medium-dark sugar
const SCENE5_FLOW_MAX_PER_TICK = 0.018;  // Slightly more flow per tick

// Dark sugar flow constants (soften dark spots immediately)
const SCENE5_DARK_FLOW_ENABLED = true;
const SCENE5_DARK_FLOW_THRESHOLD = 0.42;   // Dark cells flow (0.42 = dark golden)
const SCENE5_DARK_TARGET_LEVEL = 0.34;     // Target level after flow
const SCENE5_DARK_FLOW_RATE = 0.14;        // Faster relaxation for dark sugar
const SCENE5_DARK_FLOW_MAX_PER_TICK = 0.035; // More flow per tick for dark sugar

// Guide shadow colors (faint, so player sugar appears on top)
const SCENE5_GUIDE_FILL = "rgba(185, 145, 55, 0.20)";
const SCENE5_GUIDE_EDGE = "rgba(145, 105, 35, 0.28)";

export class Scene5 {
  constructor(containerEl, onComplete, options = {}) {
    this.container = containerEl;
    this.onComplete = onComplete;
    this.mode = options.mode || "practice"; // "practice" or "order"

    this.canvas = document.createElement('canvas');
    // Fix: Set explicit px dimensions to prevent browser scaling distortion
    const initW = window.innerWidth;
    const initH = window.innerHeight;
    this.canvas.width = initW;
    this.canvas.height = initH;
    this.canvas.style.cssText = `position: absolute; top: 0; left: 0; width: ${initW}px; height: ${initH}px; display: block; cursor: none;`;
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    // Task E: Create separate canvas for final candy (prevents distortion from main canvas context)
    this._finalCandyCanvas = document.createElement('canvas');
    this._finalCandyCanvas.style.cssText = `position: absolute; top: 0; left: 0; width: ${initW}px; height: ${initH}px; display: none; pointer-events: none;`;
    this._finalCandyCtx = this._finalCandyCanvas.getContext('2d');
    this.container.appendChild(this._finalCandyCanvas);

    // Images
    this._bgImg = null;        // With spoon background
    this._bgImgNoSpoon = null; // Without spoon background
    this._spoonBeforeImg = null;
    this._spoonPouringImg = null;
    this._imagesLoaded = 0;
    this._loadImages();

    // Spoon pickup state
    this.hasPickedUpSpoon = false;
    this._showSpoonPickupHint = true;

    // Spoon hotspot area (adjusted for new Scene 5 background)
    // TODO: Adjust these coordinates to match the spoon position in "With Spoon.png"
    this._hotspotCx = 780;   // Center X of spoon in design coordinates
    this._hotspotCy = 420;    // Center Y of spoon in design coordinates
    this._hotspotRx = 80;     // Horizontal radius of clickable area
    this._hotspotRy = 60;     // Vertical radius of clickable area

    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseCanvasX = 0;
    this.mouseCanvasY = 0;
    this.mouseDown = false;

    // Track mouse position in design coordinates for stick calibration
    this.scene5MouseX = 0;
    this.scene5MouseY = 0;

    // Scene 5 targeting model:
    // - scene5StickTargetOverride: temporary T/red-dot debug pointer only.
    // - scene5CandyStickSharedAnchor: saved anchor used by BOTH stick flight and final candy placement.
    // Do not add separate stick/candy target systems unless intentionally redesigning placement.

    // Temporary T calibration target (debug/visual only, does NOT affect stick flight)
    this.scene5StickTargetOverride = null;
    this._loadStickTargetFromStorage();

    // Whether to show the red target dot (only true after pressing T)
    this.scene5ShowTargetDot = false;

    // Task G: Debug diagnostic circle (temporary, for diagnosing oval distortion)
    this._showDebugCircle = false; // Task E: Hidden by default, enable manually if needed

    // Task C: Final candy PNG anchor point (internal point in the image)
    // 0.5 = horizontal center, 0.46 = where stick enters candy head
    this.SCENE5_FINAL_CANDY_ANCHOR_X = 0.5;
    this.SCENE5_FINAL_CANDY_ANCHOR_Y = 0.46;

    // Task A: SHARED anchor for both stick flight and final candy placement
    // This is the single source of truth for both
    this.scene5CandyStickSharedAnchor = null;
    this._loadSharedAnchorFromStorage();

    // Final candy image
    this._finalCandyImg = null;
    this._finalCandyLoaded = false;
    this._showFinalCandy = false;
    this._finalCandyAnimStartTime = 0;
    this._finalCandyAnimDuration = 400; // ms

    // Task D: Finish button invisible vertical hitbox extension
    this._finishButtonVerticalExtension = 40; // px upward extension in design coordinates

    // Ladle position
    this.ladleX = 0;
    this.ladleY = 0;
    this.ladlePrevX = 0;
    this.ladlePrevY = 0;

    // State
    this.completed = false;
    this.failed = false;  // Note: Scene 5 doesn't fail for over-thick
    this.hasStartedDrawing = false;
    this.playerSubmitted = false;  // Player clicked "完成" button

    // Per-cell hold time tracking for flow control
    this._cellHoldTime = new Float32Array(GRID_COLS * GRID_ROWS);

    // Track which cells received direct pouring (not from flow)
    // This prevents flowed cells from becoming new flow sources
    this._directPourCount = new Uint8Array(GRID_COLS * GRID_ROWS);

    // Grid (float thickness)
    this.grid = new Float32Array(GRID_COLS * GRID_ROWS);
    this._cellCD = new Uint8Array(GRID_COLS * GRID_ROWS);

    // Per-cell candidate dwell timer
    this._candidateDwell = new Float32Array(GRID_COLS * GRID_ROWS);
    this._pendingBatch = [];
    this._touchedThisFrame = new Uint8Array(GRID_COLS * GRID_ROWS);

    // Hot-plate area
    this.sheetX = SHEET_X;
    this.sheetY = SHEET_Y;
    this.sheetW = SHEET_W;
    this.sheetH = SHEET_H;
    this.cellW = this.sheetW / GRID_COLS;
    this.cellH = this.sheetH / GRID_ROWS;

    this.ladleRadius = 18;

    // Success state
    this.successTimer = 0;
    this._showSuccessMessage = false;

    // Finish button rectangle (for click detection)
    this._finishButtonRect = null;

    // Notification
    this.notificationText = '';
    this.notificationTimer = 0;
    this.notificationColor = '#ffd700';

    // Cue text
    this.cueColor = '#444';
    this.cueText = '';

    // Phase state (drawing -> result -> stickPlacement -> completed)
    this._phase = "drawing"; // "drawing" | "result" | "stickPlacement" | "completed"

    // Stick placement phase
    this._stickImg = null;
    this._stickLoaded = false;
    this._stickState = "idle"; // "idle" | "flying" | "landed"
    this._stickAnimStartTime = 0;
    this._stickStartX = 0;
    this._stickStartY = 0;
    this._stickTargetX = 0;
    this._stickTargetY = 0;
    this._stickCurrentX = 0;
    this._stickCurrentY = 0;
    this._stickAnimDuration = 800; // ms
    this._stickAnimProgress = 0;
    this._showStickPlacementHint = false;
    this._stickPlacementComplete = false;

    // Audio - syrup pouring sound (same working approach as Scene 3)
    this._syrupPourAudio = null;
    this._isPouringSoundPlaying = false;

    // Load syrup pouring audio with proper debugging (same as Scene 3)
    const audioPath = '/assets/scene3/audio/syrup-pouring.m4a';
    this._syrupPourAudio = new Audio(audioPath);
    this._syrupPourAudio.loop = true;
    this._syrupPourAudio.volume = SCENE5_SYRUP_VOLUME;
    this._syrupPourAudio.playbackRate = 0.85;
    this._syrupPourAudio.preload = "auto";

    // Add debugging event listeners
    this._syrupPourAudio.addEventListener('loadeddata', () => {
      console.log('Scene5 syrup audio loaded:', this._syrupPourAudio.src);
    });
    this._syrupPourAudio.addEventListener('canplaythrough', () => {
      console.log('Scene5 syrup audio ready:', this._syrupPourAudio.src);
    });
    this._syrupPourAudio.addEventListener('error', (e) => {
      console.error('Scene5 syrup audio failed to load:', e, this._syrupPourAudio.src);
    });

    // Preload the audio
    this._syrupPourAudio.load();
    console.log('Scene5: Loading syrup pour audio from', this._syrupPourAudio.src);

    // Task A: Button 5 background music (looping, quiet)
    this._bgmAudio = null;
    this._bgmStarted = false;
    const bgmPath = '/assets/scene5/audio/background-music.wav';
    this._bgmAudio = new Audio(bgmPath);
    this._bgmAudio.loop = true;
    this._bgmAudio.volume = SCENE5_BGM_VOLUME;
    this._bgmAudio.preload = "auto";

    // Debugging event listeners for BGM
    this._bgmAudio.addEventListener('loadeddata', () => {
      console.log('Scene5 BGM loaded:', this._bgmAudio.src);
    });
    this._bgmAudio.addEventListener('canplaythrough', () => {
      console.log('Scene5 BGM ready:', this._bgmAudio.src);
    });
    this._bgmAudio.addEventListener('error', (e) => {
      console.error('Scene5 BGM failed to load:', e, this._bgmAudio.src);
    });

    // Preload BGM
    this._bgmAudio.load();
    console.log('Scene5: Loading BGM from', this._bgmAudio.src);

    // Task B & C: Production panel state
    this._showProductionPanel = false;
    this._productionQuantity = SCENE5_MIN_PRODUCTION_QUANTITY;
    this._productionConfirmed = false;
    this._showContinueHint = false;
    this._productionPanelRect = null; // For click detection

    // Task B: Quantity feedback message
    this._quantityFeedback = '';
    this._quantityFeedbackTimer = 0;

    // Task C/D/E/F/G: Production animation state
    this._producedCandies = [];           // Array of produced candy objects
    this._productionAnimating = false;     // Flag: production animation in progress

    // Task F: Debug flag for production hitbox outlines
    // Task: Hide production hitbox debug outlines after testing
    this.scene5ShowProductionHitboxDebug = false;
    this._productionComplete = false;      // Flag: all candies produced
    this._showSuccessScreen = false;      // Flag: show success screen
    this._successScreenImg = null;        // Success screen image
    this._popAudioContext = null;         // WebAudio context for pop sound
    this._productionIndex = 0;           // Current candy being produced
    this._lastProduceTime = 0;           // Timestamp of last candy production
    this._productionStaggerDelay = 150;   // ms between each candy pop

    // Speed tracking for gameplay text
    this._speedHistory = [];
    this._maxSpeedHistory = 15;
    this._averageSpeed = 0;
    this._brushSpeedMultiplier = 1.0; // Speed-based brush thickness multiplier

    // Build guide mask using screen-space circle (true circle)
    this._guideMask = buildScene5CircleMask(GRID_COLS, GRID_ROWS, this.cellW, this.cellH);

    // Calculate candy bounding box from guide mask cells
    // This is used for stick placement target
    this._candyMinX = Infinity;
    this._candyMaxX = -Infinity;
    this._candyMinY = Infinity;
    this._candyMaxY = -Infinity;
    this._candyCellCount = 0;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (this._guideMask[row][col]) {
          this._candyCellCount++;
          const cellLeft = this.sheetX + col * this.cellW;
          const cellRight = this.sheetX + (col + 1) * this.cellW;
          const cellTop = this.sheetY + row * this.cellH;
          const cellBottom = this.sheetY + (row + 1) * this.cellH;

          if (cellLeft < this._candyMinX) this._candyMinX = cellLeft;
          if (cellRight > this._candyMaxX) this._candyMaxX = cellRight;
          if (cellTop < this._candyMinY) this._candyMinY = cellTop;
          if (cellBottom > this._candyMaxY) this._candyMaxY = cellBottom;
        }
      }
    }

    // Calculate candy center from bounding box
    this._candyCenterX = (this._candyMinX + this._candyMaxX) / 2;
    this._candyCenterY = (this._candyMinY + this._candyMaxY) / 2;



    // Single score display (完成度)
    this._completionScore = 0;

    // Final result after player submits
    this._finalScore = 0;
    this._resultMessage = '';

    // Scoring debug stats (kept for internal use)
    this._debugCoverage = 0;
    this._debugOutside = 0;

    this._resize();
    this._initEvents();
    this._loop();

    this._showNotification('点击勺子区域拾取勺子，然后照着影子画图！', '#e8c170', 200);
  }

  // ================================================================
  //  Stick target calibration helpers
  // ================================================================

  _isValidTarget(target) {
    return target && Number.isFinite(target.x) && Number.isFinite(target.y);
  }

  // Task A: Helper method to get the shared anchor for both candy and stick
  _getScene5CandyStickSharedAnchor() {
    // Priority 1: Use shared anchor from memory
    if (this._isValidTarget(this.scene5CandyStickSharedAnchor)) {
      return {
        x: this.scene5CandyStickSharedAnchor.x,
        y: this.scene5CandyStickSharedAnchor.y
      };
    }

    // Priority 2: Load from localStorage
    try {
      const stored = localStorage.getItem("scene5CandyStickSharedAnchor");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this._isValidTarget(parsed)) {
          this.scene5CandyStickSharedAnchor = parsed; // Cache in memory
          return {
            x: parsed.x,
            y: parsed.y
          };
        }
      }
    } catch (e) {
      console.warn('Scene5: Failed to load shared anchor from localStorage', e);
    }

    // Priority 3: Emergency fallback - use candy center
    console.warn("Scene5: No shared anchor found, using candy center fallback");
    return {
      x: this._candyCenterX || CANVAS_W / 2,
      y: this._candyCenterY || CANVAS_H / 2
    };
  }

  // Task A: Load shared anchor for both candy and stick from localStorage
  _loadSharedAnchorFromStorage() {
    try {
      const stored = localStorage.getItem("scene5CandyStickSharedAnchor");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this._isValidTarget(parsed)) {
          this.scene5CandyStickSharedAnchor = parsed;
          console.log('Scene5: Loaded shared candy/stick anchor from localStorage', this.scene5CandyStickSharedAnchor);
          return;
        } else {
          localStorage.removeItem("scene5CandyStickSharedAnchor");
        }
      }
    } catch (e) {
      console.warn('Scene5: Failed to load shared candy/stick anchor from localStorage', e);
      localStorage.removeItem("scene5CandyStickSharedAnchor");
    }
  }

  // Task A: Save shared anchor for both candy and stick to localStorage
  _saveSharedAnchorToStorage() {
    try {
      localStorage.setItem("scene5CandyStickSharedAnchor", JSON.stringify(this.scene5CandyStickSharedAnchor));
      console.log('Scene5: Saved shared candy/stick anchor to localStorage', this.scene5CandyStickSharedAnchor);
    } catch (e) {
      console.warn('Scene5: Failed to save shared candy/stick anchor to localStorage', e);
    }
  }

  // Task A: Start BGM (handles autoplay blocking)
  _startBGM() {
    if (this._bgmStarted || !this._bgmAudio) return;

    const playPromise = this._bgmAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this._bgmStarted = true;
        console.log("Scene5 BGM started");
      }).catch((e) => {
        console.warn('Scene5: BGM autoplay blocked, will retry on next user gesture', e);
        // Will retry on next user gesture (mouse/touch handler will call _startBGM again)
      });
    }
  }

  // Task A: Stop BGM
  _stopBGM() {
    if (this._bgmAudio && this._bgmStarted) {
      this._bgmAudio.pause();
      this._bgmAudio.currentTime = 0;
      this._bgmStarted = false;
      console.log("Scene5 BGM stopped");
    }
  }

  _loadStickTargetFromStorage() {
    // Load temporary T calibration target (debug/visual only)
    try {
      const stored = localStorage.getItem("scene5StickTargetOverride");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only accept if both x and y are finite numbers
        if (this._isValidTarget(parsed)) {
          this.scene5StickTargetOverride = parsed;
          console.log('Scene5 loaded saved stick target', {
            x: this.scene5StickTargetOverride.x,
            y: this.scene5StickTargetOverride.y,
            source: "localStorage"
          });
        } else {
          // Clear invalid data
          localStorage.removeItem("scene5StickTargetOverride");
          console.warn('Scene5: Cleared invalid stick target from localStorage', parsed);
        }
      }
    } catch (e) {
      console.warn('Scene5: Failed to load stick target from localStorage', e);
      localStorage.removeItem("scene5StickTargetOverride");
    }
  }

  _saveStickTargetToStorage() {
    try {
      localStorage.setItem("scene5StickTargetOverride", JSON.stringify(this.scene5StickTargetOverride));
      console.log('Scene5: Saved stick target to localStorage');
    } catch (e) {
      console.warn('Scene5: Failed to save stick target to localStorage', e);
    }
  }

  // ================================================================
  //  Parse target shape template into a grid (kept for compatibility)
  //  NOTE: Now using screen-space mask instead
  // ================================================================

  // ================================================================
  //  Image loading
  // ================================================================

  _loadImages() {
    // Load Scene 5 background images (with spoon and without spoon)
    const bg = new Image();
    bg.onload = () => { this._bgImg = bg; this._imagesLoaded++; };
    bg.onerror = () => { this._imagesLoaded++; };
    bg.src = 'assets/scene5/background/with-spoon.png';

    const bgNoSpoon = new Image();
    bgNoSpoon.onload = () => { this._bgImgNoSpoon = bgNoSpoon; this._imagesLoaded++; };
    bgNoSpoon.onerror = () => { this._imagesLoaded++; };
    bgNoSpoon.src = 'assets/scene5/background/without-spoon.png';

    const spoonBefore = new Image();
    spoonBefore.onload = () => { this._spoonBeforeImg = spoonBefore; this._imagesLoaded++; };
    spoonBefore.onerror = () => { this._imagesLoaded++; };
    spoonBefore.src = 'assets/scene3/spoons/beforepour.png';

    const spoonPouring = new Image();
    spoonPouring.onload = () => { this._spoonPouringImg = spoonPouring; this._imagesLoaded++; };
    spoonPouring.onerror = () => { this._imagesLoaded++; };
    spoonPouring.src = 'assets/scene3/spoons/pouring.png';

    // Load stick image for stick placement phase
    const stickImg = new Image();
    stickImg.onload = () => { 
      console.log('[Stick] stick image loaded:', stickImg.src);
      this._stickImg = stickImg; 
      this._stickLoaded = true; 
    };
    stickImg.onerror = () => { 
      console.error('[Stick] image load error:', stickImg.src); 
      this._stickLoaded = false; 
    };
    stickImg.src = '/assets/stick/stick.png';

    // Task C: Load final candy image
    const finalCandyImg = new Image();
    finalCandyImg.onload = () => { 
      this._finalCandyImg = finalCandyImg; 
      this._finalCandyLoaded = true; 
      console.log('[CandyComplete] final candy image loaded:', finalCandyImg.src);
    };
    finalCandyImg.onerror = () => { 
      this._finalCandyLoaded = false; 
      console.error('[CandyComplete] final candy image load error:', finalCandyImg.src); 
    };
    const finalCandyPath = '/assets/scene5/final/Circle candy.png';
    console.log('[CandyComplete] final candy image path:', finalCandyPath);
    finalCandyImg.src = finalCandyPath;

    // Task G: Load success screen image
    const successImg = new Image();
    successImg.onload = () => { this._successScreenImg = successImg; console.log('Scene5: Success screen image loaded'); };
    successImg.onerror = () => { console.warn('Scene5: Failed to load success screen image'); };
    successImg.src = 'Animations/Button 5/Success screen/Success candy drew.png';
  }

  // ================================================================
  //  Task F: WebAudio pop sound for candy production
  // ================================================================

  _playPopSound() {
    try {
      // Create audio context on first use (requires user gesture)
      if (!this._popAudioContext) {
        this._popAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this._popAudioContext;
      if (ctx.state === 'suspended') ctx.resume();

      // Create a short pop sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Soft pop: short burst at ~800Hz, quick decay
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Fail silently - audio is not critical
      console.log('Scene5: Pop sound failed (non-critical)', e);
    }
  }

  // ================================================================
  //  Resize
  // ================================================================

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.vw = this.canvas.width;
    this.vh = this.canvas.height;
    this.scaleX = this.vw / CANVAS_W;
    this.scaleY = this.vh / CANVAS_H;
    this.offX = 0;
    this.offY = 0;

    // Task E: Also resize the separate final candy canvas
    if (this._finalCandyCanvas) {
      this._finalCandyCanvas.width = window.innerWidth;
      this._finalCandyCanvas.height = window.innerHeight;
      this._finalCandyCanvas.style.width = window.innerWidth + 'px';
      this._finalCandyCanvas.style.height = window.innerHeight + 'px';
    }

    const cx = this._toDesign(this.vw / 2, this.vh / 2);
    this.ladleX = cx.x;
    this.ladleY = cx.y;
    this.ladlePrevX = cx.x;
    this.ladlePrevY = cx.y;
  }

  // ================================================================
  //  Events
  // ================================================================

  _initEvents() {
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);

    this.canvas.style.cursor = 'default';

    this._onMouseDown = (e) => {
      if (this._destroyed) return;
      this.mouseDown = true;
      // Update mouse position immediately so ladle position is correct
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;

      // Task A: Start BGM on user gesture (handles autoplay blocking)
      this._startBGM();

      // Task A: Use consistent coordinate conversion helper for ALL hit-testing
      const point = this._getScene5DesignPointFromClient(e.clientX, e.clientY);
      const designX = point.x;
      const designY = point.y;

      // Calculate canvas-space coordinates for production panel hit-testing
      const rect = this.canvas.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const canvasY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      // Task H: Handle success screen click - wait for user click then transition
      if (this._showSuccessScreen) {
        console.log("Scene5 success screen clicked, transitioning to next scene");
        // Call onComplete to transition to next scene (Scene 6 or placeholder)
        if (this.onComplete) {
          this.onComplete();
        }
        return;
      }

      // Task D: Prioritize production panel clicks BEFORE other click logic
      if (this._showProductionPanel && !this._productionConfirmed && !this._productionAnimating) {
        // Check if clicked on minus button (use canvas-space coordinates)
        if (this._isPointInScene5Box(this._minusBtnRect, canvasX, canvasY, designX, designY)) {
          this._productionQuantity = Math.max(SCENE5_MIN_PRODUCTION_QUANTITY, this._productionQuantity - 1);
          return;
        }

        // Check if clicked on plus button
        if (this._isPointInScene5Box(this._plusBtnRect, canvasX, canvasY, designX, designY)) {
          if (SCENE5_MAX_PRODUCTION_QUANTITY !== null && this._productionQuantity >= SCENE5_MAX_PRODUCTION_QUANTITY) {
            this._quantityFeedback = '客人只要两个圆形糖画，不能再多做了。';
            this._quantityFeedbackTimer = performance.now();
          } else {
            this._productionQuantity++;
          }
          return;
        }

        // Check if clicked on 制作 button
        if (this._isPointInScene5Box(this._makeBtnRect, canvasX, canvasY, designX, designY)) {
          // Check if quantity meets requirement (mode-dependent)
          // In order mode, require exactly SCENE5_REQUIRED_QUANTITY (2)
          // In practice mode, allow any quantity >= SCENE5_MIN_PRODUCTION_QUANTITY
          if (this.mode === "order" && this._productionQuantity < SCENE5_REQUIRED_QUANTITY) {
            this._quantityFeedback = '客人要两个圆形糖画，请做满两个。';
            this._quantityFeedbackTimer = performance.now();
            return;
          }
          // Task C: Start production animation sequence
          this._productionConfirmed = true;
          this._showProductionPanel = false;
          this._productionAnimating = true;
          this._productionIndex = 0;
          this._lastProduceTime = performance.now();
          this._producedCandies = [];
          console.log("Scene5 starting production animation", {
            quantity: this._productionQuantity,
            mode: this.mode
          });
          return;
        }
      }

      // Check if "完成" button was clicked
      if (this.hasStartedDrawing && !this.playerSubmitted && !this.completed && this._finishButtonRect) {
        const btn = this._finishButtonRect;

        // Task D: Check extended hitbox (vertical-only extension, mainly upward)
        const verticalExtension = this._finishButtonVerticalExtension || 40;
        const extendedTop = btn.y - verticalExtension; // Extend upward
        const extendedBottom = btn.y + btn.h; // No extension downward (keep original)

        if (designX >= btn.x && designX <= btn.x + btn.w &&
            designY >= extendedTop && designY <= extendedBottom) {
          this._onPlayerSubmit();
          return;
        }
      }

      // Check if stick was clicked (during stick placement phase)
      if (this._phase === "stickPlacement" && this._stickState === "idle") {
        if (this._isStickClicked(designX, designY)) {
          // Task A: Use helper method to get shared anchor for stick flight
          const anchor = this._getScene5CandyStickSharedAnchor();
          this._stickTargetX = anchor.x;
          this._stickTargetY = anchor.y;

          // Task D: Invariant debug log - stick uses shared anchor
          console.log("Scene5 shared anchor invariant - stick", {
            sharedAnchor: this._getScene5CandyStickSharedAnchor(),
            stickTargetX: this._stickTargetX,
            stickTargetY: this._stickTargetY
          });

          console.log('[Stick] stick clicked, animation started');
          this._stickState = "flying";
          this._stickAnimStartTime = performance.now();

          return;
        }
      }

      // Audio unlock
      if (this._syrupPourAudio && this._syrupPourAudio.paused) {
        this._syrupPourAudio.play().then(() => {
          this._syrupPourAudio.pause();
          this._syrupPourAudio.currentTime = 0;
          console.log('Scene5: Audio unlocked successfully');
        }).catch((err) => {
          console.log('Scene5: Audio unlock attempt (normal):', err.name);
        });
      }

      // Check if hotspot was clicked (spoon pickup)
      if (this._showSpoonPickupHint && !this.hasPickedUpSpoon) {
        // Use design coordinates for oval hit test
        const hotspotCx = this._hotspotCx;
        const hotspotCy = this._hotspotCy;
        const hotspotRx = this._hotspotRx;
        const hotspotRy = this._hotspotRy;

        // Oval parameters (same as Scene 3)
        const oldBottom = (hotspotCy + hotspotRy);
        const newOvalTop = oldBottom;
        const newOvalBottom = CANVAS_H;
        const newOvalCenterX = hotspotCx + 20;
        const newOvalRadiusX = hotspotRx * 0.75;
        const newOvalRadiusY = (newOvalBottom - newOvalTop) / 2;

        const ovalCenterX = newOvalCenterX;
        const ovalCenterY = newOvalTop + newOvalRadiusY;

        const dx = (designX - ovalCenterX) / newOvalRadiusX;
        const dy = (designY - ovalCenterY) / newOvalRadiusY;
        if (dx * dx + dy * dy <= 1) {
          this._showSpoonPickupHint = false;
          this.hasPickedUpSpoon = true;
          this.canvas.style.cursor = 'none';
          this._showNotification('开始画糖画！照着影子画图！', '#ffd700', 120);
          return;
        }
      }

      // Task D: Handle "点击任意处继续" click
      if (this._productionConfirmed && this._showContinueHint) {
        console.log("Scene5 continuing to next cutscene", {
          quantity: this._productionQuantity
        });
        // TODO: Call next cutscene/transition here if available
        // For now, just reset the state
        this._showContinueHint = false;
        return;
      }

      // Only allow drawing if spoon has been picked up
      if (this.hasPickedUpSpoon && !this.completed) {
        this._onStrokeStart();
        this._updatePourAudio();
      }
    };
    window.addEventListener('mousedown', this._onMouseDown);

    this._onMouseMove = (e) => {
      if (this._destroyed) return;
      // Task A: Start BGM on user gesture
      this._startBGM();

      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      const rect = this.canvas.getBoundingClientRect();
      this.mouseCanvasX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouseCanvasY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      // Task A/B: Track mouse position in design coordinates for stick calibration
      const designPos = this._getScene5DesignPointFromClient(e.clientX, e.clientY);
      this.scene5MouseX = designPos.x;
      this.scene5MouseY = designPos.y;

      if (this.hasPickedUpSpoon && !this.completed) {
        this._updatePourAudio();
      }
    };
    window.addEventListener('mousemove', this._onMouseMove);

    this._onKeyDown = (e) => {
      if (this._destroyed) return;
      // Task A: Start BGM on user gesture
      this._startBGM();

      if (e.key === 'T' || e.key === 't') {
        // Ctrl+Shift+T is deprecated - do nothing except log a note
        if (e.ctrlKey && e.shiftKey) {
          console.log("Scene5 Ctrl+Shift+T is deprecated. Use T then L to lock shared candy/stick anchor.");
          return;
        }
        // Regular T = Set temporary T target (debug/visual only, does NOT affect stick flight)
        else {
          // Only calibrate if Scene 5 is active
          if (this._phase === "drawing" || this._phase === "stickPlacement" || this._phase === "result") {
            // Record BOTH x and y from current mouse position (temporary/debug only)
            this.scene5StickTargetOverride = {
              x: this.scene5MouseX,
              y: this.scene5MouseY
            };
            this._saveStickTargetToStorage();

            // Show red dot after pressing T
            this.scene5ShowTargetDot = true;

            this._showNotification('T目标已设置 (调试用)，按L锁定位置', '#ffd700', 120);
          }
        }
      }

      // Task C: L key = lock current T target as generic target AND permanent stick target
      if (e.key === 'L' || e.key === 'l') {
        if (this._phase === "drawing" || this._phase === "stickPlacement" || this._phase === "result") {
          // Read current T target from memory
          let tTarget = null;
          if (this._isValidTarget(this.scene5StickTargetOverride)) {
            tTarget = this.scene5StickTargetOverride;
          } else {
            // Try reading from localStorage
            try {
              const stored = localStorage.getItem("scene5StickTargetOverride");
              if (stored) {
                const parsed = JSON.parse(stored);
                if (this._isValidTarget(parsed)) {
                  tTarget = parsed;
                }
              }
            } catch (e) {
              console.warn('Scene5: Failed to read T target from localStorage', e);
            }
          }

          if (this._isValidTarget(tTarget)) {
            // Task A: Save T target as SHARED anchor for both stick and final candy
            this.scene5CandyStickSharedAnchor = {
              x: tTarget.x,
              y: tTarget.y
            };
            this._saveSharedAnchorToStorage();

            // Read back and log
            const readBack = JSON.parse(localStorage.getItem("scene5CandyStickSharedAnchor"));
            console.log("Scene5 locked SHARED candy/stick anchor from T target", {
              tTarget,
              sharedAnchor: this.scene5CandyStickSharedAnchor,
              readBack
            });

            console.log("Scene5 L locked shared anchor", {
              sharedAnchor: this.scene5CandyStickSharedAnchor
            });

            this._showNotification('共享目标已锁定！棒子和糖果都会用这个位置！', '#00ff00', 120);
          } else {
            console.warn("Scene5: Cannot lock shared anchor - no valid T target. Press T first.");
            this._showNotification('请先按T设置目标位置', '#ff0000', 120);
          }
        }
      }
    };
    window.addEventListener('keydown', this._onKeyDown);

    this._onMouseUp = () => {
      if (this._destroyed) return;
      this.mouseDown = false;
      this._onStrokeEnd();
      this._updatePourAudio();
    };
    window.addEventListener('mouseup', this._onMouseUp);

    // Touch support
    this._onTouchStart = (e) => {
      const t = e.touches[0];
      this.mouseX = t.clientX;
      this.mouseY = t.clientY;
      this.mouseDown = true;

      // Task A: Start BGM on user gesture
      this._startBGM();

      // Task A: Use consistent coordinate conversion helper for ALL hit-testing (touch)
      const point = this._getScene5DesignPointFromClient(t.clientX, t.clientY);
      const designX = point.x;
      const designY = point.y;

      // Calculate canvas-space coordinates for production panel hit-testing (touch)
      const rect = this.canvas.getBoundingClientRect();
      const canvasX = (t.clientX - rect.left) * (this.canvas.width / rect.width);
      const canvasY = (t.clientY - rect.top) * (this.canvas.height / rect.height);

      // Task H: Handle success screen click - wait for user click then transition
      if (this._showSuccessScreen) {
        console.log("Scene5 success screen touched, transitioning to next scene");
        // Call onComplete to transition to next scene (Scene 6 or placeholder)
        if (this.onComplete) {
          this.onComplete();
        }
        return;
      }

      // Task D: Prioritize production panel clicks BEFORE other click logic (touch)
      if (this._showProductionPanel && !this._productionConfirmed && !this._productionAnimating) {
        // Check if touched on minus button (use canvas-space coordinates)
        if (this._isPointInScene5Box(this._minusBtnRect, canvasX, canvasY, designX, designY)) {
          this._productionQuantity = Math.max(SCENE5_MIN_PRODUCTION_QUANTITY, this._productionQuantity - 1);
          return;
        }

        // Check if touched on plus button
        if (this._isPointInScene5Box(this._plusBtnRect, canvasX, canvasY, designX, designY)) {
          if (SCENE5_MAX_PRODUCTION_QUANTITY !== null && this._productionQuantity >= SCENE5_MAX_PRODUCTION_QUANTITY) {
            this._quantityFeedback = '客人只要两个圆形糖画，不能再多做了。';
            this._quantityFeedbackTimer = performance.now();
          } else {
            this._productionQuantity++;
          }
          return;
        }

        // Check if touched on 制作 button
        if (this._isPointInScene5Box(this._makeBtnRect, canvasX, canvasY, designX, designY)) {
          // Check if quantity meets requirement (mode-dependent)
          // In order mode, require exactly SCENE5_REQUIRED_QUANTITY (2)
          // In practice mode, allow any quantity >= SCENE5_MIN_PRODUCTION_QUANTITY
          if (this.mode === "order" && this._productionQuantity < SCENE5_REQUIRED_QUANTITY) {
            this._quantityFeedback = '客人要两个圆形糖画，请做满两个。';
            this._quantityFeedbackTimer = performance.now();
            return;
          }
          // Task C: Start production animation sequence
          this._productionConfirmed = true;
          this._showProductionPanel = false;
          this._productionAnimating = true;
          this._productionIndex = 0;
          this._lastProduceTime = performance.now();
          this._producedCandies = [];
          return;
        }
      }

      // Task D: Handle "点击任意处继续" touch
      if (this._productionConfirmed && this._showContinueHint) {
        console.log("Scene5 continuing to next cutscene (touch)", {
          quantity: this._productionQuantity
        });
        // TODO: Call next cutscene/transition here if available
        // For now, just reset the state
        this._showContinueHint = false;
        return;
      }

      // Check if "完成" button was touched
      if (this.hasStartedDrawing && !this.playerSubmitted && !this.completed && this._finishButtonRect) {
        const btn = this._finishButtonRect;

        // Task D: Check extended hitbox (vertical-only extension, mainly upward)
        const verticalExtension = this._finishButtonVerticalExtension || 40;
        const extendedTop = btn.y - verticalExtension; // Extend upward
        const extendedBottom = btn.y + btn.h; // No extension downward (keep original)

        // Task B: Debug log for finish button touch
        console.log("Scene5 finish touch check", {
          designX,
          designY,
          finishBox: this._finishButtonRect,
          extendedTop,
          extendedBottom
        });

        if (designX >= btn.x && designX <= btn.x + btn.w &&
            designY >= extendedTop && designY <= extendedBottom) {
          this._onPlayerSubmit();
          return;
        }
      }

      // Check if stick was touched (during stick placement phase)
      if (this._phase === "stickPlacement" && this._stickState === "idle") {
        if (this._isStickClicked(designX, designY)) {
          // Task A: Use helper method to get shared anchor for stick flight (touch)
          const anchor = this._getScene5CandyStickSharedAnchor();
          this._stickTargetX = anchor.x;
          this._stickTargetY = anchor.y;

          this._stickState = "flying";
          this._stickAnimStartTime = performance.now();

          // Log that stick flies to shared anchor
          console.log("Scene5 stick flight using shared anchor (touch)", {
            targetX: this._stickTargetX,
            targetY: this._stickTargetY,
            sharedAnchor: this.scene5CandyStickSharedAnchor
          });

          return;
        }
      }

      if (this._showSpoonPickupHint && !this.hasPickedUpSpoon) {
        // Use design coordinates for oval hit test
        const hotspotCx = this._hotspotCx;
        const hotspotCy = this._hotspotCy;
        const hotspotRx = this._hotspotRx;
        const hotspotRy = this._hotspotRy;

        const oldBottom = (hotspotCy + hotspotRy);
        const newOvalTop = oldBottom;
        const newOvalBottom = CANVAS_H;
        const newOvalCenterX = hotspotCx + 20;
        const newOvalRadiusX = hotspotRx * 0.75;
        const newOvalRadiusY = (newOvalBottom - newOvalTop) / 2;

        const ovalCenterX = newOvalCenterX;
        const ovalCenterY = newOvalTop + newOvalRadiusY;

        const dx = (designX - ovalCenterX) / newOvalRadiusX;
        const dy = (designY - ovalCenterY) / newOvalRadiusY;
        if (dx * dx + dy * dy <= 1) {
          this._showSpoonPickupHint = false;
          this.hasPickedUpSpoon = true;
          this.canvas.style.cursor = 'none';
          this._showNotification('开始画糖画！照着影子画图！', '#ffd700', 120);
          return;
        }
      }

      if (this.hasPickedUpSpoon && !this.completed) {
        this._onStrokeStart();
      }
    };
    window.addEventListener('touchstart', this._onTouchStart);

    this._onTouchMove = (e) => {
      if (this._destroyed) return;
      const t = e.touches[0];
      this.mouseX = t.clientX;
      this.mouseY = t.clientY;
      const rect = this.canvas.getBoundingClientRect();
      this.mouseCanvasX = (t.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouseCanvasY = (t.clientY - rect.top) * (this.canvas.height / rect.height);

      // Task A/B: Track touch position in design coordinates for stick calibration
      const designPos = this._getScene5DesignPointFromClient(t.clientX, t.clientY);
      this.scene5MouseX = designPos.x;
      this.scene5MouseY = designPos.y;
    };
    window.addEventListener('touchmove', this._onTouchMove);

    this._onTouchEnd = () => {
      if (this._destroyed) return;
      this.mouseDown = false;
      this._onStrokeEnd();
    };
    window.addEventListener('touchend', this._onTouchEnd);

    // Stop pouring sound when mouse leaves canvas
    this._onMouseLeave = () => {
      if (this._destroyed) return;
      this._updatePourAudio();
    };
    this.canvas.addEventListener('mouseleave', this._onMouseLeave);
  }

  // ================================================================
  //  Stroke handlers
  // ================================================================

  _onStrokeStart() {
    // Always start drawing when spoon is picked up and mouse is pressed
    // The actual drawing check (inSheet) happens in _update(), not here
    if (!this.hasStartedDrawing) {
      // FIX: Use _getScene5DesignPointFromClient() to correctly convert client coords to design coords
      const pos = this._getScene5DesignPointFromClient(this.mouseX, this.mouseY);
      this.hasStartedDrawing = true;
      this.ladlePrevX = pos.x;
      this.ladlePrevY = pos.y;
      this._lastDrawTime = performance.now();

      // Debug log for drawing start
      const insideBoard = this._isInSheet(pos.x, pos.y);
      console.log("Scene 5 drawing start", {
        spoonPickedUp: this.hasPickedUpSpoon,
        pointerDown: this.mouseDown,
        x: pos.x,
        y: pos.y,
        insideBoard: insideBoard,
        drawingState: this.hasStartedDrawing
      });
    }
  }

  _onStrokeEnd() {
    this._updatePourAudio();

    // Removed auto-success - player must click "完成" button to submit
  }

  // Get result message based on final score
  _getResultMessage(score) {
    if (score >= 70) {
      return "画得真不错！这幅糖画可以原价售出。";
    }
    if (score >= 40) {
      return "画得还行，虽然不算完美，但肯定还是有人愿意吃。售价打五折。";
    }
    return "这次糖画还不太完美，不过经验也是手艺的一部分。";
  }

  // Handle player submission (when "完成" button is clicked)
  _onPlayerSubmit() {
    if (this.playerSubmitted || this.completed) return;

    console.log('[CandyComplete] finish clicked');
    this.playerSubmitted = true;
    this.completed = true;
    this._phase = "result"; // Show result first

    // Stop pouring audio
    if (this._syrupPourAudio) {
      this._syrupPourAudio.pause();
      this._syrupPourAudio.currentTime = 0;
      this._isPouringSoundPlaying = false;
    }

    // Evaluate final score
    const scoring = this._computeScoring();
    this._finalScore = scoring.score;
    this._resultMessage = this._getResultMessage(scoring.score);
    console.log('Scene5 final scoring:', scoring);
    console.log('Scene5 result message:', this._resultMessage);

    // Show result message (keep it visible)
    this.successTimer = 0;
    this._showSuccessMessage = true;

    // Transition to stick placement phase after a short delay
    this._stickPlacementTimeout = setTimeout(() => {
      console.log('[Stick] stick step entered');
      this._phase = "stickPlacement";
      this._showStickPlacementHint = true;
      this._stickState = "idle";

      // Stick start position (left side of screen)
      this._stickStartX = 100;
      this._stickStartY = CANVAS_H * 0.5;

      // Current stick position (starts at left side)
      this._stickCurrentX = this._stickStartX;
      this._stickCurrentY = this._stickStartY;

      // Target will be set when stick is clicked (using _getScene5CandyStickSharedAnchor())

      // Restore normal cursor for stick placement phase
      this.canvas.style.cursor = 'default';

      console.log('Scene5: Stick placement phase started');
      console.log('Scene5: Stick target will be determined when stick is clicked');
    }, 1500); // 1.5 second delay to show result first
  }

  // ================================================================
  //  Coordinate conversion
  // ================================================================

  _toDesign(cx, cy) {
    return { x: (cx - this.offX) / this.scaleX, y: (cy - this.offY) / this.scaleY };
  }

  // Task B: Convert browser client coordinates to Scene 5 design coordinates.
  // Accounts for canvas bounding rect, CSS-to-drawing-buffer scaling.
  _getScene5DesignPointFromClient(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = (clientX - rect.left) * (this.canvas.width / rect.width);
    const canvasY = (clientY - rect.top) * (this.canvas.height / rect.height);
    return this._toDesign(canvasX, canvasY);
  }

  // Task B: Convert Scene 5 design coordinates to canvas draw coordinates.
  _getScene5CanvasPointFromDesign(x, y) {
    return {
      x: this.offX + x * this.scaleX,
      y: this.offY + y * this.scaleY
    };
  }

  // Task C: Helper to check if a point is inside a saved button box
  // The production panel is rendered in canvas space, so we need to compare canvas coordinates
  _isPointInScene5Box(box, canvasX, canvasY, designX, designY) {
    if (!box) return false;

    // Production panel buttons are saved in canvas space (rendered after ctx.restore())
    // So we use canvasX/canvasY for hit-testing
    const px = canvasX;
    const py = canvasY;

    return (
      px >= box.x &&
      px <= box.x + box.w &&
      py >= box.y &&
      py <= box.y + box.h
    );
  }

  _isInSheet(dx, dy) {
    return dx >= this.sheetX && dx <= this.sheetX + this.sheetW &&
           dy >= this.sheetY && dy <= this.sheetY + this.sheetH;
  }

  _getCell(dx, dy) {
    const col = Math.floor((dx - this.sheetX) / this.cellW);
    const row = Math.floor((dy - this.sheetY) / this.cellH);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return -1;
    return row * GRID_COLS + col;
  }

  // ================================================================
  //  Grid/thickness logic (similar to Scene 3)
  // ================================================================

  _addThickness(idx, amt) {
    if (idx < 0 || idx >= GRID_COLS * GRID_ROWS) return;
    if (this._cellCD[idx] > 0) return;
    this.grid[idx] = Math.min(10, this.grid[idx] + amt);
    this._cellCD[idx] = 2;
  }

  _applyDiffusion() {
    const src = this.grid;
    const dst = new Float32Array(GRID_COLS * GRID_ROWS);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col;
        const v = src[idx];
        if (v <= IDEAL_MAX) { dst[idx] = v; continue; }
        const excess = v - IDEAL_MAX;
        if (excess < 0.1) { dst[idx] = v; continue; }
        let transferred = 0;
        const neighbors = [];
        if (row > 0) neighbors.push(idx - GRID_COLS);
        if (row < GRID_ROWS - 1) neighbors.push(idx + GRID_COLS);
        if (col > 0) neighbors.push(idx - 1);
        if (col < GRID_COLS - 1) neighbors.push(idx + 1);
        for (const ni of neighbors) {
          if (src[ni] < IDEAL_MAX && transferred < excess) {
            const need = IDEAL_MAX - src[ni];
            const give = Math.min(need, excess * DIFFUSION_RATE);
            dst[ni] = (dst[ni] || src[ni]) + give;
            transferred += give;
          }
        }
        dst[idx] = v - transferred;
      }
    }
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) this.grid[i] = dst[i] || this.grid[i];
  }

  // ================================================================
  //  Viscous candy flow — slow diffusion for very thick candy
  // ================================================================

  _applyViscousFlow(dt) {
    if (!SCENE5_FLOW_ENABLED) return;
    if (this.completed || this.playerSubmitted) return; // Stop flow after success/submission

    const dtFrames = dt * 60;
    const deltas = new Float32Array(GRID_COLS * GRID_ROWS);

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col;
        const v = this.grid[idx];

        // Condition 1: Only very thick cells flow (very dark blob)
        if (v < SCENE5_FLOW_THRESHOLD) continue;

        // Condition 2: Player held in this cell long enough
        if (this._cellHoldTime[idx] < SCENE5_FLOW_HOLD_TIME_MS / 1000) continue;

        // Condition 3: Cell received direct pouring (not from flow)
        // This prevents flowed cells from becoming new flow sources
        if (this._directPourCount[idx] === 0) continue;

        const excess = v - SCENE5_FLOW_THRESHOLD;
        const flowAmount = Math.min(
          SCENE5_FLOW_MAX_PER_TICK,
          excess * SCENE5_FLOW_RATE * dtFrames
        );

        if (flowAmount <= 0) continue;

        // 4-neighbor diffusion (local only)
        const neighbors = [];
        if (row > 0) neighbors.push(idx - GRID_COLS);
        if (row < GRID_ROWS - 1) neighbors.push(idx + GRID_COLS);
        if (col > 0) neighbors.push(idx - 1);
        if (col < GRID_COLS - 1) neighbors.push(idx + 1);

        if (neighbors.length === 0) continue;

        // Remove a very small amount from this cell (dark center becomes slightly less extreme)
        deltas[idx] -= flowAmount;

        // Distribute to neighbors (neighbors become light sugar, not dark)
        const each = flowAmount / neighbors.length;
        for (const ni of neighbors) {
          deltas[ni] += each;
        }
      }
    }

    // Apply deltas
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      if (deltas[i] !== 0) {
        this.grid[i] = Math.max(0, Math.min(10, this.grid[i] + deltas[i]));
      }
    }
  }

  _applyDarkFlow(dt) {
    // Soften dark spots immediately by spreading to neighbors
    if (!SCENE5_DARK_FLOW_ENABLED) return;

    const dtFrames = dt * 60;
    const deltas = new Float32Array(GRID_COLS * GRID_ROWS);

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col;
        const v = this.grid[idx];

        // Only dark cells flow (darker than threshold)
        if (v < SCENE5_DARK_FLOW_THRESHOLD) continue;

        // Calculate how much to flow (spread dark to light)
        const excess = v - SCENE5_DARK_TARGET_LEVEL;
        const flowAmount = Math.min(
          SCENE5_DARK_FLOW_MAX_PER_TICK,
          excess * SCENE5_DARK_FLOW_RATE * dtFrames
        );

        if (flowAmount <= 0) continue;

        // 4-neighbor diffusion (local only)
        const neighbors = [];
        if (row > 0) neighbors.push(idx - GRID_COLS);
        if (row < GRID_ROWS - 1) neighbors.push(idx + GRID_COLS);
        if (col > 0) neighbors.push(idx - 1);
        if (col < GRID_COLS - 1) neighbors.push(idx + 1);

        if (neighbors.length === 0) continue;

        // Remove from dark cell (become lighter)
        deltas[idx] -= flowAmount;

        // Distribute to neighbors (neighbors become lighter golden)
        const each = flowAmount / neighbors.length;
        for (const ni of neighbors) {
          // Only add if neighbor is not already too dark
          if (this.grid[ni] < SCENE5_DARK_FLOW_THRESHOLD) {
            deltas[ni] += each;
          }
        }
      }
    }

    // Apply deltas
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      if (deltas[i] !== 0) {
        this.grid[i] = Math.max(0, Math.min(10, this.grid[i] + deltas[i]));
      }
    }
  }

  // ================================================================
  //  Scoring / success calculation
  // ================================================================

  _computeScoring() {
    // Score against the in-grid guide mask (screen-space circle)
    if (!this._guideMask) {
      return { score: 0, scaffoldCellCount: 0, filledScaffoldCellCount: 0, outsideFilledCellCount: 0 };
    }

    const VISIBLE_SUGAR_THRESHOLD = 0.025;
    const OUTSIDE_PENALTY_WEIGHT = 1.0;

    let scaffoldCellCount = 0;
    let filledScaffoldCellCount = 0;
    let outsideFilledCellCount = 0;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col;
        const v = this.grid[idx];
        const isScaffold = this._guideMask[row] && this._guideMask[row][col];
        const hasVisibleSugar = v > VISIBLE_SUGAR_THRESHOLD;

        if (isScaffold) {
          scaffoldCellCount += 1;

          if (hasVisibleSugar) {
            filledScaffoldCellCount += 1;
          }
        } else {
          if (hasVisibleSugar) {
            outsideFilledCellCount += 1;
          }
        }
      }
    }

    // Simple binary cell counting
    const rawPoints =
      filledScaffoldCellCount -
      outsideFilledCellCount * OUTSIDE_PENALTY_WEIGHT;

    const percent = Math.round(
      (rawPoints / Math.max(1, scaffoldCellCount)) * 100
    );

    const scorePercent = Math.max(0, Math.min(100, percent));



    return {
      score: scorePercent,
      scaffoldCellCount,
      filledScaffoldCellCount,
      outsideFilledCellCount
    };
  }

  // ================================================================
  //  Audio helpers (same working logic as Scene 3)
  // ================================================================

  _shouldPlaySyrupAudio() {
    // FIX: Use _getScene5DesignPointFromClient() for correct coordinate conversion
    const pos = this._getScene5DesignPointFromClient(this.mouseX, this.mouseY);
    const pointerInsideGrid = this._isInSheet(pos.x, pos.y);
    const drawingEnabled = this.hasPickedUpSpoon && this.hasStartedDrawing && this.mouseDown && pointerInsideGrid;

    return (
      this.hasPickedUpSpoon &&
      this.mouseDown &&
      pointerInsideGrid &&
      drawingEnabled &&
      !this.completed
    );
  }

  _updatePourAudio() {
    if (!this._syrupPourAudio) {
      console.warn('Scene5: No syrup pour audio object');
      return;
    }

    const shouldPlay = this._shouldPlaySyrupAudio();

    if (shouldPlay) {
      if (this._syrupPourAudio.paused) {
        console.log('Scene5 syrup audio START');
        const playPromise = this._syrupPourAudio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            this._isPouringSoundPlaying = true;
            console.log('Scene5: Syrup pour audio started successfully');
          }).catch((err) => {
            console.error('Scene5: Audio play failed:', err.name, err.message);
          });
        } else {
          this._isPouringSoundPlaying = true;
        }
      }
    } else {
      if (!this._syrupPourAudio.paused) {
        console.log('Scene5: Pausing syrup pour audio');
        this._syrupPourAudio.pause();
        this._isPouringSoundPlaying = false;
      }
    }
  }

  // ================================================================
  //  Notification
  // ================================================================

  _showNotification(text, color, dur) {
    this.notificationText = text;
    this.notificationColor = color;
    this.notificationTimer = dur || 120;
  }

  // ================================================================
  //  Update logic
  // ================================================================

  _updateCandidates(prevX, prevY, curX, curY, dtFrames) {
    const dx = curX - prevX;
    const dy = curY - prevY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const stepSize = Math.min(this.cellW, this.cellH) * 0.4;
    const steps = Math.max(1, Math.ceil(dist / stepSize));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = prevX + dx * t;
      const py = prevY + dy * t;
      const cellIdx = this._getCell(px, py);
      if (cellIdx < 0) continue;

      this._touchedThisFrame[cellIdx] = 1;

      if (this.grid[cellIdx] > 0) {
        this._candidateDwell[cellIdx] += dtFrames;
        // Track hold time for flow control
        this._cellHoldTime[cellIdx] += (1/60) * dtFrames;
        // Mark as directly poured (player is actively pouring here)
        this._directPourCount[cellIdx] = 1;
        continue;
      }

      const dwellAdd = dtFrames / (steps + 1);
      const prevDwell = this._candidateDwell[cellIdx];
      const newDwell = prevDwell + dwellAdd;
      this._candidateDwell[cellIdx] = newDwell;

      if (prevDwell < MIN_CANDY_DWELL_FRAMES && newDwell >= MIN_CANDY_DWELL_FRAMES) {
        this._pendingBatch.push(cellIdx);
      }
    }

    // Local spread (reduced for more precise drawing)
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      if (!this._touchedThisFrame[i]) continue;
      if (this.grid[i] <= 0) continue;
      const dwell = this._candidateDwell[i];

      // Spread amounts with precision tuning (SCENE5_SPREAD_STRENGTH = 0.55)
      // coreAmt uses SCENE5_THICKNESS_GAIN_MULTIPLIER for faster darkening
      let coreAmt, ring1Amt, ring2Amt;
      if (dwell >= SPREAD_BLOB_DWELL) {
        coreAmt = 0.10 * SCENE5_SPREAD_STRENGTH * SCENE5_THICKNESS_GAIN_MULTIPLIER;
        ring1Amt = 0.06 * SCENE5_SPREAD_STRENGTH;
        ring2Amt = 0;  // Disabled for smaller initial stamp (plus shape)
      } else if (dwell >= SPREAD_RING2_DWELL) {
        coreAmt = 0.13 * SCENE5_SPREAD_STRENGTH * SCENE5_THICKNESS_GAIN_MULTIPLIER;
        ring1Amt = 0.08 * SCENE5_SPREAD_STRENGTH;
        ring2Amt = 0;  // Disabled for smaller initial stamp (plus shape)
      } else {
        coreAmt = 0.16 * SCENE5_SPREAD_STRENGTH * SCENE5_THICKNESS_GAIN_MULTIPLIER;
        ring1Amt = 0.06 * SCENE5_SPREAD_STRENGTH;
        ring2Amt = 0;  // Disabled for smaller initial stamp (plus shape)
      }
      
      // Apply speed-based multiplier (fast = thinner, slow = thicker)
      const speedMult = this._brushSpeedMultiplier || 1.0;
      coreAmt *= speedMult;
      ring1Amt *= speedMult;
      ring2Amt *= speedMult;
      
      this._localSpread(i, coreAmt * dtFrames, ring1Amt * dtFrames, ring2Amt * dtFrames);
    }
  }

  _localSpread(cellIdx, coreAmt, ring1Amt, ring2Amt) {
    if (cellIdx < 0) return;
    const row = Math.floor(cellIdx / GRID_COLS);
    const col = cellIdx % GRID_COLS;

    this._addThickness(cellIdx, coreAmt);

    if (col > 0) this._addThickness(cellIdx - 1, ring1Amt);
    if (col < GRID_COLS - 1) this._addThickness(cellIdx + 1, ring1Amt);
    if (row > 0) this._addThickness(cellIdx - GRID_COLS, ring1Amt);
    if (row < GRID_ROWS - 1) this._addThickness(cellIdx + GRID_COLS, ring1Amt);

    if (ring2Amt <= 0) return;
    if (row > 1) this._addThickness(cellIdx - 2 * GRID_COLS, ring2Amt);
    if (row < GRID_ROWS - 2) this._addThickness(cellIdx + 2 * GRID_COLS, ring2Amt);
    if (col > 1) this._addThickness(cellIdx - 2, ring2Amt);
    if (col < GRID_COLS - 2) this._addThickness(cellIdx + 2, ring2Amt);
    if (col > 0 && row > 0) this._addThickness(cellIdx - GRID_COLS - 1, ring2Amt);
    if (col < GRID_COLS - 1 && row > 0) this._addThickness(cellIdx - GRID_COLS + 1, ring2Amt);
    if (col > 0 && row < GRID_ROWS - 1) this._addThickness(cellIdx + GRID_COLS - 1, ring2Amt);
    if (col < GRID_COLS - 1 && row < GRID_ROWS - 1) this._addThickness(cellIdx + GRID_COLS + 1, ring2Amt);
  }

  _update(dt) {
    // Only update drawing logic during drawing phase
    if (this._phase === "drawing") {
      const dtFrames = dt * 60;

      // Ladle = mouse position (FIX: use _getScene5DesignPointFromClient for correct coordinate conversion)
      const target = this._getScene5DesignPointFromClient(this.mouseX, this.mouseY);
      this.ladlePrevX = this.ladleX;
      this.ladlePrevY = this.ladleY;
      this.ladleX = target.x;
      this.ladleY = target.y;

      // Track speed
      const ladleDx = this.ladleX - this.ladlePrevX;
      const ladleDy = this.ladleY - this.ladlePrevY;
      const ladleDist = Math.sqrt(ladleDx * ladleDx + ladleDy * ladleDy);
      this._speedHistory.push(ladleDist);
      if (this._speedHistory.length > this._maxSpeedHistory) {
        this._speedHistory.shift();
      }
      let speedSum = 0;
      for (let i = 0; i < this._speedHistory.length; i++) {
        speedSum += this._speedHistory[i];
      }
      this._averageSpeed = this._speedHistory.length > 0 ? speedSum / this._speedHistory.length : 0;

      // Speed-based brush thickness multiplier
      const SCENE5_BRUSH_SPEED_MIN = 2;
      const SCENE5_BRUSH_SPEED_MAX = 25;
      const SCENE5_BRUSH_MULT_MIN = 0.4;
      const SCENE5_BRUSH_MULT_MAX = 1.6;
      
      let speedNorm = Math.max(0, Math.min(1, (this._averageSpeed - SCENE5_BRUSH_SPEED_MIN) / (SCENE5_BRUSH_SPEED_MAX - SCENE5_BRUSH_SPEED_MIN)));
      this._brushSpeedMultiplier = SCENE5_BRUSH_MULT_MAX - speedNorm * (SCENE5_BRUSH_MULT_MAX - SCENE5_BRUSH_MULT_MIN);

      // Per-cell cooldowns
      for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
        if (this._cellCD[i] > 0) this._cellCD[i] = Math.max(0, this._cellCD[i] - dtFrames);
      }

      // Clear pending batch and touched tracking
      this._pendingBatch = [];
      this._touchedThisFrame.fill(0);

      // Candidate dwell / candy formation
      const inSheet = this._isInSheet(this.ladleX, this.ladleY);
      if (this.mouseDown && inSheet && this.hasStartedDrawing) {
        this._updateCandidates(this.ladlePrevX, this.ladlePrevY, this.ladleX, this.ladleY, dtFrames);
      } else if (!this.mouseDown) {
        for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
          if (this._candidateDwell[i] > 0 && this.grid[i] <= 0) {
            this._candidateDwell[i] = Math.max(0, this._candidateDwell[i] - dtFrames * 2);
          }
        }
      }

      // Decay dwell for cells NOT touched this frame
      for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
        if (!this._touchedThisFrame[i] && this._candidateDwell[i] > 0 && this.grid[i] <= 0) {
          this._candidateDwell[i] = Math.max(0, this._candidateDwell[i] - dtFrames * 3);
        }
      }

      // Process pending batch (commit cells that reached dwell threshold)
      if (this._pendingBatch.length > 0) {
        for (const idx of this._pendingBatch) {
          this.grid[idx] = 0.3;
          // Mark as directly poured (player created this candy)
          this._directPourCount[idx] = 1;
        }
      }

      // Diffusion
      if (this.mouseDown && this.hasStartedDrawing) this._applyDiffusion();

      // Viscous candy flow (slow diffusion for very thick candy)
      if (SCENE5_FLOW_ENABLED && !this.completed) {
        this._applyViscousFlow(dt);
      }

      // Dark sugar flow (soften dark spots immediately)
      if (SCENE5_DARK_FLOW_ENABLED && !this.completed) {
        this._applyDarkFlow(dt);
      }

      // Update syrup audio
      this._updatePourAudio();

      // Update completion score
      if (this.hasStartedDrawing) {
        const scoring = this._computeScoring();
        this._completionScore = scoring.score;
      }

      // Decay hold time for cells NOT touched this frame
      for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
        if (!this._touchedThisFrame[i] && this._cellHoldTime[i] > 0) {
          this._cellHoldTime[i] = Math.max(0, this._cellHoldTime[i] - dt * 2);
        }
      }

      // Gameplay text
      const activelyDrawing = this.hasStartedDrawing && this.mouseDown && inSheet;
      if (activelyDrawing) {
        // Speed-based feedback (no blocking, just informational)
        this.cueColor = '#ffd700';
        this.cueText = '快速移动线更细，慢慢移动糖会更厚。';
      } else if (!this.hasPickedUpSpoon) {
        this.cueColor = '#444';
        this.cueText = '';
      } else if (this.playerSubmitted || this.completed) {
        this.cueColor = '#444';
        this.cueText = '已完成绘制';
      } else {
        this.cueColor = '#ffd700';
        this.cueText = '按住鼠标左键画糖：快画线细，慢画更厚。';
      }
    }

    // Update stick animation during stick placement phase
    if (this._phase === "stickPlacement") {
      this._updateStickAnimation(dt);
    }

    // Task C/D: Update production animation
    if (this._productionAnimating && !this._productionComplete) {
      this._updateProductionAnimation();
    }
  }

  // ================================================================
  //  Render
  // ================================================================

  _render() {
    const ctx = this.ctx;

    // Background image
    const bgImg = this.hasPickedUpSpoon ? this._bgImgNoSpoon : this._bgImg;
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, bgImg.width, bgImg.height, 0, 0, this.vw, this.vh);
    } else {
      ctx.fillStyle = '#2a1a0e';
      ctx.fillRect(0, 0, this.vw, this.vh);
    }

    // Spoon pickup hint
    if (this._showSpoonPickupHint) {
      const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
      ctx.font = 'bold 20px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const oldBottom = (this._hotspotCy + this._hotspotRy) * this.scaleY + this.offY;
      const newOvalTop = oldBottom;
      const newOvalBottom = this.vh;
      const newOvalCenterX = (this._hotspotCx + 20) * this.scaleX + this.offX;
      ctx.fillText('点击勺子区域拾取勺子', newOvalCenterX, newOvalTop - 30);
    }

    // Drawing grid (design space)
    ctx.save();
    ctx.translate(this.offX, this.offY);
    ctx.scale(this.scaleX, this.scaleY);

    // Guide shadow — faint target shape drawn directly on the white tiles
    // Task B: Hide guide when showing final candy for clean transition
    if (!this._showFinalCandy && this._guideMask) {
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          if (!this._guideMask[row][col]) continue;
          const x = this.sheetX + col * this.cellW;
          const y = this.sheetY + row * this.cellH;
          // Fill
          ctx.fillStyle = "rgba(185, 145, 55, 0.20)";
          ctx.fillRect(x, y, this.cellW + 0.5, this.cellH + 0.5);
          // Edge highlight for shape clarity
          ctx.fillStyle = "rgba(145, 105, 35, 0.28)";
          ctx.fillRect(x, y, this.cellW + 0.5, 1.0); // top edge
          ctx.fillRect(x, y, 1.0, this.cellH + 0.5); // left edge
        }
      }
    }

    // Committed candy cells (more vivid/higher contrast colors — drawn ON TOP of guide)
    // Always render candy, even after success (freeze the drawing)
    // Task D: Hide candy when showing final candy
    if (!this._showFinalCandy) {
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const v = this.grid[row * GRID_COLS + col];
          if (v <= 0) continue;

          // Cap visual thickness so candy never looks brown
          const visualV = Math.min(v, SCENE5_MAX_VISUAL_THICKNESS);

          let r, g, b, a;
          if (visualV < THIN_MAX) {
            // Light sugar - more visible with higher opacity
            const t = visualV / THIN_MAX;
            a = 0.68 + t * 0.15;  // Increased from 0.45+0.20
            // More saturated golden (less pale)
            r = 235 + t * (249 - 235); g = 180 + t * (171 - 180); b = 80 + t * (63 - 80);
          } else if (visualV <= IDEAL_MAX) {
            // Ideal golden - more saturated
            const t = (visualV - THIN_MAX) / (IDEAL_MAX - THIN_MAX);
            a = 0.82 + t * 0.10;  // Increased from 0.60+0.22
            // Richer golden color
            r = 249 - t * 5; g = 171 - t * 15; b = 63 - t * 8;
          } else if (visualV <= THICK_MAX) {
            // Dark amber - deeper color (warm golden/orange, not brown)
            const t = (visualV - IDEAL_MAX) / (THICK_MAX - IDEAL_MAX);
            a = 0.90 + t * 0.08;  // Increased from 0.78+0.14
            // Deeper amber (capped to warm golden, never brown)
            r = 220 - t * 40; g = 140 - t * 50; b = 50 - t * 20;
          } else {
            // Cap at warm golden/orange (never brown)
            const t = Math.min(1, (visualV - THICK_MAX) / 2);
            a = 0.95 + t * 0.05;  // Increased from 0.88+0.10
            // Warm golden/orange (capped so it never becomes brown)
            r = Math.max(180, 220 - t * 40); g = Math.max(100, 140 - t * 50); b = Math.max(50, 50 - t * 20);
          }
          ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
          ctx.fillRect(this.sheetX + col * this.cellW, this.sheetY + row * this.cellH, this.cellW + 0.5, this.cellH + 0.5);
        }
      }
    }

    // Red calibration dot: Show temporary T target (Task E: only if T was pressed)
    // This helps verify the recorded coordinate is correct.
    // NOTE: This is INSIDE ctx.save()/translate/scale block, so use DESIGN coordinates directly.
    if (this.scene5ShowTargetDot && 
        this.scene5StickTargetOverride && 
        Number.isFinite(this.scene5StickTargetOverride.x) && 
        Number.isFinite(this.scene5StickTargetOverride.y)) {
      const dotX = this.scene5StickTargetOverride.x;  // Design coordinate — ctx already scaled
      const dotY = this.scene5StickTargetOverride.y;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 5, 0, Math.PI * 2); // ~5*scaleX canvas pixels
      ctx.fill();
      ctx.restore();
    }

    // Stick rendering (during stick placement phase)
    // Task D: Hide stick when showing final candy
    if (!this._showFinalCandy && (this._phase === "stickPlacement" || this._phase === "completed")) {
      if (this._stickLoaded && this._stickImg) {
        // Task D: Scale up the stick so it feels proportionate to the enlarged candy
        // Task B: Use controlled final visual size
        // Task D: Increased from 140 to 220 to make the stick proportionate to the larger candy
        const SCENE5_STICK_RENDER_LENGTH = 220;  // px, scaled up to match the larger candy
        const SCENE5_STICK_ROTATION_RADIANS = 0;  // No rotation (image is already vertical)

        const imgW = this._stickImg.width;
        const imgH = this._stickImg.height;

        // Preserve aspect ratio: calculate rendered dimensions
        let renderedWidth, renderedHeight;
        if (imgW > imgH) {
          // Image is horizontal (landscape), length = width
          renderedWidth = SCENE5_STICK_RENDER_LENGTH;
          renderedHeight = SCENE5_STICK_RENDER_LENGTH * imgH / imgW;
        } else {
          // Image is vertical (portrait), length = height
          renderedHeight = SCENE5_STICK_RENDER_LENGTH;
          renderedWidth = SCENE5_STICK_RENDER_LENGTH * imgW / imgH;
        }

        // Convert stick position from design to canvas coordinates
        const canvasStickX = this.offX + this._stickCurrentX * this.scaleX;
        const canvasStickY = this.offY + this._stickCurrentY * this.scaleY;

        // Task D: Log debug info
        if (this.scene5StickTargetOverride && 
            Number.isFinite(this.scene5StickTargetOverride.x) && 
            Number.isFinite(this.scene5StickTargetOverride.y)) {
          console.log("Scene5 stick render/fly debug", {
            targetX: this._stickTargetX,
            targetY: this._stickTargetY,
            redDotX: this.scene5StickTargetOverride.x,
            redDotY: this.scene5StickTargetOverride.y,
            renderedWidth,
            renderedHeight,
            rotationRadians: SCENE5_STICK_ROTATION_RADIANS,
            renderMode: "canvas"
          });
        }

        // Task C: Rotate at actual render point
        // Draw stick with controlled size and rotation.
        // NOTE: Reset transform because stick position/size are in canvas pixels.
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);  // Cancel parent translate/scale
        ctx.translate(canvasStickX, canvasStickY);
        ctx.rotate(SCENE5_STICK_ROTATION_RADIANS); // Rotate 90 degrees

        // Draw image centered at origin, with controlled dimensions
        ctx.drawImage(
          this._stickImg,
          -renderedWidth / 2,
          -renderedHeight / 2,
          renderedWidth,
          renderedHeight
        );
        ctx.restore();

        // Draw stick placement hint
        if (this._showStickPlacementHint && this._stickState === "idle") {
          ctx.save();
          ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
          ctx.font = 'bold 20px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 8;
          ctx.fillText('点击竹签，给糖画装上棍子', CANVAS_W / 2, CANVAS_H * 0.15);
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }
    }

    // Task D & E: Render final candy image with pop animation (on separate canvas)
    // Task D: Hide final candy when success screen appears
    if (this._showFinalCandy && !this._showSuccessScreen && this._finalCandyLoaded && this._finalCandyImg) {
      // Show the separate final candy canvas
      this._finalCandyCanvas.style.display = 'block';

      // Clear the separate canvas
      this._finalCandyCtx.clearRect(0, 0, this._finalCandyCanvas.width, this._finalCandyCanvas.height);

      // Task A: Use helper method to get shared anchor for final candy placement
      const anchor = this._getScene5CandyStickSharedAnchor();
      let finalAnchorX = anchor.x;
      let finalAnchorY = anchor.y;

      // Use finalAnchorX/finalAnchorY for placement
      const stickAnchorX = finalAnchorX;
      const stickAnchorY = finalAnchorY;

      // Task C: Scale up the final candy so it can roughly cover the blueprint circle area
      // Task D: Fix size only, without changing position
      // Task C: Increased from 88 to 160 to make the candy larger and better match the blueprint circle
      const SCENE5_FINAL_CANDY_WIDTH = 160; // px, scaled up to match the larger blueprint circle
      const imgW = this._finalCandyImg.width;
      const imgH = this._finalCandyImg.height;

      // Task D & E: Calculate using ONE uniform scale factor (preserves aspect ratio)
      const baseScale = SCENE5_FINAL_CANDY_WIDTH / imgW; // Single scale factor
      const renderedWidth = imgW * baseScale; // = SCENE5_FINAL_CANDY_WIDTH
      const renderedHeight = imgH * baseScale; // Preserves aspect ratio

      // Task F: Pop animation - uniform scale only
      const animProgress = this._finalCandyAnimProgress || 0;
      const popScale = 0.8 + (1.0 - 0.8) * animProgress; // Start 0.8, end 1.0
      const opacity = animProgress; // Start 0, end 1

      // Task E: KEY FIX - Use UNIFORM scale to prevent oval distortion
      // Must use same scale factor for both X and Y
      const uniformScale = Math.min(this.scaleX, this.scaleY);
      
      // Task A: Convert stick anchor from design coordinates to canvas coordinates
      const canvasAnchorX = this.offX + stickAnchorX * this.scaleX;
      const canvasAnchorY = this.offY + stickAnchorY * this.scaleY;
      
      // Task C: Calculate canvas-space rendered size
      const finalWidth = renderedWidth * uniformScale * popScale;
      const finalHeight = renderedHeight * uniformScale * popScale;
      
      // Task C: Calculate draw position so anchor point lands on stick target
      // Anchor is at (ANCHOR_X, ANCHOR_Y) inside the image
      // In canvas coordinates:
      //   canvasDrawX = canvasAnchorX - finalWidth * ANCHOR_X
      //   canvasDrawY = canvasAnchorY - finalHeight * ANCHOR_Y
      const canvasDrawX = canvasAnchorX - finalWidth * this.SCENE5_FINAL_CANDY_ANCHOR_X;
      const canvasDrawY = canvasAnchorY - finalHeight * this.SCENE5_FINAL_CANDY_ANCHOR_Y;
      
      // Task A: Debug logging to verify final candy placement
      console.log('[CandyComplete] final candy image render position', {
        stickAnchorX,
        stickAnchorY,
        canvasAnchorX,
        canvasAnchorY,
        canvasDrawX,
        canvasDrawY,
        finalWidth,
        finalHeight,
        anchorX: this.SCENE5_FINAL_CANDY_ANCHOR_X,
        anchorY: this.SCENE5_FINAL_CANDY_ANCHOR_Y,
        popScale
      });

      // Task F: Render at anchor-based position on separate canvas
      this._finalCandyCtx.save();
      this._finalCandyCtx.globalAlpha = opacity;
      this._finalCandyCtx.drawImage(
        this._finalCandyImg,
        canvasDrawX,
        canvasDrawY,
        finalWidth,
        finalHeight
      );
      
      // Task G: Temporary diagnostic circle (at stick anchor position)
      if (this._showDebugCircle) {
        this._finalCandyCtx.strokeStyle = 'red';
        this._finalCandyCtx.lineWidth = 2;
        this._finalCandyCtx.beginPath();
        this._finalCandyCtx.arc(canvasAnchorX, canvasAnchorY, 10, 0, Math.PI * 2);
        this._finalCandyCtx.stroke();
      }
      
      this._finalCandyCtx.restore();
    } else {
      // Hide the separate final candy canvas
      if (this._finalCandyCanvas) {
        this._finalCandyCanvas.style.display = 'none';
      }
    }

    // Guidance text
    if (this.cueText) {
      ctx.fillStyle = '#e8c170';
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.cueText, CANVAS_W / 2, CANVAS_H * 0.08);
    }

    // Single completion score display (完成度)
    if (this.hasStartedDrawing) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this._roundRect(ctx, 15, 15, 180, 60, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,0,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#e8c170';
      ctx.font = 'bold 20px serif';
      ctx.textAlign = 'left';
      ctx.fillText(`完成度：${this._completionScore}%`, 30, 45);
      ctx.fillStyle = this.completed ? '#44ff44' : '#888';
      ctx.font = 'bold 16px serif';
      ctx.fillText(this.completed ? '完成!' : '绘制中', 30, 70);
    }

    // "完成" button (only show after drawing has started and not yet submitted)
    if (this.hasStartedDrawing && !this.playerSubmitted && !this.completed) {
      const btnW = 100;
      const btnH = 40;
      const btnX = CANVAS_W - btnW - 30;
      const btnY = CANVAS_H - btnH - 30;

      // Store button position for click detection
      this._finishButtonRect = { x: btnX, y: btnY, w: btnW, h: btnH };

      // Button background
      ctx.fillStyle = 'rgba(255,215,0,0.85)';
      this._roundRect(ctx, btnX, btnY, btnW, btnH, 8);
      ctx.fill();

      // Button border
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Button text
      ctx.fillStyle = '#2a1a0e';
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('完成', btnX + btnW / 2, btnY + btnH / 2);
    }

    // Result message (shown after player clicks "完成")
    if (this.completed && this._resultMessage) {
      const resultText = `完成度：${this._finalScore}%｜${this._resultMessage}`;
      ctx.save();

      // Background banner
      ctx.font = 'bold 20px serif';
      const tw = ctx.measureText(resultText).width;
      const bw = Math.min(CANVAS_W - 40, tw + 40);
      const bx = CANVAS_W / 2 - bw / 2;
      const by = 20;
      const bh = 50;

      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      this._roundRect(ctx, bx, by, bw, bh, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,0,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 6;
      ctx.fillText(resultText, CANVAS_W / 2, by + bh / 2);
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // Notification (only show if no result message)
    if (!this.completed && this.notificationText) {
      const a = Math.min(1, this.notificationTimer / 20);
      ctx.save(); ctx.globalAlpha = a;
      ctx.font = 'bold 22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(this.notificationText).width;
      const bw = Math.max(300, tw + 60);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      this._roundRect(ctx, CANVAS_W / 2 - bw / 2, 60 - 20, bw, 40, 10);
      ctx.fill();
      ctx.fillStyle = this.notificationColor;
      ctx.shadowColor = this.notificationColor; ctx.shadowBlur = 8;
      ctx.fillText(this.notificationText, CANVAS_W / 2, 62);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.restore();

    // Spoon cursor
    if (this.hasPickedUpSpoon && !this.completed) {
      const inSheet = this._isInSheet(this.ladleX, this.ladleY);
      const isPouring = this.mouseDown && inSheet;
      let cursorImg = this._spoonBeforeImg;

      if (isPouring && this._spoonPouringImg) {
        cursorImg = this._spoonPouringImg;
      }

      if (cursorImg) {
        const cursorW = 80;
        const aspect = cursorImg.width / cursorImg.height;
        const cursorH = cursorW / aspect;

        const isBeforePour = (cursorImg === this._spoonBeforeImg);
        if (isBeforePour) {
          ctx.save();
          ctx.translate(this.mouseCanvasX, this.mouseCanvasY);
          ctx.rotate(Math.PI);
          ctx.drawImage(cursorImg, -cursorW / 2, -cursorH / 2, cursorW, cursorH);
          ctx.restore();
        } else {
          const sx = this.mouseCanvasX - cursorW / 2;
          const sy = this.mouseCanvasY - cursorH / 2;
          ctx.drawImage(cursorImg, sx, sy, cursorW, cursorH);
        }
      }
    }

    // Task C: Render production panel (bottom-left)
    if (this._showProductionPanel && !this._productionConfirmed) {
      this._renderProductionPanel(ctx);
    }

    // Task D/E: Render produced candies during production animation
    if (this._producedCandies.length > 0) {
      this._renderProducedCandies(ctx);
    }

    // Task G: Render success screen
    if (this._showSuccessScreen && this._successScreenImg) {
      this._renderSuccessScreen(ctx);
    }
  }

  // Task C: Render production panel
  _renderProductionPanel(ctx) {
    const panelW = 320;
    const panelH = 180;
    const panelX = 20; // Bottom-left
    const panelY = CANVAS_H - panelH - 20;

    this._productionPanelRect = { x: panelX, y: panelY, w: panelW, h: panelH };

    // Panel background
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    this._roundRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.5)';
    ctx.lineWidth = 2;
    this._roundRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.stroke();

    // Title text
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 6;
    ctx.fillText('太棒了！同款糖画要制作多少个？', panelX + panelW / 2, panelY + 35);
    ctx.shadowBlur = 0;

    // Quantity selector
    const selectorY = panelY + 80;
    const btnW = 40;
    const btnH = 40;
    const numW = 60;
    const selectorX = panelX + (panelW - btnW * 2 - numW - 10) / 2;

    // Minus button
    const minusX = selectorX;
    const minusRect = { x: minusX, y: selectorY - btnH / 2, w: btnW, h: btnH };
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    this._roundRect(ctx, minusX, selectorY - btnH / 2, btnW, btnH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, minusX, selectorY - btnH / 2, btnW, btnH, 6);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('-', minusX + btnW / 2, selectorY);
    this._minusBtnRect = minusRect;

    // Quantity display
    const numX = minusX + btnW + 5;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    this._roundRect(ctx, numX, selectorY - btnH / 2, numW, btnH, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this._productionQuantity), numX + numW / 2, selectorY);
    this._quantityRect = { x: numX, y: selectorY - btnH / 2, w: numW, h: btnH };

    // Plus button
    const plusX = numX + numW + 5;
    const plusRect = { x: plusX, y: selectorY - btnH / 2, w: btnW, h: btnH };
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    this._roundRect(ctx, plusX, selectorY - btnH / 2, btnW, btnH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, plusX, selectorY - btnH / 2, btnW, btnH, 6);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', plusX + btnW / 2, selectorY);
    this._plusBtnRect = plusRect;

    // Green "制作" button
    const makeBtnY = selectorY + btnH / 2 + 20;
    const makeBtnW = 120;
    const makeBtnH = 40;
    const makeBtnX = panelX + (panelW - makeBtnW) / 2;
    const makeBtnRect = { x: makeBtnX, y: makeBtnY, w: makeBtnW, h: makeBtnH };

    ctx.fillStyle = '#4CAF50';
    this._roundRect(ctx, makeBtnX, makeBtnY, makeBtnW, makeBtnH, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('制作', makeBtnX + makeBtnW / 2, makeBtnY + makeBtnH / 2);
    this._makeBtnRect = makeBtnRect;

    ctx.restore();

    // Task B: Render quantity feedback message
    if (this._quantityFeedback && performance.now() - this._quantityFeedbackTimer < 3000) {
      ctx.save();
      ctx.fillStyle = '#ff8844';
      ctx.font = 'bold 16px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowColor = '#ff8844';
      ctx.shadowBlur = 6;
      ctx.fillText(this._quantityFeedback, this.vw / 2, selectorY + btnH / 2 + 60);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Task F: Draw debug hitbox outlines (cyan)
    if (this.scene5ShowProductionHitboxDebug) {
      ctx.save();
      ctx.strokeStyle = 'cyan';
      ctx.lineWidth = 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Use raw canvas coordinates

      // Minus button outline
      if (this._minusBtnRect) {
        ctx.strokeRect(this._minusBtnRect.x, this._minusBtnRect.y, this._minusBtnRect.w, this._minusBtnRect.h);
      }

      // Plus button outline
      if (this._plusBtnRect) {
        ctx.strokeRect(this._plusBtnRect.x, this._plusBtnRect.y, this._plusBtnRect.w, this._plusBtnRect.h);
      }

      // Make button outline
      if (this._makeBtnRect) {
        ctx.strokeRect(this._makeBtnRect.x, this._makeBtnRect.y, this._makeBtnRect.w, this._makeBtnRect.h);
      }

      ctx.restore();
    }
  }

  // ================================================================
  //  Task D/E: Render produced candy text indicators during production
  // ================================================================

  _renderProducedCandies(ctx) {
    // Task E: Removed giant candy PNG drawing - show text-only indicators only

    // Use canvas coordinates directly (context is NOT transformed here)
    for (let i = 0; i < this._producedCandies.length; i++) {
      const candy = this._producedCandies[i];

      // Skip if candy is done (already reached target)
      if (candy.state === 'done') continue;

      // Convert design coordinates to canvas coordinates
      const canvasX = this.offX + candy.x * this.scaleX;
      const canvasY = this.offY + candy.y * this.scaleY;

      // Task E: Draw only the text indicator (no candy PNG)
      // Draw +1 indicator in canvas coordinates
      if (candy.showPlus && candy.plusAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = candy.plusAlpha;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 28px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 6;

        const plusX = canvasX;
        const plusY = canvasY + candy.plusY;
        ctx.fillText('糖画 +1', plusX, plusY);

        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
  }

  // ================================================================
  //  Task G: Render success screen
  // ================================================================

  _renderSuccessScreen(ctx) {
    if (!this._successScreenImg) return;

    ctx.save();

    // Semi-transparent black background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, this.vw, this.vh);

    // Calculate image dimensions to preserve aspect ratio
    const img = this._successScreenImg;
    const imgRatio = img.width / img.height;
    const screenRatio = this.vw / this.vh;

    let drawW, drawH, drawX, drawY;

    if (imgRatio > screenRatio) {
      // Image is wider than screen - fit to width
      drawW = this.vw * 0.9;
      drawH = drawW / imgRatio;
    } else {
      // Image is taller than screen - fit to height
      drawH = this.vh * 0.9;
      drawW = drawH * imgRatio;
    }

    // Task F: Shrink the success screen graphic to 50% of its current display size
    drawW *= 0.5;
    drawH *= 0.5;

    drawX = (this.vw - drawW) / 2;
    drawY = (this.vh - drawH) / 2;

    // Draw the success screen image
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Add click prompt
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('点击任意处继续', this.vw / 2, this.vh - 50);

    ctx.restore();
  }

  // ================================================================
  //  (Removed _renderTargetShape — guide is now rendered as shadow on drawing grid)
  // ================================================================
  //  Helper: round rect
  // ================================================================

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ================================================================
  //  Game loop
  // ================================================================

  _loop() {
    const dt = 1 / 60;
    if (this.notificationTimer > 0) {
      this.notificationTimer--;
      if (this.notificationTimer <= 0) this.notificationText = '';
    }
    this._update(dt);
    this._render();
    requestAnimationFrame(() => this._loop());
  }

  // ================================================================
  //  Stick animation
  // ================================================================

  _updateStickAnimation(dt) {
    if (this._stickState === "flying") {
      const now = performance.now();
      const elapsed = now - this._stickAnimStartTime;
      this._stickAnimProgress = Math.min(1, elapsed / this._stickAnimDuration);

      // Ease-out interpolation
      const t = 1 - Math.pow(1 - this._stickAnimProgress, 3);

      // Interpolate from start to target
      this._stickCurrentX = this._stickStartX + (this._stickTargetX - this._stickStartX) * t;
      this._stickCurrentY = this._stickStartY + (this._stickTargetY - this._stickStartY) * t;

      // Add a slight hover/bounce effect
      const hoverOffset = Math.sin(this._stickAnimProgress * Math.PI) * 30;
      this._stickCurrentY -= hoverOffset;

      // Check if animation complete
      if (this._stickAnimProgress >= 1) {
        this._stickState = "landed";
        this._stickPlacementComplete = true;
        this._showStickPlacementHint = false;
        this._showNotification('糖画完成！', '#ffd700', 200);
        console.log('[Stick] animation completed');
        console.log('Scene5: Stick landed');

        // Task D: Wait 400ms then transition to final candy
        this._finalCandyTimeout = setTimeout(() => {
          console.log('[CandyComplete] completion state entered');
          this._showFinalCandy = true;
          this._finalCandyAnimStartTime = performance.now();
          console.log('Scene5: Transitioning to final candy');

          // Task D: Invariant debug log - final candy uses shared anchor
          const sharedAnchor = this._getScene5CandyStickSharedAnchor();
          console.log("Scene5 shared anchor invariant - final candy", {
            sharedAnchor,
            finalAnchorX: sharedAnchor.x,
            finalAnchorY: sharedAnchor.y
          });
        }, 400);
      }
    }

    // Task E: Update final candy pop animation
    if (this._showFinalCandy) {
      const now = performance.now();
      const elapsed = now - this._finalCandyAnimStartTime;
      const progress = Math.min(1, elapsed / this._finalCandyAnimDuration);

      // Ease-out animation
      this._finalCandyAnimProgress = 1 - Math.pow(1 - progress, 3);

      // Task C: Show production panel after animation finishes
      if (this._finalCandyAnimProgress >= 1 && !this._productionConfirmed && !this._showProductionPanel) {
        this._showProductionPanel = true;
        console.log("Scene5: Showing production panel");
      }
    }
  }

  // ================================================================
  //  Task C/D: Production animation - produce candies one by one
  // ================================================================

  _updateProductionAnimation() {
    const now = performance.now();

    // Check if it's time to produce the next candy
    if (this._productionIndex < this._productionQuantity &&
        now - this._lastProduceTime >= this._productionStaggerDelay) {

      // Get the shared anchor for candy placement
      const anchor = this._getScene5CandyStickSharedAnchor();

      // Calculate target position (right side of screen)
      const targetX = CANVAS_W * 0.82 + (Math.random() - 0.5) * 60;
      const targetY = CANVAS_H * 0.42 + (Math.random() - 0.5) * 80;

      // Create a new produced candy
      const candy = {
        // Start from the shared anchor position
        x: anchor.x,
        y: anchor.y,
        // Target position (right side)
        targetX: targetX,
        targetY: targetY,
        // Animation state
        state: 'pop',           // pop → fly → done
        popProgress: 0,          // 0 to 1
        flyProgress: 0,          // 0 to 1
        // Timing
        popDuration: 300,        // ms for pop animation
        flyDuration: 600,        // ms for fly animation
        startTime: now,
        // Scale for pop effect
        scale: 0.5,
        // +1 indicator
        showPlus: true,
        plusAlpha: 1.0,
        plusY: 0
      };

      this._producedCandies.push(candy);
      this._productionIndex++;
      this._lastProduceTime = now;

      // Play pop sound
      this._playPopSound();

      console.log("Scene5 produced candy", {
        index: this._productionIndex,
        total: this._productionQuantity,
        startX: candy.x,
        startY: candy.y,
        targetX: candy.targetX,
        targetY: candy.targetY
      });
    }

    // Update all produced candies
    let allDone = this._productionIndex >= this._productionQuantity;

    for (let i = 0; i < this._producedCandies.length; i++) {
      const candy = this._producedCandies[i];
      const elapsed = now - candy.startTime;

      if (candy.state === 'pop') {
        // Pop animation: scale up then down
        candy.popProgress = Math.min(1, elapsed / candy.popDuration);

        // Scale: 0.5 → 1.3 → 1.0 (pop effect)
        if (candy.popProgress < 0.3) {
          candy.scale = 0.5 + (candy.popProgress / 0.3) * 0.8; // 0.5 → 1.3
        } else {
          candy.scale = 1.3 - ((candy.popProgress - 0.3) / 0.7) * 0.3; // 1.3 → 1.0
        }

        // Check if pop is done
        if (candy.popProgress >= 1) {
          candy.state = 'fly';
          candy.flyStartTime = now;
        }

        // Update +1 indicator
        candy.plusAlpha = 1.0;
        candy.plusY = -20 - candy.popProgress * 30;

      } else if (candy.state === 'fly') {
        // Fly animation: move toward target
        const flyElapsed = now - candy.flyStartTime;
        candy.flyProgress = Math.min(1, flyElapsed / candy.flyDuration);

        // Ease-out interpolation
        const t = 1 - Math.pow(1 - candy.flyProgress, 3);
        candy.x = candy.x + (candy.targetX - candy.x) * t;
        candy.y = candy.y + (candy.targetY - candy.y) * t;

        // Update +1 indicator
        candy.plusAlpha = Math.max(0, 1 - candy.flyProgress * 1.5);
        candy.plusY = -50 - candy.flyProgress * 40;

        // Check if fly is done
        if (candy.flyProgress >= 1) {
          candy.state = 'done';
        }
      }

      // Check if all candies are done
      if (candy.state !== 'done') {
        allDone = false;
      }
    }

    // Check if all candies are done
    if (allDone && !this._productionComplete) {
      this._productionComplete = true;
      this._productionAnimating = false;
      this._showSuccessScreen = true;
      // Task F: Clear produced candies array for clean transition
      this._producedCandies = [];
      console.log("Scene5 production animation complete, showing success screen");
    }
  }

  _isStickClicked(designX, designY) {
    if (this._stickState !== "idle" || this._phase !== "stickPlacement") return false;

    // Check if click is on the stick (left side of screen)
    // Use same controlled size calculation as rendering (Task F)
    const stickX = this._stickStartX;
    const stickY = this._stickStartY;

    if (!this._stickImg) return false;

    const imgW = this._stickImg.width;
    const imgH = this._stickImg.height;

    // Same calculation as rendering (SCENE5_STICK_RENDER_LENGTH = 140)
    const SCENE5_STICK_RENDER_LENGTH = 140;
    let renderedWidth, renderedHeight;
    if (imgW > imgH) {
      renderedWidth = SCENE5_STICK_RENDER_LENGTH;
      renderedHeight = SCENE5_STICK_RENDER_LENGTH * imgH / imgW;
    } else {
      renderedHeight = SCENE5_STICK_RENDER_LENGTH;
      renderedWidth = SCENE5_STICK_RENDER_LENGTH * imgW / imgH;
    }

    // Invisible click/hit area extends 80px around the visible stick (Task F)
    const hitboxPadding = 80;

    return (
      designX >= stickX - renderedWidth / 2 - hitboxPadding &&
      designX <= stickX + renderedWidth / 2 + hitboxPadding &&
      designY >= stickY - renderedHeight / 2 - hitboxPadding &&
      designY <= stickY + renderedHeight / 2 + hitboxPadding
    );
  }

  // ================================================================
  //  Cleanup
  // ================================================================

  destroy() {
    // Set destroyed flag first to guard any handlers that fire during cleanup
    this._destroyed = true;

    // Cancel animation frame loop
    // (RAF loop in _loop() will check _destroyed or just stop when DOM is cleared)

    // Clear any pending timeouts
    if (this._stickPlacementTimeout) {
      clearTimeout(this._stickPlacementTimeout);
      this._stickPlacementTimeout = null;
    }
    if (this._finalCandyTimeout) {
      clearTimeout(this._finalCandyTimeout);
      this._finalCandyTimeout = null;
    }

    // Task A: Stop BGM
    this._stopBGM();
    if (this._bgmAudio) {
      this._bgmAudio.pause();
      this._bgmAudio.currentTime = 0;
      this._bgmAudio = null;
    }

    if (this._syrupPourAudio) {
      this._syrupPourAudio.pause();
      this._syrupPourAudio.currentTime = 0;
      this._isPouringSoundPlaying = false;
    }

    // Remove event listeners
    window.removeEventListener('resize', this._onResize);
    if (this._onMouseDown) window.removeEventListener('mousedown', this._onMouseDown);
    if (this._onMouseMove) window.removeEventListener('mousemove', this._onMouseMove);
    if (this._onMouseUp) window.removeEventListener('mouseup', this._onMouseUp);
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
    if (this._onTouchStart) window.removeEventListener('touchstart', this._onTouchStart);
    if (this._onTouchMove) window.removeEventListener('touchmove', this._onTouchMove);
    if (this._onTouchEnd) window.removeEventListener('touchend', this._onTouchEnd);

    this.container.innerHTML = '';
  }
}
