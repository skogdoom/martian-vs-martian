/** Phaser 4.2.1 compares an interpolated sampler ID with exact floats. Rotated
 * multi-texture quads can therefore discard interior pixels on SwiftShader.
 * Round the ID in fragment headers using the public shader-addition API. Keep
 * normal multi-texture batching; this host does not use normal-map lighting
 * (which would assign a different meaning to outTexDatum).
 */
export function stabilizeTextureSampling(renderer) {
  if (!renderer.gl) return;
  const manager = renderer.renderNodes.getNode('BatchHandlerQuad').programManager;
  if (manager.getAddition('MvmStableTextureId')) return;
  manager.addAddition({ name: 'MvmStableTextureId', additions: { fragmentHeader: '#define outTexDatum floor(outTexDatum + 0.5)\n' } }, 0);
}

/** Phaser specializes a quad shader for each batch's texture count. New arrivals
 * and Graphics flushes can introduce a previously unused count during play,
 * synchronously compiling/linking a program. Prepare the bounded set at boot,
 * after installing the sampling addition, using the same native shader/VAO cache.
 * Canvas has no programs to prepare. Phaser owns restoration and final disposal.
 */
export function warmRenderPrograms(renderer) {
  if (!renderer.gl) return;
  const quads = renderer.renderNodes.getNode('BatchHandlerQuad');
  const manager = quads.programManager;
  const texture = manager.getAdditionsByTag('TEXTURE')[0];
  const count = manager.getAdditionsByTag('TexCount')[0];
  try {
    for (let n = 1; n <= quads.maxTexturesPerBatch; n++) {
      quads.finalizeTextureCount(n);
      manager.getCurrentProgramSuite();
    }
    renderer.renderNodes.getNode('BatchHandlerTriFlat').programManager.getCurrentProgramSuite();
  } finally {
    manager.replaceAddition(manager.getAdditionsByTag('TEXTURE')[0].name, texture);
    manager.replaceAddition(manager.getAdditionsByTag('TexCount')[0].name, count);
  }
}
