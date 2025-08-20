# Hybrid Paddle Spin (Phaser 3 Arcade) – Implementation Notes

This document explains the minimal, repeatable changes applied to enable deterministic paddle spin and robust paddle collisions while staying entirely on Phaser 3 Arcade Physics (no Planck dependency). Use this to re-apply the same changes on another branch.

Scope: one file updated
- `scenes/GameScene.js`

## Goals
- Deterministic paddle bounce with predictable spin.
- Eliminate double-impulses from Arcade solver on the paddle.
- Prevent tunneling/pass-through, especially near the walls.
- Keep constant ball speed with sane minimum vertical component.
- Provide debug logs and tunable constants.

## Key Changes (what to replicate)

1) Paddle contact: collider -> overlap
- Replace the paddle collider with an overlap and handle the bounce yourself.
- Store the overlap in `this.over_ball_paddle` (useful to toggle for modes):
  - `this.over_ball_paddle = this.physics.add.overlap(this.balls, this.paddle, this.hitPaddle, null, this);`

2) Deterministic paddle bounce with spin (`hitPaddle`)
- Preconditions before bouncing:
  - Ball has a body and is moving downward (vy > 0).
  - Ball center is above the paddle center (avoid back-side triggers).
  - Per-ball cooldown (`ball._nextPaddleHitAt`) to avoid retriggering while overlapping.
- Compute outgoing velocity via vector reflection + spin:
  - Reflect vertical component: `vyOut = -eRest * vyIn`.
  - Add spin on the tangent axis from two sources:
    - Paddle motion: `kMove * paddleVx` (paddle velocity, low-pass filtered).
    - Hit offset: `kOff * hitOffset * |vyIn|` where `hitOffset ∈ [-1,1]` across the paddle.
  - Enforce a minimum angle from horizontal by adjusting components (no random angle jitter).
  - Scale final vector to `ballSpeed` and set with `ball.setVelocity(vx, vy)`.
- Separate the ball just above the paddle using body-aware half sizes; update `body.y` to match sprite y.
- Set per-ball cooldown `ball._nextPaddleHitAt` (~50ms).
- Tag `ball._lastPaddleBounceAt = now` to suppress normalization for ~90ms right after a paddle bounce (preserves the chosen direction).

Tunables inside `hitPaddle`:
- `eRest = 0.98` (vertical restitution on paddle)
- `kMove = 0.38` (paddle motion influence – higher gives stronger spin)
- `kOff = 0.18` (impact offset influence – where you hit across the paddle)
- `minAngleRad = DegToRad(10)` (min angle away from horizontal)

3) Normalize ball speed after non-paddle collisions
- In `worldbounds` handler (for up/left/right) and after `hitBrick`, call `_normalizeBallVelocity(ball)` to keep speed consistent and avoid shallow angles.
- `_normalizeBallVelocity` enforces:
  - Target speed = `this.ballSpeed`.
  - Minimum vertical component (prevents skimmy horizontals).
  - Skips normalization for ~90ms after a paddle bounce using `ball._lastPaddleBounceAt`.

4) Paddle/ball body sizing and anti-tunneling measures
- Increase paddle body size slightly (taller and slightly wider) and recenter offset; improves catch of fast balls and near-wall hits.
- Standardize ball display/body sizes so all ball textures are the same gameplay size:
  - Add `this._ballDiameter = 20` in `_initSceneProperties`.
  - In `_createGameBall`: `setDisplaySize(D, D)` and set physics circle/body to match `D`.

5) Crossing detection fallback in `update()`
- If overlap misses a frame at high speed, detect when the ball crosses the paddle top between frames (using `lastY -> y`) and a swept AABB on X (`lastX -> x` against expanded paddle width), then call `hitPaddle`.
- Expand effective paddle width near the walls (small margin) and clamp ball x to playfield before testing.

6) Paddle velocity smoothing for stable spin
- Track instantaneous `paddleVx` and a low-pass filtered version `this._paddleVxFilt` in `update()` for spin calculation (less jitter).

