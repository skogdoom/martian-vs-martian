# Optional Pixi regression reference

The normal game uses Phaser. This package preserves the 24 retired Pixi host,
input/fullscreen, scene and drawing files byte-for-byte from the pre-cutover
branch. `archive.json` maps their original paths and SHA-256 hashes. The original
24 shared logic/service files remain canonical in `src/`, and all 271 original
tests remain in their unchanged test files. Frozen baseline evidence is unchanged.

Pixi 8.21.0 and its exact pre-cutover transitive dependencies are locked here. This
package is not a workspace or a root dependency. Normal `npm ci`, builds and Pages
deployment neither install it nor ship it. Install it only for comparison work:

```sh
npm ci
npm ci --prefix references/pixi
npm run dev:pixi-reference -- --port 5174
```

The reference server defaults to Pixi and supports `?engine=phaser` for the retained
comparison drivers. Its config aliases retired source paths to this archive and
shared imports to the canonical logic/services. Old browser-injected module URLs
re-export the canonical archived module, so input state/listeners exist once.
Archived game files are not rewritten. This config is separate from the normal
Vite config and is never used by the production build.

Existing reference tools can use this server, with normal Phaser development or
production as their candidate. For example:

```sh
python scripts/phaser/check_scene_logic.py --base-url http://127.0.0.1:5174/
python scripts/phaser/check_artwork.py \
  --base-url http://127.0.0.1:5174/ --phaser-url http://127.0.0.1:5173/ \
  --quick --pages saucers animals wolves icons drops weapons hud scenery --batch-uploads
```

For the browser performance comparison, start the normal dev server and production
preview separately, then open its developer benchmark with both server URLs:

```text
/scripts/phaser/benchmark.html?profiles=ordinary,combined&seconds=60&repeats=3&pixi-url=http://localhost:5174/&phaser-url=http://localhost:4173/
```

Use the actual ports and base URLs ending in `/`. The report labels Pixi reference
**development** versus Phaser **production**; this is not a matched production
comparison. `pixi-url` is required after cutover. The reference package is optional
and no part of these tools is imported by the normal game entry.
