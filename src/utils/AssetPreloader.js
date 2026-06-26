/**
 * Asset Preloader Utility
 * Handles Promise-based loading of images, videos, and audio
 * Shows progress and handles timeouts gracefully
 */

export class AssetPreloader {
  constructor() {
    this.loaded = 0;
    this.total = 0;
    this.failed = [];
    this.loadedAssets = [];
    this.onProgress = null;
    this.onComplete = null;
    this.onAssetLoad = null;
    this._aborted = false;
    this._label = ''; // Label for logging (e.g., 'critical', 'Scene2/3')
  }

  /**
   * Preload an image
   * @param {string} src - Image URL
   * @returns {Promise<{src: string, success: boolean, type: string}>}
   */
  preloadImage(src) {
    return new Promise((resolve) => {
      if (this._aborted) {
        resolve({ src, success: false, type: 'image', reason: 'aborted' });
        return;
      }

      const img = new Image();
      
      const timeout = setTimeout(() => {
        console.warn(`[Preload] failed: ${src}`);
        this.failed.push({ src, type: 'image', reason: 'timeout' });
        resolve({ src, success: false, type: 'image', reason: 'timeout' });
      }, 15000); // 15s timeout for images

      img.onload = () => {
        clearTimeout(timeout);
        if (this._aborted) {
          resolve({ src, success: false, type: 'image', reason: 'aborted' });
          return;
        }
        console.log(`[Preload] loaded: ${src}`);
        this.loadedAssets.push({ src, type: 'image', element: img });
        resolve({ src, success: true, type: 'image' });
      };

      img.onerror = () => {
        clearTimeout(timeout);
        console.warn(`[Preload] failed: ${src}`);
        this.failed.push({ src, type: 'image', reason: 'error' });
        resolve({ src, success: false, type: 'image', reason: 'error' });
      };

      img.src = src;
    });
  }

  /**
   * Preload a video
   * @param {string} src - Video URL
   * @returns {Promise<{src: string, success: boolean, type: string}>}
   */
  preloadVideo(src) {
    return new Promise((resolve) => {
      if (this._aborted) {
        resolve({ src, success: false, type: 'video', reason: 'aborted' });
        return;
      }

      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true; // Mute to allow preload without user gesture
      video.playsInline = true;
      
      const timeout = setTimeout(() => {
        console.warn(`[Preload] failed: ${src}`);
        this.failed.push({ src, type: 'video', reason: 'timeout' });
        resolve({ src, success: false, type: 'video', reason: 'timeout' });
      }, 20000); // 20s timeout for videos

      video.addEventListener('canplaythrough', () => {
        clearTimeout(timeout);
        if (this._aborted) {
          resolve({ src, success: false, type: 'video', reason: 'aborted' });
          return;
        }
        console.log(`[Preload] loaded: ${src}`);
        this.loadedAssets.push({ src, type: 'video', element: video });
        resolve({ src, success: true, type: 'video' });
      }, { once: true });

      video.addEventListener('loadeddata', () => {
        // Fallback: if canplaythrough doesn't fire, loadeddata is still good
        if (!video._loadedFired) {
          video._loadedFired = true;
          clearTimeout(timeout);
          if (this._aborted) {
            resolve({ src, success: false, type: 'video', reason: 'aborted' });
            return;
          }
          console.log(`[Preload] loaded (loadeddata): ${src}`);
          this.loadedAssets.push({ src, type: 'video', element: video });
          resolve({ src, success: true, type: 'video' });
        }
      }, { once: true });

      video.addEventListener('error', () => {
        clearTimeout(timeout);
        console.warn(`[Preload] failed: ${src}`);
        this.failed.push({ src, type: 'video', reason: 'error' });
        resolve({ src, success: false, type: 'video', reason: 'error' });
      }, { once: true });

      video.src = src;
    });
  }

  /**
   * Preload audio
   * @param {string} src - Audio URL
   * @returns {Promise<{src: string, success: boolean, type: string}>}
   */
  preloadAudio(src) {
    return new Promise((resolve) => {
      if (this._aborted) {
        resolve({ src, success: false, type: 'audio', reason: 'aborted' });
        return;
      }

      const audio = new Audio();
      audio.preload = 'auto';
      
      const timeout = setTimeout(() => {
        console.warn(`[Preload] failed: ${src}`);
        this.failed.push({ src, type: 'audio', reason: 'timeout' });
        resolve({ src, success: false, type: 'audio', reason: 'timeout' });
      }, 15000); // 15s timeout for audio

      audio.addEventListener('canplaythrough', () => {
        clearTimeout(timeout);
        if (this._aborted) {
          resolve({ src, success: false, type: 'audio', reason: 'aborted' });
          return;
        }
        console.log(`[Preload] loaded: ${src}`);
        this.loadedAssets.push({ src, type: 'audio', element: audio });
        resolve({ src, success: true, type: 'audio' });
      }, { once: true });

      audio.addEventListener('error', () => {
        clearTimeout(timeout);
        console.warn(`[Preload] failed: ${src}`);
        this.failed.push({ src, type: 'audio', reason: 'error' });
        resolve({ src, success: false, type: 'audio', reason: 'error' });
      }, { once: true });

      audio.src = src;
    });
  }

  /**
   * Set label for logging
   * @param {string} label - Label for this preload batch (e.g., 'critical', 'Scene2/3')
   */
  setLabel(label) {
    this._label = label;
  }

