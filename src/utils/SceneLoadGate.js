/**
 * Scene Load Gate — Preload gate for scene transitions
 * 
 * Shows a Chinese loading screen while preloading critical assets for the next scene.
 * Only appears if loading takes >300ms to avoid flashing.
 * Includes rotating Chinese sugar-painting facts.
 */

// ============================================================
//  Chinese sugar-painting facts (rotating every 3 seconds)
// ============================================================
const SUGAR_PAINTING_FACTS = [
  '糖画讲究"趁热成形"，糖浆冷却后会很快变硬。',
  '画糖画时，铜勺的速度和手腕的稳定度都会影响线条粗细。',
  '传统糖画常用龙、凤、鱼、蝴蝶等吉祥图案。',
  '糖浆熬到合适火候后，会呈现金黄色，冷却后晶莹透亮。',
  '糖画不是先画草稿，而是用热糖一笔一线直接成形。',
  '糖画完成后需要稍微冷却，才能从画板上完整取下。',
  '糖画的线条太细容易断，太粗又会失去灵动感。',
  '竹签通常要趁糖还没完全凝固时放上，才能牢牢粘住。',
  '糖画既是小吃，也是民间手工艺。',
  '好看的糖画，往往要兼顾速度、火候和构图。'
];

// ============================================================
//  Critical assets for each scene
// ============================================================
const SCENE_CRITICAL_ASSETS = {
  // Scene 1: Act1 videos (already preloaded in INITIAL_PRELOAD_ASSETS)
  1: [
    { src: '/assets/start/act1-first.mp4', type: 'video' },
    { src: '/assets/start/act1-second.mp4', type: 'video' },
    { src: '/assets/ui/hand-pointer.png', type: 'image' },
  ],
  
  // Scene 2: Sugar-boiling mini-game
  2: [
    { src: '/assets/scene2/background/Background.png', type: 'image' },
    { src: '/assets/scene2/Backgrounds/without-stove.png', type: 'image' },
    { src: '/assets/scene2/ui/sugar-bar-empty.png', type: 'image' },
    { src: '/assets/scene2/audio/background-music.mp3', type: 'audio' },
  ],
  
  // Scene 3: Candy sheet pouring
  3: [
    { src: '/assets/scene3/background/Candy hot Plate with no Spoon.png', type: 'image' },
    { src: '/assets/scene3/candy-sheet-finished.png', type: 'image' },
    { src: '/assets/scene3/spoons/beforepour.png', type: 'image' },
    { src: '/assets/scene3/spoons/pouring.png', type: 'image' },
    { src: '/assets/scene3/audio/background-music.mp3', type: 'audio' },
  ],
  
  // Scene 4: Cutscene video
  4: [
    { src: '/assets/scene4/cutscene.mp4', type: 'video' },
  ],
  
  // Scene 5: Candy painting/drawing
  5: [
    { src: '/assets/scene5/background/with-spoon.png', type: 'image' },
    { src: '/assets/scene5/background/without-spoon.png', type: 'image' },
    { src: '/assets/scene5/final/Circle candy.png', type: 'image' },
    { src: '/assets/scene5/final/Success candy drew.png', type: 'image' },
    { src: '/assets/stick/stick.png', type: 'image' },
  ],
  
  // Scene 6: Video cutscene (two videos)
  6: [
    { src: '/assets/scene6/scene6-first.mp4', type: 'video' },
    { src: '/assets/scene6/scene6-second.mp4', type: 'video' },
  ],
  
  // Scene 7: Dragon painting
  7: [
    { src: '/assets/scene7/background/with-spoon.png', type: 'image' },
    { src: '/assets/scene7/background/without-spoon.png', type: 'image' },
    { src: '/assets/scene7/final/Dragon candy.png', type: 'image' },
    { src: '/assets/button7/successful-drawing.png', type: 'image' },
  ],
  
  // Scene 8: Reward video
  8: [
    // Add reward video assets here if needed
  ],
  
  // Scene 9: Ending/locked market
  9: [
    // Add ending assets here if needed
  ],
};

