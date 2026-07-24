# 🥐 Brawl Buns

A slingshot **physics duel**. The Crumb Monster stole the cereal and hid in a junk-food fortress — fling your angry breakfast buns and **smash it to crumbs**. Local **2-player**: both players demolish the *same* fort; highest score wins. Original characters (not Angry Birds), built to be juicier.

## Play it

**Browser (no setup):** double-click `START-BRAWL-BUNS.bat` in the repo root — it opens in your browser. Or just open `games/brawl-buns/index.html`.

**Desktop app (Electron window):**
```bash
cd games/brawl-buns/desktop
npm install        # first time only
npm start
```
Or double-click `START-BRAWL-BUNS-DESKTOP.bat` in the repo root.

## How to play
- **Drag** a bun back on the slingshot, aim with the trajectory dots, **release** to fire.
- Knock out the little monsters and **demolish the fort**. Destruction = points.
- Chain destruction fast for a **COMBO** multiplier (🔥 x2, x3…).
- Each player gets **5 buns** on the **same** fort. Clear all monsters early for a leftover-bun **bonus**.
- **R** restarts your turn. Highest total wins the duel → **Rematch** or **Menu**.

## The hook (why it beats the birds)
**Juicy destructible physics.** Real 2D rigid-body simulation (Matter.js) — stacked chocolate bars, dough planks, and glass jars that crack, topple, and chain-react. Combos reward big satisfying collapses.

## Tech
- **HTML5 Canvas** + **[Matter.js](https://brm.io/matter-js/)** (bundled locally, MIT) for physics.
- Custom themed rendering (emoji characters, cracking blocks, particle debris, screen shake, trajectory preview).
- `index.html` (shell/UI) · `game.js` (engine + gameplay) · `matter.min.js` (physics) · `desktop/` (Electron wrapper).
- Self-contained and offline. `window.BrawlBuns` exposes a small test hook (`_tick`, `autoFire`) used to verify physics headlessly.

## Roadmap ideas
- More levels + a level select; star ratings.
- Special-ability buns (split-shot, bomb, boomerang).
- Sound design (Web Audio thuds/pops).
- Online duel + shareable levels.
- Package a real `.exe` installer (electron-builder).
