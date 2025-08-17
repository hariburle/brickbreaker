// YouWinScene.js
class YouWinScene extends Phaser.Scene {
    constructor() { super('YouWinScene'); }
    init(data) {
        this.score = data.score || 0;
        this.highScore = data.highScore || 0;
    }
    create() {
        const w = this.sys.game.config.width; const h = this.sys.game.config.height;
        const cx = w / 2; const cy = h / 2;
        this.add.text(cx, cy - 120, 'You Win!', {
            fontSize: window.GameConfig.FONT_SIZES.title, color: '#00ff00', fontFamily: 'Arial', align: 'center'
        }).setOrigin(0.5);
        this.add.text(cx, cy - 40, `Score: ${this.score}`, {
            fontSize: window.GameConfig.FONT_SIZES.button, color: window.GameConfig.COLORS.text, fontFamily: 'Arial', align: 'center'
        }).setOrigin(0.5);
        this.add.text(cx, cy, `High Score: ${this.highScore}`, {
            fontSize: window.GameConfig.FONT_SIZES.smallButton, color: '#ffd700', fontFamily: 'Arial', align: 'center'
        }).setOrigin(0.5);
        const playAgainBtn = this.add.text(cx, cy + 80, 'Play Again', {
            fontSize: window.GameConfig.FONT_SIZES.button, color: window.GameConfig.COLORS.button, backgroundColor: '#222', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();
        playAgainBtn.on('pointerdown', () => {
            this.scene.start('MainMenu');
        });
        window.YouWinScene = YouWinScene;
    }
};
