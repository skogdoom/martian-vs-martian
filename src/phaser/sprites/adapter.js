import world from '../../../assets/cartoon/world.json';
import extras from '../../../assets/cartoon/extras.json';
import logo from '../../../assets/cartoon/logo.json';
import fx from '../../../assets/cartoon/fx.json';

const sheets = { 'cartoon-world': world, 'cartoon-extras': extras, 'cartoon-logo': logo, 'cartoon-fx': fx };
export const FRAME_SHEETS = Object.fromEntries(
  Object.entries(sheets).flatMap(([key, sheet]) => Object.keys(sheet.frames).map((frame) => [frame, key])),
);

export function createSpriteAdapter(art, preferences) {
  function frame(image, name) {
    const key = FRAME_SHEETS[name];
    if (!key) throw new Error(`Invalid animation frame ${name}`);
    if (image.getData('cartoon-frame') === name) return;
    const w = image.displayWidth;
    const h = image.displayHeight;
    art.scope.atlasFrame(image, name, key);
    image.setData('atlas', key).setData('cartoon-frame', name);
    image.setDisplaySize(w, h);
  }
  function sprite(name, w, h, x = 0, y = 0, ox = 0.5, oy = 0.5) {
    const key = FRAME_SHEETS[name];
    if (!key) throw new Error(`Unknown cartoon sprite ${name}`);
    return art.scope
      .atlasImage(key, name)
      .setData('atlas', key)
      .setData('cartoon-frame', name)
      .setDisplaySize(w, h)
      .setPosition(x, y)
      .setOrigin(ox, oy);
  }
  return { preferences, sprite, frame };
}

// Reusable atlas slots for effects. Positions, colors and alpha are native Image
// properties. No per-frame canvas painting, atlas changes or texture uploads.
export function createSpriteSurface(art, { dot = 'fx-dot', ring = 'fx-ring' } = {}) {
  const view = art.container();
  const pool = [];
  let used = 0;
  function paint(name, x, y, w, h, style, angle = 0) {
    let slot = pool[used];
    if (!slot) {
      slot = { image: art.sprites.sprite(name, w, h), name };
      pool.push(slot);
      art.add(view, slot.image);
    } else if (slot.name !== name) {
      art.sprites.frame(slot.image, name);
      slot.name = name;
    }
    const image = slot.image;
    image
      .setDisplaySize(Math.max(0.1, w), Math.max(0.1, h))
      .setPosition(x, y)
      .setRotation(angle)
      .setAlpha(style.alpha ?? 1)
      .setVisible(true);
    const color = style.fill ?? style.stroke ?? 0xffffff;
    if (art.color(image) !== color) art.tint(image, color);
    used++;
    return surface;
  }
  const surface = {
    view,
    clear() {
      for (let i = 0; i < used; i++) pool[i].image.visible = false;
      used = 0;
      return this;
    },
    circle(x, y, r, style) {
      const color = style.fill ?? 0xffffff;
      const red = (color >> 16) & 255;
      const green = (color >> 8) & 255;
      const blue = color & 255;
      const high = Math.max(red, green, blue);
      const smoke = dot === 'fx-dot' && r >= 3 && high < 220 && high - Math.min(red, green, blue) < 32;
      return paint(style.stroke === undefined ? (smoke ? 'fx-smoke' : dot) : ring, x, y, r * 2, r * 2, style);
    },
    ellipse(x, y, rx, ry, style) {
      return paint(style.stroke === undefined ? dot : 'fx-beam-ring', x, y, rx * 2, ry * 2, style);
    },
    rect(x, y, w, h, style) {
      return paint('fx-confetti', x + w / 2, y + h / 2, w, h, style);
    },
    polygon(points, style) {
      let left = Infinity,
        top = Infinity,
        right = -Infinity,
        bottom = -Infinity;
      for (let i = 0; i < points.length; i += 2) {
        left = Math.min(left, points[i]);
        right = Math.max(right, points[i]);
        top = Math.min(top, points[i + 1]);
        bottom = Math.max(bottom, points[i + 1]);
      }
      return paint('fx-spark', (left + right) / 2, (top + bottom) / 2, right - left, bottom - top, style);
    },
    curve(commands, style) {
      const [, x0, y0] = commands[0];
      const [, x1, y1] = commands.at(-1);
      return paint(
        'fx-trail',
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        Math.hypot(x1 - x0, y1 - y0),
        (style.width ?? 1) * 3,
        style,
        Math.atan2(y1 - y0, x1 - x0),
      );
    },
  };
  return surface;
}

export function createStyleSurface(art, options = {}, dynamic = true) {
  const classic = dynamic ? art.dynamicGraphics() : art.graphics();
  if (!art.sprites)
    return {
      view: classic,
      get draw() {
        return art.draw(classic);
      },
    };
  const cartoon = createSpriteSurface(art, options);
  const view = art.container();
  art.add(view, classic, cartoon.view);
  return {
    view,
    get draw() {
      const useClassic = art.sprites.preferences.classic;
      classic.visible = useClassic;
      cartoon.view.visible = !useClassic;
      return useClassic ? art.draw(classic) : cartoon;
    },
  };
}
