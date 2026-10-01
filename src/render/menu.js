// A vertical menu, shared by the pause menu and the settings menu.
// Up/down (arrows, W/S, d-pad) choose, Enter/Space/A select.

import { Container } from 'pixi.js';
import { WIDTH } from '../config.js';
import { wasPressed } from '../input.js';
import { toggleMute, isMuted } from '../audio.js';
import { toggleFullscreen, isFullscreen } from '../fullscreen.js';
import { setFixed169, layout } from '../layout.js';
import { saveOptions, pickOptions } from '../options.js';
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
export function createMenu({ items, y0 = 290, gap = 50, size = 30 }) {
  const view = new Container();
  const labels = items.map((_, i) => {
    const l = label('', { size, bold: true, anchorX: 0.5, anchorY: 0.5 });
    l.position.set(WIDTH / 2, y0 + i * gap);
    view.addChild(l);
    return l;
  });
  let choice = 0;

  function refresh() {
    items.forEach((item, i) => {
      labels[i].text = `${i === choice ? '▶ ' : '  '}${item.text()}${i === choice ? ' ◀' : '  '}`;
      labels[i].tint = i === choice ? 0xffffff : 0x8a93c0;
    });
  }
  refresh();

  return {
    view,
    refresh,
    reset() {
      choice = 0;
      refresh();
    },
    /** Read this step's input. Returns the id of the item chosen, or null. */
    selected() {
      const up = wasPressed('ArrowUp') || wasPressed('KeyW') || wasPressed('PadUp');
      const down = wasPressed('ArrowDown') || wasPressed('KeyS') || wasPressed('PadDown');
      if (up) choice = (choice + items.length - 1) % items.length;
      if (down) choice = (choice + 1) % items.length;
      const chosen = ['Enter', 'Space', 'NumpadEnter', 'PadConfirm'].some(wasPressed) ? items[choice] : null;
      chosen?.run?.();
      refresh();
      return chosen?.id ?? null;
    },
  };
}
