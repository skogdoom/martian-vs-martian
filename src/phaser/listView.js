/** Object identity owns one cached view; gone objects remain until list disposal. */
export function createListView(scope, make, parent = scope.root) {
  const view = scope.container(parent);
  const views = new Map();
  view.once('destroy', () => views.clear());
  return {
    view,
    get size() {
      return views.size;
    },
    sync(list, t) {
      for (const obj of list) {
        let sprite = views.get(obj);
        if (!sprite) {
          sprite = make(obj, view);
          scope.attach(view, sprite.view);
          views.set(obj, sprite);
        }
        sprite.sync(obj, t);
      }
    },
  };
}
