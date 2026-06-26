# 甜叔糖画铺 / Uncle Tong Sugar Painting Game - Submission Documentation

## Project Information

**Project Name**: 甜叔糖画铺 / Uncle Tong Sugar Painting Game

**Public Playable Link**: https://uncletian.xyz

**Backup Link**: https://uncle-tang-s-sugar-painting.vercel.app

## Project Description

### English Description (for judges)

Uncle Tong Sugar Painting Game is a browser-based interactive story game about Chinese sugar painting (糖画), an intangible cultural heritage. Players experience the traditional craft through short animated cutscenes and first-person mini-games, including cooking sugar, spreading candy, drawing sugar paintings, placing sticks, and fulfilling customer orders. The game combines cultural education with interactive entertainment, all within a web browser.

### 中文简介 (for judges)

《甜叔糖画铺》是一款以中国糖画非遗文化为主题的网页互动游戏。玩家将跟随甜叔体验糖画制作流程，通过剧情动画和小游戏完成熬糖、摊糖、画糖、插竹签和接单等步骤。游戏将传统手工艺与现代网页技术结合，让玩家在互动中了解糖画艺术。

## Feature List

✅ **Story-driven sugar painting experience**
- Narrative-driven gameplay following Uncle Tong
- Multiple cutscenes with professional animations
- Cultural context and education about sugar painting

✅ **Multiple cutscenes**
- Scene 1: Opening introduction
- Scene 4: Candy finishing cutscene
- Scene 6: Transition cutscene (two-part video)
- Scene 8: Dragon drawing cutscene

✅ **Cooking sugar mini-game (Scene 2)**
- Interactive sugar boiling simulation
- Temperature and timing mechanics
- Success/failure states with visual feedback

✅ **Candy spreading mini-game (Scene 3)**
- Pour liquid sugar onto cooling plate
- Control spoon angle and speed
- Create even candy sheet

✅ **Drawing mini-games**
- Scene 5: Round candy drawing (practice + real order)
- Scene 7: Dragon candy drawing (advanced)
- Mouse/touch drawing mechanics
- Quantity validation (2 round candies, 1 dragon candy)

✅ **Stick placement / candy completion steps**
- Add bamboo sticks to finished candies
- Timing-based mechanics

✅ **Quantity/order logic**
- Practice mode: no quantity restriction
- Real order mode: exactly 2 round candies required
- Dragon order: exactly 1 dragon candy required
- Wrong quantity hints (larger, darker, readable text)

✅ **Chinese UI and cultural details**
- All UI text in Chinese
- Traditional sugar painting facts during loading screens
- Culturally accurate visuals and assets
- Chinese idioms and expressions

✅ **Web deployment with custom domain**
- Deployed on Vercel
- Custom domain: uncletian.xyz
- Responsive design for desktop and mobile
- Optimized video playback for web

## How to Play

1. **Open the game**: Visit https://uncletian.xyz in your browser

2. **Follow the cutscenes**:
   - Watch the opening introduction (Scene 1)
   - Click to skip or progress through videos

3. **Complete each mini-game**:
   - **Scene 2**: Cook sugar by controlling temperature
   - **Scene 3**: Pour candy sheet by controlling spoon
   - **Scene 5**: Draw round candy (practice first, then real order)
   - **Scene 7**: Draw dragon candy (advanced challenge)

4. **Practice drawing first**:
   - First visit to Scene 5 is practice mode
   - No quantity restrictions
   - Learn the mechanics

5. **Complete real customer candy orders**:
   - Second visit to Scene 5 requires exactly 2 round candies
   - Wrong quantity shows helpful hints

6. **Finish the dragon candy order and ending sequence**:
   - Scene 7 requires exactly 1 dragon candy
   - Watch the celebration cutscene (Scene 8)
   - Reach the ending (Scene 9)

## Development Tools Used

### CodeBuddy (AI Coding Assistant)
- **Gameplay logic implementation**
  - Scene transition system
  - Mini-game mechanics (Scene 2, 3, 5, 7)
  - Quantity validation logic
  - State management

