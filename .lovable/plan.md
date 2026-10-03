# Train access and realistic districts

## What will change
- Add a live **Train Roof** destination to the M menu that follows the lead car and places the player securely on its moving roof.
- Make train boarding and riding more forgiving with a wider roof catch area, reliable carry-through-corners, and an obvious low platform/step at the station.
- Restyle the railway with concrete supports, steel rails, sleepers, platform markings, and restrained safety lighting.
- Replace the airport’s blocky neon jets with recognizable aircraft silhouettes, realistic runway markings/lights, terminal apron details, and grounded materials.
- Restyle the gaming zone as a believable entertainment district: concrete/glass venues, street-level signs, awnings, roof equipment, and limited accent lighting instead of floating neon cubes.
- Keep the dense layered city, Laser Tag Arena, gameplay layout, coordinates, loot, and collision system intact.

## Technical details
- Extend teleport requests to support a live train target, resolved inside the game loop from the current lead-car transform.
- Add a short rider attachment grace period and local-space roof bounds so riders stay attached during track corners.
- Add focused procedural landmark meshes and track details while preserving instancing and the existing performance budget.
- Verify the M-menu flow, train teleport/riding, and airport/gaming-zone appearance in the running game at desktop and the current compact viewport.
