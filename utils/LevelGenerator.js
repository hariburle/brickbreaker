// Simple procedural level generator with seeded RNG and responsive grid sizing
// Exposes window.LevelGenerator.generateLevel({ levelNumber, viewport: { width, height }, seed })
(function () {
  function mulberry32(a) {
    return function () {
      var t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function choose(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  function computeGridSize(viewport) {
    const { width, height } = viewport;
    const isMobileish = Math.min(width, height) <= 500;
    const targetCell = isMobileish ? 50 : 56; // px per brick cell target
    const cols = clamp(Math.round(width / targetCell), 6, 16);
  const brickRegionH = Math.floor(height * 0.38);
    const rows = clamp(Math.floor(brickRegionH / targetCell), 4, 10);
    return { cols, rows, targetCell };
  }

  function pickPattern(levelNumber, rng) {
    if (levelNumber === 1) return 'stripes';
    if (levelNumber <= 3) return choose(rng, ['stripes', 'checker']);
    if (levelNumber <= 6) return choose(rng, ['checker', 'pyramid']);
    if (levelNumber <= 10) return choose(rng, ['pyramid', 'diagonals']);
    const opts = ['pyramid', 'diagonals', 'waves', 'clusters'];
    return choose(rng, opts);
  }

  function makeEmpty(rows, cols, fill = 0) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
  }

  function fillPattern(grid, pattern, rng) {
    const rows = grid.length, cols = grid[0].length;
    switch (pattern) {
      case 'stripes':
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c] = (r % 2 === 0) ? 1 : (rng() < 0.6 ? 1 : 0);
        break;
      case 'checker':
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c] = ((r + c) % 2 === 0) ? 1 : (rng() < 0.25 ? 1 : 0);
        break;
      case 'pyramid': {
        const mid = Math.floor(cols / 2);
        for (let r = 0; r < rows; r++) {
          const span = clamp(mid - r, 0, mid);
          for (let c = mid - span; c <= mid + span && c < cols; c++) if (c >= 0) grid[r][c] = 1;
        }
        break;
      }
      case 'diagonals':
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r][c] = ((c - r) % 3 === 0) ? 1 : (rng() < 0.2 ? 1 : 0);
        break;
      case 'waves':
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const y = Math.sin((c / cols) * Math.PI * 2) * 0.5 + 0.5; // 0..1
            grid[r][c] = (r / rows < y) ? 1 : (rng() < 0.15 ? 1 : 0);
          }
        }
        break;
      case 'clusters': {
        // random clusters
        const clusterCount = Math.max(2, Math.floor((rows * cols) / 30));
        for (let i = 0; i < clusterCount; i++) {
          const cr = Math.floor(rng() * rows);
          const cc = Math.floor(rng() * cols);
          const radius = 1 + Math.floor(rng() * 2);
          for (let r = cr - radius; r <= cr + radius; r++)
            for (let c = cc - radius; c <= cc + radius; c++)
              if (r >= 0 && r < rows && c >= 0 && c < cols && (Math.abs(cr - r) + Math.abs(cc - c) <= radius)) grid[r][c] = 1;
        }
        // sprinkle
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (rng() < 0.1) grid[r][c] = 1;
        break;
      }
    }
  }

  function applyDifficulty(grid, levelNumber, rng) {
    const rows = grid.length, cols = grid[0].length;
    // Increase density slightly per level band by adding bricks in empty spots
    const addChance = clamp(0.03 + (Math.floor((levelNumber - 1) / 3) * 0.025), 0.03, 0.22);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === 0 && rng() < addChance) grid[r][c] = 1;
      }
    }
  }

  // Reduce overall density for the first level to keep it beginner-friendly
  function thinGridForLevel1(grid, rng, targetFill = 0.38) {
    const rows = grid.length, cols = grid[0].length;
    let filled = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c] === 1) filled++;
    const total = rows * cols;
    const desired = Math.floor(total * targetFill);
    if (filled <= desired) return;
    // Collect coordinates of filled cells and randomly clear until target met
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c] === 1) cells.push([r, c]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    let idx = 0;
    while (filled > desired && idx < cells.length) {
      const [r, c] = cells[idx++];
      // Avoid clearing center columns too aggressively; favor edges first
      const bias = Math.abs(c - Math.floor(cols / 2));
      if (rng() < (0.3 + bias / Math.max(1, cols))) { grid[r][c] = 0; filled--; }
    }
  }

  function distributePowerups(grid, levelNumber, rng) {
    const rows = grid.length, cols = grid[0].length;
    // Power-up count scales up gently with level, ensure at least 1
    const minP = 1;
    const base = Math.round((rows * cols) * 0.025);
    const bonus = Math.floor((levelNumber - 1) / 3); // +1 every 3 levels
    const maxP = clamp(2 + Math.floor((levelNumber - 1) / 5), 2, 6);
    let target = clamp(base + bonus, minP, maxP);
    if (levelNumber <= 1) target = clamp(target, 2, 2); // ensure 2 on Level 1 (Life + one other)

    // Collect eligible brick cells (value 1)
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c] === 1) cells.push([r, c]);
    // shuffle cells
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = cells[i]; cells[i] = cells[j]; cells[j] = t; }

    // Helper to take a cell, preferring non-top rows when possible
    const takeCell = () => {
      // try non-top first
      for (let i = 0; i < cells.length; i++) {
        if (cells[i][0] > 0) { return cells.splice(i, 1)[0]; }
      }
      return cells.length ? cells.shift() : null;
    };

    // Guarantee a mix of power-ups
    const required = [];
    if (levelNumber === 1) {
      required.push(4); // life
      required.push(rng() < 0.5 ? 2 : 3); // big_paddle or multi_ball
    } else if (levelNumber === 2) {
      required.push(4); // life
      required.push(5); // fireball
    }

    target = Math.min(Math.max(target, required.length), Math.max(required.length, cells.length));

    // Place required types first
    for (let k = 0; k < required.length && target > 0; k++) {
      const picked = takeCell(); if (!picked) break;
      const [r, c] = picked; grid[r][c] = required[k]; target--;
    }

    // Fill remaining with biased random per level band
    while (target > 0 && cells.length > 0) {
      const picked = takeCell(); if (!picked) break;
      const [r, c] = picked;
      const roll = rng();
      if (levelNumber === 1) {
        grid[r][c] = roll < 0.45 ? 2 : roll < 0.8 ? 3 : 4; // no fire on L1
      } else if (levelNumber === 2) {
        grid[r][c] = roll < 0.4 ? 2 : roll < 0.7 ? 3 : roll < 0.85 ? 4 : 5; // introduce some fire
      } else if (levelNumber <= 5) {
        grid[r][c] = roll < 0.4 ? 2 : roll < 0.75 ? 3 : roll < 0.9 ? 4 : 5;
      } else {
        grid[r][c] = roll < 0.35 ? 2 : roll < 0.65 ? 3 : roll < 0.8 ? 4 : 5;
      }
      target--;
    }
  }

  function generateLevel(opts) {
    const { levelNumber = 1, viewport = { width: 800, height: 600 }, seed } = opts || {};
    const baseSeed = String(seed || `level-${levelNumber}-${viewport.width}x${viewport.height}`);
    const rng = mulberry32(hashString(baseSeed));
  const { cols, rows, targetCell } = computeGridSize(viewport);
  // Ensure level 1 is easy: at most 3 rows, reduced columns if very wide
  let effectiveRows = rows;
  let effectiveCols = cols;
  if (levelNumber <= 1) {
    effectiveRows = Math.min(rows, 3);
    effectiveCols = Math.max(6, Math.min(cols, 10));
  }
  const grid = makeEmpty(effectiveRows, effectiveCols, 0);
    const pattern = pickPattern(levelNumber, rng);
    fillPattern(grid, pattern, rng);
    if (levelNumber <= 1) {
      // Thin bricks for an easy start; skip extra density
      thinGridForLevel1(grid, rng, 0.34);
    } else {
      applyDifficulty(grid, levelNumber, rng);
    }
    distributePowerups(grid, levelNumber, rng);

    // Reserve side corridors at level 1 (leave first/last column empty)
    if (levelNumber <= 1 && effectiveCols >= 6) {
      for (let r = 0; r < grid.length; r++) {
        grid[r][0] = 0;
        grid[r][effectiveCols - 1] = 0;
      }
    }

    // Modifiers scale
    const ballSpeed = clamp(250 + (Math.floor((levelNumber - 1) / 5) * 20), 200, 500);

    return {
  grid, // numbers: 0 empty, 1 normal, 2 big_paddle, 3 multi_ball, 4 life, 5 fireball
      meta: {
  cols: effectiveCols,
  rows: effectiveRows,
        cell: { w: targetCell, h: targetCell },
        pattern
      },
      modifiers: { ballSpeed }
    };
  }

  window.LevelGenerator = { generateLevel };
})();