  /**
   * Preload multiple assets with progress tracking
   * @param {Array<{src: string, type: 'image'|'video'|'audio'}>} assets
   * @returns {Promise<Array<{src: string, success: boolean, type: string}>>}
   */
  async preloadAssets(assets) {
    this.total = assets.length;
    this.loaded = 0;
    this._aborted = false;

    // Log background start if label is set
    if (this._label && this._label !== 'critical') {
      console.log(`[Preload] background start: ${this._label}`);
    }

    const results = [];
    
    for (const asset of assets) {
      if (this._aborted) break;

      let result;
      try {
        if (asset.type === 'image') {
          result = await this.preloadImage(asset.src);
        } else if (asset.type === 'video') {
          result = await this.preloadVideo(asset.src);
        } else if (asset.type === 'audio') {
          result = await this.preloadAudio(asset.src);
        } else {
          console.warn(`[Preload] unknown asset type: ${asset.type}`);
          result = { src: asset.src, success: false, type: asset.type, reason: 'unknown type' };
        }
      } catch (e) {
        console.error(`[Preload] error loading ${asset.src}:`, e);
        result = { src: asset.src, success: false, type: asset.type, reason: 'exception' };
      }

      results.push(result);
      this.loaded++;

      if (this.onProgress) {
        const progress = Math.round((this.loaded / this.total) * 100);
        this.onProgress(progress, this.loaded, this.total, result);
      }

      if (this.onAssetLoad) {
        this.onAssetLoad(result);
      }
    }

    if (this.onComplete) {
      this.onComplete(results, this.failed);
    }

    // Log completion with correct format
    if (this._label === 'critical') {
      console.log(`[Preload] critical complete`);
    } else if (this._label) {
      console.log(`[Preload] background complete: ${this._label}`);
    } else {
      console.log(`[Preload] complete - loaded: ${this.loaded}/${this.total}, failed: ${this.failed.length}`);
    }

    return results;
  }

  /**
   * Abort preloading (stop after current asset)
   */
  abort() {
    this._aborted = true;
  }

  /**
   * Get preloaded asset element by src
   * @param {string} src - Asset URL
   * @returns {HTMLElement|null}
   */
  getPreloadedAsset(src) {
    const asset = this.loadedAssets.find(a => a.src === src);
    return asset ? asset.element : null;
  }

  /**
   * Clear all preloaded assets (free memory)
   */
  clear() {
    this.loadedAssets.forEach(asset => {
      if (asset.element && asset.element.remove) {
        asset.element.remove();
      }
    });
    this.loadedAssets = [];
    this.failed = [];
    this.loaded = 0;
    this.total = 0;
  }
}

/**
 * Critical assets to preload before game starts
 */
export const INITIAL_PRELOAD_ASSETS = [
  // Act1 videos
  { src: '/assets/start/act1-first.mp4', type: 'video' },
  { src: '/assets/start/act1-second.mp4', type: 'video' },
  
  // Scene2 assets
  { src: '/assets/scene2/background/Background.png', type: 'image' },
  { src: '/assets/scene2/Backgrounds/without-stove.png', type: 'image' },
  { src: '/assets/scene2/ui/sugar-bar-empty.png', type: 'image' },
  { src: '/assets/scene2/restart/restart.png', type: 'image' },
  { src: '/assets/scene2/audio/background-music.mp3', type: 'audio' },
  
  // Shared UI assets
  { src: '/assets/ui/hand-pointer.png', type: 'image' },
];

/**
 * Scene 2/3 assets to preload in background after Act1 starts
 */
export const SCENE2_3_PRELOAD_ASSETS = [
  // Scene3 assets
  { src: '/assets/scene3/background/Candy hot Plate with no Spoon.png', type: 'image' },
  { src: '/assets/scene3/candy-sheet-finished.png', type: 'image' },
  { src: '/assets/scene3/spoons/beforepour.png', type: 'image' },
  { src: '/assets/scene3/spoons/pouring.png', type: 'image' },
  { src: '/assets/scene3/audio/background-music.mp3', type: 'audio' },
];

/**
 * Scene 4/5 assets to preload in background after Scene2 starts
 */
export const SCENE4_5_PRELOAD_ASSETS = [
  // Scene4 video
  { src: '/assets/scene4/cutscene.mp4', type: 'video' },
  
  // Scene5 assets
  { src: '/assets/scene5/background/with-spoon.png', type: 'image' },
  { src: '/assets/scene5/background/without-spoon.png', type: 'image' },
  { src: '/assets/scene5/final/Circle candy.png', type: 'image' },
  { src: '/assets/scene5/final/Success candy drew.png', type: 'image' },
  { src: '/assets/stick/stick.png', type: 'image' },
];

/**
 * Scene 6/7 assets to preload in background after Scene4 starts
 */
export const SCENE6_7_PRELOAD_ASSETS = [
  // Scene6 videos
  { src: '/assets/scene6/first-video-open.mp4', type: 'video' },
  { src: '/assets/button6/cutscenes/connect.mp4', type: 'video' },
  
  // Scene7 assets
  { src: '/assets/scene7/background/with-spoon.png', type: 'image' },
  { src: '/assets/scene7/background/without-spoon.png', type: 'image' },
  { src: '/assets/scene7/final/Dragon candy.png', type: 'image' },
  { src: '/assets/button7/successful-drawing.png', type: 'image' },
];

// createLoadingScreen function removed - replaced with soft preload flow in main.js