// ============================================================
//  Scene Load Gate class
// ============================================================
export class SceneLoadGate {
  constructor() {
    this._overlay = null;
    this._factIndex = 0;
    this._factInterval = null;
    this._loadingTimeout = null;
    this._showDelayTimeout = null;
    this._currentSceneNumber = null;
    this._onReady = null;
    this._loadStartTime = null;
    this._showReloadButton = false;
    this._aborted = false;
  }

  /**
   * Preload assets for a scene and show loading overlay if needed
   * @param {number} sceneNumber - Scene number (1-9)
   * @returns {Promise<void>} - Resolves when critical assets are loaded
   */
  async preload(sceneNumber) {
    const assets = SCENE_CRITICAL_ASSETS[sceneNumber] || [];
    
    console.log(`[SceneLoad] requested: Scene ${sceneNumber}`);
    
    // Check if assets are already cached
    const uncachedAssets = assets.filter(asset => !this._isAssetCached(asset.src));
    
    if (uncachedAssets.length === 0) {
      console.log(`[SceneLoad] already ready: Scene ${sceneNumber}`);
      return Promise.resolve();
    }
    
    console.log(`[SceneLoad] loading start: Scene ${sceneNumber} (${uncachedAssets.length} assets)`);
    
    this._currentSceneNumber = sceneNumber;
    this._loadStartTime = performance.now();
    this._aborted = false;
    
    // Delay showing overlay by 300ms to avoid flashing for fast loads
    return new Promise((resolve, reject) => {
      this._onReady = resolve;
      
      this._showDelayTimeout = setTimeout(() => {
        if (!this._aborted) {
          this._showOverlay();
        }
      }, 300);
      
      // Start preloading
      this._preloadAssets(uncachedAssets)
        .then(() => {
          this._onLoadComplete();
          resolve();
        })
        .catch((error) => {
          console.error(`[SceneLoad] failed: Scene ${sceneNumber}`, error);
          this._onLoadComplete();
          resolve(); // Still resolve to not block the game
        });
    });
  }

  /**
   * Check if an asset is already cached
   * @param {string} src - Asset URL
   * @returns {boolean}
   */
  _isAssetCached(src) {
    // Check if image is cached
    if (src.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
      const img = new Image();
      img.src = src;
      return img.complete || img.naturalWidth > 0;
    }
    
    // For videos and audio, we can't easily check cache
    // Assume not cached (they'll load quickly if cached)
    return false;
  }

