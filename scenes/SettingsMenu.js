// SettingsMenu Scene
class SettingsMenu extends Phaser.Scene {
    constructor() { super('SettingsMenu'); }
    init(data) {
        this.returnTo = (data && data.returnTo) || 'MainMenu';
    }
    create() {
        const w = this.sys.game.config.width;
        const h = this.sys.game.config.height;
    // Opaque centered panel (no transparent overlay)
    const panelW = 600, panelH = 360;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;
    const panel = this.add.graphics();
    panel.fillStyle(window.GameConfig.COLORS.helpBox, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    panel.lineStyle(2, 0x00ffff, 1);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);

        this.add.text(w / 2, h / 2 - 120, 'Settings', { fontSize: window.GameConfig.FONT_SIZES.title, color: window.GameConfig.COLORS.text }).setOrigin(0.5);

        // Sound toggle (persisted)
        const style = { fontSize: window.GameConfig.FONT_SIZES.button, color: window.GameConfig.COLORS.button, padding: { x: 20, y: 10 } };
        let muted = localStorage.getItem('bb_soundMuted') === 'true';

        const makeToggleButton = (label) => {
            const textObj = this.add.text(w / 2, h / 2, label, style).setOrigin(0.5).setInteractive();
            const bounds = textObj.getBounds();
            const bg = this.add.graphics();
            const draw = (color) => { bg.clear(); bg.fillStyle(color, 1); bg.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 16); };
            draw(window.GameConfig.COLORS.normal);
            this.children.moveBelow(bg, textObj);
            textObj.on('pointerover', () => draw(window.GameConfig.COLORS.hover));
            textObj.on('pointerout', () => draw(window.GameConfig.COLORS.normal));
            return { textObj, bg, draw };
        };

        const labelFor = (m) => `Sound: ${m ? 'Off' : 'On'}`;
        let toggle = makeToggleButton(labelFor(muted));
        toggle.textObj.on('pointerdown', () => {
            muted = !muted;
            localStorage.setItem('bb_soundMuted', String(muted));
            if (this.sound && typeof this.sound.setMute === 'function') this.sound.setMute(muted);
            toggle.textObj.setText(labelFor(muted));
            const b = toggle.textObj.getBounds();
            toggle.draw(window.GameConfig.COLORS.hover);
        });

    createRoundedButton(this, w / 2, h / 2 + 120, 'Back', { fontSize: window.GameConfig.FONT_SIZES.smallButton, color: window.GameConfig.COLORS.button, padding: { x: 20, y: 10 } }, () => {
            if (this.returnTo === 'GameScene') {
                // Close settings overlay and resume game scene
                this.scene.stop();
                const gs = this.scene.get('GameScene');
                if (gs && gs.resumeGame) gs.resumeGame();
            } else {
                this.scene.start('MainMenu');
            }
        });
    window.SettingsMenu = SettingsMenu;
    }
};