- **UI implementation**
  - Loading screens with Chinese facts
  - Click-to-continue prompts
  - Hand pointer animations
  - Video player controls

- **Debugging**
  - Scene transition debugging
  - Loading screen issues
  - Video playback optimization
  - Console logging system

- **Deployment preparation**
  - Vite configuration
  - Build optimization
  - Asset path management
  - Git workflow

### ChatGPT (AI Language Model)
- **Planning**
  - Game flow design
  - Scene structure planning
  - User experience design

- **Prompt writing**
  - Asset generation prompts
  - Documentation writing
  - Code commenting

- **Debugging guidance**
  - Loading screen troubleshooting
  - Video optimization advice
  - Deployment troubleshooting

- **Documentation**
  - README.md
  - PROJECT_SUMMARY.md (this file)
  - Code documentation

### AI-assisted Visual/Audio Assets
- **Video assets**: AI-assisted video editing and optimization
- **Image assets**: AI-generated or AI-assisted image creation
- **Audio assets**: AI-assisted audio generation or optimization

## Technical Run Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm (v8 or higher)

### Installation
```bash
# Clone the repository
git clone https://github.com/danielwork12121-lab/Uncle-Tang-s-Sugar-Painting.git

# Navigate to project directory
cd Uncle-Tang-s-Sugar-Painting

# Install dependencies
npm install
```

### Development
```bash
# Start development server (with hot reload)
npm run dev

# Opens at http://localhost:5173
```

### Production Build
```bash
# Build for production
npm run build

# Output in /dist folder
```

### Preview Production Build
```bash
# Preview production build locally
npm run preview

# Opens at http://localhost:4173
```

## Deployment Information

### Hosting Platform
**Vercel** - https://vercel.com

### Custom Domain
**uncletian.xyz** - Purchased and configured through Aliyun (Alibaba Cloud)

### DNS Configuration
- Domain purchased from Aliyun
- DNS records point to Vercel
- SSL/TLS certificate auto-managed by Vercel

### Auto-Deployment Workflow
1. Push code to GitHub `main` branch
2. Vercel detects changes
3. Automatic build and deployment
4. Live at https://uncletian.xyz

### Deployment URLs
- **Production**: https://uncletian.xyz
- **Vercel Preview**: https://uncle-tang-s-sugar-painting.vercel.app
- **GitHub Repository**: https://github.com/danielwork12121-lab/Uncle-Tang-s-Sugar-Painting

## Final Status

✅ **Playable online** - Game is live at https://uncletian.xyz  
✅ **Custom domain connected** - uncletian.xyz working properly  
✅ **Major videos optimized for browser playback** - H.264, AAC, faststart  
✅ **Scene order stabilized** - 1 → 2 → 3 → 4 → 5(practice) → 6 → 5(real) → 7 → 8 → 9  
✅ **Scene 5 practice/real-order behavior implemented** - Practice mode vs. real order logic  
✅ **Scene 7 dragon order behavior implemented** - Exactly 1 dragon candy required  
✅ **Loading screen system implemented** - Chinese facts, 10-second minimum for Scene 2  
✅ **Video asset paths stabilized** - No spaces, lowercase extensions  
✅ **GitHub → Vercel auto-deployment working** - Push to main = auto-deploy  

## Project Structure

