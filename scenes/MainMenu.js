// MainMenu Scene
class MainMenu extends Phaser.Scene {
    constructor() { super('MainMenu'); }
    create() {
        const w = this.sys.game.config.width; const h = this.sys.game.config.height;
        const cx = w / 2; const cy = h / 2;
        const spacing = 56;
        this.add.text(cx, cy - spacing * 3, 'Brick Breaker', { fontSize: window.GameConfig.FONT_SIZES.title, color: window.GameConfig.COLORS.text }).setOrigin(0.5);
    createRoundedButton(this, cx, cy - spacing, 'Play', { fontSize: window.GameConfig.FONT_SIZES.button, color: window.GameConfig.COLORS.button, padding: { x: 20, y: 10 } }, () => this.scene.start('GameScene'));
    createRoundedButton(this, cx, cy, 'Settings', { fontSize: window.GameConfig.FONT_SIZES.smallButton, color: window.GameConfig.COLORS.button, padding: { x: 20, y: 10 } }, () => this.scene.start('SettingsMenu', { returnTo: 'MainMenu' }));
    createRoundedButton(this, cx, cy + spacing, 'Help', { fontSize: window.GameConfig.FONT_SIZES.smallButton, color: window.GameConfig.COLORS.button, padding: { x: 20, y: 10 } }, () => this.scene.start('HelpScene'));
    }
};
window.MainMenu = MainMenu;
