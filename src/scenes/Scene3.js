/**
 * Scene 3 — Sugar-Sheet Laying Mini-Game
 *
 * The ladle follows the mouse directly (no inertia). Candy only forms
 * after a minimum 100ms dwell time over a cell. Fast swipes create no
 * candy. The only failure condition is a disconnected candy island.
 *
 * All player-facing text is Chinese.
 */
const CANVAS_W = 1024;
const CANVAS_H = 768;
const GRID_COLS = 27;
const GRID_ROWS = 30;

// Hot-plate drawable region — shrink left by 3 columns (SHEET_X+≈60, SHEET_W-≈60)
const SHEET_X = 284;
const SHEET_Y = 105;
const SHEET_W = 476;
const SHEET_H = 585;

// Thickness thresholds
const THIN_MAX = 1.0;
const IDEAL_MAX = 2.5;
const THICK_MAX = 4.0;

// Success / failure
const SUCCESS_COVERAGE = 0.80;  // Lowered from 0.90 for easier success
const SUCCESS_GOLDEN_RATIO = 0.30;  // 30% golden area threshold (lowered from 0.35)
const FAIL_OVER_THICK_RATIO = 0.22;
const FAIL_MIN_PAINTED = 10;

// Diffusion
const DIFFUSION_RATE = 0.10;

// Minimum dwell before a cell becomes real candy (200ms at 60fps)
const MIN_CANDY_DWELL_FRAMES = 12;

// Dwell thresholds for outward spread (frames at 60fps)
const SPREAD_RING2_DWELL = 20;
const SPREAD_BLOB_DWELL = 50;

// Audio
const syrupPourVolume = 0.28;

// Manual tuning for final candy sheet success PNG.
// Adjust these numbers to align the PNG with the drawing grid.
const FINISHED_CANDY_SHEET_TUNING = {
  xOffset: 0,          // Horizontal offset (positive = right)
  yOffset: 0,          // Vertical offset (positive = down)
  widthScale: 1.0,      // Scale factor for width (1.0 = no change)
  heightScale: 1.0,     // Scale factor for height (1.0 = no change)
  topExtra: 0,          // Extra pixels at top (positive = expand up)
  bottomExtra: 0         // Extra pixels at bottom (positive = expand down)
};

