/**
 * Sugar Painting Game — Main Entry Point
 *
 * Scene flow:
 *   Act 1 (animation) → Scene 2 (sugar-boiling mini-game) → Scene 3 (sugar-sheet drawing) → Scene 4 (cutscene) → Candy Making
 */
import { Act1Scene } from './scenes/Act1Scene.js';
import { Scene2 } from './scenes/Scene2.js';
import { Scene3 } from './scenes/Scene3.js';
import { Scene4 } from './scenes/Scene4.js';
import { Scene5 } from './scenes/Scene5.js';
import { Scene6 } from './scenes/Scene6.js';
import { Scene7 } from './scenes/Scene7.js';
import { Scene8 } from './scenes/Scene8.js';
import { Scene9 } from './scenes/Scene9.js';
import { AssetPreloader, INITIAL_PRELOAD_ASSETS, SCENE2_3_PRELOAD_ASSETS, SCENE4_5_PRELOAD_ASSETS, SCENE6_7_PRELOAD_ASSETS } from './utils/AssetPreloader.js';

// Set to false to remove dev hotkeys in production
const enableDevHotkeys = true;

class Game {
  constructor() {
    this.appEl = document.getElementById('app');
    this.currentScene = null;
    this.currentSceneNumber = 0;  // Track which scene number is active

    // Background music instances (managed centrally)
    this._bgMusic = null;           // Scene 1 / intro music
    this._scene2BgMusic = null;     // Scene 2 cooking music
    this._scene3BgMusic = null;     // Scene 3 candy pouring music
    this._scene3BgMusicStarted = false;

    // Asset preloader (for silent background preloading)
    this._preloader = new AssetPreloader();

    if (enableDevHotkeys) {
      this._initDevHotkeys();
    }
  }

  /** Central scene transition function - stops current scene completely, then starts new scene */
  switchToScene(sceneNumber, options = {}) {
    const oldScene = this.currentSceneNumber;
    console.log(`[Game] Switching scene: ${oldScene} → ${sceneNumber}`, options);

    // Stop current scene completely
    this._stopCurrentScene();

    // Start new scene
    console.log(`[Game] Starting scene ${sceneNumber}`);
    switch (sceneNumber) {
      case 1:
        this._enterScene1Video();
        break;
      case 2:
        this._enterScene2Cooking();
        break;
      case 3:
        this._enterScene3CandyPouring();
        break;
      case 4:
        this._enterScene4Cutscene();
        break;
      case 5:
        this._enterScene5Painting(options);
        break;
      case 6:
        this._enterScene6Cutscene();
        break;
      case 7:
        this._enterScene7DragonPainting();
        break;
      case 8:
        this._enterScene8RewardVideo();
        break;
      case 9:
        this._enterScene9LockedMarket();
        break;
    }

    this.currentSceneNumber = sceneNumber;
    console.log(`[Game] Scene switch complete: ${oldScene} → ${sceneNumber}`);
  }

  /** Stop current scene completely - cleanup all resources */
  _stopCurrentScene() {
    if (!this.currentScene) {
      console.log('[Game] No current scene to stop');
      return;
    }

    console.log(`[Game] Cleaning up scene ${this.currentSceneNumber}`);

    // Call scene's destroy/cleanup method
    if (this.currentScene.destroy) {
      this.currentScene.destroy();
    }

    // Clear the reference
    this.currentScene = null;

    // Stop all audio as safety net
    this._stopAllBackgroundMusic();

    console.log(`[Game] Scene ${this.currentSceneNumber} cleanup complete`);
  }

  /** Centralized scene transition helpers */

  /** Enter Scene 1 (video) - stop all game music, let video audio play */
  _enterScene1Video() {
    // Note: Cleanup is now handled by switchToScene()
    // This method should only create the new scene

    // Transition to Scene 1
    this.currentScene = new Act1Scene(this.appEl, () => {
      // When video ends naturally, go to Scene 2 (which will start cooking music)
      this.goToScene2();
    });
    console.log('[Game] Scene 1 (Act1) created');

    // Background preload Scene 2/3 assets
    setTimeout(() => {
      this._preloadScene2_3();
    }, 2000); // Start preloading after 2s to not block video playback
  }

