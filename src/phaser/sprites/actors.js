import { SAUCER, ANIMALS, SPOOK, WOLF } from '../../config.js';
import { SIDES } from '../../logic/world.js';
import { createListView } from '../render/listView.js';
import { label } from '../render/text.js';

const GOLD = 0xffcf3a;
const TEAM = { red: 0xff4d59, blue: 0x58b7ff };
const airborne = (a) => ['lifting', 'carried', 'falling', 'descending'].includes(a.state);
const chuteVisible = (a) => a.state === 'descending' || (a.state === 'falling' && a.chute);

export function cartoonSaucer(art, side) {
  const { sprite, frame } = art.sprites;
  const view = art.container();
  const glow = sprite('fx-ring', 82, 38, 0, 3).setAlpha(0.25);
  art.tint(glow, TEAM[side]);
  const aura = sprite('fx-ring', 100, 72, 0, -8);
  art.tint(aura, 0x8dffac);
  const streak = sprite('laser', 58, 12, -60, 2);
  const rocket = sprite('rocket', 24, 14, 0, 21);
  const bomb = sprite('bomb', 16, 23, 0, 25);
  const body = sprite(`saucer-${side}`, SAUCER.radius * 2, SAUCER.top + SAUCER.halfHeight, 0, -8);
  const flash = sprite('impact', 76, 50, 0, -8).setAlpha(0);
  const shield = sprite('fx-ring', 100, 76, 0, -4);
  art.tint(shield, 0x7fe8ff);
  const shock = sprite('fx-shock', 25, 56, 46, 0);
  const stars = Array.from({ length: 4 }, () => sprite('star', 9, 9));
  art.add(view, aura, streak, glow, rocket, bomb, body, flash, ...stars, shield, shock);
  return {
    view,
    sync(s, t, { look = 1, hit = 0, deflect = 0, beam = false, power = null, momentum = 0, ramReady = false } = {}) {
      const stunned = s.stun > 0;
      view.setPosition(s.x, s.y + Math.sin(t * 3 + (side === 'red' ? 0 : 1.7)) * 1.5);
      view.rotation = stunned ? Math.sin(t * 18) * 0.6 : Math.max(-0.25, Math.min(0.25, s.vx / 2000)) + (hit > 0 ? Math.sin(t * 60) * 0.12 * hit : 0);
      frame(body, `saucer-${side}${(t + (side === 'red' ? 0 : 1.9)) % 3.7 < 0.12 ? '-blink' : ''}`);
      glow.alpha = beam ? 0.45 : 0.18 + 0.08 * Math.sin(t * 4);
      flash.alpha = hit * 0.6;
      aura.visible = power !== null;
      aura.alpha = 0.5 + 0.4 * Math.sin(t * 8);
      aura.setScale((100 / aura.width) * (1 + 0.06 * Math.sin(t * 8)), (72 / aura.height) * (1 + 0.06 * Math.sin(t * 8)));
      const speedy = power === 'speed' && Math.abs(s.vx) > 150;
      streak.visible = speedy || momentum > 0.15;
      streak.alpha = speedy ? 1 : Math.min(1, momentum * 1.3);
      streak.x = s.vx >= 0 ? -60 : 60;
      streak.flipX = s.vx < 0;
      rocket.visible = power === 'rocket';
      rocket.flipX = look < 0;
      bomb.visible = power === 'bomb' || power === 'timeBomb';
      frame(bomb, power === 'timeBomb' ? 'timebomb' : 'bomb');
      shield.visible = power === 'shield';
      shield.alpha = 0.55 + 0.2 * Math.sin(t * 5) + 0.45 * deflect;
      shield.setDisplaySize(100 * (1 + 0.03 * Math.sin(t * 5) + 0.08 * deflect), 76 * (1 + 0.03 * Math.sin(t * 5) + 0.08 * deflect));
      shock.visible = ramReady && !stunned;
      shock.setPosition(Math.cos(Math.atan2(s.vy, s.vx)) * 46, Math.sin(Math.atan2(s.vy, s.vx)) * 46);
      shock.rotation = Math.atan2(s.vy, s.vx) - view.rotation;
      shock.alpha = 0.6 + 0.4 * Math.sin(t * 30);
      stars.forEach((star, i) => {
        star.visible = stunned;
        const a = t * 6 + (i * Math.PI) / 2;
        star.setPosition(Math.cos(a) * 22, -26 + Math.sin(a) * 6);
      });
    },
  };
}

