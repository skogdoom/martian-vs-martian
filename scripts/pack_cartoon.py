#!/usr/bin/env python3
"""Mechanically crop and pack the generated artwork; never repaint it.

Requires Pillow. Source rectangles use the actual generated PNG coordinates. Keep the sources for art revisions.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'cartoon'
WORLD = [
    ('saucer-red', (47, 130, 247, 261)),
    ('saucer-blue', (256, 137, 438, 263)),
    ('cow', (446, 140, 636, 281)),
    ('lamb', (653, 172, 833, 288)),
    ('wolf', (848, 143, 1048, 292)),
    ('alien', (1068, 131, 1203, 294)),
    ('parachute', (50, 297, 245, 481)),
    ('rocket', (250, 361, 452, 455)),
    ('bomb', (478, 317, 614, 491)),
    ('timebomb', (652, 338, 813, 493)),
    ('star', (850, 329, 1008, 482)),
    ('heart', (1060, 354, 1209, 480)),
    ('shield', (50, 497, 224, 668)),
    ('laser', (250, 544, 468, 638)),
    ('pellet', (480, 510, 616, 658)),
    ('beam-ring', (630, 553, 836, 627)),
    ('flame', (870, 547, 1028, 639)),
    ('explosion', (1054, 512, 1214, 651)),
    ('barn', (40, 679, 252, 836)),
    ('fence', (281, 707, 473, 821)),
    ('flag-blue', (514, 669, 626, 833)),
    ('flag-red', (679, 671, 794, 833)),
    ('flag-blue-cloth', (535, 684, 626, 769)),
    ('flag-red-cloth', (694, 685, 794, 769)),
    ('hay', (831, 694, 1020, 833)),
    ('trees', (1044, 668, 1232, 838)),
    ('moon-full', (39, 845, 218, 1019)),
    ('hills', (235, 917, 446, 1000)),
    ('meadow', (460, 905, 671, 996)),
    ('grass', (684, 888, 847, 996)),
    ('smoke', (850, 857, 1049, 1009)),
    ('impact', (1068, 867, 1214, 1007)),
    ('christmas-tree', (35, 1025, 199, 1225)),
    ('pumpkin', (243, 1055, 405, 1208)),
    ('maypole', (442, 1014, 628, 1225)),
    ('fighter', (658, 1072, 848, 1204)),
    ('snowflake', (873, 1038, 1024, 1206)),
    ('spark', (1074, 1052, 1208, 1204)),
]
EXTRA_NAMES = [
    'power-speed', 'power-laser', 'power-triple', 'power-steal', 'power-rocket', 'power-twin',
    'power-bomb', 'power-unlimited', 'power-shield', 'power-cowRain', 'power-lambRain', 'power-timeBomb',
    'power-parachute', 'package', 'crate', 'santa-hat', 'bat', 'battle-station',
    'cow-walk-a', 'cow-walk-b', 'cow-aloft', 'lamb-walk-a', 'lamb-walk-b', 'lamb-aloft',
    'wolf-walk-a', 'wolf-walk-b', 'wolf-eat', 'wolf-howl', 'alien-panic', 'saucer-red-blink',
    'saucer-blue-blink', 'ribbon-red', 'ribbon-blue', 'moon-waning', 'moon-quarter', 'moon-waxing',
]

# Explicit rectangles from the generated PNGs (not an assumed uniform grid).
EXTRA_RECTS = [
    (32, 43, 206, 217),
    (239, 44, 414, 218),
    (441, 43, 615, 218),
    (638, 43, 814, 218),
    (838, 43, 1014, 218),
    (1046, 43, 1222, 219),
    (32, 242, 209, 417),
    (236, 241, 412, 417),
    (441, 241, 614, 417),
    (635, 241, 813, 419),
    (839, 241, 1018, 418),
    (1045, 241, 1225, 419),
    (31, 437, 209, 623),
    (240, 445, 415, 621),
    (433, 452, 615, 617),
    (637, 475, 820, 613),
    (822, 496, 1047, 606),
    (1055, 426, 1219, 619),
    (27, 659, 214, 807),
    (222, 657, 420, 804),
    (431, 650, 613, 804),
    (638, 674, 820, 803),
    (853, 673, 1031, 803),
    (1046, 663, 1219, 797),
    (16, 857, 219, 1012),
    (214, 854, 412, 1013),
    (432, 865, 629, 1012),
    (642, 836, 828, 1017),
    (864, 828, 1027, 1027),
    (1037, 868, 1242, 1007),
    (15, 1061, 223, 1204),
    (240, 1064, 425, 1184),
    (439, 1077, 631, 1195),
    (654, 1041, 809, 1218),
    (919, 1041, 1012, 1217),
    (1062, 1042, 1225, 1217),
]
EXTRAS = list(zip(EXTRA_NAMES, EXTRA_RECTS))

def pack(name, rectangles, width=2048, maximum=248):
    source = Image.open(ROOT / 'source' / f'{name}.png').convert('RGBA')
    atlas = Image.new('RGBA', (width, 2048))
    cursor_x, cursor_y, row_height = 4, 4, 0
    frames = {}
    for key, rect in rectangles:
        cut = (max(0, rect[0] - 2), max(0, rect[1] - 2), min(source.width, rect[2] + 2), min(source.height, rect[3] + 2))
        tile = source.crop(cut)
        bounds = tile.getchannel('A').getbbox()
        if not bounds:
            raise ValueError(f'Empty sprite: {key}')
        tile = tile.crop(bounds)
        if name == 'fx':
            tile.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
        # Four transparent pixels protect linear sampling.
        if cursor_x + tile.width + 4 > atlas.width:
            cursor_x, cursor_y, row_height = 4, cursor_y + row_height + 8, 0
        x, y = cursor_x, cursor_y
        cursor_x += tile.width + 8
        row_height = max(row_height, tile.height)
        if tile.width > maximum or tile.height > maximum:
            raise ValueError(f'Sprite does not fit: {key}')
        atlas.paste(tile, (x, y))
        frames[key] = {
            'frame': {'x': x, 'y': y, 'w': tile.width, 'h': tile.height},
            'rotated': False, 'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': tile.width, 'h': tile.height},
            'sourceSize': {'w': tile.width, 'h': tile.height},
        }
    height = 2 ** (cursor_y + row_height + 4 - 1).bit_length()
    atlas = atlas.crop((0, 0, width, height))
    atlas.save(ROOT / f'{name}.png', optimize=True)
    data = {'frames': frames, 'meta': {'image': f'{name}.png', 'format': 'RGBA8888', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'}}
    (ROOT / f'{name}.json').write_text(json.dumps(data, indent=2) + '\n')
    print(f'{name}: {len(frames)} frames, {(ROOT / f"{name}.png").stat().st_size:,} bytes')


if __name__ == '__main__':
    pack('world', WORLD)
    pack('extras', EXTRAS)
    pack('fx', [
        ('fx-dot', (106, 185, 385, 461)), ('fx-ring', (468, 85, 862, 492)),
        ('fx-spark', (901, 116, 1337, 508)), ('fx-smoke', (1373, 154, 1760, 489)),
        ('fx-trail', (7, 592, 527, 802)), ('fx-confetti', (589, 588, 769, 790)),
        ('fx-beam-ring', (863, 592, 1371, 801)), ('fx-shock', (1404, 501, 1740, 873)),
    ], width=1024, maximum=240)
    source = Image.open(ROOT / 'source' / 'logo.png').convert('RGBA')
    # The concept logo is a transparent cutout, retaining its stacked layout.
    bounds = source.getchannel('A').getbbox()
    if not bounds:
        raise ValueError('Empty concept logo')
    tile = source.crop(bounds)
    tile.thumbnail((2040, 1016), Image.Resampling.LANCZOS)
    width = 2 ** (tile.width + 8 - 1).bit_length()
    height = 2 ** (tile.height + 8 - 1).bit_length()
    atlas = Image.new('RGBA', (width, height))
    atlas.paste(tile, (4, 4))
    atlas.save(ROOT / 'logo.png', optimize=True)
    data = {'frames': {'logo': {'frame': {'x': 4, 'y': 4, 'w': tile.width, 'h': tile.height}, 'rotated': False, 'trimmed': False}},
            'meta': {'image': 'logo.png', 'format': 'RGBA8888', 'size': {'w': width, 'h': height}, 'scale': '1'}}
    (ROOT / 'logo.json').write_text(json.dumps(data, indent=2) + '\n')
