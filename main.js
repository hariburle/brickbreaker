// --- REQUIREMENTS TRACKER ---
// 1. Ball respawn from paddle center with random direction after life loss [implemented]
// 2. Game over and restart when all lives are lost [implemented]
// 3. Persistent high score tracking and display [implemented]
// 4. Distinct color for power-up bricks [implemented]
// 5. Brick layout should be dynamic and adapt to asset size [implemented]
// 6. Power-up bricks require two hits and drop items from their center [implemented]
// 7. Multiple levels with progression upon clearing bricks [implemented]
// 8. Keyboard controls (arrows) for paddle movement [implemented]
// 9. Ball speed adjustment (+/- keys) with HUD display [implemented]
// 10. Combo-based scoring system with floating text [implemented]
// 11. Refactored for clarity and maintainability [implemented]
// 12. Speed control physics adjusted for noticeable effect [implemented]
// 13. Score and lives persist between levels [implemented]
// 14. Fixed level completion logic and removed dead code [implemented]
// 15. Fixed combo scoring logic and help screen behavior [implemented]
// 16. Made all text buttons visible and interactive [implemented]
// 17. Improved pause screen button with rounded corners and hover effect [implemented]
// 18. Improved button UI with rounded corners and consistent visibility [implemented]
// 19. Fixed power-up paddle texture logic [implemented]
// 20. Renamed power-up to 'Big Paddle' and updated asset [implemented]
// 21. Renamed power-up paddle asset to 'paddle_wide' for clarity [implemented]
// 22. Added "You Win!" scene for completing all levels [implemented]
// 23. Game auto-pauses when window loses focus [implemented]
// 24. Fixed power-up timer crash, asset key mismatch, and redundant update logic [implemented]
// 25. Sound effects for key game events [implemented]
// 26. Fixed ReferenceError for global constants [implemented]
// --- END REQUIREMENTS TRACKER ---

// --- Game Configuration ---
// Use global variables from config.js and uiUtils.js loaded via <script> tags
// Phaser Brick Breaker Game Implementation
// Only Preloader and game initialization remain here. All other scenes are loaded from scenes/*.js and attached to window.

// No global config declaration here; only Phaser game config below