function animalSprite(art, a) {
  const { sprite, frame } = art.sprites;
  const view = art.container();
  const cow = a.kind === 'cow';
  const w = cow ? 72 : 49;
  const h = cow ? 49 : 34;
  const glow = sprite('fx-ring', w + 14, h + 10, 0, -h / 2).setAlpha(0.3);
  art.tint(glow, GOLD);
  const chute = sprite('parachute', 56, 64, 0, -h + 4, 0.5, 1);
  const body = sprite(a.kind, w, h, 0, 0, 0.5, 1);
  const collar = sprite('fx-confetti', 7, 10, cow ? 20 : 14, -h * 0.57);
  const badge = sprite('star', 14, 14, 0, -h - 3);
  const fire = Array.from({ length: 4 }, (_, i) => sprite('flame', 16, 24, -18 + i * 12, -h * 0.75, 0.5, 1));
  const alarm = label(art, '!', { size: 22, color: 0xffe14a, bold: true, anchorX: 0.5, anchorY: 1 });
  alarm.y = -h - 2;
  art.add(view, glow, chute, body, collar, badge, ...fire, alarm);
  let facing = a.x < 640 ? 1 : -1;
  let walk = art.random() * 10;
  const wobble = art.random() * 10;
  return {
    view,
    sync(a, t, dt, nervous) {
      view.visible = a.state !== 'gone';
      if (!view.visible) return;
      if (a.vx !== 0) facing = Math.sign(a.vx);
      view.setPosition(a.x + (nervous ? Math.sin(t * 45) * 1.5 : 0), a.y).setScale(facing, 1);
      const aloft = airborne(a);
      if (!aloft) walk += dt * Math.abs(a.vx) * 0.25;
      const pose = aloft ? `${a.kind}-aloft` : a.vx ? `${a.kind}-walk-${Math.sin(walk) >= 0 ? 'a' : 'b'}` : a.kind;
      frame(body, pose);
      view.rotation = aloft ? Math.sin(t * 5 + wobble) * 0.08 : 0;
      glow.visible = Boolean(a.golden);
      glow.alpha = 0.2 + 0.15 * Math.sin(t * 5);
      art.tint(body, a.golden ? GOLD : a.onFire ? 0xb8a898 : 0xffffff);
      chute.visible = chuteVisible(a);
      collar.visible = Boolean(a.owner);
      if (a.owner) art.tint(collar, TEAM[a.owner]);
      badge.visible = Boolean(a.bonus && a.state === 'penned');
      badge.rotation = Math.sin(t * 3) * 0.3;
      alarm.visible = nervous;
      alarm.scaleX = facing;
      fire.forEach((f, i) => {
        f.visible = Boolean(a.onFire);
        f.setDisplaySize(15, 22 + 8 * Math.sin(t * 17 + i * 1.9) + 5 * Math.sin(t * 29 + i));
        f.rotation = Math.sin(t * 11 + i * 2.3) * 0.12;
      });
    },
  };
}

export function cartoonAnimals(art, animals) {
  const view = art.container();
  const sprites = new Map();
  view.once('destroy', () => sprites.clear());
  let last = null;
  return {
    view,
    sync(t, spook = null) {
      const dt = last === null ? 0 : Math.min(0.1, Math.max(0, t - last));
      last = t;
      for (const a of animals) {
        if (!sprites.has(a)) {
          const s = animalSprite(art, a);
          sprites.set(a, s);
          if (a.kind === 'cow') art.addAt(view, s.view, 0);
          else art.add(view, s.view);
        }
        sprites.get(a).sync(a, t, dt, spook !== null && a.state === 'penned' && spook[a.pen] > SPOOK.warn);
      }
    },
  };
}

export function cartoonWolf(art) {
  const { sprite, frame } = art.sprites;
  const view = art.container();
  const chute = sprite('parachute', 56, 64, 0, -38, 0.5, 1);
  const body = sprite('wolf', 78, 49, 0, 0, 0.5, 1);
  const blood = sprite('fx-dot', 5, 4, 33, -13);
  art.tint(blood, 0xb5171f);
  art.add(view, chute, body, blood);
  let facing = 1;
  const wobble = art.random() * 10;
  return {
    view,
    sync(w, t) {
      view.visible = w.state !== 'gone';
      if (!view.visible) return;
      if (w.vx) facing = Math.sign(w.vx);
      view.setPosition(w.x, w.y).setScale(facing, 1);
      const aloft = airborne(w);
      const eating = w.eating > 0;
      const howling = !aloft && !eating && w.bored > WOLF.boredAfter - 1.8;
      const pose = eating ? 'wolf-eat' : howling ? 'wolf-howl' : w.vx && !aloft ? `wolf-walk-${Math.sin(t * 12) >= 0 ? 'a' : 'b'}` : 'wolf';
      frame(body, pose);
      chute.visible = chuteVisible(w);
      blood.visible = eating;
      view.rotation = aloft ? Math.sin(t * 5 + wobble) * 0.1 : 0;
    },
  };
}

export function cartoonBeams(art) {
  const view = art.container();
  const plane = art.dynamicGraphics();
  const rings = Array.from({ length: 8 }, () => art.sprites.sprite('fx-beam-ring', 20, 6));
  art.add(view, plane, ...rings);
  return {
    view,
    sync(world, t) {
      art.draw(plane).clear();
      rings.forEach((r) => (r.visible = false));
      for (const [index, side] of SIDES.entries()) {
        const hook = world.hooks[side];
        const a = hook.target ?? hook.second ?? hook.carrying;
        if (!a) continue;
        const s = world.saucers[side];
        const strength = hook.target ? hook.progress : 1;
        const reach = Math.min(1, strength / 0.12);
        const x0 = s.x;
        const y0 = s.y + SAUCER.halfHeight - 2;
        const x1 = x0 + (a.x - x0) * reach;
        const y1 = y0 + (a.y + 4 - y0) * reach;
        const bottom = ANIMALS.size[a.kind].w / 2 + 12;
        art.draw(plane).polygon([x0 - 10, y0, x0 + 10, y0, x1 + bottom, y1, x1 - bottom, y1], { fill: 0x58cfff, alpha: 0.18 + 0.22 * strength });
        for (let i = 0; i < 4; i++) {
          const u = 1 - ((t * 1.6 + i / 4) % 1);
          const ring = rings[index * 4 + i];
          ring
            .setPosition(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u)
            .setDisplaySize((10 + (bottom - 10) * u) * 2, 6)
            .setAlpha(0.6 * reach)
            .setVisible(true);
        }
      }
    },
  };
}

export function cartoonWolves(art) {
  return createListView(art, () => cartoonWolf(art));
}
