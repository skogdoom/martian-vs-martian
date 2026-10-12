import { defineConfig, normalizePath } from 'vite';
import { fileURLToPath } from 'node:url';

const root = normalizePath(fileURLToPath(new URL('.', import.meta.url)));
// Enforce the cutover on the actual production module graph, including Pages.
function phaserOnly() {
  return {
    name: 'phaser-only',
    generateBundle(_options, bundle) {
      const modules = [...new Set(Object.values(bundle).flatMap((file) => (file.type === 'chunk' ? Object.keys(file.modules) : [])))].map((id) =>
        normalizePath(id).replace(root, ''),
      );
      const legacy = modules.filter((id) =>
        /(?:node_modules\/pixi\.js\/|^references\/pixi\/|^src\/(?:main\.js|input\.js|fullscreen\.js|render\/|scenes\/))/.test(id),
      );
      if (legacy.length) this.error(`Production build includes retired Pixi modules: ${legacy.join(', ')}`);
      if (!modules.some((id) => id.includes('node_modules/phaser/'))) this.error('Production build does not include the Phaser runtime');
      this.emitFile({
        type: 'asset',
        fileName: 'engine-build.json',
        source: JSON.stringify({ schema: 1, engine: 'phaser', entry: 'src/phaser/main.js', modules: modules.sort() }, null, 2) + '\n',
      });
    },
  };
}

// Relative paths, so the build works from any folder: GitHub Pages
// (/martian-vs-martian/), itch.io, or a plain file server.
export default defineConfig({
  base: './',
  optimizeDeps: { entries: ['index.html'] },
  plugins: [phaserOnly()],
});