7) Resize handler hardening
- Register a stored resize handler `this._resizeHandler` that:
  - Checks `this.scene.isActive()` and `this.physics.world` exist before calling `setBounds`.
  - Updates HUD/panel/paddle positions safely.
- Unregister the handler on scene `shutdown`/`destroy` to avoid late calls into a dead scene.

8) Debug logging and toggles
- Build tag in `create()` for quick confirmation: `[BB] GameScene created (HYBRID_SPIN_v0.1)`.
- Log that paddle is in OVERLAP mode.
- On paddle hits, log input/output vectors and spin inputs.
- Throttled logs inside normalization to avoid spam.
- Press `D` in-game to toggle debug logging; persisted via `localStorage('bb_debug')`.

## Where to find each change
- Scene properties (`_initSceneProperties`):
  - Added: `_paddleVxFilt`, `_paddleHitCooldown`, `_ballDiameter`, `_buildTag`, `_debug`, `_resizeHandler`.
- Physics init (`_initWorldPhysics`):
  - Replaced collider with overlap for the paddle.
  - Normalize ball speed after wall hits.
- Input init (`_initInputHandling`):
  - Added `keydown-D` toggle for logs.
- Paddle creation (`_createPlayer`):
  - Increased body size and recenters offset.
- Ball creation (`_createGameBall`):
  - Standardizes size and physics circle; logs created size.
- Paddle hit (`hitPaddle`):
  - Deterministic vector reflection, separation, cooldown, timestamp, logs.
- Update loop (`update`):
  - Low-pass `paddleVx`, crossing detection fallback with swept AABB, near-wall width expansion.
- Helper (`_normalizeBallVelocity`):
  - Target speed, min vertical, 90ms suppression after paddle bounce, throttled logs.
- Resize handling:
  - Guarded handler and cleanup on shutdown/destroy.

## Tuning Cheatsheet (search these in `GameScene.js`)
- Spin strength: `kMove`, `kOff` (inside `hitPaddle`).
- Min angle from horizontal: `minAngleRad` in `hitPaddle`.
- Ball size: `this._ballDiameter` in `_initSceneProperties`.
- Overlap cooldown: `ball._nextPaddleHitAt = now + 50` (adjust ms).
- Post-bounce normalization suppression: `_normalizeBallVelocity` window (~90ms).
- Crossing detection wall margin: `wallInset`.
- Paddle speed filter: `alpha` in `update()` (higher = more responsive).

## How to Re-Apply on Main Branch
1) Copy the sections from `GameScene.js` in this order:
- `_initSceneProperties` additions (debug flags, ball diameter, filter vars).
- `_initWorldPhysics` changes (overlap for paddle, wall normalization calls).
- `_initInputHandling` toggle for `keydown-D`.
- `_createPlayer` body-size adjustments.
- `_createGameBall` standard size + circle body + size log.
- `hitPaddle` full method (deterministic bounce, separation, cooldown, logs).
- `update` block additions (paddleVx filter, crossing detection).
- `_normalizeBallVelocity` helper and calls after walls/bricks.
- Guarded resize handler registration + cleanup.

2) Verify
- Run and open DevTools console. You should see:
  - `[BB] GameScene created (HYBRID_SPIN_v0.1)`
  - `[BB] Paddle contact: OVERLAP mode enabled`
  - `createBall` logs showing uniform sizes (e.g., `20x20`).
- Hit the paddle: logs show `hitPos`, `pvx`, and `in/out` velocity vectors.
- Try near the left wall: crossing-detect logs may appear if the fallback triggers.

## Notes / Gotchas
- Using overlap avoids Arcade impulse stacking, but you must separate the ball above the paddle after setting velocity (done here) and add a short cooldown.
- The 90ms normalization suppression prevents a perceived “late spin” correction.
- If balls still rarely pass through at extreme speeds, increase paddle body height a bit more, or increase the near-wall width expansion margin.

## Optional Enhancements
- Settings toggle to pick between Arcade default bounce and Custom deterministic bounce.
- On-screen mini debug overlay instead of console logs.
- Persist tuning constants in a config file and expose a dev UI slider to tweak spin live.
