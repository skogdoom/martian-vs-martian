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
