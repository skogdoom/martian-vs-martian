# Cartoon artwork

Generated with OpenAI's image generation tool from the concept image supplied
for the `phaser-sprites` branch. These are game-ready atlas PNGs and Phaser JSON
frame maps; no external image service is used by the game.

| Sheet | Frames | Size | Contents |
| --- | ---: | --- | --- |
| `world.png` | 38 | 2048 × 1024 | Saucers, cow, lamb, wolf, alien, parachute, weapons, scenery, decorations and colored effects |
| `extras.png` | 36 | 2048 × 1024 | All 13 power icons, animation poses, package, crate, seasonal props and moon phases |
| `fx.png` | 8 | 1024 × 512 | White/grey tintable particles, rings, sparks, smoke, trails, confetti and shock front |
| `logo.png` | 1 | 2048 × 1024 | Stacked concept title logo and author credit |

The four shipped PNGs total approximately 4.45 MB. RGBA pixels occupy 26 MiB
before mipmaps (approximately 34.7 MiB with a complete mip chain). This excludes
text, scenery gradients and renderer overhead. Source PNGs are retained in
`source/` for art revisions and are not imported into the production build.

The first source sheet follows the user's concept: red and blue saucers with
glass domes, cream animals with pink cow muzzles, friendly aliens, red barns,
wood fences and a navy night farm. The companion sheet uses that first sheet as
its style reference. The logo was isolated from the inspiration image using
background removal, retaining its stacked typography and author credit; neutral VFX allow the renderer
to apply accurate team colors.

Frame names are the stable interface. Animal sprites face right and their
renderer puts the bottom center at the animal's feet. Saucer views retain the
existing center, collision radius and hover/tilt motion. Left-facing poses are
mirrored at runtime; gold, soot and team colors use tint. Walking/aloft poses and
blinking pilots have explicit frames. New graphics do not define physics bodies.

`scripts/pack_cartoon.py` records explicit source rectangles: generated sheets
do not necessarily obey a perfect grid. It crops, trims and packs frames into
power-of-two images with transparent gutters. It resizes the oversized logo and
VFX during packing; it does not redraw the illustrations or change the originals.
With Python and Pillow installed:

```sh
python scripts/pack_cartoon.py
npx prettier --write 'assets/cartoon/*.json'
```

When revising an image, inspect the source and adjust the crop rectangles if its
layout changes. `tests/phaser-graphics.test.js` checks frame coverage, unique
names, bounds and sampling gutters. The main repository license applies.
