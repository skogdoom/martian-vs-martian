import { createListView as makeList } from '../listView.js';

export function createListView(art, make) {
  return makeList(art.scope, make);
}
