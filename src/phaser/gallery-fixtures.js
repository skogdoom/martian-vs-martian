export const GALLERY_TIME = 1.25;
export const GALLERY_BACKGROUND = 0x101c3d;
export const GALLERY_ITEMS = [
  'saucer-red',
  'saucer-blue',
  'cow',
  'lamb',
  'wolf',
  'parachute',
  'glow',
  'paths',
  'gradient',
  'text-left',
  'text-center',
  'nested-tint',
];

export function tilePosition(index) {
  return { x: 160 + (index % 4) * 320, y: 145 + Math.floor(index / 4) * 215 };
}

export const TEXT_LINES = 'RED ↑ BLUE\n∞ × — !';
