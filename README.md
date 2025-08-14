# Ants Game — v6.10 DEBUG

This is a lightweight HTML5 canvas build set up for drag-and-drop ZIP deployment.

## What’s in this build
- **splat.png** animation spawns **above** the ant on death
- **stain.png** animation spawns **below** the ant on death
- Both effects spawn with **random rotation**
- **Pop** sound uses WebAudio with **±200 cents** random pitch variation per death
- Simple debug overlay (toggle with **D**). Click an ant to splat it.

## How to use
1. Replace the placeholder art in `assets/` with your real `splat.png` and `stain.png`.
2. If your splat/stain are sprite sheets, adjust the `SPRITES` config in `js/game.js`:
   - `frameWidth`, `frameHeight`, and `frames` per sprite.
3. Zip the folder and drag the ZIP onto your existing `deploy.bat`.
   - Or use the ZIP I provided directly.

## Controls
- **Click** an ant to kill it (spawns stain below, splat above, plays pop with pitch variation).
- **D** toggles debug overlay.
- **S** spawns a test ant.

