import { defineConfig, normalizePath } from 'vite';
import { fileURLToPath } from 'node:url';

const root = normalizePath(fileURLToPath(new URL('.', import.meta.url)));
const entry = `${root}src/entry.js`;

// A review build with one engine. The normal comparison entry stays available
// until the manual acceptance gates pass; deployment continues to use dist/.
function phaserCandidate() {
  return {
    name: 'phaser-candidate',
    transform(_source, id) {
      if (normalizePath(id.split('?')[0]) === entry) return "await import('./phaser/main.js');";
    },
    generateBundle(_options, bundle) {
      const modules = [...new Set(Object.values(bundle).flatMap((file) => (file.type === 'chunk' ? Object.keys(file.modules) : [])))].map((id) =>
        normalizePath(id).replace(root, ''),
      );
      const legacy = modules.filter((id) => /(?:node_modules\/pixi\.js\/|^src\/(?:main\.js|input\.js|fullscreen\.js|render\/|scenes\/))/.test(id));
      if (legacy.length) this.error(`Phaser candidate includes Pixi runtime modules: ${legacy.join(', ')}`);
      if (!modules.some((id) => id.includes('node_modules/phaser/'))) this.error('Phaser candidate does not include the Phaser runtime');
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
export default defineConfig(({ mode }) => ({
  base: './',
  build: { outDir: mode === 'phaser' ? 'dist-phaser' : 'dist' },
  plugins: mode === 'phaser' ? [phaserCandidate()] : [],
}));
