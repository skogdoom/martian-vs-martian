import { defineConfig } from 'vite';

// Relative paths, so the build works from any folder: GitHub Pages
// (/martian-vs-martian/), itch.io, or a plain file server.
export default defineConfig({ base: './' });
