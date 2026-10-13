import { createArt } from '../art.js';
import { createSpriteAdapter } from '../sprites/adapter.js';

// Logical disposal removes subscriptions; view destruction releases artwork.
// The host may transfer a disposed scene's native tree to the round result.
export function withSceneScope(game, build) {
  const scope = game.presentation.scope();
  try {
    const art = createArt(scope);
    art.sprites = createSpriteAdapter(art, game.graphics);
    return build(art, scope);
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