  /** Enter Scene 2 (cooking) - stop Scene 3 music, start cooking music */
  _enterScene2Cooking() {
    // Note: Cleanup is now handled by switchToScene()

    // Start Scene 2 cooking background music
    this._initScene2Music();
    if (this._scene2BgMusic) {
      this._scene2BgMusic.currentTime = 0;
      this._scene2BgMusic.play().catch(() => {
        const resumeOnce = () => {
          if (this._scene2BgMusic && this._scene2BgMusic.paused) {
            this._scene2BgMusic.play().catch(() => {});
          }
          document.removeEventListener('click', resumeOnce);
          document.removeEventListener('touchstart', resumeOnce);
        };
        document.addEventListener('click', resumeOnce);
        document.addEventListener('touchstart', resumeOnce);
      });
    }

    // Transition to Scene 2
    this.currentScene = new Scene2(this.appEl, () => {
      this.goToScene3();
    });
    console.log('[Game] Scene 2 (cooking) created');

    // Background preload Scene 4/5 assets
    this._preloadScene4_5();
  }

  /** Enter Scene 3 (candy pouring) - stop Scene 2 music, start candy pouring music */
  _enterScene3CandyPouring() {
    // Note: Cleanup is now handled by switchToScene()

    // Transition to Scene 3
    this.currentScene = new Scene3(this.appEl,
      // onComplete: transition to Scene 4 cutscene
      () => {
        // Stop Scene 3 music when transitioning to next scene
        this._stopScene3Music();
        this.switchToScene(4);
      },
      // onSuccess: show click prompt, wait for click before Scene 4
      () => {
        // Don't transition yet - Scene3 will show "点击任意处继续"
        // The transition to Scene 4 will happen after the user clicks
        console.log('[Main] Scene 3 success, waiting for click...');
      }
    );

    // Immediately start Scene 3 background music
    this._startScene3Music();
    console.log('[Game] Scene 3 (candy pouring) created');
  }

  /** Enter Scene 4 (cutscene) - stop all music, play video audio */
  _enterScene4Cutscene() {
    // Note: Cleanup is now handled by switchToScene()

    // Transition to Scene 4
    this.currentScene = new Scene4(this.appEl, () => {
      // When video ends and user clicks, go to Scene 5 in practice mode
      this.switchToScene(5, { mode: "practice" });
    });
    console.log('[Game] Scene 4 (cutscene) created');

    // Background preload Scene 6/7 assets
    this._preloadScene6_7();
  }

  /** Enter Scene 5 (painting minigame) - stop all music */
  _enterScene5Painting(options = {}) {
    // Note: Cleanup is now handled by switchToScene()

    const mode = options.mode || "practice"; // Default to practice mode

    // Transition to Scene 5 with mode-specific completion callback
    this.currentScene = new Scene5(this.appEl, () => {
      // When Scene 5 completes, route based on mode
      if (mode === "practice") {
        // Practice mode: after completion, go to Scene 6 cutscene
        console.log('[Main] Scene 5 (practice) completed, switching to Scene 6');
        this.switchToScene(6);
      } else {
        // Order mode: after completion, go to Scene 7 (dragon painting)
        console.log('[Main] Scene 5 (order) completed, switching to Scene 7');
        this.switchToScene(7);
      }
    }, { mode: mode });

    console.log(`[Main] Scene 5 (painting, mode: ${mode}) created`);
  }

  /** Enter Scene 6 (cutscene) - stop all music, play video */
  _enterScene6Cutscene() {
    // Note: Cleanup is now handled by switchToScene()

    // Transition to Scene 6
    this.currentScene = new Scene6(this.appEl, () => {
      // When Scene 6 completes, go to Scene 5 in order mode
      console.log('[Main] Scene 6 completed, switching to Scene 5 (order mode)');
      this.switchToScene(5, { mode: "order" });
    });

    console.log('[Main] Scene 6 (cutscene) created');
  }

  /** Enter Scene 7 (dragon painting) - stop all music */
  _enterScene7DragonPainting() {
    // Note: Cleanup is now handled by switchToScene()

    // Transition to Scene 7
    this.currentScene = new Scene7(this.appEl, () => {
      // When Scene 7 completes, transition to Scene 8 (reward video)
      console.log('[Main] Scene 7 completed, switching to Scene 8');
      this.switchToScene(8);
    });

    console.log('[Main] Scene 7 (dragon painting) created');
  }

