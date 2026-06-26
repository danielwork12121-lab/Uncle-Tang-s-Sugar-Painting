# 甜叔糖画铺 / Uncle Tong Sugar Painting Game

A browser-based interactive game about traditional Chinese sugar painting (糖画). Built with HTML5 Canvas and Vite.

**Play Online**: https://uncletian.xyz

## Features

- **Story-driven experience**: Follow Uncle Tong through the sugar painting process
- **Multiple cutscenes**: Professional animated videos
- **Interactive mini-games**:
  - Scene 2: Sugar cooking simulation
  - Scene 3: Candy spreading/pouring
  - Scene 5: Circle candy drawing (practice + real order)
  - Scene 7: Dragon candy drawing (advanced)
- **Chinese UI and cultural details**: Authentic sugar painting facts and terminology
- **Web deployment**: Custom domain with Vercel auto-deployment

## Tech Stack

- **Build Tool**: Vite 5.x
- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: HTML5 Canvas, CSS3
- **Deployment**: Vercel (auto-deploy from GitHub)
- **Domain**: Aliyun DNS → Vercel
- **Architecture**: Browser-based static web app

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Opens at `http://localhost:5173`

## Build

```bash
npm run build
```

Output in `/dist` folder.

## Preview Production Build

```bash
npm run preview
```

Opens at `http://localhost:4173`

## Controls

- **Press 1-9 keys** to jump to specific scenes (dev mode)
- **Mouse/touch** to draw candy shapes
- **Click** to progress through story scenes
- **Follow on-screen prompts** for mini-games

## Scene Flow

```
Scene 1 (Intro) → Scene 2 (Cooking) → Scene 3 (Pouring) → 
Scene 4 (Cutscene) → Scene 5 (Practice) → Scene 6 (Cutscene) → 
Scene 5 (Real Order) → Scene 7 (Dragon) → Scene 8 (Reward) → 
Scene 9 (Ending)
```

## Scene Descriptions

- **Scene 1 / Act 1**: Opening intro video sequence
- **Scene 2**: Sugar cooking mini-game
- **Scene 3**: Candy spreading/pouring mini-game
- **Scene 4**: Candy finished cutscene
- **Scene 5 (First Visit)**: Practice circle drawing (any quantity allowed)
- **Scene 6**: Cutscene/transition
- **Scene 5 (Second Visit)**: Real round candy order (requires exactly 2)
- **Scene 7**: Dragon candy order (requires exactly 1)
- **Scene 8**: Dragon drawing cutscene/video
- **Scene 9**: Ending/final scene

## Deployment

### Live Links

- **Custom Domain**: https://uncletian.xyz
- **Vercel Deployment**: https://uncle-tang-s-sugar-painting.vercel.app
- **GitHub Repository**: https://github.com/danielwork12121-lab/Uncle-Tang-s-Sugar-Painting

### Deployment Workflow

1. Push to GitHub `main` branch
2. Vercel automatically deploys from `main`
3. Custom domain (`uncletian.xyz`) points to Vercel through Aliyun DNS records
4. Main public URL: https://uncletian.xyz

## Asset Notes

- **Video optimization**: H.264, AAC, yuv420p, faststart
- **Browser-safe filenames**: Avoid spaces/uppercase extensions
- **Audio compression**: Prefer compressed MP3 over large WAV files
- **Git hygiene**: Do NOT commit `node_modules/` or `dist/`

## Development Rules

1. Inspect first before editing
2. Avoid broad rewrites
3. Keep one source of truth
4. Remove dead code only after confirming unused
5. Do not duplicate scene systems
6. Make small staged patches
7. Preserve working scenes
8. Run `npm run build` before pushing
9. Report exact files changed

## Project Structure

```
/
├── index.html              # Entry point
├── package.json            # Dependencies & scripts
├── vite.config.js         # Vite configuration
├── README.md              # This file
├── PROJECT_SUMMARY.md    # Detailed project documentation
├── SUBMISSION.md          # Submission documentation
├── public/                # Static assets (served as /)
│   └── assets/           # Game assets (videos, images, audio)
├── src/                   # Source code
│   ├── main.js           # Game entry point & scene management
│   ├── scenes/           # Scene implementations
│   └── utils/           # Utilities (AssetPreloader, SceneLoadGate)
└── dist/                 # Build output (gitignored)
```

## License

MIT

---

**Created with ❤️ to celebrate and share the traditional Chinese art of sugar painting (糖画).**