  /**
   * Preload multiple assets
   * @param {Array} assets - Array of {src, type}
   * @returns {Promise<void>}
   */
  async _preloadAssets(assets) {
    const timeoutMs = 20000; // 20 second timeout for all assets
    
    const promises = assets.map(asset => {
      return Promise.race([
        this._preloadAsset(asset),
        this._createTimeout(timeoutMs, asset.src)
      ]);
    });
    
    const results = await Promise.allSettled(promises);
    
    // Log failed assets
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`[SceneLoad] failed asset: ${assets[index].src}`);
      }
    });
    
    return results;
  }

  /**
   * Preload a single asset
   * @param {Object} asset - {src, type}
   * @returns {Promise<void>}
   */
  _preloadAsset(asset) {
    return new Promise((resolve) => {
      if (this._aborted) {
        resolve();
        return;
      }

      if (asset.type === 'image') {
        const img = new Image();
        
        img.onload = () => {
          console.log(`[SceneLoad] loaded: ${asset.src}`);
          resolve();
        };
        
        img.onerror = () => {
          console.warn(`[SceneLoad] failed: ${asset.src}`);
          resolve(); // Still resolve to not block
        };
        
        img.src = asset.src;
        
      } else if (asset.type === 'video') {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        
        const onReady = () => {
          console.log(`[SceneLoad] loaded: ${asset.src}`);
          cleanup();
          resolve();
        };
        
        const onError = () => {
          console.warn(`[SceneLoad] failed: ${asset.src}`);
          cleanup();
          resolve(); // Still resolve to not block
        };
        
        const cleanup = () => {
          video.removeEventListener('canplaythrough', onReady);
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('error', onError);
        };
        
        video.addEventListener('canplaythrough', onReady, { once: true });
        video.addEventListener('loadeddata', onReady, { once: true });
        video.addEventListener('error', onError, { once: true });
        
        video.src = asset.src;
        
      } else if (asset.type === 'audio') {
        const audio = new Audio();
        audio.preload = 'auto';
        
        const onReady = () => {
          console.log(`[SceneLoad] loaded: ${asset.src}`);
          cleanup();
          resolve();
        };
        
        const onError = () => {
          console.warn(`[SceneLoad] failed: ${asset.src}`);
          cleanup();
          resolve(); // Still resolve to not block
        };
        
        const cleanup = () => {
          audio.removeEventListener('canplaythrough', onReady);
          audio.removeEventListener('error', onError);
        };
        
        audio.addEventListener('canplaythrough', onReady, { once: true });
        audio.addEventListener('error', onError, { once: true });
        
        audio.src = asset.src;
        
      } else {
        console.warn(`[SceneLoad] unknown asset type: ${asset.type}`);
        resolve();
      }
    });
  }

  /**
   * Create a timeout promise
   * @param {number} ms - Timeout in milliseconds
   * @param {string} src - Asset source (for logging)
   * @returns {Promise<void>}
   */
  _createTimeout(ms, src) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.warn(`[SceneLoad] timeout: ${src}`);
        resolve(); // Still resolve to not block
      }, ms);
    });
  }

  /**
   * Show the loading overlay
   */
  _showOverlay() {
    if (this._overlay) return;
    
    console.log(`[SceneLoad] showing overlay for Scene ${this._currentSceneNumber}`);
    
    this._overlay = document.createElement('div');
    this._overlay.id = 'scene-load-overlay';
    this._overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a0e05 0%, #2d1f0f 50%, #1a0e05 100%);
      color: #e8c170;
      font-family: serif;
      user-select: none;
    `;
    
    // Title
    const title = document.createElement('div');
    title.textContent = '糖画摊准备中...';
    title.style.cssText = `
      font-size: 32px;
      margin-bottom: 16px;
      text-shadow: 0 0 20px rgba(232,193,112,0.5);
      animation: sceneLoadFadeIn 0.5s ease;
    `;
    this._overlay.appendChild(title);
    
    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.textContent = '正在备好铜勺、糖浆和画板...';
    subtitle.style.cssText = `
      font-size: 16px;
      margin-bottom: 32px;
      opacity: 0.7;
      animation: sceneLoadFadeIn 0.5s ease 0.1s both;
    `;
    this._overlay.appendChild(subtitle);
    
    // Loading indicator
    const loading = document.createElement('div');
    loading.textContent = '加载中...';
    loading.style.cssText = `
      font-size: 14px;
      margin-bottom: 24px;
      opacity: 0.5;
      animation: sceneLoadPulse 1.5s ease-in-out infinite;
    `;
    this._overlay.appendChild(loading);
    
    // Fact text
    this._factElement = document.createElement('div');
    this._factElement.textContent = SUGAR_PAINTING_FACTS[0];
    this._factElement.style.cssText = `
      font-size: 14px;
      max-width: 600px;
      text-align: center;
      line-height: 1.6;
      padding: 0 20px;
      opacity: 0.6;
      animation: sceneLoadFadeIn 0.5s ease;
    `;
    this._overlay.appendChild(this._factElement);
    
    // Reload button (hidden initially)
    this._reloadButton = document.createElement('button');
    this._reloadButton.textContent = '重新加载';
    this._reloadButton.style.cssText = `
      margin-top: 32px;
      padding: 12px 32px;
      font-size: 16px;
      font-family: serif;
      color: #e8c170;
      background: rgba(232,193,112,0.1);
      border: 1px solid rgba(232,193,112,0.3);
      border-radius: 8px;
      cursor: pointer;
      display: none;
      transition: all 0.3s ease;
    `;
    this._reloadButton.onmouseenter = () => {
      this._reloadButton.style.background = 'rgba(232,193,112,0.2)';
      this._reloadButton.style.borderColor = 'rgba(232,193,112,0.5)';
    };
    this._reloadButton.onmouseleave = () => {
      this._reloadButton.style.background = 'rgba(232,193,112,0.1)';
      this._reloadButton.style.borderColor = 'rgba(232,193,112,0.3)';
    };
    this._reloadButton.onclick = () => {
      console.log(`[SceneLoad] retry clicked: Scene ${this._currentSceneNumber}`);
      this._reloadButton.style.display = 'none';
      this._showReloadButton = false;
      this._factIndex = (this._factIndex + 1) % SUGAR_PAINTING_FACTS.length;
      this._factElement.textContent = SUGAR_PAINTING_FACTS[this._factIndex];
      this.preload(this._currentSceneNumber);
    };
    this._overlay.appendChild(this._reloadButton);
    
    // Add to document
    document.body.appendChild(this._overlay);
    
    // Start rotating facts
    this._startFactRotation();
    
    // Show reload button after 8 seconds
    this._loadingTimeout = setTimeout(() => {
      if (this._overlay && !this._aborted) {
        console.log(`[SceneLoad] loading slow: Scene ${this._currentSceneNumber}`);
        this._showReloadButton = true;
        if (this._reloadButton) {
          this._reloadButton.style.display = 'block';
        }
      }
    }, 8000);
    
    // Add animation keyframes
    this._addAnimationStyles();
  }

  /**
   * Start rotating facts every 3 seconds
   */
  _startFactRotation() {
    this._factInterval = setInterval(() => {
      if (this._factElement && !this._aborted) {
        this._factIndex = (this._factIndex + 1) % SUGAR_PAINTING_FACTS.length;
        this._factElement.style.animation = 'none';
        // Trigger reflow
        void this._factElement.offsetHeight;
        this._factElement.style.animation = 'sceneLoadFadeIn 0.5s ease';
        this._factElement.textContent = SUGAR_PAINTING_FACTS[this._factIndex];
      }
    }, 3000);
  }

  /**
   * Add CSS animation keyframes
   */
  _addAnimationStyles() {
    if (document.getElementById('scene-load-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'scene-load-styles';
    style.textContent = `
      @keyframes sceneLoadFadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 0.6; transform: translateY(0); }
      }
      @keyframes sceneLoadPulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Called when loading is complete
   */
  _onLoadComplete() {
    const loadTime = performance.now() - this._loadStartTime;
    console.log(`[SceneLoad] loading complete: Scene ${this._currentSceneNumber} (${Math.round(loadTime)}ms)`);
    
    // Clear timeouts
    if (this._showDelayTimeout) {
      clearTimeout(this._showDelayTimeout);
      this._showDelayTimeout = null;
    }
    
    if (this._loadingTimeout) {
      clearTimeout(this._loadingTimeout);
      this._loadingTimeout = null;
    }
    
    // Stop fact rotation
    if (this._factInterval) {
      clearInterval(this._factInterval);
      this._factInterval = null;
    }
    
    // Hide overlay
    this._hideOverlay();
    
    // Resolve promise
    if (this._onReady) {
      this._onReady();
      this._onReady = null;
    }
  }

  /**
   * Hide the loading overlay
   */
  _hideOverlay() {
    if (this._overlay) {
      this._overlay.style.transition = 'opacity 0.3s ease';
      this._overlay.style.opacity = '0';
      
      setTimeout(() => {
        if (this._overlay && this._overlay.parentNode) {
          this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
      }, 300);
    }
  }

  /**
   * Abort loading (cleanup)
   */
  abort() {
    console.log('[SceneLoad] aborted');
    this._aborted = true;
    
    if (this._showDelayTimeout) {
      clearTimeout(this._showDelayTimeout);
      this._showDelayTimeout = null;
    }
    
    if (this._loadingTimeout) {
      clearTimeout(this._loadingTimeout);
      this._loadingTimeout = null;
    }
    
    if (this._factInterval) {
      clearInterval(this._factInterval);
      this._factInterval = null;
    }
    
    this._hideOverlay();
    this._onReady = null;
  }
}

// ============================================================
//  Export singleton instance
// ============================================================
let _instance = null;

export function getSceneLoadGate() {
  if (!_instance) {
    _instance = new SceneLoadGate();
  }
  return _instance;
}

export default SceneLoadGate;