  /** Enter Scene 8 (reward video) - stop all music */
  _enterScene8RewardVideo() {
    // Note: Cleanup is now handled by switchToScene()

    // Transition to Scene 8 (reward video)
    this.currentScene = new Scene8(this.appEl, () => {
      // When Scene 8 completes (reward sequence finished), go to Scene 9
      console.log('[Main] Scene 8 completed, switching to Scene 9');
      this.switchToScene(9);
    });

    console.log('[Main] Scene 8 (reward video) created');
  }

  /** Enter Scene 9 (locked future market) - stop all music */
  _enterScene9LockedMarket() {
    // Note: Cleanup is now handled by switchToScene()

    // Transition to Scene 9 (locked future market)
    this.currentScene = new Scene9(this.appEl, () => {
      // When Scene 9 completes (shouldn't happen, it's a locked screen)
      console.log('[Main] Scene 9 completed');
    });

    console.log('[Main] Scene 9 (locked future market) created');
  }

  /** Enter candy making game (placeholder for now) */
  _enterCandyMakingGame() {
    // Stop all music just in case
    this._stopAllBackgroundMusic();

    // Transition to candy making game
    if (this.currentScene && this.currentScene.destroy) {
      this.currentScene.destroy();
    }

    // Placeholder screen for candy making
    this.appEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.cssText = `
      width:100%; height:100%;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      background: linear-gradient(135deg, #1a0e05, #3d2b1f);
      color: #e8c170; font-family: serif;
    `;

    const title = document.createElement('div');
    title.textContent = '糖画绘制';
    title.style.cssText = `
      font-size: 36px; margin-bottom: 16px;
      text-shadow: 0 0 20px rgba(232,193,112,0.5);
    `;
    wrap.appendChild(title);

    const sub = document.createElement('div');
    sub.textContent = '（开发中...）';
    sub.style.cssText = 'font-size: 18px; opacity:0.6;';
    wrap.appendChild(sub);

    this.appEl.appendChild(wrap);
  }

