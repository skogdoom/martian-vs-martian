// Audit actual Pixi calls and Phaser paint recipes as well as screenshots. This
// catches vanished low-alpha particles and paths thinner than a device pixel.
import { Graphics } from 'pixi.js';
import { starPoints, multiplyColor, colorCss } from '../../src/phaser/shapes.js';

const drawings = new WeakMap();
let installed = false;
export function installPaintAudit() {
  if (installed) return;
  installed = true;
  for (const method of [
    'ellipse',
    'circle',
    'rect',
    'roundRect',
    'poly',
    'star',
    'moveTo',
    'lineTo',
    'quadraticCurveTo',
    'bezierCurveTo',
    'closePath',
    'clear',
    'fill',
    'stroke',
  ]) {
    const original = Graphics.prototype[method];
    Graphics.prototype[method] = function (...args) {
      let state = drawings.get(this);
      if (!state) {
        state = { recipes: [], shape: null, commands: [] };
        drawings.set(this, state);
      }
      if (method === 'clear') {
        state.recipes.length = 0;
        state.shape = null;
        state.commands = [];
      } else if (method === 'fill' || method === 'stroke') {
        // Sky gradient has its own pixel gate; UI veil uses native Graphics.
        const option = args[0];
        if (option?.colorStops) return original.apply(this, args);
        const style = typeof option === 'number' ? { [method]: option } : { ...option, [method]: option?.color ?? 0xffffff };
        delete style.color;
        if (state.commands.length) state.recipes.push({ kind: 'curve', values: [state.commands.slice()], style });
        else if (state.shape) state.recipes.push({ ...state.shape, style });
      } else if (['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'closePath'].includes(method)) {
        if (method === 'moveTo') {
          state.commands = [];
          state.shape = null;
        }
        state.commands.push([method, ...args]);
      } else {
        state.commands = [];
        let kind = method,
          values = args;
        if (method === 'circle') {
          kind = 'ellipse';
          values = [args[0], args[1], args[2], args[2]];
        }
        if (method === 'poly') kind = 'polygon';
        if (method === 'star') {
          kind = 'polygon';
          values = [starPoints(...args)];
        }
        state.shape = { kind, values };
      }
      return original.apply(this, args);
    };
  }
}

export function snapshotArtwork(phaser) {
  const scene = window.__game.scene;
  const fixture = phaser ? scene.fixture : scene;
  const art = scene.art;
  let painted = 0,
    labels = 0;
  function node(view) {
    if (phaser && view.type === 'Image') return null;
    const graphic = phaser ? art.isDrawing(view) || view.type === 'Graphics' : view instanceof Graphics;
    const text = phaser ? view.type === 'Text' : view.constructor.name === 'Text';
    const recipes = graphic ? (phaser ? art.recipes(view) : (drawings.get(view)?.recipes ?? [])) : [];
    // The native dimmer's one rectangle is verified by pixels, like the sky.
    const paints = recipes.filter((recipe) => !(recipe.kind === 'rect' && recipe.style.fill === 0 && recipe.values[1] === -400));
    painted += paints.length;
    labels += text ? 1 : 0;
    let effective = 0xffffff;
    if (text && !phaser) for (let parent = view; parent; parent = parent.parent) effective = multiplyColor(effective, parent.tint ?? 0xffffff);
    const children = (phaser ? view.list : view.children) ?? [];
    return {
      kind: text ? 'text' : graphic ? 'paint' : 'container',
      x: view.x,
      y: view.y,
      scaleX: phaser ? view.scaleX : view.scale.x,
      scaleY: phaser ? view.scaleY : view.scale.y,
      rotation: view.rotation,
      alpha: Math.max(0, Math.min(1, view.alpha)),
      visible: view.visible,
      ...(text
        ? {
            text: view.text,
            fontSize: parseFloat(view.style.fontSize),
            fontFamily: view.style.fontFamily,
            fontWeight: phaser ? view.style.fontStyle || 'normal' : view.style.fontWeight,
            align: view.style.align,
            resolution: phaser ? view.style.resolution : view.resolution,
            color: phaser
              ? view.style.color
              : colorCss(multiplyColor(typeof view.style.fill === 'number' ? view.style.fill : view.style.fill.color, effective)),
            width: view.width,
            height: view.height,
            originX: phaser ? view.originX : view.anchor.x,
            originY: phaser ? view.originY : view.anchor.y,
          }
        : {}),
      paints,
      children: children.map(node).filter(Boolean),
    };
  }
  return { tree: node(fixture.view), painted, labels, world: JSON.stringify(fixture.world), elapsed: fixture.elapsed };
}
