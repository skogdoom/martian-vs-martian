// Optional comparison server. This config is never used by the normal build.
import { defineConfig, normalizePath } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalizePath(fileURLToPath(new URL('../../', import.meta.url)));
const archive = `${root}references/pixi/`;
const retired = new Set(JSON.parse(readFileSync(`${archive}archive.json`, 'utf8')).files.map((row) => row.original));
const pixi = `${archive}node_modules/pixi.js/lib/index.mjs`;
if (!existsSync(pixi)) throw Error('Install the optional Pixi reference with: npm ci --prefix references/pixi');

export default defineConfig({
  root,
  base: './',
  cacheDir: `${archive}node_modules/.vite`,
  optimizeDeps: { entries: ['index.html'] },
  resolve: { alias: [{ find: /^pixi\.js$/, replacement: pixi }] },
  plugins: [
    {
      name: 'retired-pixi-reference',
      enforce: 'pre',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const url = new URL(request.url, 'http://reference');
          const original = url.pathname.slice(1);
          if (!retired.has(original)) return next();
          // Browser-injected harness imports use old absolute URLs. Re-export
          // the canonical archive module so input listeners/state exist once.
          response.setHeader('Content-Type', 'text/javascript');
          response.end(`export * from ${JSON.stringify(`/references/pixi/${original}${url.search}`)};`);
        });
      },
      resolveId(source, importer) {
        const [path, ...query] = source.split('?');
        if (!path.startsWith('.') && !isAbsolute(path)) return;
        let absolute = normalizePath(
          path.startsWith('/src/')
            ? resolve(root, `.${path}`)
            : isAbsolute(path)
              ? path
              : resolve(dirname(importer?.split('?')[0] ?? `${root}index.html`), path),
        );
        if (absolute.startsWith(`${archive}src/`)) absolute = absolute.replace(archive, root);
        if (!absolute.startsWith(`${root}src/`)) return;
        const relative = absolute.slice(root.length);
        // Original shared logic/services stay canonical, so both engines and
        // the fixtures use the same layout, options, audio and simulation modules.
        const resolved = retired.has(relative) ? `${archive}${relative}` : absolute;
        return resolved + (query.length ? `?${query.join('?')}` : '');
      },
      transform(_source, id) {
        if (normalizePath(id.split('?')[0]) === `${root}src/entry.js`)
          return "if(new URLSearchParams(location.search).get('engine')==='phaser') await import('./phaser/main.js'); else await import('/references/pixi/src/main.js');";
      },
    },
  ],
});
