# Milestone 3: complete procedural artwork

The sixteen original rendering modules now have Phaser implementations in
`src/phaser/render/`. The default URL still runs the Pixi game. Full title,
settings, play, result and tally scene integration is milestone 4.

## Review locally

Run `npm ci` and `npm run dev`, then open the printed URL with
`?engine=phaser&gallery=artwork`. Dismiss the startup overlay.

- Left/right: change artwork page; P: freeze; R: restart; V: toggle 16:9.
- `&art=saucers`, `animals`, `icons`, `drops`, `wolves`, `weapons`, `hud`,
  `menus`, `effects-a`, `effects-b`, or `effects-c`: jump to a page.
- `arena` combines the graphics; `sky` isolates the gradient; `scenery`
  isolates scenery on a flat background for transparent-shape comparisons.
- `&moon=waning`, `quarter`, `waxing`, or `full`: inspect moon phases.
- `&date=2026-12-24`, `2026-12-31`, `2026-06-19`, `2026-05-04`, or
  `2026-10-31`: Christmas, New Year, midsummer, May 4, and Halloween.
  Christmas and Halloween retain their forced full moon.
- Add `&renderer=canvas` to check the Canvas fallback.

This is a render-only preview with fixed world poses. Arena/scenery also exercise
the shooting-star and fighter factories on every date; production scene conditions
(such as fighters only on May 4) are integrated in milestone 4. The calibration round at
`?engine=phaser` and milestone 2 primitive gallery remain available.

## Implementation and ownership

Factories accept an artwork context first, for example
`createSaucerView(art, side)` and `createAnimalView(art, animals)`, and retain their
`view`, `sync`, `tick`, `handle`, `ambient`, `update`, and `render` contracts.
Positions, scales, rotations, visibility and child order use native Phaser
containers. Text uses the milestone 2 monospace metrics and resolution 2.

`createArt(scope)` provides explicit Canvas path recipes displayed by native
Phaser Images. It preserves independent fill/stroke alpha, curved strokes,
negative coordinates and mirrored sprites without emulating Pixi's Graphics API.
Each drawing retains indexed paint slots across clear/redraw. Position and alpha
changes use Image properties; unchanged geometry/color recipes do not upload again.
Solid rectangles stretch a single procedural color pixel, including resizing HUD
bars and laser glows. This avoids a 4096² background canvas for one flat color.
Recipe comparisons round only cache signatures to remove floating-point translation
noise; the supplied geometry remains unchanged.

Static sky is generated once at resolution 1. Small shapes use resolution 4;
large padded paint textures are limited to 4096 pixels per dimension. Paint canvases
use transparent power-of-two padding and WebGL `LINEAR_MIPMAP_NEAREST` filtering
(the nearest mip level with linear sampling) so portrait minification
retains small stars and snowflakes without blending an overly soft adjacent level.
Canvas uses the same supersampled source with high-quality minification scoped
to paint Images; native text and other host objects keep their existing sampling.
Textures are owned by their Images and freed when their native view tree is destroyed.
`scope.repaint` updates an exclusively owned bitmap and its tint variants while
retaining the base texture key. Shared immutable textures cannot be repainted.
Existing animal/list identity caches, rocket/bomb pools and effect caps remain.

Cosmetic randomness has its own stream, independently seeded from browser entropy.
Phaser uses `Math.random` for text texture UUIDs; sharing that stream displaced
seeded animal phases and effects. The comparison harness injects the original
cosmetic seed into the separate stream. Gameplay RNG is never used for rendering.
The arena preview shakes its entire field, including the backdrop, while its HUD
and banners stay anchored.

## Verification

The full development matrix passes 816 artwork/layout cases across all fourteen
pages, four moon phases, six dates, five window shapes, free/fixed layouts, and
WebGL/Canvas at DPR 1/2. Drawing/pose audits, bounded pixel comparisons, preview
controls, negative controls, and separate missing-silhouette checks all pass.

The production build passes 232 artwork/layout cases at the root URL and another
232 under `/martian-vs-martian/`, with WebGL/Canvas at DPR 1/2. A separate run passes
192 longer animation cases across all six dates. Previous milestone regressions
also pass: 60 host/layout checks and 40 primitive-gallery cases (480 compared tiles),
including the existing ownership checks. All 460 tests in 32 files pass, with all
271 original test identities in 30 unchanged files preserved; lint, build, and the
ten-round headless simulator pass.

Artwork ownership passes 100 create/render/destroy transitions in each of the four
renderer/DPR combinations (400 total), with no growth in objects, textures, GPU
wrappers or presentation-store entries. Additional checks cover unchanged redraws,
position/alpha-only animation, solid-rectangle resizing, object identity caches,
rocket/bomb pools, mutable tinted textures, and popup expiration.