  /** Temporary dev hotkeys for testing scene transitions */
  _initDevHotkeys() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case '1':
          e.preventDefault();
          this.switchToScene(1);
          break;
        case '2':
          e.preventDefault();
          this.switchToScene(2);
          break;
        case '3':
          e.preventDefault();
          this.switchToScene(3);
          break;
        case '4':
          e.preventDefault();
          this.switchToScene(4);
          break;
        case '5':
          e.preventDefault();
          this.switchToScene(5);
          break;
        case '6':
          e.preventDefault();
          this.switchToScene(6);
          break;
        case '7':
          e.preventDefault();
          this.switchToScene(7);
          break;
        case '8':
          e.preventDefault();
          this.switchToScene(8);
          break;
        case '9':
          e.preventDefault();
          this.switchToScene(9);
          break;
      }
    });
  }

  /** Called when Act 1 animation ends or copper pot is clicked - route through central switch */
  goToScene2() {
    this.switchToScene(2);
  }

  /** Stop Scene 2 cooking music only */
  _stopScene2Music() {
    if (this._scene2BgMusic) {
      this._scene2BgMusic.pause();
      this._scene2BgMusic.currentTime = 0;
    }
  }

  /** Stop Scene 3 candy pouring music only */
  _stopScene3Music() {
    if (this._scene3BgMusic) {
      this._scene3BgMusic.pause();
      this._scene3BgMusic.currentTime = 0;
      this._scene3BgMusicStarted = false;
    }
  }

  /** Initialize Scene 2 cooking background music */
  _initScene2Music() {
    if (this._scene2BgMusic) return;
    try {
      this._scene2BgMusic = new Audio('/assets/scene2/audio/background-music.wav');
      this._scene2BgMusic.volume = 0.25;
      this._scene2BgMusic.loop = true;
    } catch (e) { console.warn('[Main] Could not create Scene 2 background music:', e); }
  }

  /** Initialize Scene 3 candy pouring background music */
  _initScene3Music() {
    if (this._scene3BgMusic) return;
    try {
      this._scene3BgMusic = new Audio('/assets/scene3/audio/background-music.wav');
      this._scene3BgMusic.volume = 0.28;
      this._scene3BgMusic.loop = true;
    } catch (e) { console.warn('[Main] Could not create Scene 3 background music:', e); }
  }

  /** Start Scene 3 background music (idempotent) */
  _startScene3Music() {
    this._initScene3Music();
    if (!this._scene3BgMusic) return;
    if (!this._scene3BgMusic.paused) return; // already playing

    this._scene3BgMusicStarted = true;
    this._scene3BgMusic.play().then(() => {
      console.log('[Main] Scene 3 background music started');
    }).catch(() => {
      // Autoplay policy blocked — retry on next user gesture
      this._scene3BgMusicStarted = false;
      const resumeOnce = () => {
        if (this._scene3BgMusic && this._scene3BgMusic.paused) {
          this._scene3BgMusic.play().then(() => {
            this._scene3BgMusicStarted = true;
            console.log('[Main] Scene 3 background music started on retry');
          }).catch(() => { this._scene3BgMusicStarted = false; });
        }
        document.removeEventListener('click', resumeOnce);
        document.removeEventListener('touchstart', resumeOnce);
      };
      document.addEventListener('click', resumeOnce);
      document.addEventListener('touchstart', resumeOnce);
    });
  }

  /** Stop ALL background music instances */
  _stopAllBackgroundMusic() {
    if (this._bgMusic) {
      this._bgMusic.pause();
      this._bgMusic.currentTime = 0;
    }
    if (this._scene2BgMusic) {
      this._scene2BgMusic.pause();
      this._scene2BgMusic.currentTime = 0;
    }
    if (this._scene3BgMusic) {
      this._scene3BgMusic.pause();
      this._scene3BgMusic.currentTime = 0;
      this._scene3BgMusicStarted = false;
    }
  }

  /** Transition into Scene 3 (sugar-sheet drawing) after Scene 2 success - route through central switch */
  goToScene3() {
    this.switchToScene(3);
  }

  start() {
    // Start directly with Act1 video
    this._enterScene1Video();

    // Silent background preload of critical assets (non-blocking)
    this._preloader.setLabel('critical');
    this._preloader.onProgress = (progress, loaded, total, result) => {
      if (result && !result.success) {
        console.warn(`[Preload] failed: ${result.src}`);
      }
    };
    this._preloader.onComplete = (results, failed) => {
      console.log('[Preload] critical complete');
    };
    this._preloader.preloadAssets(INITIAL_PRELOAD_ASSETS).catch(() => {
      // Non-critical, ignore errors
    });
  }

  /**
   * Background preload for Scene 2/3 assets (call during Act1)
   */
  _preloadScene2_3() {
    const preloader = new AssetPreloader();
    preloader.setLabel('Scene2/3');
    preloader.onProgress = (progress) => {
      // Silent progress - only log failures
    };
    preloader.onComplete = (results, failed) => {
      // Logging is done in AssetPreloader
    };
    preloader.preloadAssets(SCENE2_3_PRELOAD_ASSETS).catch(() => {
      // Non-critical, ignore errors
    });
  }

  /**
   * Background preload for Scene 4/5 assets (call during Scene2)
   */
  _preloadScene4_5() {
    const preloader = new AssetPreloader();
    preloader.setLabel('Scene4/5');
    preloader.onProgress = (progress) => {
      // Silent progress - only log failures
    };
    preloader.onComplete = (results, failed) => {
      // Logging is done in AssetPreloader
    };
    preloader.preloadAssets(SCENE4_5_PRELOAD_ASSETS).catch(() => {
      // Non-critical, ignore errors
    });
  }

  /**
   * Background preload for Scene 6/7 assets (call during Scene4)
   */
  _preloadScene6_7() {
    const preloader = new AssetPreloader();
    preloader.setLabel('Scene6/7');
    preloader.onProgress = (progress) => {
      // Silent progress - only log failures
    };
    preloader.onComplete = (results, failed) => {
      // Logging is done in AssetPreloader
    };
    preloader.preloadAssets(SCENE6_7_PRELOAD_ASSETS).catch(() => {
      // Non-critical, ignore errors
    });
  }
}

const game = new Game();
game.start();