class Preloader extends Phaser.Scene {
    constructor() { super('Preloader'); }
    preload() {
        //    console.log('Preloader: preload started');
        // Add a loading bar to give visual feedback
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 30, 320, 50);

        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading...',
            style: { font: '20px monospace', fill: '#ffffff' }
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 20, 300 * value, 30);
                //console.log(`Preloader: loading progress ${Math.round(value * 100)}%`);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
                //console.log('Preloader: asset loading complete');
        });

        // Load all game assets
    this.load.image('paddle', 'assets/paddle.png');
    this.load.image('paddle_wide', 'assets/paddle_wide.png');
    this.load.image('ball', 'assets/ball_blue.png'); // Default ball texture
    this.load.image('ball_blue', 'assets/ball_blue.png'); // Default ball
    this.load.image('ball_red', 'assets/ball_red.png');
    this.load.image('ball_green', 'assets/ball_green.png');
    this.load.image('ball_yellow', 'assets/ball_yellow.png');
    this.load.image('brick_green', 'assets/brick_green.png');
    this.load.image('brick_blue', 'assets/brick_blue.png');
    this.load.image('brick_yellow', 'assets/brick_yellow.png');
    this.load.image('brick_green_crack', 'assets/brick_green_crack.png');
    this.load.image('brick_blue_crack', 'assets/brick_blue_crack.png');
    this.load.image('brick_yellow_crack', 'assets/brick_yellow_crack.png');
    // New bricks for dedicated power-ups
    this.load.image('brick_purple', 'assets/brick_purple.png'); // Life
    this.load.image('brick_red', 'assets/brick_red.png');       // Fireball
    this.load.image('brick_purple_crack', 'assets/brick_purple_crack.png');
    this.load.image('brick_red_crack', 'assets/brick_red_crack.png');
    this.load.image('powerup_wide', 'assets/powerup_wide.png');
    this.load.image('powerup_multiball', 'assets/powerup_multiball.png');

    // Load audio files - bounce, crack_brick, gameover, hit_brick, hit_paddle, level_complete, lose_life, powerup_drop, powerup_collect
    this.load.audio('hit_brick', 'assets/sounds/hit_brick.wav');
    this.load.audio('hit_paddle', 'assets/sounds/hit_paddle.wav');
    this.load.audio('lose_life', 'assets/sounds/lose_life.wav');
    this.load.audio('crack_brick', 'assets/sounds/crack_brick.wav');
    this.load.audio('bounce', 'assets/sounds/bounce.wav');
    this.load.audio('gameover', 'assets/sounds/gameover.wav');
    this.load.audio('level_complete', 'assets/sounds/level_complete.wav');
    this.load.audio('powerup_drop', 'assets/sounds/powerup_drop.wav');
    this.load.audio('powerup_collect', 'assets/sounds/powerup_collect.wav');
    // New power-up/paddle assets
    this.load.image('powerup_life', 'assets/powerup_life.png');
    this.load.image('powerup_fireball', 'assets/powerup_fireball.png');
    this.load.image('paddle_fireball', 'assets/paddle_fireball.png');
    this.load.image('ball_fireball', 'assets/ball_fireball.png');
    }
    create() {
    // Apply persisted mute setting
    const muted = localStorage.getItem('bb_soundMuted') === 'true';
    if (this.sound && typeof this.sound.setMute === 'function') this.sound.setMute(muted);

    // Generate minimal textures for new power-ups/particles if not provided as images
    const hasValidTexture = (key) => {
        if (!this.textures.exists(key)) return false;
        try {
            const t = this.textures.get(key);
            return !!(t && t.source && t.source[0] && t.source[0].image);
        } catch (_) { return false; }
    };
    const makeCircleTex = (key, color, r) => {
        if (hasValidTexture(key)) return;
        const g = this.add.graphics();
        g.fillStyle(color, 1);
        g.fillCircle(r, r, r);
        g.generateTexture(key, r * 2, r * 2);
        g.destroy();
    };
    const makeRectTex = (key, color, w, h, radius = 6) => {
        if (hasValidTexture(key)) return;
        const g = this.add.graphics();
        g.fillStyle(color, 1);
        g.fillRoundedRect(0, 0, w, h, radius);
        g.generateTexture(key, w, h);
        g.destroy();
    };
    makeRectTex('powerup_life', 0xff3366, 28, 18, 6);         // placeholder life (if no image)
    makeRectTex('powerup_fireball', 0xff8800, 28, 18, 6);     // placeholder fireball (if no image)
    makeCircleTex('particle_white', 0xffffff, 3);       // general particle
    makeCircleTex('ball_fireball', 0xffa200, 8);        // placeholder fireball ball

    //    console.log('Preloader: create called, starting MainMenu');
        this.scene.start('MainMenu');
    }
}

const phaserConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 600
    },
    scene: [Preloader, MainMenu, HelpScene, GameScene, SettingsMenu, GameOverScene, YouWinScene],
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    }
};

const game = new Phaser.Game(phaserConfig);
    console.log('Phaser game created');

// Pause the game when the browser/tab loses focus
document.addEventListener('visibilitychange', () => {
    const gs = window.currentGameScene;
    if (!gs) return;
    if (document.hidden) {
        if (gs.isHelpVisible) return; // don't override in-game Help overlay
        window.isGamePaused = true;
        if (gs && gs.scene && gs.scene.isActive && gs.scene.isActive()) gs.pauseGame();
    } else {
        if (gs.isHelpVisible) return; // don't auto-resume while Help is open
        window.isGamePaused = false;
        if (gs && gs.scene && gs.scene.isActive && gs.scene.isActive()) gs.resumeGame();
    }
});

window.addEventListener('blur', () => {
    const gs = window.currentGameScene;
    if (!gs) return;
    if (gs.isHelpVisible) return;
    window.isGamePaused = true;
    if (gs && gs.scene && gs.scene.isActive && gs.scene.isActive()) gs.pauseGame();
});

window.addEventListener('focus', () => {
    const gs = window.currentGameScene;
    if (!gs) return;
    if (gs.isHelpVisible) return;
    window.isGamePaused = false;
    if (gs && gs.scene && gs.scene.isActive && gs.scene.isActive()) gs.resumeGame();
});