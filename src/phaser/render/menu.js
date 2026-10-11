// A vertical menu, shared by the pause menu and the settings menu.
// Up/down (arrows, W/S, d-pad) choose, Enter/Space/A select.

import { WIDTH } from '../../config.js';
import { wasPressed, onKey } from '../input.js';
import { toggleMute, isMuted } from '../../audio.js';
import { toggleFullscreen, isFullscreen } from '../fullscreen.js';
import { setFixed169, layout } from '../../layout.js';
import { saveOptions, pickOptions } from '../../options.js';
import { label } from './text.js';

/** The display and sound items that both menus share. */
export function settingsItems(session) {
  return [
    { id: 'sound', text: () => `SOUND: ${isMuted() ? 'OFF' : 'ON'}`, run: () => toggleMute() },
    { id: 'fullscreen', text: () => `FULL SCREEN: ${isFullscreen() ? 'ON' : 'OFF'}`, run: () => toggleFullscreen() },
    {
      id: 'ratio',
      text: () => `16:9: ${layout.fixed169 ? 'YES' : 'NO (USE THE WHOLE HEIGHT)'}`,
      run: () => {
        session.ratio169 = !session.ratio169;
        setFixed169(session.ratio169);
        saveOptions(pickOptions(session));
      },
    },
  ];
}

/**
 * `items` are { id, text(), run() }. An item without `run` is only reported
 * as chosen (the caller acts on it). `selected()` returns the id of an item
 * the player just chose, after running its `run`, or null.
 */
export function createMenu(art, { items, y0 = 290, gap = 50, size = 30, active = () => false }) {
  const view = art.container();
  const labels = items.map((_, i) => {
    const l = label(art, '', { size, bold: true, anchorX: 0.5, anchorY: 0.5 });
    l.setPosition(WIDTH / 2, y0 + i * gap);
    art.add(view, l);
    return l;
  });
  let choice = 0;
  let keyboardFullscreen = null;
  const confirmation = ['Enter', 'Space', 'NumpadEnter'];
  const direction = () => ({
    up: ['ArrowUp', 'KeyW', 'PadUp'].some(wasPressed),
    down: ['ArrowDown', 'KeyS', 'PadDown'].some(wasPressed),
  });
  // Request fullscreen in the originating keyboard event, while activation is
  // guaranteed. Apply any pending direction edge exactly as selected() will.
  const dispose = onKey((code, { swallowed }) => {
    if (swallowed || !confirmation.includes(code) || !active()) return;
    const { up, down } = direction();
    const item = items[(choice - Number(up) + Number(down) + items.length) % items.length];
    if (item.id !== 'fullscreen' || keyboardFullscreen === item) return;
    item.run?.();
    keyboardFullscreen = item;
  });
  view.once('destroy', dispose);

  function refresh() {
    items.forEach((item, i) => {
      labels[i].text = `${i === choice ? '▶ ' : '  '}${item.text()}${i === choice ? ' ◀' : '  '}`;
      art.tint(labels[i], i === choice ? 0xffffff : 0x8a93c0);
    });
  }
  refresh();

  return {
    view,
    dispose,
    refresh,
    reset() {
      choice = 0;
      refresh();
    },
    /** Read this step's input. Returns the id of the item chosen, or null. */
    selected() {
      const { up, down } = direction();
      if (up) choice = (choice + items.length - 1) % items.length;
      if (down) choice = (choice + 1) % items.length;
      const chosen = ['Enter', 'Space', 'NumpadEnter', 'PadConfirm'].some(wasPressed) ? items[choice] : null;
      if (chosen?.id === 'fullscreen') {
        // A controller can leave fullscreen, but never enter it using residual
        // activation from an earlier keyboard or pointer gesture.
        if (keyboardFullscreen !== chosen && wasPressed('PadConfirm') && isFullscreen()) chosen.run?.();
      } else chosen?.run?.();
      keyboardFullscreen = null;
      refresh();
      return chosen?.id ?? null;
    },
  };
}