export class Scene3 {
  constructor(containerEl, onComplete, onSuccess) {
    this.container = containerEl;
    this.onComplete = onComplete;
    this._onSuccess = onSuccess; // Callback when candy sheet is successfully completed

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; cursor: none;`;
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    // Images
    this._bgImg = null;
    this._bgImgNoSpoon = null;
    this._finishedImg = null;
    this._spoonBeforeImg = null;  // beforepour.png
    this._spoonPouringImg = null; // pouring.png
    this._unevenSpreadFailImg = null;  // uneven spread fail PNG
    this._tangShuFailImg = null;        // Tang Shu fail PNG (UnEven Spread Fail)
    this._restartBtnImg = null;         // restart button PNG
    this._imagesLoaded = 0;
    this._loadImages();

    // Hotspot state (temporary overlay for background swap)
    this._showHotspot = true;
    this._hotspotClicked = false;
    this.hasPickedUpSpoon = false;  // Track if spoon has been picked up

    // Hotspot area (ellipse around the spoon area in design coordinates)
    // This is the clickable region that triggers background swap
    this._hotspotCx = 780;  // Center X of hotspot (right side where spoon is)
    this._hotspotCy = 420;  // Center Y of hotspot (middle area)
    this._hotspotRx = 80;   // Horizontal radius
    this._hotspotRy = 60;   // Vertical radius

    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseCanvasX = 0;  // Canvas coordinates for spoon cursor
    this.mouseCanvasY = 0;
    this.mouseDown = false;

    // Ladle position
    this.ladleX = 0;
    this.ladleY = 0;
    this.ladlePrevX = 0;
    this.ladlePrevY = 0;

    // State
    this.completed = false;
    this.failed = false;
    this.hasStartedDrawing = false;

    // Grid (float thickness) — only committed candy cells
    this.grid = new Float32Array(GRID_COLS * GRID_ROWS);
    this._cellCD = new Uint8Array(GRID_COLS * GRID_ROWS);

    // Per-cell candidate dwell timer (frames accumulated)
    this._candidateDwell = new Float32Array(GRID_COLS * GRID_ROWS);
    // Cells that crossed the threshold THIS frame (batch for connectivity check)
    this._pendingBatch = [];
    // Cells touched by brush this frame (for local spread)
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
    this._successPhase = "none";  // "none" | "animating" | "waitingForClick"
    this._showClickPrompt = false;  // Show "点击任意处继续" after success
    this._waitForClickAfterSuccess = false;  // Wait for click before transitioning

    // Notification
    this.notificationText = '';
    this.notificationTimer = 0;
    this.notificationColor = '#ffd700';

    // Debug: show restart button hitbox
    this.scene3ShowRestartHitboxDebug = false;

    // Fail reason (Chinese explanation)
    this._failReason = '';

    // Cue
    this.cueColor = '#444';
    this.cueText = '';

    // Warning flags
    this._warnShown = false;
    this._overThickWarnShown = false;

    // Audio - syrup pouring sound
    this._syrupPourAudio = null;
    this._isPouringSoundPlaying = false;
    this._ladleMoved = false;
    this._generatedNewSyrupThisFrame = false;

    // Syrup pour volume constant (lowered by 25% from 0.3 to 0.225)
    const SCENE3_SYRUP_POUR_VOLUME = 0.225;

    // Load syrup pouring audio with proper debugging
    this._syrupPourAudio = new Audio('/assets/scene3/audio/syrup-pouring.m4a');
    this._syrupPourAudio.loop = true;
    this._syrupPourAudio.volume = SCENE3_SYRUP_POUR_VOLUME;
    this._syrupPourAudio.playbackRate = 0.85;  // Play slightly slower (0.85 as requested)
    this._syrupPourAudio.preload = "auto";
    
    // Add debugging event listeners (as requested by user)
    this._syrupPourAudio.addEventListener('loadeddata', () => {
      console.log('Scene3 syrup audio loaded:', this._syrupPourAudio.src);
    });
    this._syrupPourAudio.addEventListener('canplaythrough', () => {
      console.log('Scene3 syrup audio ready:', this._syrupPourAudio.src);
    });
    this._syrupPourAudio.addEventListener('error', (e) => {
      console.error('Scene3 syrup audio failed to load:', e, this._syrupPourAudio.src);
    });
    
    // Preload the audio
    this._syrupPourAudio.load();
    console.log('Scene3: Loading syrup pour audio from', this._syrupPourAudio.src);

    // Speed tracking for gameplay text
    this._speedHistory = [];  // Track recent speeds
    this._maxSpeedHistory = 15;  // Keep last 15 frames
    this._averageSpeed = 0;

    this._resize();
    this._initEvents();
    this._loop();
    this._showNotification('按住鼠标左键，在案板上铺糖！', '#e8c170', 200);
  }

  _loadImages() {
    const bg = new Image();
    bg.onload = () => { this._bgImg = bg; this._imagesLoaded++; };
    bg.onerror = () => { this._imagesLoaded++; };
    bg.src = 'assets/scene3/candy-hot-plate-empty.jpg';

    const bgNoSpoon = new Image();
    bgNoSpoon.onload = () => { this._bgImgNoSpoon = bgNoSpoon; this._imagesLoaded++; };
    bgNoSpoon.onerror = () => { this._imagesLoaded++; };
    bgNoSpoon.src = 'assets/scene3/Candy hot Plate with no Spoon.png';

    const fin = new Image();
    fin.onload = () => { this._finishedImg = fin; this._imagesLoaded++; };
    fin.onerror = () => { this._imagesLoaded++; };
    fin.src = 'assets/scene3/candy-sheet-finished.png';

    // Load the finished candy sheet image from public assets
    const finishedSheet = new Image();
    finishedSheet.onload = () => { this._finishedSheetImg = finishedSheet; this._imagesLoaded++; };
    finishedSheet.onerror = () => { this._imagesLoaded++; };
    finishedSheet.src = 'assets/scene3/candy-sheet-finished.png';

    // Load spoon cursor images
    const spoonBefore = new Image();
    spoonBefore.onload = () => { this._spoonBeforeImg = spoonBefore; this._imagesLoaded++; };
    spoonBefore.onerror = () => { this._imagesLoaded++; };
    spoonBefore.src = 'assets/scene3/spoons/beforepour.png';

    const spoonPouring = new Image();
    spoonPouring.onload = () => { this._spoonPouringImg = spoonPouring; this._imagesLoaded++; };
    spoonPouring.onerror = () => { this._imagesLoaded++; };
    spoonPouring.src = 'assets/scene3/spoons/pouring.png';

    // Load uneven-spread fail image
    const unevenFail = new Image();
    unevenFail.onload = () => { this._unevenSpreadFailImg = unevenFail; this._imagesLoaded++; };
    unevenFail.onerror = () => { this._imagesLoaded++; };
    unevenFail.src = 'assets/scene3/fail/uneven-spread-fail.png';

    // Load Tang Shu fail PNG (UnEven Spread Fail)
    const tangShuFail = new Image();
    tangShuFail.onload = () => { this._tangShuFailImg = tangShuFail; this._imagesLoaded++; };
    tangShuFail.onerror = () => { console.warn("Scene3 Tang Shu fail PNG failed to load", tangShuFail.src); this._imagesLoaded++; };
    tangShuFail.src = 'assets/scene3/fail/UnEven Spread Fail.png';

    // Load restart button image
    const restartBtn = new Image();
    restartBtn.onload = () => { this._restartBtnImg = restartBtn; this._imagesLoaded++; };
    restartBtn.onerror = () => { this._imagesLoaded++; };
    restartBtn.src = 'assets/scene2/restart/restart_button_transparent.png';

    // Load syrup pouring audio with proper debugging
    // Use absolute path from public folder
    const audioPath = '/assets/scene3/audio/syrup-pouring.m4a';
    this._syrupPourAudio = new Audio(audioPath);
    this._syrupPourAudio.loop = true;
    this._syrupPourAudio.volume = 0.225;  // Lowered by 25% from 0.3
    this._syrupPourAudio.playbackRate = 0.85;  // Play slightly slower (0.85 as requested)
    this._syrupPourAudio.preload = "auto";
    
    // Add debugging event listeners (as requested by user)
    this._syrupPourAudio.addEventListener('loadeddata', () => {
      console.log('Scene3 syrup audio loaded:', this._syrupPourAudio.src);
    });
    this._syrupPourAudio.addEventListener('canplaythrough', () => {
      console.log('Scene3 syrup audio ready:', this._syrupPourAudio.src);
    });
    this._syrupPourAudio.addEventListener('error', (e) => {
      console.error('Scene3 syrup audio failed to load:', e, this._syrupPourAudio.src);
    });
    
    // Preload the audio
    this._syrupPourAudio.load();
    console.log('Scene3: Loading syrup pour audio from', this._syrupPourAudio.src);
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.vw = this.canvas.width;
    this.vh = this.canvas.height;
    // Non-uniform stretch to fill entire viewport (no letterbox, slight distortion OK)
    this.scaleX = this.vw / CANVAS_W;
    this.scaleY = this.vh / CANVAS_H;
    this.offX = 0;
    this.offY = 0;
    // Ladle center
    const cx = this._toDesign(this.vw / 2, this.vh / 2);
    this.ladleX = cx.x;
    this.ladleY = cx.y;
    this.ladlePrevX = cx.x;
    this.ladlePrevY = cx.y;
  }

  _initEvents() {
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);

    // Hide cursor when spoon is picked up
    this.canvas.style.cursor = 'default';

    // Store bound references for ALL window listeners so we can remove them in destroy()
    this._onMouseDown = (e) => {
      if (this._destroyed) return;
      this.mouseDown = true;

      // If failed, check if click is on restart button
      if (this.failed) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseCanvasX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const mouseCanvasY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

        if (this._scene3RestartButtonBox) {
          const box = this._scene3RestartButtonBox;
          if (mouseCanvasX >= box.x && mouseCanvasX <= box.x + box.w &&
              mouseCanvasY >= box.y && mouseCanvasY <= box.y + box.h) {
            this._restart();
          }
        }
        return;
      }

      // Audio unlock: try to play and immediately pause on ANY mousedown (user gesture)
      // This ensures the audio is "unlocked" for later playback
      if (this._syrupPourAudio && this._syrupPourAudio.paused) {
        this._syrupPourAudio.play().then(() => {
          this._syrupPourAudio.pause();
          this._syrupPourAudio.currentTime = 0;
          console.log('Scene3: Audio unlocked successfully');
        }).catch((err) => {
          // This is normal - audio might already be unlocked or file might not be loaded yet
          console.log('Scene3: Audio unlock attempt (normal):', err.name);
        });
      }

      // Check if hotspot was clicked (before starting to draw)
      if (this._showHotspot && !this.hasPickedUpSpoon) {
        // Use canvas coordinates for hit detection
        const rect = this.canvas.getBoundingClientRect();
        const mouseCanvasX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const mouseCanvasY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

        // Oval parameters (straight vertical, no rotation)
        const oldBottom = (this._hotspotCy + this._hotspotRy) * this.scaleY + this.offY;
        const newOvalTop = oldBottom;
        const newOvalBottom = this.vh;
        const newOvalCenterX = (this._hotspotCx + 20) * this.scaleX + this.offX;
        const newOvalRadiusX = this._hotspotRx * 0.75 * this.scaleX;
        const newOvalRadiusY = (newOvalBottom - newOvalTop) / 2;

        // Oval center (directly below top point)
        const ovalCenterX = newOvalCenterX;
        const ovalCenterY = newOvalTop + newOvalRadiusY;

        // Check ellipse equation (no rotation)
        const dx = (mouseCanvasX - ovalCenterX) / newOvalRadiusX;
        const dy = (mouseCanvasY - ovalCenterY) / newOvalRadiusY;
        if (dx * dx + dy * dy <= 1) {
          // Clicked inside hotspot - swap background and pick up spoon
          this._showHotspot = false;
          this._hotspotClicked = true;
          this.hasPickedUpSpoon = true;
          this.canvas.style.cursor = 'none';  // Hide system cursor

          // Music is now managed by main.js (starts when Scene 3 opens)
          this._showNotification('开始铺糖！', '#ffd700', 120);
          return;
        }
      }

      // Only allow drawing if spoon has been picked up
      if (this.hasPickedUpSpoon) {
        this._onStrokeStart();
        
        // Update pouring audio on user gesture (mousedown)
        // This ensures the first play call happens in a user gesture context
        this._updatePourAudio();
      }
    };

    this._onMouseMove = (e) => {
      if (this._destroyed) return;
      // Track both client coordinates (for design-space conversion) and canvas coordinates (for spoon cursor)
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      const rect = this.canvas.getBoundingClientRect();
      this.mouseCanvasX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouseCanvasY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      
      // Update pour audio on mousemove (in case pointer leaves grid)
      if (this.hasPickedUpSpoon) {
        this._updatePourAudio();
      }
    };

    this._onMouseUp = () => {
      if (this._destroyed) return;
      this.mouseDown = false; 
      this._onStrokeEnd();
      // Update pour audio on mouseup
      this._updatePourAudio();
    };

    this._onTouchStart = (e) => {
      if (this._destroyed) return;
      const t = e.touches[0]; this.mouseX = t.clientX; this.mouseY = t.clientY; this.mouseDown = true;
      
      // If failed, check if touch is on restart button
      if (this.failed) {
        const rect = this.canvas.getBoundingClientRect();
        const touchCanvasX = (t.clientX - rect.left) * (this.canvas.width / rect.width);
        const touchCanvasY = (t.clientY - rect.top) * (this.canvas.height / rect.height);
        
        if (this._scene3RestartButtonBox) {
          const box = this._scene3RestartButtonBox;
          if (touchCanvasX >= box.x && touchCanvasX <= box.x + box.w &&
              touchCanvasY >= box.y && touchCanvasY <= box.y + box.h) {
            this._restart();
          }
        }
        return;
      }

        // Check if hotspot was clicked (touch version)
        if (this._showHotspot && !this.hasPickedUpSpoon) {
          const rect = this.canvas.getBoundingClientRect();
          const touchCanvasX = (t.clientX - rect.left) * (this.canvas.width / rect.width);
          const touchCanvasY = (t.clientY - rect.top) * (this.canvas.height / rect.height);

          // Oval parameters (straight vertical, no rotation)
          const oldBottom = (this._hotspotCy + this._hotspotRy) * this.scaleY + this.offY;
          const newOvalTop = oldBottom;
          const newOvalBottom = this.vh;
          const newOvalCenterX = (this._hotspotCx + 20) * this.scaleX + this.offX;
          const newOvalRadiusX = this._hotspotRx * 0.75 * this.scaleX;
          const newOvalRadiusY = (newOvalBottom - newOvalTop) / 2;

          // Oval center (directly below top point)
          const ovalCenterX = newOvalCenterX;
          const ovalCenterY = newOvalTop + newOvalRadiusY;

          // Check ellipse equation (no rotation)
          const dx = (touchCanvasX - ovalCenterX) / newOvalRadiusX;
          const dy = (touchCanvasY - ovalCenterY) / newOvalRadiusY;
          if (dx * dx + dy * dy <= 1) {
            // Clicked inside hotspot - swap background and pick up spoon
            this._showHotspot = false;
            this._hotspotClicked = true;
            this.hasPickedUpSpoon = true;
            this.canvas.style.cursor = 'none';  // Hide system cursor

            // Music is now managed by main.js (starts when Scene 3 opens)
            this._showNotification('开始铺糖！', '#ffd700', 120);
            return;
          }
      }

      // Only allow drawing if spoon has been picked up
      if (this.hasPickedUpSpoon) {
        this._onStrokeStart();
      }
    };

    this._onTouchMove = (e) => {
      if (this._destroyed) return;
      const t = e.touches[0];
      this.mouseX = t.clientX;
      this.mouseY = t.clientY;
      const rect = this.canvas.getBoundingClientRect();
      this.mouseCanvasX = (t.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouseCanvasY = (t.clientY - rect.top) * (this.canvas.height / rect.height);
    };

    this._onTouchEnd = () => {
      if (this._destroyed) return;
      this.mouseDown = false; this._onStrokeEnd();
    };

    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('touchstart', this._onTouchStart);
    window.addEventListener('touchmove', this._onTouchMove);
    window.addEventListener('touchend', this._onTouchEnd);

    // Stop pouring sound when mouse leaves canvas
    this._onMouseLeave = () => {
      if (this._destroyed) return;
      this._updatePourAudio();
    };
    this.canvas.addEventListener('mouseleave', this._onMouseLeave);

    // Click handler for "点击任意处继续" after success
    this._onClick = (e) => {
      if (this._destroyed) return;
      if (this.completed && this._successPhase === "waitingForClick" && !this._waitForClickAfterSuccess) {
        // User clicked after success - transition to Scene 4
        this._waitForClickAfterSuccess = true;
        if (this.onComplete) {
          this.onComplete();
        }
      }
    };
    this.canvas.addEventListener('click', this._onClick);
  }

  _onStrokeStart() {
    const pos = this._toDesign(this.mouseX, this.mouseY);
    if (!this._isInSheet(pos.x, pos.y)) return;
    this.hasStartedDrawing = true;
    this.ladlePrevX = pos.x;
    this.ladlePrevY = pos.y;
  }

  _onStrokeEnd() {
    // Update pouring sound when mouse is released
    this._updatePourAudio();

    // Check for success only after releasing mouse
    if (!this.failed && !this.completed) {
      const st = this._computeStats();
      if (st.coverage >= SUCCESS_COVERAGE &&
          st.goldenRatio >= SUCCESS_GOLDEN_RATIO &&
          st.painted > FAIL_MIN_PAINTED) {
        // Update pouring audio on success
        this._updatePourAudio();
        
        this.completed = true;
        this.successTimer = 0;
        this._successPhase = "animating";  // Start with animation
        this._showNotification('铺得真平整，一块好糖成了！', '#ffd700', 200);

        // Notify main.js that success was achieved (for music stop etc.)
        if (this._onSuccess) {
          this._onSuccess();
        }
      }
    }
  }

  _toDesign(cx, cy) {
    return { x: (cx - this.offX) / this.scaleX, y: (cy - this.offY) / this.scaleY };
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

  _computeStats() {
    let painted = 0, golden = 0, overThick = 0;
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      const v = this.grid[i];
      if (v > 0) painted++;
      if (v >= THIN_MAX && v <= IDEAL_MAX) golden++;
      if (v > THICK_MAX) overThick++;
    }
    return {
      painted, golden, overThick,
      coverage: painted / (GRID_COLS * GRID_ROWS),
      goldenRatio: painted > 0 ? golden / painted : 0,
      overThickRatio: painted > 0 ? overThick / painted : 0,
    };
  }

  // ================================================================
  //  Detect disconnected candy components
  // ================================================================

  _countConnectedComponents() {
    const visited = new Uint8Array(GRID_COLS * GRID_ROWS);
    let componentCount = 0;
    
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      if (visited[i] || this.grid[i] <= 0) continue;
      
      // Found a new component, do BFS
      componentCount++;
      const queue = [i];
      visited[i] = 1;
      
      while (queue.length > 0) {
        const idx = queue.shift();
        
        // Check 4-directional neighbors
        const neighbors = [];
        if (idx % GRID_COLS > 0) neighbors.push(idx - 1);           // left
        if (idx % GRID_COLS < GRID_COLS - 1) neighbors.push(idx + 1); // right
        if (idx >= GRID_COLS) neighbors.push(idx - GRID_COLS);         // up
        if (idx < GRID_COLS * (GRID_ROWS - 1)) neighbors.push(idx + GRID_COLS); // down
        
        for (const ni of neighbors) {
          if (!visited[ni] && this.grid[ni] > 0) {
            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }
    }
    
    return componentCount;
  }

  // Helper function to determine if syrup audio should play (as requested by user)
  _shouldPlaySyrupAudio() {
    // Calculate if pointer is inside grid
    const pos = this._toDesign(this.mouseX, this.mouseY);
    const pointerInsideGrid = this._isInSheet(pos.x, pos.y);
    
    // Drawing is enabled when: spoon picked up, started drawing, mouse down, inside grid
    const drawingEnabled = this.hasPickedUpSpoon && this.hasStartedDrawing && this.mouseDown && pointerInsideGrid;
    
    return (
      this.hasPickedUpSpoon &&
      this.mouseDown &&
      pointerInsideGrid &&
      drawingEnabled &&
      !this.failed &&
      !this.completed
    );
  }

  _updatePourAudio() {
    if (!this._syrupPourAudio) {
      console.warn('Scene3: No syrup pour audio object');
      return;
    }

    const shouldPlay = this._shouldPlaySyrupAudio();

    if (shouldPlay) {
      // Play the pouring sound (resume if paused, don't reset currentTime)
      if (this._syrupPourAudio.paused) {
        console.log('Scene3 syrup audio START', {
          hasPickedUpSpoon: this.hasPickedUpSpoon,
          mouseDown: this.mouseDown,
          pointerInsideGrid: this._isInSheet(this._toDesign(this.mouseX, this.mouseY).x, this._toDesign(this.mouseX, this.mouseY).y),
          hasStartedDrawing: this.hasStartedDrawing,
          failed: this.failed,
          completed: this.completed,
          src: this._syrupPourAudio.src
        });
        
        const playPromise = this._syrupPourAudio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            this._isPouringSoundPlaying = true;
            console.log('Scene3: Syrup pour audio started successfully');
          }).catch((err) => {
            console.error('Scene3: Audio play failed:', err.name, err.message, this._syrupPourAudio.src);
          });
        } else {
          this._isPouringSoundPlaying = true;
        }
      }
    } else {
      // Pause the pouring sound (don't reset currentTime for natural resume)
      if (!this._syrupPourAudio.paused) {
        console.log('Scene3: Pausing syrup pour audio');
        this._syrupPourAudio.pause();
        this._isPouringSoundPlaying = false;
      }
    }
  }

  _showNotification(text, color, dur) {
    this.notificationText = text;
    this.notificationColor = color;
    this.notificationTimer = dur || 120;
  }

  _restart() {
    // Stop pouring sound on restart and reset to beginning
    if (this._syrupPourAudio) {
      this._syrupPourAudio.pause();
      this._syrupPourAudio.currentTime = 0;
      this._isPouringSoundPlaying = false;
    }

    // NOTE: Do NOT stop background music on restart - it should continue through failures
    // Music only stops on success (when candy sheet pops out) or destroy()

    this.grid.fill(0);
    this._cellCD.fill(0);
    this._candidateDwell.fill(0);
    this._pendingBatch = [];
    this._touchedThisFrame.fill(0);
    this.completed = false;
    this.failed = false;
    this._unevenSpreadFail = false;  // Reset uneven spread fail flag
    this.hasStartedDrawing = false;
    this.hasPickedUpSpoon = false;  // Reset spoon pickup state
    this.successTimer = 0;
    this.cueColor = '#444';
    this._speedHistory = [];  // Reset speed tracking
    this._averageSpeed = 0;
    this.cueText = '';
    this._warnShown = false;
    this._overThickWarnShown = false;
    this._showHotspot = true;  // Show hotspot again
    this._hotspotClicked = false;
    this.canvas.style.cursor = 'default';  // Show system cursor again
    this._failReason = '';  // Reset fail reason on restart
    this._showNotification('按住鼠标左键，在案板上铺糖！', '#e8c170', 200);
    const cx = this._toDesign(this.vw / 2, this.vh / 2);
    this.ladleX = cx.x;
    this.ladleY = cx.y;
    this.ladlePrevX = cx.x;
    this.ladlePrevY = cx.y;
  }

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

      // Track which cells are being touched this frame
      this._touchedThisFrame[cellIdx] = 1;

      if (this.grid[cellIdx] > 0) {
        // Already committed: accumulate dwell for spread logic
        this._candidateDwell[cellIdx] += dtFrames;
        continue;
      }

      // Dwell split across interpolation points — fast swipe = tiny per cell
      const dwellAdd = dtFrames / (steps + 1);
      const prevDwell = this._candidateDwell[cellIdx];
      const newDwell = prevDwell + dwellAdd;
      this._candidateDwell[cellIdx] = newDwell;

      // Crossed 200ms threshold? Add to pending batch (not committed yet)
      if (prevDwell < MIN_CANDY_DWELL_FRAMES && newDwell >= MIN_CANDY_DWELL_FRAMES) {
        this._pendingBatch.push(cellIdx);
      }
    }

    // Local spread: only from cells being touched this frame (not global)
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      if (!this._touchedThisFrame[i]) continue;
      if (this.grid[i] <= 0) continue; // Only spread from committed cells
      const dwell = this._candidateDwell[i];
      // Local spread: center + distance-1 + distance-2 only (no distance-3)
      // Increased by ~25% to make brush slightly bigger (about 1 grid cell wider)
      let coreAmt, ring1Amt, ring2Amt;
      if (dwell >= SPREAD_BLOB_DWELL) {
        coreAmt = 0.20; ring1Amt = 0.13; ring2Amt = 0.06;
      } else if (dwell >= SPREAD_RING2_DWELL) {
        coreAmt = 0.26; ring1Amt = 0.16; ring2Amt = 0.07;
      } else {
        coreAmt = 0.32; ring1Amt = 0.13; ring2Amt = 0.03;
      }
      this._localSpread(i, coreAmt * dtFrames, ring1Amt * dtFrames, ring2Amt * dtFrames);
    }
  }

  // Local spread: only distance-1 and distance-2 (compact blob)
  _localSpread(cellIdx, coreAmt, ring1Amt, ring2Amt) {
    if (cellIdx < 0) return;
    const row = Math.floor(cellIdx / GRID_COLS);
    const col = cellIdx % GRID_COLS;

    this._addThickness(cellIdx, coreAmt);

    // Distance-1 (4 orthogonal neighbors) — lighter
    if (col > 0) this._addThickness(cellIdx - 1, ring1Amt);
    if (col < GRID_COLS - 1) this._addThickness(cellIdx + 1, ring1Amt);
    if (row > 0) this._addThickness(cellIdx - GRID_COLS, ring1Amt);
    if (row < GRID_ROWS - 1) this._addThickness(cellIdx + GRID_COLS, ring1Amt);

    // Distance-2 (8 neighbors) — lightest
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
    if (this.completed) {
      this.successTimer++;
      
      // Check if animation is complete (450ms / 16.67ms per frame ≈ 27 frames)
      const animationDurationFrames = 27;  // 450ms at 60fps
      if (this._successPhase === "animating" && this.successTimer >= animationDurationFrames) {
        this._successPhase = "waitingForClick";
        this._showClickPrompt = true;
      }
      
      // Restore normal cursor on success
      this.canvas.style.cursor = 'default';
      return;
    }
    if (this.failed) {
      // Show cursor so player can see where they're clicking
      this.canvas.style.cursor = 'default';
      return;
    }

    const dtFrames = dt * 60;

    // Reset flag at beginning of frame
    this._generatedNewSyrupThisFrame = false;

    // Ladle = mouse position (direct)
    const target = this._toDesign(this.mouseX, this.mouseY);
    this.ladlePrevX = this.ladleX;
    this.ladlePrevY = this.ladleY;
    this.ladleX = target.x;
    this.ladleY = target.y;

    // Track if ladle moved enough to generate syrup
    const ladleDx = this.ladleX - this.ladlePrevX;
    const ladleDy = this.ladleY - this.ladlePrevY;
    const ladleDist = Math.sqrt(ladleDx * ladleDx + ladleDy * ladleDy);
    this._ladleMoved = ladleDist > 0.5; // Minimum movement threshold

    // Track speed history for gameplay text
    this._speedHistory.push(ladleDist);
    if (this._speedHistory.length > this._maxSpeedHistory) {
      this._speedHistory.shift();
    }
    // Calculate average speed
    let speedSum = 0;
    for (let i = 0; i < this._speedHistory.length; i++) {
      speedSum += this._speedHistory[i];
    }
    this._averageSpeed = this._speedHistory.length > 0 ? speedSum / this._speedHistory.length : 0;

    // Per-cell cooldowns
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      if (this._cellCD[i] > 0) this._cellCD[i] = Math.max(0, this._cellCD[i] - dtFrames);
    }

    // Capture whether candy existed BEFORE this frame (for strict connectivity)
    let hadCandyBefore = false;
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      if (this.grid[i] > 0) { hadCandyBefore = true; break; }
    }

    const inSheet = this._isInSheet(this.ladleX, this.ladleY);

    // Clear pending batch and touched tracking
    this._pendingBatch = [];
    this._touchedThisFrame.fill(0);

    // Candidate dwell / candy formation — collects cells that reach 200ms into _pendingBatch
    if (this.mouseDown && inSheet && this.hasStartedDrawing) {
      this._updateCandidates(this.ladlePrevX, this.ladlePrevY, this.ladleX, this.ladleY, dtFrames);
    } else if (!this.mouseDown) {
      // Decay dwell when not pressing
      for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
        if (this._candidateDwell[i] > 0 && this.grid[i] <= 0) {
          this._candidateDwell[i] = Math.max(0, this._candidateDwell[i] - dtFrames * 2);
        }
      }
    }

    // Decay dwell for cells NOT touched this frame (brush moved away)
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      if (!this._touchedThisFrame[i] && this._candidateDwell[i] > 0 && this.grid[i] <= 0) {
        this._candidateDwell[i] = Math.max(0, this._candidateDwell[i] - dtFrames * 3);
      }
    }

    // --- Pre-commit connectivity check ---
    // Process pending batch BEFORE committing to grid
    if (this._pendingBatch.length > 0) {
      // New cells being committed - set flag
      this._generatedNewSyrupThisFrame = true;

      if (!hadCandyBefore) {
        // First batch: always allowed, commit immediately
        for (const idx of this._pendingBatch) {
          this.grid[idx] = 0.3;
        }
      } else {
        // Check: at least one cell in batch must touch old committed candy (8-neighbor)
        let touchesOld = false;
        for (const idx of this._pendingBatch) {
          const row = Math.floor(idx / GRID_COLS);
          const col = idx % GRID_COLS;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = row + dr;
              const nc = col + dc;
              if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
              const ni = nr * GRID_COLS + nc;
              if (this.grid[ni] > 0) { touchesOld = true; break; }
            }
            if (touchesOld) break;
          }
          if (touchesOld) break;
        }
        if (!touchesOld) {
          // Disconnected! Fail immediately
          this.failed = true;
          this.cueText = '';  // Hide guidance text on failure
          this._failReason = '糖丝断开了，必须重来。\n（糖层不连续，出现了分离的区域）';
          this._showNotification(this._failReason.split('\n')[0], '#ff4444', 240);
          // Update pouring sound on failure
          this._updatePourAudio();
          return;
        }
        // Connected: commit the batch
        for (const idx of this._pendingBatch) {
          this.grid[idx] = 0.3;
        }
      }
    }

    // Check if spread is happening (cells being touched for spread)
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      if (this._touchedThisFrame[i] && this.grid[i] > 0) {
        this._generatedNewSyrupThisFrame = true;
        break;
      }
    }

    // Diffusion (only for committed cells)
    if (this.mouseDown && this.hasStartedDrawing) this._applyDiffusion();

    // Local spread is done in _updateCandidates (only from cells brush is touching)

    const st = this._computeStats();

    // Check for disconnected components (post-diffusion check)
    // Task: Detect when player draws two separate disconnected candy patches
    if (!this.failed && !this.completed && st.painted > FAIL_MIN_PAINTED) {
      const componentCount = this._countConnectedComponents();
      if (componentCount > 1) {
        this.failed = true;
        this._unevenSpreadFail = true;  // Reuse existing fail image
        this.cueText = '';  // Hide guidance text on failure
        this._failReason = '不要画出两块彼此分离的糖。\n（出现了多个分离的区域，覆盖率不足）';
        this._showNotification('不要画出两块彼此分离的糖。这样会让糖丝断开。', '#ff44444', 240);
        // Update pouring sound on failure
        this._updatePourAudio();
        return;
      }
    }

    // Over-thick warning
    if (st.overThickRatio > 0.15 && st.painted > FAIL_MIN_PAINTED && !this._overThickWarnShown) {
      this._overThickWarnShown = true;
      this._showNotification('糖层太厚了，必须重来。', '#ff8844', 120);
    }

    // Over-thick failure (uneven spread / bad pour)
    if (st.overThickRatio > FAIL_OVER_THICK_RATIO && st.painted > FAIL_MIN_PAINTED) {
      this.failed = true;
      this.cueText = '';  // Hide guidance text on failure
      this._unevenSpreadFail = true;  // Flag for rendering uneven-spread fail PNG
      this._failReason = '这张糖片铺坏了，必须重来。\n（糖层过厚区域超过22%，影响口感）';
      this._showNotification('这张糖片铺坏了，必须重来。', '#ff4444', 240);
      // Update pouring sound on failure
      this._updatePourAudio();
      return;
    }

    // Feedback
    const activelyDrawing = this.hasStartedDrawing && this.mouseDown && inSheet;

    // Syrup pouring audio logic - play when conditions are met
    // Conditions are now checked inside _updatePourAudio using _shouldPlaySyrupAudio()
    this._updatePourAudio();

    // Gameplay text - only show the 4 exact Chinese lines
    if (this.completed) {
      // Success text is shown via notification
      this.cueText = '';
    } else if (activelyDrawing) {
      // Determine pouring speed based on average speed
      const speedThreshold = 5.0;  // Design space units per frame
      const isTooFast = this._averageSpeed > speedThreshold && st.coverage < 0.5;
      const isTooSlow = this._averageSpeed < 2.0 && st.overThickRatio > 0.05;

      if (isTooFast) {
        this.cueColor = '#ff8844';
        this.cueText = '铺得太快了，糖丝还没连成片！';
      } else if (isTooSlow) {
        this.cueColor = '#ff8844';
        this.cueText = '铺得太慢了，糖层变厚会影响冷却！';
      } else {
        this.cueColor = '#44ff44';
        this.cueText = '保持均匀速度，让糖面平整铺开。';
      }
    } else {
      this.cueColor = '#444';
      this.cueText = '';
    }
  }

  _render() {
    const ctx = this.ctx;

    // --- Background image: stretch full image to fill entire viewport (no crop, no bars) ---
    // Use no-spoon background if hotspot was clicked, otherwise use original
    const bgImg = this._hotspotClicked ? this._bgImgNoSpoon : this._bgImg;
    if (bgImg) {
      // Draw full image (no source crop) stretched to fill entire viewport
      ctx.drawImage(bgImg, 0, 0, bgImg.width, bgImg.height, 0, 0, this.vw, this.vh);
    } else {
      // Fallback if image not loaded
      ctx.fillStyle = '#2a1a0e';
      ctx.fillRect(0, 0, this.vw, this.vh);
    }

    // --- Hotspot overlay (hidden oval, only text for spoon pickup) ---
    if (this._showHotspot && this._bgImg) {
      // Calculate vertical oval in canvas coordinates (straight, no rotation)
      const oldBottom = (this._hotspotCy + this._hotspotRy) * this.scaleY + this.offY;
      const newOvalTop = oldBottom;
      const newOvalBottom = this.vh;
      const newOvalCenterX = (this._hotspotCx + 20) * this.scaleX + this.offX;
      const newOvalRadiusX = this._hotspotRx * 0.75 * this.scaleX;
      const newOvalRadiusY = (newOvalBottom - newOvalTop) / 2;

      // Oval center (directly below top point, no rotation)
      const ovalCenterX = newOvalCenterX;
      const ovalCenterY = newOvalTop + newOvalRadiusY;

      // Instruction text (not rotated, positioned above where oval would be)
      const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
      ctx.font = 'bold 20px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('点击勺子区域开始', ovalCenterX, newOvalTop - 30);
    }

    // --- Design-space content ---
    ctx.save();
    ctx.translate(this.offX, this.offY);
    ctx.scale(this.scaleX, this.scaleY);

    // --- No candidate preview: cells below 200ms dwell are NOT rendered ---

    // --- Committed candy cells (highly visible, sugar/caramel family) ---
    // Only render if not completed AND not failed (failure hides the pixelated drawing)
    if (!this.completed && !this.failed) {
      // Target golden color: RGB(249, 171, 63) — sampled from success candy sheet PNG
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const v = this.grid[row * GRID_COLS + col];
          if (v <= 0) continue;
          let r, g, b, a;
          if (v < THIN_MAX) {
            // Pale sugar — lighter than target golden (visible light cream)
            const t = v / THIN_MAX;
            a = 0.45 + t * 0.20;
            // Interpolate from pale cream toward target golden
            r = 242 + t * (249 - 242); g = 210 + t * (171 - 210); b = 150 + t * (63 - 150);
          } else if (v <= IDEAL_MAX) {
            // Ideal golden — match target RGB(249, 171, 63)
            const t = (v - THIN_MAX) / (IDEAL_MAX - THIN_MAX);
            a = 0.60 + t * 0.22;
            // Stay close to target golden, slight variation for depth
            r = 249 - t * 10; g = 171 - t * 8; b = 63 - t * 5;
          } else if (v <= THICK_MAX) {
            // Dark amber — darker than target golden (getting too thick)
            const t = (v - IDEAL_MAX) / (THICK_MAX - IDEAL_MAX);
            a = 0.78 + t * 0.14;
            // Darken from target golden toward deep amber
            r = 239 - t * 50; g = 163 - t * 60; b = 58 - t * 25;
          } else {
            // Burnt brown — way too thick
            const t = Math.min(1, (v - THICK_MAX) / 2);
            a = 0.88 + t * 0.10;
            r = 190 - t * 28; g = 118 - t * 28; b = 48 - t * 18;
          }
          ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
          ctx.fillRect(this.sheetX + col * this.cellW, this.sheetY + row * this.cellH, this.cellW + 0.5, this.cellH + 0.5);
        }
      }
    }

    // --- Success: finished candy sheet PNG over the hot plate ---
    if (this.completed) {
      // Use the finished candy sheet image from the correct path
      const img = this._finishedSheetImg || this._finishedImg;
      if (img) {
        // Calculate target placement using current grid bounds and tuning config
        const gridTop = this.sheetY;
        const gridBottom = this.sheetY + this.sheetH;
        const gridCenterX = this.sheetX + this.sheetW / 2;

        // Apply tuning offsets and extras
        const targetTop = gridTop + FINISHED_CANDY_SHEET_TUNING.yOffset - FINISHED_CANDY_SHEET_TUNING.topExtra;
        const targetBottom = gridBottom + FINISHED_CANDY_SHEET_TUNING.bottomExtra;
        const targetHeight = (targetBottom - targetTop) * FINISHED_CANDY_SHEET_TUNING.heightScale;

        // Preserve aspect ratio, fit to grid height
        const imgAspect = img.width / img.height;
        const targetWidth = targetHeight * imgAspect * FINISHED_CANDY_SHEET_TUNING.widthScale;

        const targetX = gridCenterX - targetWidth / 2 + FINISHED_CANDY_SHEET_TUNING.xOffset;
        const targetY = targetTop;

        // Animation: scale up from 0.82 to 1.0 over 450ms
        const animationDuration = 450; // ms
        const progress = Math.min(1, (this.successTimer * 16.67) / animationDuration); // ~60fps
        const eased = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
        const scale = 0.82 + (1.0 - 0.82) * eased;

        // Calculate current draw dimensions with scale
        const drawW = targetWidth * scale;
        const drawH = targetHeight * scale;

        // Keep centered on final target center
        const centerX = targetX + targetWidth / 2;
        const centerY = targetY + targetHeight / 2;
        const drawX = centerX - drawW / 2;
        const drawY = centerY - drawH / 2;

        // Draw the finished candy sheet with animation
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }
    }

    // --- Guidance text (top-center) ---
    // Show the 4 exact Chinese lines during gameplay
    if (this.cueText) {
      ctx.fillStyle = '#e8c170';
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Position text near top of screen (8% from top)
      ctx.fillText(this.cueText, CANVAS_W / 2, CANVAS_H * 0.08);
    }

    // --- Stats (improved UI) ---
    const st = this._computeStats();
    // Semi-transparent dark background with more padding
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect3(ctx, 15, 15, 180, 130, 10);
    ctx.fill();
    // Add a subtle border
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Larger, more readable font with better spacing
    ctx.fillStyle = '#e8c170';
    ctx.font = 'bold 18px serif';
    ctx.textAlign = 'left';
    ctx.fillText(`覆盖率: ${(st.coverage * 100).toFixed(0)}%`, 30, 45);
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`黄金区: ${(st.goldenRatio * 100).toFixed(0)}%`, 30, 72);
    ctx.fillStyle = st.overThickRatio > 0.12 ? '#ff6644' : '#aabb66';
    ctx.fillText(`过厚: ${(st.overThickRatio * 100).toFixed(0)}%`, 30, 99);
    ctx.fillStyle = this.failed ? '#ff4444' : this.completed ? '#44ff44' : '#888';
    ctx.font = '16px serif';
    ctx.fillText(this.failed ? '失败' : this.completed ? '完成!' : '绘制中', 30, 126);

    // --- Notification ---
    if (this.notificationText) {
      const a = Math.min(1, this.notificationTimer / 20);
      ctx.save(); ctx.globalAlpha = a;
      ctx.font = 'bold 22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(this.notificationText).width;
      const bw = Math.max(300, tw + 60);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect3(ctx, CANVAS_W / 2 - bw / 2, 60 - 20, bw, 40, 10);
      ctx.fill();
      ctx.fillStyle = this.notificationColor;
      ctx.shadowColor = this.notificationColor; ctx.shadowBlur = 8;
      ctx.fillText(this.notificationText, CANVAS_W / 2, 62);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // End design-space transform
    ctx.restore();

    // --- Success click prompt (渲染在視口坐標，不在設計空間) ---
    if (this.completed && this._showClickPrompt && !this._waitForClickAfterSuccess) {
      // Semi-transparent prompt at bottom of screen
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.003) * 0.4;  // Pulse effect
      ctx.fillStyle = '#e8c170';
      ctx.font = 'bold 24px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#e8c170';
      ctx.shadowBlur = 10;
      ctx.fillText('点击任意处继续', this.vw / 2, this.vh - 80);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // --- Failure overlay (render in viewport coordinates, NOT in design space) ---
    if (this.failed) {
      // Dark translucent overlay over the whole screen
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, this.vw, this.vh);

      // --- Tang Shu fail PNG (main visual focus) ---
      let failImgBottomY = 0;  // Track where the fail image ends

      if (this._tangShuFailImg) {
        const img = this._tangShuFailImg;
        const aspect = img.width / img.height;

        // Size: 45% of viewport width (large enough to clearly show Tang Shu)
        const failMaxW = this.vw * 0.45;
        const failMaxH = this.vh * 0.50;

        let failW = failMaxW;
        let failH = failW / aspect;
        if (failH > failMaxH) { failH = failMaxH; failW = failH * aspect; }

        // Position: centered horizontally, in upper part of screen
        const failX = this.vw / 2 - failW / 2;
        const failY = this.vh * 0.25;  // 25% down the viewport

        // Draw Tang Shu fail PNG
        ctx.drawImage(img, failX, failY, failW, failH);

        // Store bottom Y for restart button positioning
        failImgBottomY = failY + failH;

        // Store hitbox for click detection (if needed)
        this._failOverlayBtn = { x: failX, y: failY, w: failW, h: failH };
      }

      // --- Fail reason text (between fail PNG and restart button) ---
      if (this._failReason) {
        const reasonLines = this._failReason.split('\n');
        const reasonY = failImgBottomY + (this.vh * 0.02);  // 2% viewport spacing below fail image

        ctx.save();
        ctx.fillStyle = '#ff8844';
        ctx.font = 'bold 18px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = '#ff8844';
        ctx.shadowBlur = 6;

        for (let i = 0; i < reasonLines.length; i++) {
          ctx.fillText(reasonLines[i], this.vw / 2, reasonY + i * 28);
        }

        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // --- Restart button (below fail reason text) ---
      if (this._restartBtnImg) {
        const restartImg = this._restartBtnImg;
        const restartAspect = restartImg.width / restartImg.height;

        // Size: 25% of viewport width, but not taller than 10% of viewport height
        const restartMaxW = this.vw * 0.25;
        const restartMaxH = this.vh * 0.10;

        let restartW = restartMaxW;
        let restartH = restartW / restartAspect;
        if (restartH > restartMaxH) { restartH = restartMaxH; restartW = restartH * restartAspect; }

        // Position: centered below fail reason text (with comfortable spacing)
        const reasonLinesCount = this._failReason ? this._failReason.split('\n').length : 0;
        const reasonBottomY = failImgBottomY + (this.vh * 0.02) + reasonLinesCount * 28;
        const restartX = this.vw / 2 - restartW / 2;
        const restartY = reasonBottomY + (this.vh * 0.03);  // 3% viewport spacing below reason text

        // Draw restart button
        ctx.drawImage(restartImg, restartX, restartY, restartW, restartH);

        // Store hitbox
        this._scene3RestartButtonBox = { x: restartX, y: restartY, w: restartW, h: restartH, space: "canvas" };

        // Debug outline (cyan)
        if (this.scene3ShowRestartHitboxDebug) {
          ctx.save();
          ctx.strokeStyle = 'cyan';
          ctx.lineWidth = 2;
          ctx.strokeRect(restartX, restartY, restartW, restartH);
          ctx.restore();
        }
      }
    }

    // --- Spoon cursor (only after picking up spoon, draw in canvas coordinates) ---
    if (this.hasPickedUpSpoon && !this.completed && !this.failed) {
      // Determine which cursor image to use
      const inSheet = this._isInSheet(this.ladleX, this.ladleY);
      const isPouring = this.mouseDown && inSheet;
      let cursorImg = this._spoonBeforeImg;

      if (isPouring && this._spoonPouringImg) {
        cursorImg = this._spoonPouringImg;
      }

      if (cursorImg) {
        // Draw spoon centered on mouse cursor (canvas coordinates)
        const cursorW = 80;  // Fixed size in canvas pixels
        const aspect = cursorImg.width / cursorImg.height;
        const cursorH = cursorW / aspect;

        // Check if this is beforepour.png (needs 180 degree rotation)
        const isBeforePour = (cursorImg === this._spoonBeforeImg);

        if (isBeforePour) {
          // Rotate 180 degrees around mouse position
          ctx.save();
          ctx.translate(this.mouseCanvasX, this.mouseCanvasY);
          ctx.rotate(Math.PI);
          ctx.drawImage(cursorImg, -cursorW / 2, -cursorH / 2, cursorW, cursorH);
          ctx.restore();
        } else {
          // No rotation for pouring.png
          const sx = this.mouseCanvasX - cursorW / 2;
          const sy = this.mouseCanvasY - cursorH / 2;
          ctx.drawImage(cursorImg, sx, sy, cursorW, cursorH);
        }
      }
    }
  }

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

  destroy() {
    // Set destroyed flag to guard any handlers that might still fire
    this._destroyed = true;

    // Cancel animation frame loop
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    // Stop and cleanup pouring audio
    if (this._syrupPourAudio) {
      this._syrupPourAudio.pause();
      this._syrupPourAudio.currentTime = 0;
      this._isPouringSoundPlaying = false;
    }

    // Remove ALL event listeners (fix leak)
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
    if (this.canvas) {
      this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
      this.canvas.removeEventListener('click', this._onClick);
    }

    this.container.innerHTML = '';
  }
}

function roundRect3(ctx, x, y, w, h, r) {
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
