// The proven padded veil and native menu layer from milestone 2.
import { dimmer as makeDimmer, centerUi as makeCentered } from '../uiLayer.js';

export function dimmer(art, alpha) {
  return makeDimmer(art.scope, alpha);
}

export function centerUi(art, view, first) {
  return makeCentered(art.scope, view, first);
}