```
Uncle-Tang-s-Sugar-Painting/
├── index.html                  # Entry point
├── package.json                # Dependencies & scripts
├── vite.config.js             # Vite configuration
├── README.md                  # Basic setup instructions
├── PROJECT_SUMMARY.md        # Detailed project documentation
├── SUBMISSION.md              # This file - submission documentation
├── public/                    # Static assets (served as /)
│   ├── assets/
│   │   ├── start/            # Act 1 videos (act1-first.mp4, act1-second.mp4)
│   │   ├── scene2/           # Scene 2 assets (background, UI, audio)
│   │   ├── scene3/           # Scene 3 assets (background, spoons, audio)
│   │   ├── scene4/           # Scene 4 video (candy-finished-cutscene.mp4)
│   │   ├── scene5/           # Scene 5 assets (background, final candies)
│   │   ├── scene6/           # Scene 6 videos (scene6-first.mp4, scene6-second.mp4)
│   │   ├── scene7/           # Scene 7 assets (background, final dragon)
│   │   ├── ui/              # UI elements (handpointer.png)
│   │   └── stick/            # Candy stick assets
│   └── model graphics/        # 3D model images
├── src/                       # Source code
│   ├── main.js               # Game entry point & scene management
│   ├── scenes/               # Scene implementations
│   │   ├── Act1Scene.js      # Intro video sequence
│   │   ├── Scene2.js         # Sugar cooking mini-game
│   │   ├── Scene3.js         # Candy pouring mini-game
│   │   ├── Scene4.js         # Cutscene (candy finished)
│   │   ├── Scene5.js         # Candy drawing (practice + real)
│   │   ├── Scene6.js         # Cutscene (transition)
│   │   ├── Scene7.js         # Dragon drawing mini-game
│   │   ├── Scene8.js         # Reward video
│   │   └── Scene9.js         # Ending (locked future market)
│   └── utils/               # Utilities
│       ├── AssetPreloader.js  # Asset loading with progress
│       └── SceneLoadGate.js   # Loading screen with Chinese facts
├── dist/                     # Build output (gitignored)
├── node_modules/             # Dependencies (gitignored)
└── .gitignore               # Git ignore file
```

## Known Issues & Limitations

1. **Video autoplay policy**: Some browsers block autoplay, requiring user gesture to start videos
2. **Mobile touch controls**: Drawing mini-games work better with mouse than touch (can be improved)
3. **Loading screen reliability**: Sometimes loading screen doesn't appear (being fixed in recent commits)
4. **Scene 9 placeholder**: Ending scene is a placeholder, waiting for future content

## Notes for Future Improvement

1. **Improve China mainland loading reliability if needed**
   - Add CDN nodes in China
   - Optimize asset delivery for Chinese users

2. **Further compress large videos/images**
   - Reduce file sizes for faster loading
   - Implement progressive video loading

3. **Improve loading/preload screen behavior**
   - Fix loading screen reliability issues
   - Add better progress indicators
   - Smoother transitions between scenes

4. **Add more polish to scene transitions**
   - Add transition animations
   - Improve visual feedback
   - Add sound effects to transitions

5. **Expand Scene 9 (locked future market)**
   - Add more content to ending
   - Unlock new game modes
   - Add replay value

6. **Add sound effects to mini-games**
   - Audio feedback for drawing
   - Sound effects for successful actions
   - Background music for each scene

7. **Mobile touch optimization**
   - Improve touch controls for drawing
   - Better mobile UI layout
   - Touch-friendly buttons and prompts

8. **Add accessibility features**
   - Keyboard navigation
   - Screen reader support
   - High contrast mode
   - Adjustable text size

## Submission Checklist

✅ Game is playable online at https://uncletian.xyz  
✅ Backup link working: https://uncle-tang-s-sugar-painting.vercel.app  
✅ GitHub repository is public and accessible  
✅ All source code is committed and pushed  
✅ README.md includes setup instructions  
✅ PROJECT_SUMMARY.md created with detailed documentation  
✅ SUBMISSION.md created with submission documentation  
✅ Videos are optimized for browser playback  
✅ No broken imports or missing assets  
✅ Game logic is complete and working  
✅ Scene transitions are working properly  
✅ Loading screens are implemented  
✅ Chinese UI is complete and readable  
✅ Quantity validation is working (2 round, 1 dragon)  
✅ Practice mode vs. real order logic is implemented  

## Contact Information

**Developer**: Daniel  
**GitHub**: https://github.com/danielwork12121-lab  
**Live Game**: https://uncletian.xyz  
**Email**: [Your Email Here]  

---

**Thank you for playing 甜叔糖画铺 / Uncle Tong Sugar Painting Game!**

This game was created to celebrate and share the traditional Chinese art of sugar painting (糖画) with the world. Through interactive gameplay and storytelling, we hope to preserve and promote this intangible cultural heritage.

---

**Last Updated**: June 27, 2026  
**Version**: 1.0.0  
**License**: MIT
