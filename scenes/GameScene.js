// GameScene
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.currentLevel = data.level || 0;
    this.levels = window.GameConfig.LEVELS;
    this.startingScore = data.score || 0;
    this.startingLives = data.lives !== undefined ? data.lives : 3;
  }

  create() {
    this._initSceneProperties();
    this._createHUD();
    this._createPlayer();
    this._createBricks();
    this._createBalls();
    this._initWorldPhysics();
    this._initInputHandling();
    this._drawBorders();
    this.spawnBall();
    window.currentGameScene = this;
  }

  _initSceneProperties() {
    this.score = this.startingScore;
    this.lives = this.startingLives;
    this.highScore = localStorage.getItem('bb_highscore') || 0;
    this.ballSpeed = 250;
    this.isLosingLife = false;
    this.isPaused = false;
    this.isHelpVisible = false;
  this.isFireball = false;
  // Level source mode (procedural vs configured)
  const savedMode = localStorage.getItem('bb_useProceduralLevels');
  this.useProceduralLevels = (savedMode === null) ? !!window.LevelGenerator : (savedMode === 'true');
  this.helpScreenElements = null;
  this.pauseScreenElements = null;
  // Status display for multiple timers
  this.statusPanel = null;
  this.statusContainer = null;
  this.statusTimers = {}; // key -> { text, intervalEvent, expireEvent, remaining, onExpire }
  this.activePowerups = { big: false, fire: false };
    this.comboMultiplier = 1;
    this.comboTimer = null;
    this.brickPoints = window.GameConfig.BRICK_POINTS;
  this.prevPaddleX = null;
  this.paddleSpeed = 0;
  this.paddleVx = 0; // px/second for spin
  // ESC double-press tracking
  this._escPressCount = 0;
  this._escResetEvent = null;
  }

  _createHUD() {
    const w = this.sys.game.config.width;
    // Left/center/right HUD texts
    this.hudLeftText = this.add.text(16, 24, '', { fontSize: window.GameConfig.FONT_SIZES.hud, color: window.GameConfig.COLORS.text }).setOrigin(0, 0.5);
    this.hudCenterText = this.add.text(w / 2, 24, '', { fontSize: window.GameConfig.FONT_SIZES.hud, color: window.GameConfig.COLORS.text }).setOrigin(0.5);
    this.hudRightText = this.add.text(w - 72, 24, '', { fontSize: window.GameConfig.FONT_SIZES.hud, color: window.GameConfig.COLORS.text }).setOrigin(1, 0.5);
    this.updateHudText();
  this._initParticles();
    this.hudWall = this.add.rectangle(w / 2, 52, w, 8, 0xffd700, 1).setOrigin(0.5);
  // Clear global reference when this scene shuts down/destroys
  this.events.once('shutdown', () => { if (window.currentGameScene === this) window.currentGameScene = null; });
  this.events.once('destroy', () => { if (window.currentGameScene === this) window.currentGameScene = null; });
  // Create footer sound toggle
  this._createFooterSoundToggle();
  }

  _createPlayer() {
    const w = this.sys.game.config.width;
    const h = this.sys.game.config.height;
  const footerHeight = this._footerHeight || 28;
  this.paddle = this.physics.add.sprite(w / 2, h - footerHeight - 50, 'paddle');
    this.paddle.setImmovable(true);
    this.paddle.body.allowGravity = false;
  // We'll clamp manually to allow exact visual edge contact with walls
  this.paddle.setCollideWorldBounds(false);
  if (this.paddle.body) this.paddle.body.setSize(this.paddle.displayWidth, this.paddle.displayHeight, true);
  }

  _createBricks() {
    this.bricks = this.physics.add.staticGroup();
    this.powerupBricks = this.physics.add.staticGroup();
    if (this.useProceduralLevels && window.LevelGenerator) {
      const viewport = { width: this.sys.game.config.width, height: this.sys.game.config.height };
      const gen = window.LevelGenerator.generateLevel({ levelNumber: this.currentLevel + 1, viewport });
      if (gen && gen.grid) {
        this._buildGeneratedLevel(gen);
        if (gen.modifiers && gen.modifiers.ballSpeed) this.ballSpeed = gen.modifiers.ballSpeed;
      } else {
        // Fallback to configured level if generator failed
        let idx = this.currentLevel;
        if (!Array.isArray(this.levels) || idx < 0 || idx >= this.levels.length) idx = 0;
        const levelData = this.levels[idx];
        this.buildLevel(levelData);
      }
    } else {
      // Configured/static levels; clamp index and fallback to 0 if needed
      let idx = this.currentLevel;
      if (!Array.isArray(this.levels) || idx < 0 || idx >= this.levels.length) idx = 0;
      const levelData = this.levels[idx];
      this.buildLevel(levelData);
    }
    this.bricks.getChildren().forEach(b => { b.refreshBody(); b.setImmovable(true); });
    this.powerupBricks.getChildren().forEach(b => { b.refreshBody(); b.setImmovable(true); });
    this.powerups = this.physics.add.group();
  }

  _createBalls() {
    this.balls = this.physics.add.group();
    this.physics.add.collider(this.balls, this.balls);
  }

  _initWorldPhysics() {
  const hudHeight = 52; // top HUD
  const footerHeight = 28; // reserved space for bottom status/timer panel
  this._hudHeight = hudHeight;
  this._footerHeight = footerHeight;
  this._borderThickness = 3; // thickness used in _drawBorders
  this.physics.world.setBounds(0, hudHeight, this.sys.game.config.width, this.sys.game.config.height - hudHeight - footerHeight);
    this.physics.world.on('worldbounds', (body, up, down, left, right) => {
      const ball = body.gameObject;
      if ((up || left || right) && ball && ball.active) this.sound.play('bounce');
      if (down && ball) {
        // stop and cleanup per-ball trail emitter if present
        if (ball._trailEmitter) { try { ball._trailEmitter.destroy(); } catch(_){}; ball._trailEmitter = null; }
        ball.destroy();
        if (this.balls.countActive(true) === 0) this.loseLife();
      }
    });
  this.physics.add.collider(this.balls, this.paddle, this.hitPaddle, null, this);
    // Save colliders so we can toggle for fireball mode
    this.coll_ball_bricks = this.physics.add.collider(this.balls, this.bricks, this.hitBrick, null, this);
    this.coll_ball_powerBricks = this.physics.add.collider(this.balls, this.powerupBricks, this.hitPowerupBrick, null, this);
    // Pre-create overlaps, start disabled
    this.over_ball_bricks = this.physics.add.overlap(this.balls, this.bricks, this.hitBrickOverlap, null, this);
    this.over_ball_powerBricks = this.physics.add.overlap(this.balls, this.powerupBricks, this.hitPowerupBrickOverlap, null, this);
    this.over_ball_bricks.active = false;
    this.over_ball_powerBricks.active = false;
    this.physics.add.overlap(this.paddle, this.powerups, this.collectPowerup, null, this);
  }

  _initParticles() {
    // Helper to spawn a short-lived burst at x,y
    this._burstAt = (x, y, quantity = 10) => {
      const emitterGO = this.add.particles(x, y, 'particle_white', {
        speed: { min: 80, max: 160 },
        lifespan: 350,
        quantity,
        scale: { start: 1.0, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: 'ADD'
      });
      if (emitterGO.setDepth) emitterGO.setDepth(5);
      this.time.delayedCall(400, () => { try { emitterGO.destroy(); } catch(_){} });
    };
  }

  _initInputHandling() {
    this.input.on('pointermove', pointer => {
      if (this.isPaused || this.isHelpVisible) return;
  const half = this.paddle.displayWidth / 2;
  const w = this.sys.game.config.width;
  const margin = Math.ceil((this._borderThickness || 3) / 2);
  const minX = margin + half;
  const maxX = w - margin - half;
  this.paddle.x = Phaser.Math.Clamp(pointer.x, minX, maxX);
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.isLosingLife) return;
      if (this.isHelpVisible) { this.hideHelp(); return; }
      // If already paused, a single ESC should exit immediately
      if (this.isPaused) { this._exitToMainMenu(); return; }
      // Double-ESC to exit to Main Menu (while not paused)
      if (this._handleEscDoublePress()) return;
      // First press: pause and show hint already shown by _handleEscDoublePress
      this.pauseGame();
    });
    this.input.keyboard.on('keydown-H', () => {
      if (this.isPaused) return;
      this.isHelpVisible ? this.hideHelp() : this.showHelp();
    });
    this.input.keyboard.on('keydown-S', () => {
      if (this.isPaused || this.isHelpVisible) return;
      const muted = !(localStorage.getItem('bb_soundMuted') === 'true');
      localStorage.setItem('bb_soundMuted', String(muted));
      if (this.sound && typeof this.sound.setMute === 'function') this.sound.setMute(muted);
  if (this.soundBtnFooter) { this.soundBtnFooter.setText(muted ? '🔇' : '🔊'); if (this._redrawFooterSoundBtnBg) this._redrawFooterSoundBtnBg(); }
    });
    this.input.keyboard.on('keydown-PLUS', () => {
      this.ballSpeed = Phaser.Math.Clamp(this.ballSpeed + 50, 200, 500);
      this.updateHudText();
      this.balls.getChildren().forEach(ball => {
        if (ball.body && ball.body.velocity) {
          const angle = Math.atan2(ball.body.velocity.y, ball.body.velocity.x);
          ball.setVelocity(Math.cos(angle) * this.ballSpeed, Math.sin(angle) * this.ballSpeed);
        }
      });
    });
    this.input.keyboard.on('keydown-MINUS', () => {
      this.ballSpeed = Phaser.Math.Clamp(this.ballSpeed - 50, 200, 500);
      this.updateHudText();
      this.balls.getChildren().forEach(ball => {
        if (ball.body && ball.body.velocity) {
          const angle = Math.atan2(ball.body.velocity.y, ball.body.velocity.x);
          ball.setVelocity(Math.cos(angle) * this.ballSpeed, Math.sin(angle) * this.ballSpeed);
        }
      });
    });
    // Toggle level source mode (L): Procedural vs Configured
    this.input.keyboard.on('keydown-L', () => {
      if (this.isPaused || this.isHelpVisible || this.isLosingLife) return;
      const next = !this.useProceduralLevels;
      if (next && !window.LevelGenerator) {
        this._showFloatingText(this.sys.game.config.width / 2, 80, 'Procedural mode unavailable', '#ff6666');
        return;
      }
      this.useProceduralLevels = next;
      localStorage.setItem('bb_useProceduralLevels', String(next));
      this._showFloatingText(this.sys.game.config.width / 2, 80, `Level Mode: ${next ? 'Procedural' : 'Configured'}`, '#00e6e6');
      this.time.delayedCall(120, () => {
        this.scene.restart({ level: this.currentLevel, score: this.score, lives: this.lives });
      });
    });

    if (this.scale) {
      this.scale.on('resize', (gameSize) => {
  const width = gameSize.width; const height = gameSize.height;
  const hudHeight = this._hudHeight || 52;
  const footerHeight = this._footerHeight || 28;
  this.physics.world.setBounds(0, hudHeight, width, height - hudHeight - footerHeight);
        if (this.hudLeftText) this.hudLeftText.setPosition(16, 24);
        if (this.hudCenterText) this.hudCenterText.setPosition(width / 2, 24);
        if (this.hudRightText) this.hudRightText.setPosition(width - 72, 24);
  if (this.hudWall) this.hudWall.setPosition(width / 2, 52).setSize(width, 8);
        if (this.paddle) {
          const half = this.paddle.displayWidth / 2;
          const margin = Math.ceil((this._borderThickness || 3) / 2);
          const minX = margin + half;
          const maxX = width - margin - half;
          this.paddle.x = Phaser.Math.Clamp(this.paddle.x, minX, maxX);
          // Ensure paddle stays above reserved footer area
          const maxY = height - footerHeight - (this.paddle.displayHeight / 2) - 6;
          if (this.paddle.y > maxY) this.paddle.y = maxY;
        }
  const footerCenterY = height - Math.floor(footerHeight / 2) - 2;
  if (this.statusPanel) this.statusPanel.setPosition(width / 2, footerCenterY).setSize(width, footerHeight);
  if (this.statusContainer) this.statusContainer.setPosition(width / 2, footerCenterY);
  if (this._layoutStatusDisplay) this._layoutStatusDisplay();
  if (this.soundBtnFooter) {
    // Resize icon to fit footer height
    const fontPx = Math.max(12, Math.min(16, Math.floor(footerHeight * 0.55)));
    const rightMargin = 12;
    this.soundBtnFooter.setFontSize(fontPx);
    this.soundBtnFooter.setPosition(width - rightMargin, footerCenterY);
    if (this._redrawFooterSoundBtnBg) this._redrawFooterSoundBtnBg();
  }
      });
    }
  }

  _createFooterSoundToggle() {
    this._ensureStatusDisplay();
    const iconFor = (m) => (m ? '🔇' : '🔊');
    const mutedInit = localStorage.getItem('bb_soundMuted') === 'true';
    const w = this.sys.game.config.width; const h = this.sys.game.config.height;
    const footerHeight = this._footerHeight || 28;
    const footerCenterY = h - Math.floor(footerHeight / 2) - 2;
  // Fit icon to panel height (55% of footer height, clamped 12..16px)
  const fontPx = Math.max(12, Math.min(16, Math.floor(footerHeight * 0.55)));
  const rightMargin = 12;
  this.soundBtnFooter = this.add.text(w - rightMargin, footerCenterY, iconFor(mutedInit), { fontSize: `${fontPx}px`, color: window.GameConfig.COLORS.button })
      .setOrigin(1, 0.5).setInteractive();
    this.soundBtnFooterBg = this.add.graphics();
    this._redrawFooterSoundBtnBg = () => {
      if (!this.soundBtnFooter || !this.soundBtnFooterBg) return;
      const b = this.soundBtnFooter.getBounds();
      this.soundBtnFooterBg.clear();
      this.soundBtnFooterBg.fillStyle(window.GameConfig.COLORS.normal, 1);
  const padX = 6, padY = 3;
  const rectW = b.width + padX * 2;
  const rectH = Math.max(Math.min(footerHeight - 8, b.height + padY * 2), 14);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  this.soundBtnFooterBg.fillRoundedRect(cx - rectW / 2, cy - rectH / 2, rectW, rectH, 6);
      this.children.moveBelow(this.soundBtnFooterBg, this.soundBtnFooter);
    };
    this._redrawFooterSoundBtnBg();
    this.soundBtnFooter.on('pointerover', () => {
      const b = this.soundBtnFooter.getBounds();
      this.soundBtnFooterBg.clear();
      this.soundBtnFooterBg.fillStyle(window.GameConfig.COLORS.hover, 1);
      this.soundBtnFooterBg.fillRoundedRect(b.x - 6, b.y - 4, b.width + 12, b.height + 8, 8);
    });
    this.soundBtnFooter.on('pointerout', () => this._redrawFooterSoundBtnBg());
    this.soundBtnFooter.on('pointerdown', () => {
      const current = localStorage.getItem('bb_soundMuted') === 'true';
      const next = !current;
      localStorage.setItem('bb_soundMuted', String(next));
      if (this.sound && typeof this.sound.setMute === 'function') this.sound.setMute(next);
      this.soundBtnFooter.setText(iconFor(next));
      this._redrawFooterSoundBtnBg();
    });
    if (this.soundBtnFooter.setDepth) this.soundBtnFooter.setDepth(4);
    if (this.soundBtnFooterBg.setDepth) this.soundBtnFooterBg.setDepth(3);
  }

  _handleEscDoublePress() {
    const threshold = 1500; // ms
    this._escPressCount = (this._escPressCount || 0) + 1;
    if (this._escPressCount === 1) {
      if (this._escResetEvent) this._escResetEvent.remove();
      // Small hint for the user
      this._showFloatingText(this.sys.game.config.width / 2, 80, 'Press ESC again to exit', '#ffcc00');
      this._escResetEvent = this.time.delayedCall(threshold, () => { this._escPressCount = 0; this._escResetEvent = null; });
      return false;
    }
    // Second press within threshold
    if (this._escResetEvent) { this._escResetEvent.remove(); this._escResetEvent = null; }
    this._escPressCount = 0;
    // End game -> Main Menu
    this._exitToMainMenu();
    return true;
  }

  _exitToMainMenu() {
    try { this.physics.pause(); } catch(_) {}
    try { this.scene.stop('GameScene'); } catch(_) {}
    try { this.scene.start('MainMenu'); } catch(_) {}
  }

  _drawBorders() {
    const g = this.add.graphics();
    const w = this.sys.game.config.width;
    const h = this.sys.game.config.height;
  const hudHeight = this._hudHeight || 52;
  const footerHeight = this._footerHeight || 28;
  const playTop = hudHeight;
  const playBottom = h - footerHeight;
  g.lineStyle(3, 0x00ffff, 1);
  g.strokeLineShape(new Phaser.Geom.Line(0, playTop, 0, playBottom));
  g.strokeLineShape(new Phaser.Geom.Line(w, playTop, w, playBottom));
  g.strokeLineShape(new Phaser.Geom.Line(0, playBottom, w, playBottom));
    g.lineStyle(3, 0xffd700, 1);
  g.strokeRect(0, 0, w, hudHeight);
  }

  updateHudText() {
  const speedText = `Spd ${this.ballSpeed}`;
  const levelText = `Lvl ${this.currentLevel + 1}`;
    const livesText = `Lives ${this.lives}`;
    const scoreText = `Score ${this.score}`;
    const highText = `Hi ${this.highScore}`;
    if (this.hudLeftText) this.hudLeftText.setText(`${levelText}  |  ${livesText}`);
    if (this.hudCenterText) this.hudCenterText.setText(`${scoreText}`);
    if (this.hudRightText) this.hudRightText.setText(`${highText}  |  ${speedText}`);
  }

  // --- Status Display (bottom) helpers ---
  _ensureStatusDisplay() {
    const w = this.sys.game.config.width; const h = this.sys.game.config.height;
    const footerHeight = this._footerHeight || 28;
    const footerCenterY = h - Math.floor(footerHeight / 2) - 2;
    if (!this.statusPanel) {
  const alpha = (window.GameConfig && typeof window.GameConfig.STATUS_BG_ALPHA === 'number') ? window.GameConfig.STATUS_BG_ALPHA : 0.85;
  this.statusPanel = this.add.rectangle(w / 2, footerCenterY, w, footerHeight, 0x222222, alpha).setOrigin(0.5);
      if (this.statusPanel.setDepth) this.statusPanel.setDepth(2);
    }
    if (!this.statusContainer) {
      this.statusContainer = this.add.container(w / 2, footerCenterY);
      if (this.statusContainer.setDepth) this.statusContainer.setDepth(3);
    }
  // Show/hide bg based on configured alpha
  const alpha = (window.GameConfig && typeof window.GameConfig.STATUS_BG_ALPHA === 'number') ? window.GameConfig.STATUS_BG_ALPHA : 0.85;
  this.statusPanel.setVisible(alpha > 0);
    this.statusContainer.setVisible(true);
  }

  _layoutStatusDisplay() {
    if (!this.statusContainer) return;
    const keys = Object.keys(this.statusTimers);
    const texts = keys.map(k => this.statusTimers[k].text).filter(Boolean);
    if (texts.length === 0) {
      if (this.statusPanel) this.statusPanel.setVisible(false);
      this.statusContainer.setVisible(false);
      return;
    }
    this.statusPanel.setVisible(true);
    this.statusContainer.setVisible(true);
    // Arrange texts horizontally centered
    const gap = 24;
    const widths = texts.map(t => t.getBounds().width);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (texts.length - 1);
    let x = -total / 2;
    texts.forEach((t, i) => {
      const w = widths[i];
      t.setPosition(x + w / 2, 0);
      x += w + gap;
    });
  }

  _startOrResetStatusTimer(key, label, color, durationMs, onExpire) {
    this._ensureStatusDisplay();
    const seconds = Math.max(1, Math.round(durationMs / 1000));
    const existing = this.statusTimers[key];
    if (existing) {
      // Extend existing timer
      existing.remaining += seconds;
      existing.onExpire = existing.onExpire || onExpire;
      if (existing.text) existing.text.setText(`${label}: ${existing.remaining}`);
      if (!existing.intervalEvent || existing.intervalEvent.hasDispatched) {
        // Safety: (re)create interval if it doesn't exist
        existing.intervalEvent = this.time.addEvent({ delay: 1000, loop: true, callback: () => {
          existing.remaining = Math.max(0, existing.remaining - 1);
          if (existing.text) existing.text.setText(`${label}: ${existing.remaining}`);
          if (existing.remaining <= 0) {
            try { if (typeof existing.onExpire === 'function') existing.onExpire(); } catch(_) {}
            if (existing.intervalEvent) existing.intervalEvent.remove(false);
            if (existing.text) { try { existing.text.destroy(); } catch(_) {} }
            delete this.statusTimers[key];
          }
          this._layoutStatusDisplay();
        }});
      }
    } else {
      const text = this.add.text(0, 0, `${label}: ${seconds}`, { fontSize: '16px', color, align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
      this.statusContainer.add(text);
      const entry = { text, remaining: seconds, intervalEvent: null, onExpire };
      entry.intervalEvent = this.time.addEvent({ delay: 1000, loop: true, callback: () => {
        entry.remaining = Math.max(0, entry.remaining - 1);
        if (entry.text) entry.text.setText(`${label}: ${entry.remaining}`);
        if (entry.remaining <= 0) {
          try { if (typeof entry.onExpire === 'function') entry.onExpire(); } catch(_) {}
          if (entry.intervalEvent) entry.intervalEvent.remove(false);
          if (entry.text) { try { entry.text.destroy(); } catch(_) {} }
          delete this.statusTimers[key];
        }
        this._layoutStatusDisplay();
      }});
      this.statusTimers[key] = entry;
    }
    this._layoutStatusDisplay();
  }

  buildLevel(levelData) {
    if (!Array.isArray(levelData) || levelData.length === 0 || !Array.isArray(levelData[0])) {
      console.warn('Invalid level data; using simple default row');
      levelData = [ [1,1,1,1,1,1,1] ];
    }
    const brickTextures = { 1: 'brick_green', 2: 'brick_blue', 3: 'brick_yellow', 4: 'brick_purple', 5: 'brick_red' };
    const brickTexture = this.textures.get('brick_green');
    if (!brickTexture || !brickTexture.source[0]) { console.error('Brick texture not found.'); return; }
    const baseW = brickTexture.getSourceImage().width;
    const baseH = brickTexture.getSourceImage().height;
  const padX = 5, padY = 5;
    const cols = levelData[0].length;
  const gameW = this.sys.game.config.width;
  const totalGutter = padX * (cols - 1);
  const side = window.GameConfig.SIDE_MARGIN || 0;
  const availW = Math.max(0, gameW - totalGutter - (2 * side));
    const scaledW = availW / cols;
    const scale = scaledW / baseW;
    const scaledH = baseH * scale;
  const levelWidth = cols * scaledW + totalGutter;
  const offsetX = (gameW - levelWidth) / 2;
  const hudHeight = this._hudHeight || 52;
  const offsetY = Math.max(hudHeight + 48, 100);
    const lastColIndex = levelData[0].length - 1;
    for (let row = 0; row < levelData.length; row++) {
      for (let col = 0; col < levelData[row].length; col++) {
        // For earliest level, reserve an empty corridor along both side walls
        if (this.currentLevel <= 0 && (col === 0 || col === lastColIndex)) continue;
        const brickType = levelData[row][col];
        if (brickType === 0) continue;
  const x = offsetX + col * (scaledW + padX);
        const y = offsetY + row * (scaledH + padY);
        let brick = null;
        if (brickType === 1) {
          brick = this.bricks.create(x, y, brickTextures[1]);
        } else if (brickType === 2) {
          brick = this.powerupBricks.create(x, y, brickTextures[2]);
          brick.health = 2; brick.powerupType = 'big_paddle';
        } else if (brickType === 3) {
          brick = this.powerupBricks.create(x, y, brickTextures[3]);
          brick.health = 2; brick.powerupType = 'multi_ball';
        } else if (brickType === 4) {
          brick = this.powerupBricks.create(x, y, brickTextures[4]);
          brick.health = 2; brick.powerupType = 'life';
        } else if (brickType === 5) {
          brick = this.powerupBricks.create(x, y, brickTextures[5]);
          brick.health = 2; brick.powerupType = 'fire';
        }
        if (brick) brick.setOrigin(0, 0).setScale(scale).refreshBody();
      }
    }
  }

  _buildGeneratedLevel(gen) {
    const grid = gen.grid; const rows = grid.length; if (!rows) return;
    const cols = grid[0].length;
    const brickTexture = this.textures.get('brick_green');
    if (!brickTexture || !brickTexture.source[0]) { console.error('Brick texture missing'); return; }
    const baseW = brickTexture.getSourceImage().width;
    const baseH = brickTexture.getSourceImage().height;
  const padX = 5, padY = 5;
    const gameW = this.sys.game.config.width;
  const totalGutter = padX * (cols - 1);
  const side = window.GameConfig.SIDE_MARGIN || 0;
  const availW = Math.max(0, gameW - totalGutter - (2 * side));
    const scaledW = availW / cols;
    const scale = scaledW / baseW;
    const scaledH = baseH * scale;
    const totalWidth = cols * scaledW + totalGutter;
    const offsetX = (gameW - totalWidth) / 2;
  // Give more top air for early levels to reduce immediate congestion
  const hudHeight = this._hudHeight || 52;
  const offsetY = (this.currentLevel <= 0) ? Math.max(hudHeight + 68, 120) : Math.max(hudHeight + 48, 100);
  const texMap = { 1: 'brick_green', 2: 'brick_blue', 3: 'brick_yellow', 4: 'brick_purple', 5: 'brick_red' };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c]; if (!cell) continue;
        const x = offsetX + c * (scaledW + padX);
        const y = offsetY + r * (scaledH + padY);
        const isPower = cell === 2 || cell === 3;
        const group = isPower ? this.powerupBricks : this.bricks;
        const tex = texMap[cell] || 'brick_green';
        const brick = group.create(x, y, tex).setOrigin(0, 0);
        brick.setScale(scale); brick.refreshBody();
        if (isPower) {
          brick.health = 2;
          if (cell === 2) brick.powerupType = 'big_paddle';
          else if (cell === 3) brick.powerupType = 'multi_ball';
          else if (cell === 4) brick.powerupType = 'life';
          else if (cell === 5) brick.powerupType = 'fire';
        }
      }
    }
  }

  pauseGame() {
    if (this.isPaused || this.isHelpVisible) return;
  if (!this.physics || !this.physics.world) return; // scene not active
    this.isPaused = true;
    this.physics.pause();
  const textStyle = { fontSize: window.GameConfig.FONT_SIZES.button, color: window.GameConfig.COLORS.button, align: 'center', padding: { x: 20, y: 10 } };
  const w = this.sys.game.config.width; const h = this.sys.game.config.height;
  const pauseText = this.add.text(w / 2, h / 2, 'Paused\nClick to Resume\nPress ESC to Exit', textStyle).setOrigin(0.5).setInteractive();
    const b = pauseText.getBounds();
    const bg = this.add.graphics();
    const draw = (c) => { bg.clear(); bg.fillStyle(c, 0.8); bg.fillRoundedRect(b.x, b.y, b.width, b.height, 16); };
    draw(window.GameConfig.COLORS.normal);
    this.children.moveBelow(bg, pauseText);
    this.pauseScreenElements = this.add.group([bg, pauseText]);
    pauseText.on('pointerover', () => draw(window.GameConfig.COLORS.hover));
    pauseText.on('pointerout', () => draw(window.GameConfig.COLORS.normal));
    pauseText.on('pointerdown', () => this.resumeGame());
  }

  resumeGame() {
  if (!this.isPaused || this.isHelpVisible) return;
  if (!this.physics || !this.physics.world) { this.isPaused = false; return; }
    this.isPaused = false;
    this.physics.resume();
  if (this.pauseScreenElements) { this.pauseScreenElements.destroy(true, true); this.pauseScreenElements = null; }
  if (this.soundBtnFooterBg) this.soundBtnFooterBg.setVisible(true);
  if (this.soundBtnFooter) this.soundBtnFooter.setVisible(true);
    const muted = localStorage.getItem('bb_soundMuted') === 'true';
  if (this.soundBtnFooter) { this.soundBtnFooter.setText(muted ? '🔇' : '🔊'); if (this._redrawFooterSoundBtnBg) this._redrawFooterSoundBtnBg(); }
  }

  showHelp() {
    if (this.isHelpVisible || this.isPaused || this.isLosingLife) return;
    this.isHelpVisible = true;
    this.physics.pause();
  const group = window.createHelpPanel ? window.createHelpPanel(this, { onBack: () => this.hideHelp() }) : null;
  this.helpScreenElements = group;
  if (group && group.setDepth) { group.setDepth(1000); }
  if (!group) {
      // Minimal fallback if helper not available
      const w = this.sys.game.config.width; const h = this.sys.game.config.height;
      const bg = this.add.rectangle(w/2, h/2, Math.min(680, w*0.9), Math.min(520, h*0.85), 0x222233, 0.95).setOrigin(0.5).setDepth(1000);
      const txt = this.add.text(w/2, h/2, 'Help\nPress H or ESC to close', { fontSize: '28px', color: '#fff', align: 'center' }).setOrigin(0.5).setDepth(1000);
      this.helpScreenElements = this.add.group([bg, txt]);
    }
  if (this.soundBtnFooter) this.soundBtnFooter.setVisible(false);
  if (this.soundBtnFooterBg) this.soundBtnFooterBg.setVisible(false);
    this.input.keyboard.once('keydown-H', () => this.hideHelp());
    this.input.keyboard.once('keydown-ESC', () => this.hideHelp());
  }

  hideHelp() {
    if (!this.isHelpVisible) return;
    this.isHelpVisible = false;
    this.physics.resume();
    if (this.helpScreenElements) {
      // support Container or Group
      if (this.helpScreenElements.destroy) {
        try { this.helpScreenElements.destroy(true, true); } catch (_) { try { this.helpScreenElements.destroy(); } catch(_){} }
      }
      this.helpScreenElements = null;
    }
  if (this.soundBtnFooterBg) this.soundBtnFooterBg.setVisible(true);
  if (this.soundBtnFooter) this.soundBtnFooter.setVisible(true);
  }

  _showFloatingText(x, y, message, color) {
    const text = this.add.text(x, y, message, { fontSize: '20px', color, stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
    this.tweens.add({ targets: text, y: y - 50, alpha: 0, duration: 1500, ease: 'Power1', onComplete: () => text.destroy() });
  }

  _awardPoints(basePoints, brick) {
    if (this.comboTimer) this.comboTimer.remove();
    const scoreGained = basePoints * this.comboMultiplier;
    this.score += scoreGained;
    const comboString = this.comboMultiplier > 1 ? ` (x${this.comboMultiplier} Combo!)` : '';
    this._showFloatingText(brick.x + (brick.displayWidth / 2), brick.y, `+${scoreGained}${comboString}`, '#ffff00');
    this.comboMultiplier++;
    if (this.score > this.highScore) { this.highScore = this.score; localStorage.setItem('bb_highscore', this.highScore); }
    this.updateHudText();
    this.comboTimer = this.time.delayedCall(window.GameConfig.COMBO_TIMER_DURATION, this.resetCombo, [], this);
  }

  resetCombo() {
    if (this.comboTimer) this.comboTimer.remove();
    this.comboTimer = null;
    this.comboMultiplier = 1;
    this.updateHudText();
  }

  spawnBall() {
    this.balls.clear(true, true);
    const w = this.sys.game.config.width; const h = this.sys.game.config.height;
  const footerHeight = this._footerHeight || 28;
  const ballX = this.paddle ? this.paddle.x : (w / 2);
  const ballY = this.paddle ? (this.paddle.y - (this.paddle.displayHeight / 2) - 10) : (h - footerHeight - 60);
    const ball = this._createGameBall(ballX, ballY, 'ball_blue', this.ballSpeed, -Math.PI / 2);
    ball.setVelocity(0, 0);
    this.time.delayedCall(300, () => {
      const angle = Phaser.Math.DegToRad(Phaser.Math.Between(-30, 30));
      const speed = this.ballSpeed;
      ball.setVelocity(speed * Math.sin(angle), -Math.abs(speed * Math.cos(angle)));
    });
  }

  loseLife() {
    if (this.isLosingLife) return;
    this.sound.play('lose_life');
    this.isLosingLife = true;
    this.lives--; this.resetCombo(); this.updateHudText();
    if (this.lives > 0) {
    const msg = `Life Lost!\n${this.lives} ${this.lives === 1 ? 'life' : 'lives'} remaining`;
  const w = this.sys.game.config.width; const h = this.sys.game.config.height;
  const t = this.add.text(w / 2, h / 2, msg, { fontSize: '40px', color: '#ffff00', align: 'center', backgroundColor: '#333', padding: { x: 20, y: 10 } }).setOrigin(0.5);
  // Do not block paddle input during interlude; only balls are cleared
  this.time.delayedCall(1500, () => { t.destroy(); this.spawnBall(); this.isLosingLife = false; });
    } else {
      this.scene.start('GameOverScene', { score: this.score, highScore: this.highScore });
    }
  }

  hitPaddle(ball, paddle) {
    if (!ball || !ball.body || !paddle) return;
    this.sound.play('hit_paddle');
    const diff = ball.x - paddle.x;
    const hitPos = diff / (paddle.displayWidth / 2);
  let angle = hitPos * 60;
  // Add spin from paddle horizontal velocity (px/s)
  const spinDeg = Phaser.Math.Clamp((this.paddleVx || 0) / 30, -33, 33);
  angle += spinDeg;
  const minAngle = 5;
  if (Math.abs(angle) < minAngle) angle = angle >= 0 ? minAngle : -minAngle;
  angle += Phaser.Math.Between(-3, 3);
  angle = Phaser.Math.Clamp(angle, -80, 80);
    const speed = this.ballSpeed;
    const radians = Phaser.Math.DegToRad(-90 + angle);
    ball.setVelocity(Math.cos(radians) * speed, Math.sin(radians) * speed);
  }

  hitBrick(ball, brick) {
    this.sound.play('hit_brick');
  if (this._burstAt) this._burstAt(brick.x + (brick.displayWidth / 2), brick.y + (brick.displayHeight / 2), 10);
    this.bricks.remove(brick, true, true);
    this._awardPoints(this.brickPoints[1], brick);
    this._checkLevelCompletion();
  }

  hitBrickOverlap(ball, brick) {
    // Fireball pass-through handler: mimic hit without bounce/sep
    if (!brick || !brick.active) return;
    this.hitBrick(ball, brick);
  }

  hitPowerupBrick(ball, brick) {
    brick.health = (brick.health || 2) - 1;
    if (brick.health > 0) {
      const color = brick.texture.key;
      let cracked = 'brick_blue_crack';
      if (color === 'brick_green') cracked = 'brick_green_crack';
      else if (color === 'brick_yellow') cracked = 'brick_yellow_crack';
  else if (color === 'brick_purple') cracked = 'brick_purple_crack';
  else if (color === 'brick_red') cracked = 'brick_red_crack';
      brick.setTexture(cracked);
      this.sound.play('crack_brick');
      this._awardPoints(this.brickPoints['crack'], brick);
    } else {
      this.sound.play('hit_brick');
  if (this._burstAt) this._burstAt(brick.x + (brick.displayWidth / 2), brick.y + (brick.displayHeight / 2), 12);
      this.powerupBricks.remove(brick, true, true);
      this._awardPoints(this.brickPoints[2], brick);
      const px = brick.x + brick.displayWidth / 2; const py = brick.y + brick.displayHeight / 2;
      // Choose a drop type; bias to the brick's declared powerupType
      const chooseDropType = (base) => {
        // If explicit power type on brick, keep it; else fallback to base power-ups
        if (base === 'life' || base === 'fire') return base;
        const r = Math.random();
        if (r < 0.6) return base || 'big_paddle'; // 60% keep base
        return base === 'big_paddle' ? 'multi_ball' : 'big_paddle'; // 40% swap
      };
      const type = chooseDropType(brick.powerupType);
      let sprite = 'powerup_wide';
      if (type === 'multi_ball') sprite = 'powerup_multiball';
      else if (type === 'life') sprite = 'powerup_life';
      else if (type === 'fire') sprite = 'powerup_fireball';
      const p = this.powerups.create(px, py, sprite);
      p.powerupType = type; p.setVelocityY(100); p.setDepth(0);
      this.sound.play('powerup_drop');
      this._checkLevelCompletion();
    }
  }

  hitPowerupBrickOverlap(ball, brick) {
    // Fireball pass-through handler for two-hit bricks
    if (!brick || !brick.active) return;
    this.hitPowerupBrick(ball, brick);
  }

  _checkLevelCompletion() {
    if (this.bricks.countActive(true) === 0 && this.powerupBricks.countActive(true) === 0) {
      const nextLevel = this.currentLevel + 1;
      this.physics.pause();
      this.balls.getChildren().forEach(b => b.setVisible(false));
      this.sound.play('level_complete');
      const w = this.sys.game.config.width; const h = this.sys.game.config.height;
      this.add.text(w / 2, h / 2, 'Level Cleared!', { fontSize: '48px', color: '#00ff00', align: 'center', backgroundColor: '#000', padding: { x: 20, y: 10 } }).setOrigin(0.5);
      const delay = (this.useProceduralLevels && window.LevelGenerator) ? 1200 : 2000;
      this.time.delayedCall(delay, () => {
        if (this.useProceduralLevels && window.LevelGenerator) {
          this.scene.restart({ level: nextLevel, score: this.score, lives: this.lives });
        } else if (Array.isArray(this.levels) && nextLevel < this.levels.length) {
          this.scene.restart({ level: nextLevel, score: this.score, lives: this.lives });
        } else {
          this.scene.start('YouWinScene', { score: this.score, highScore: this.highScore });
        }
      });
    }
  }

  collectPowerup(paddle, powerup) {
    powerup.disableBody(true, true);
    this.sound.play('powerup_collect');
    const type = powerup.powerupType;
    switch (type) {
      case 'big_paddle':
        this.activePowerups.big = true;
        paddle.setScale(1.5, 1);
        // Use fireball skin if fire is active, else wide skin
        if (this.activePowerups.fire) {
          if (this.textures.exists('paddle_fireball')) paddle.setTexture('paddle_fireball');
        } else if (this.textures.exists('paddle_wide')) {
          paddle.setTexture('paddle_wide');
        }
        if (paddle.body) {
          // Match physics body width to displayed sprite width
          paddle.body.setSize(paddle.displayWidth, paddle.displayHeight);
          paddle.body.setOffset((paddle.width - paddle.displayWidth) / 2 || 0, (paddle.height - paddle.displayHeight) / 2 || 0);
        }
        this._startOrResetStatusTimer('big', 'Big Paddle', '#00e6e6', window.GameConfig.POWERUP_DURATION, () => {
          this.activePowerups.big = false;
          // Restore or keep appropriate paddle skin
          if (this.activePowerups.fire) {
            if (this.textures.exists('paddle_fireball')) paddle.setTexture('paddle_fireball');
          } else if (this.textures.exists('paddle')) {
            paddle.setTexture('paddle');
          }
          paddle.setScale(1, 1);
          if (paddle.body) paddle.body.setSize(paddle.displayWidth, paddle.displayHeight, true);
        });
        break;
      case 'multi_ball':
        const mainBall = this.balls.getFirstAlive();
        if (mainBall) {
          const all = ['ball_blue', 'ball_red', 'ball_green', 'ball_yellow'];
          const colors = all.filter(c => c !== mainBall.texture.key);
          let base = -Math.PI / 2;
          if (mainBall.body && mainBall.body.velocity) base = Math.atan2(mainBall.body.velocity.y, mainBall.body.velocity.x);
          const spread = [Phaser.Math.DegToRad(-30), 0, Phaser.Math.DegToRad(30)];
          const baseSpeed = this.ballSpeed;
          for (let i = 0; i < 3; i++) {
            let a = base + spread[i];
            let deg = Phaser.Math.RadToDeg(a) % 360;
            if (Math.abs(deg) < 20 || Math.abs(deg - 180) < 20) a += Phaser.Math.DegToRad(40);
            const speed = baseSpeed + (i + 1) * 40;
            const off = 10 * (i - 1);
            const sx = mainBall.x + Math.cos(a) * off;
            const sy = mainBall.y + Math.sin(a) * off;
            this._createGameBall(sx, sy, colors[i], speed, a);
          }
        }
        break;
      case 'life':
        this.lives = Math.min(99, this.lives + 1);
        this._showFloatingText(paddle.x, paddle.y - 30, '+1 Life', '#00ff88');
        this.updateHudText();
        break;
      case 'fire': {
        // Activate timed fireball mode; coexists with big paddle
        this.activePowerups.fire = true;
        this._setFireballActive(true);
        // Change paddle skin for fireball duration if available
        if (this.textures.exists('paddle_fireball')) paddle.setTexture('paddle_fireball');
        // Change all balls to fireball texture for the duration
        this.balls.getChildren().forEach(b => { try { b.setTexture('ball_fireball'); } catch(_){} });
        this._startOrResetStatusTimer('fire', 'Fireball', '#ffa200', window.GameConfig.POWERUP_DURATION, () => {
          this.activePowerups.fire = false;
          this._setFireballActive(false);
          // Restore paddle skin depending on whether big paddle remains
          if (this.activePowerups.big) {
            if (this.textures.exists('paddle_wide')) paddle.setTexture('paddle_wide');
          } else if (this.textures.exists('paddle')) {
            paddle.setTexture('paddle');
          }
          // Restore ball textures
          this.balls.getChildren().forEach(b => {
            const k = b._baseKey || 'ball_blue';
            try { b.setTexture(k); } catch(_) {}
          });
        });
        break; }
    }
  }

  _createGameBall(x, y, texture, speed, angleRad) {
    const ball = this.balls.create(x, y, texture);
  ball._baseKey = texture;
    ball.setCollideWorldBounds(true);
    ball.setBounce(1);
    ball.body.onWorldBounds = true;
    ball.body.checkCollision.up = true;
    ball.body.checkCollision.down = true;
    ball.body.checkCollision.left = true;
    ball.body.checkCollision.right = true;
    ball.setVelocity(Math.cos(angleRad) * speed, Math.sin(angleRad) * speed);
  // Ensure ball renders above trail dots
  try { ball.setDepth(6); } catch(_) {}
  // Prepare time marker for sprite-based trail
  ball._lastTrailAt = 0;
    return ball;
  }

  _setFireballActive(active) {
    this.isFireball = !!active;
    if (this.coll_ball_bricks) this.coll_ball_bricks.active = !this.isFireball;
    if (this.coll_ball_powerBricks) this.coll_ball_powerBricks.active = !this.isFireball;
    if (this.over_ball_bricks) this.over_ball_bricks.active = this.isFireball;
    if (this.over_ball_powerBricks) this.over_ball_powerBricks.active = this.isFireball;
    // Visual cue: tint balls while fireball is active
    this.balls.getChildren().forEach(b => {
      try { this.isFireball ? b.setTint(0xffa200) : b.clearTint(); } catch(_) {}
    });
  }

  update() {
  if (window.isGamePaused || this.isPaused || this.isHelpVisible) return;
    if (this.paddle) {
      if (this.prevPaddleX !== null) {
        const dx = this.paddle.x - this.prevPaddleX;
        this.paddleSpeed = dx; // px/frame
        const dt = Math.max(1, this.game && this.game.loop ? (this.game.loop.delta || 16.67) : 16.67);
        this.paddleVx = dx * (1000 / dt); // px/second
      }
      this.prevPaddleX = this.paddle.x;
    }
    const w = this.sys.game.config.width;
    if (this.cursors.left && this.cursors.left.isDown) {
      const half = this.paddle.displayWidth / 2;
      const margin = Math.ceil((this._borderThickness || 3) / 2);
      const minX = margin + half;
      this.paddle.x = Math.max(minX, this.paddle.x - 5);
    } else if (this.cursors.right && this.cursors.right.isDown) {
      const half = this.paddle.displayWidth / 2;
      const margin = Math.ceil((this._borderThickness || 3) / 2);
      const maxX = w - margin - half;
      this.paddle.x = Math.min(maxX, this.paddle.x + 5);
    }
    if (this.paddle.body) this.paddle.body.setVelocity(0, 0);
    // Sprite-based trail: spawn small fading dots behind each ball
    if (this.balls) {
      const now = this.time.now || performance.now();
      this.balls.getChildren().forEach(b => {
        if (!b || !b.active) return;
        const last = b._lastTrailAt || 0;
        const interval = 40; // ms
        if (now - last >= interval) {
          b._lastTrailAt = now;
          try {
            const dot = this.add.image(b.x, b.y, 'particle_white').setAlpha(0.7);
            const tint = this._getTrailTintForBall ? this._getTrailTintForBall(b) : 0xffffff;
            try { dot.setTint(tint); } catch(_) {}
            dot.setScale(1.0);
            if (dot.setDepth) dot.setDepth(4);
            this.tweens.add({
              targets: dot,
              alpha: 0,
              scale: 0,
              duration: 280,
              ease: 'Linear',
              onComplete: () => { try { dot.destroy(); } catch(_) {} }
            });
          } catch(_) {}
        }
      });
    }
  }

  _getTrailTintForBall(ball) {
    // Prefer an existing tint if applied (e.g., during fireball mode)
    try {
      if (typeof ball.tintTopLeft === 'number' && ball.tintTopLeft !== 0xffffff) return ball.tintTopLeft;
    } catch(_) {}
    const key = (ball && ball.texture && ball.texture.key) ? ball.texture.key : '';
    switch (key) {
      case 'ball_blue': return 0x3aa0ff;
      case 'ball_red': return 0xff3b30;
      case 'ball_green': return 0x35c759;
      case 'ball_yellow': return 0xffd700;
      case 'ball_fireball': return 0xffa200;
      default: return 0xffffff;
    }
  }
}

window.GameScene = GameScene;