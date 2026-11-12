# MAP01 «Алғашқы іздер / Первые следы» — 2D top-down

Flow: `/` → «Саяхатты бастау» → «Жаңа саяхат» → motion-comic intro → `/rpg.html?new=1` (MAP01).
The old DoomGeneric FPS is no longer launched from the menu; its files stay in the repo as the Beta 0.1 archive.
The game page fills the whole window; real browser fullscreen turns on at the first key/click (browsers require a gesture). HUD and hotbar are inside the game frame.

## Architecture
- `scripts/rpgart/` — Python (Pillow) pixel-art generator: one palette for tiles, autotile fringes, cliffs, props,
  8-direction animated characters (5 drawn views + mirroring), animals, FX, item icons and dialogue portraits.
  `python scripts/rpgart/build.py` → `public/art/rpg/atlas.png`, `src/rpg/gen/atlas.{hpp,js}`.
  `python scripts/rpgart/map01.py` → `src/rpg/gen/map01.{hpp,js}` (112×108 tiles: overworld zones 0–4, cave 5, camp 6).
- `src/rpg/*.hpp, engine.cpp` — C++17 → standalone WASM (`npm run engine:rpg`): camera, atlas blitting, lighting
  (ambient + fire/torch/glow lights, cloud shadows), particles, NPC routines, animals, 4 enemy types (wolf pack,
  spear stranger, archer, cave bear with roar/charge/stun), sword/spear/bow, hold-interactions, triggers, events,
  co-op peers/enemy snapshots, save v3. `tests/rpg-fixture.cpp` = same engine + test hooks (`--test`).
- `src/rpg/quest.js` — story flags (grow-only, mergeable between co-op peers), world state, handlers, cutscenes.
- `src/rpg/story.js` — kk/ru dialogue (fiction), 5 main quizzes + 5-question bonus quiz (facts with sources).
- `src/rpg/main.js` — loop, HUD/hotbar, dialogue with portraits, skippable cutscenes, quizzes, inventory, minimap, saves.
- `src/rpg/net.js` — co-op 1–3 players: Supabase Realtime broadcast/presence when `VITE_SUPABASE_*` is set,
  otherwise BroadcastChannel (tabs of one browser). First member = host (enemy authority); 4th member refused.

## Checks
`npm test` (WASM movement/collision/interaction/combat/co-op/save + server tests),
`npm run dev` then `node scripts/check-rpg-browser.mjs http://127.0.0.1:5173` (full story, save/reload, 3-tab co-op).
