// Render every supported batch texture count through the actual native renderer.
// A startup-only shader fix must prepare all counts, including ones not used by
// the title scene, without creating more programs or VAOs as effects alternate.
export function checkRenderPrograms(host, draw) {
  const renderer = host.game.renderer;
  if (!renderer.gl) return { applicable: false, reason: 'Canvas has no WebGL programs' };
  const node = renderer.renderNodes.getNode('BatchHandlerQuad');
  const factory = renderer.shaderProgramFactory;
  const original = factory.createShaderProgram;
  const before = { programs: renderer.glProgramWrappers.length, vaos: renderer.glVAOWrappers.length };
  let compiled = 0;
  factory.createShaderProgram = function (...args) {
    compiled++;
    return original.apply(this, args);
  };
  const scope = host.presentation.scope();
  scope.root.addToDisplayList();
  const visible = host.root.visible;
  host.root.visible = false;
  try {
    const images = [];
    for (let i = 0; i < node.maxTexturesPerBatch; i++) {
      const image = scope.bitmap(
        { x: 0, y: 0, width: 8, height: 8 },
        (ctx) => {
          ctx.fillStyle = `rgb(${i * 8}, 128, 255)`;
          ctx.fillRect(0, 0, 8, 8);
        },
        { resolution: 1 },
      );
      image.setPosition(250 + i * 12, 300).setVisible(false);
      images.push(image);
    }
    scope.graphics().fillStyle(0xffffff).fillTriangle(250, 320, 260, 330, 270, 320);
    for (let repeat = 0; repeat < 2; repeat++) {
      for (const image of images) image.visible = false;
      for (const image of images) {
        image.visible = true;
        draw();
      }
    }
    const after = { programs: renderer.glProgramWrappers.length, vaos: renderer.glVAOWrappers.length };
    if (compiled !== 0 || before.programs !== after.programs || before.vaos !== after.vaos)
      throw new Error(`Shader compilation during rendering: ${JSON.stringify({ compiled, before, after })}`);
    return {
      applicable: true,
      texture_counts_checked: images.length,
      repeats: 2,
      programs: after.programs,
      vaos: after.vaos,
      compilations_during_draw: compiled,
    };
  } finally {
    factory.createShaderProgram = original;
    scope.dispose();
    host.root.visible = visible;
    draw();
  }
}
