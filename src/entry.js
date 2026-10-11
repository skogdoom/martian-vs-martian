// Temporary comparison entry. Import only the selected runtime and its services.
const engine = new URLSearchParams(window.location.search).get('engine');
if (engine === 'phaser') await import('./phaser/main.js');
else await import('./main.js');
