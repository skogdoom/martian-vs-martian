import { createArt } from '../art.js';

// Logical disposal removes subscriptions; view destruction releases artwork.
// The host may transfer a disposed scene's native tree to the round result.
export function withSceneScope(game, build) {
  const scope = game.presentation.scope();
  try {
    return build(createArt(scope), scope);
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
