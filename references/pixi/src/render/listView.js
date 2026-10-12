// A view for a list of world objects (drops, wolves, time bombs): a sprite per
// object, made the first time it shows up. The world never removes them, it
// marks them gone, and each sprite hides itself then.

import { Container } from 'pixi.js';

/** `make(obj)` returns a sprite: { view, sync(obj, t) }. */
export function createListView(make) {
  const view = new Container();
  const views = new Map();
  return {
    view,
    sync(list, t) {
      for (const obj of list) {
        let v = views.get(obj);
        if (!v) {
          v = make(obj);
          views.set(obj, v);
          view.addChild(v.view);
        }
        v.sync(obj, t);
      }
    },
  };
}
