# 甜叔糖画铺 / Uncle Tong Sugar Painting Game

## Project Overview

### English Summary

A browser-based interactive game about traditional Chinese sugar painting (糖画). The player follows Uncle Tong through cooking sugar, pouring candy, drawing sugar paintings, adding sticks, and completing customer orders. The game combines story-driven cutscenes with interactive mini-games to teach players about this intangible cultural heritage.

### 中文简介

《甜叔糖画铺》是一款以中国糖画非遗文化为主题的横版网页互动游戏。玩家通过剧情动画和小游戏体验熬糖、摊糖、画糖、插竹签和完成订单的完整流程。游戏将传统手工艺与现代网页技术结合，让玩家在互动中了解糖画艺术。

## Live Links

- **Custom Domain**: https://uncletian.xyz
- **Vercel Deployment**: https://uncle-tang-s-sugar-painting.vercel.app
- **GitHub Repository**: https://github.com/danielwork12121-lab/Uncle-Tang-s-Sugar-Painting

## Tech Stack

- **Build Tool**: Vite 5.x
- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: HTML5 Canvas, CSS3
- **Deployment**: Vercel (auto-deploy from GitHub)
- **Domain**: Aliyun DNS → Vercel
- **Architecture**: Browser-based static web app

## How to Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment Workflow

1. Push to GitHub `main` branch
2. Vercel automatically deploys from `main`
3. Custom domain (`uncletian.xyz`) points to Vercel through Aliyun DNS records
4. Main public URL: https://uncletian.xyz

## Scene/Game Flow

```
Scene 1 → Scene 2 → Scene 3 → Scene 4 → 
Scene 5 (practice) → Scene 6 (cutscene) → 
Scene 5 (real order) → Scene 7 → Scene 8 → Scene 9
```

## Scene Descriptions

### Scene 1 / Act 1: Opening Intro Video
- Plays introductory video sequence
- Two-part video: start video → main cutscene
- Click to skip functionality
- Transitions to Scene 2 when complete

### Scene 2: Sugar Cooking Mini-game
- Interactive sugar boiling simulation
- Player controls temperature and timing
- Success/failure based on cooking state
- Transitions to Scene 3 on success

### Scene 3: Candy Spreading/Pouring Mini-game
- Pour liquid sugar onto cooling plate
- Control spoon angle and speed
- Create even candy sheet
- Transitions to Scene 4 on success

### Scene 4: Candy Finished Cutscene
- Video cutscene showing completed candy
- Hand pointer animation for progression
- Transitions to Scene 5 (practice mode)

### Scene 5 (First Visit): Practice Circle Drawing
- Tutorial mode for drawing sugar paintings
- Player draws circle candy shape
- **Shows practice success popup**
- **Allows any quantity** (practice mode)
- Transitions to Scene 6 after completion

### Scene 6: Cutscene / Transition
- Video cutscene between practice and real order
- Two-part video sequence
- Prepares player for real order
- Transitions back to Scene 5 (real order mode)

### Scene 5 (Second Visit): Real Round Candy Order
- **Does NOT show practice popup**
- **Requires exactly 2 round candies**
- Real order fulfillment
- Wrong quantity shows hints (larger/darker/readable)
- Transitions to Scene 7 after completion

### Scene 7: Dragon Candy Order
- Advanced drawing mini-game
- **Requires exactly 1 dragon candy**
- More complex shape than circle candy
- Wrong quantity shows hints
- Transitions to Scene 8 after completion

### Scene 8: Dragon Drawing Cutscene/Video
- Video cutscene showing dragon candy completion
- Celebration of finished work
- Transitions to Scene 9

### Scene 9: Ending/Final Scene
- Final scene (locked future market)
- Placeholder for expanded gameplay
- Game completion screen

## Current Important Behavior

### Scene 5 Practice Mode (First Visit)
- Shows practice success popup
- Allows any quantity (practice mode)
- No penalty for incorrect drawing

### Scene 5 Real Order (Second Visit)
- Does NOT show practice popup
- Requires **exactly 2 round candies**
- Wrong quantity hints are larger/darker/readable

### Scene 7 Dragon Order
- Requires **exactly 1 dragon candy**
- Wrong quantity hints are larger/darker/readable

