// A stable view lets a settings change replace just the art, even mid-round.
// Classic audit galleries omit the sprite adapter and retain their exact tree.
export function variant(art, classic, cartoon) {
  if (!art.sprites) return classic();
  const view = art.container();
  let current;
  let style;
  function ensure() {
    const next = art.sprites.preferences.classic;
    if (current && next === style) return current;
    current?.destroy?.();
    current?.view.destroy();
    style = next;
    current = (style ? classic : cartoon)();
    view.setData('variant-view', current.view);
    art.add(view, current.view);
    return current;
  }
  ensure();
  const unsubscribe = art.sprites.preferences.subscribe(ensure);
  view.once('destroy', () => {
    unsubscribe();
    current?.destroy?.();
  });
  return {
    view,
    sync: (...args) => ensure().sync?.(...args),
    tick: (...args) => ensure().tick?.(...args),
    update: (...args) => ensure().update?.(...args),
    render: (...args) => ensure().render?.(...args),
  };
}