`scripts/phaser/pixi_artwork.js` invokes the unchanged real Pixi factories with
shared input poses. `artwork_audit.js` records actual Pixi drawing calls and compares
them with Phaser paint recipes and native view hierarchy. The audit covers shapes,
curves, stroke/fill order, colors, opacity, positions, scales, rotations, visibility,
label content/style/origins, and animation time. Numeric values match within 1e-8;
the previously documented native text width rounding is below one logical pixel,
including the green-man speech bubble that measures its label.

Screenshots supplement the audit. Flat interiors permit at most three RGB levels;
coverage/blending differences are confined to reference pixel/geometry edges within
`ceil(3 * layout scale * DPR)` device pixels. Silhouettes use brightness hysteresis
(16 for definite foreground, 3 for possible foreground, matching the flat-color
tolerance) to avoid treating alpha rounding as a missing shape. Geometry edges come
from the real Pixi drawing calls,
including occluded particles and shapes whose subpixel coverage rounded to zero;
flat shape interiors remain checked. Geometry-edge allowances never exempt
a missing reference silhouette, including tiny bright fragments. For monospace
text below eight device pixels tall, non-space cells from the audited reference
metrics define the additional geometric edge band: texture minification can round
a caption fragment away in Pixi while Canvas retains it. Larger labels retain the
pixel-edge check, and content/style/position audits apply to every label. Clipped
fragments and filtering at image boundaries are allowed only within the same bounded
image-edge band. Gradient-only frames require at most two RGB
levels of error. Scenery is additionally checked against a flat background so the
sky gradient cannot conceal missing stars, snow, flags, lanterns or fireworks.
Negative controls confirm that removing a saucer, adding an interior color, moving
a view, deleting a recipe, or changing a label all fail the comparison.

Reproduce the browser checks with a Vite dev server running:

```sh
python -m pip install -r scripts/phaser/requirements.txt
python scripts/phaser/check_artwork.py --batch-uploads --base-url http://127.0.0.1:5173/
python scripts/phaser/check_artwork.py --batch-uploads --base-url http://127.0.0.1:5173/ --motion-only
python scripts/phaser/check_artwork.py --batch-uploads --base-url http://127.0.0.1:5173/ --phaser-url http://127.0.0.1:4173/ --smoke
python scripts/phaser/check_primitives.py --base-url http://127.0.0.1:5173/
python scripts/phaser/check_host.py --base-url http://127.0.0.1:5173/
```

`--batch-uploads` delays redundant GPU uploads between screenshots while every
60 Hz update, real Canvas drawing operation, transform and cosmetic RNG call still
runs. Before capture it uploads final sources through the normal Phaser API and
renders normally. Lifecycle/pool checks use normal uploads throughout. Christmas
portrait arena/scenery screenshots are byte-identical with batching enabled and
disabled. Omit the flag to exercise every intermediate upload on faster hardware.
This gate measures fidelity and ownership, not frame-rate performance.

Reports and screenshots are written to a temporary directory; frozen
`baselines/pixi/` references are never overwritten. `validation.json` records the
completed runs and preserved original source/test identities. Selected comparison
images are included here for review.

| Artwork | Pixi reference | Phaser |
| --- | --- | --- |
| Combined arena | [Pixi](arena-pixi.png) | [Phaser](arena.png) |
| Animals and layering | [Pixi](animals-pixi.png) | [Phaser](animals.png) |
| Saucer poses | [Pixi](saucers-pixi.png) | [Phaser](saucers.png) |
| Power-up icons | [Pixi](powerups-pixi.png) | [Phaser](powerups.png) |
| Weapons | [Pixi](weapons-pixi.png) | [Phaser](weapons.png) |
| HUD | [Pixi](hud-pixi.png) | [Phaser](hud.png) |
| Effects | [Pixi](effects-pixi.png) | [Phaser](effects.png) |
| Christmas | [Pixi](christmas-pixi.png) | [Phaser](christmas.png) |
| New Year | [Pixi](new-year-pixi.png) | [Phaser](new-year.png) |
| Midsummer | [Pixi](midsummer-pixi.png) | [Phaser](midsummer.png) |
| May 4 | [Pixi](may4-pixi.png) | [Phaser](may4.png) |
| Halloween | [Pixi](halloween-pixi.png) | [Phaser](halloween.png) |
| Christmas portrait | [Pixi](portrait-pixi.png) | [Phaser](portrait.png) |
| Canvas DPR 2 portrait, fixed 16:9 | [Pixi](portrait-fixed-pixi.png) | [Phaser](portrait-fixed.png) |

Performance acceptance on physical hardware remains milestone 6. Paint slots retain
per-shape blending and can use more texture objects than the original Graphics
batches; this milestone establishes fidelity and bounded resource ownership.
Firefox/WebKit remain unverified under the existing cloud browser limitation.