### Video Asset Paths (Stable)
- **Act 1 Videos**:
  - `/assets/start/act1-first.mp4`
  - `/assets/start/act1-second.mp4`
- **Scene 6 Videos** (optimized):
  - `/assets/scene6/scene6-first.mp4`
  - `/assets/scene6/scene6-second.mp4`

## Asset/Deployment Notes

### Development Best Practices
- **Avoid local paths**: No `/Users/daniel/...` paths in runtime code
- **Browser-safe filenames**: Avoid spaces/uppercase extensions for deployed assets
- **Video optimization**: Prefer H.264, AAC, yuv420p, faststart
- **Audio compression**: Prefer compressed MP3 over large WAV files
- **Git hygiene**: Do NOT commit `node_modules/` or `dist/`

### Deployment Optimization
- Videos optimized for browser playback (H.264, faststart)
- Assets served from `/public` via Vite
- Vercel CDN for global distribution

## Known Development Rules

1. **Inspect first before editing**
2. **Avoid broad rewrites** - make targeted changes
3. **Keep one source of truth** - avoid duplicated logic
4. **Remove dead code only after confirming unused**
5. **Do not duplicate scene systems**
6. **Make small staged patches**
7. **Preserve working scenes** - don't break what works
8. **Run `npm run build` before pushing**
9. **Report exact files changed** in commit messages

## File Structure

```
/
├── index.html              # Entry point
├── package.json            # Dependencies & scripts
├── vite.config.js         # Vite configuration
├── README.md              # Basic setup instructions
├── PROJECT_SUMMARY.md    # This file
├── SUBMISSION.md          # Submission documentation
├── public/                # Static assets (served as /)
│   ├── assets/
│   │   ├── start/        # Act 1 videos
│   │   ├── scene2/       # Scene 2 assets
│   │   ├── scene3/       # Scene 3 assets
│   │   ├── scene4/       # Scene 4 video
│   │   ├── scene5/       # Scene 5 assets
│   │   ├── scene6/       # Scene 6 videos
│   │   ├── scene7/       # Scene 7 assets
│   │   ├── ui/           # UI elements
│   │   └── stick/        # Candy stick assets
│   └── model graphics/   # 3D model images
├── src/                   # Source code
│   ├── main.js           # Game entry point & scene management
│   ├── scenes/           # Scene implementations
│   │   ├── Act1Scene.js  # Intro video sequence
│   │   ├── Scene2.js     # Sugar cooking
│   │   ├── Scene3.js     # Candy pouring
│   │   ├── Scene4.js     # Cutscene
│   │   ├── Scene5.js     # Candy drawing
│   │   ├── Scene6.js     # Cutscene
│   │   ├── Scene7.js     # Dragon drawing
│   │   ├── Scene8.js     # Reward video
│   │   └── Scene9.js     # Ending
│   └── utils/           # Utilities
│       ├── AssetPreloader.js  # Asset loading
│       └── SceneLoadGate.js   # Loading screen
└── dist/                 # Build output (gitignored)
```

## Development Tools Used

- **CodeBuddy**: Gameplay logic, UI implementation, debugging, deployment preparation
- **ChatGPT**: Planning, prompt writing, debugging guidance, documentation
- **AI-assisted assets**: Visual and audio assets generated with AI tools

## Final Status

✅ Playable online at https://uncletian.xyz  
✅ Custom domain connected and working  
✅ Major videos optimized for browser playback  
✅ Scene order stabilized  
✅ Scene 5 practice/real-order behavior implemented  
✅ Scene 7 dragon order behavior implemented  
✅ Loading screen system implemented  
✅ GitHub → Vercel auto-deployment working  

## Notes for Future Improvement

1. **Improve China mainland loading reliability** if needed (CDN optimization)
2. **Further compress large videos/images** (reduce bundle size)
3. **Improve loading/preload screen behavior** (smoother transitions)
4. **Add more polish to scene transitions** (animations, effects)
5. **Expand Scene 9** (locked future market content)
6. **Add sound effects** to mini-games
7. **Mobile touch optimization** (improve mobile experience)
8. **Add accessibility features** (keyboard navigation, screen reader support)

## License

MIT
