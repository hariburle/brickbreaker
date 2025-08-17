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
    const panelW = 600, panelH = 460;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;
    const panel = this.add.graphics();
    panel.fillStyle(window.GameConfig.COLORS.helpBox, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    panel.lineStyle(2, 0x00ffff, 1);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);

    this.add.text(w / 2, h / 2 - 180, 'Settings', { fontFamily: 'monospace', fontSize: window.GameConfig.FONT_SIZES.title, color: window.GameConfig.COLORS.text }).setOrigin(0.5);

        // Sound toggle (persisted)
    const style = { fontFamily: 'monospace', fontSize: window.GameConfig.FONT_SIZES.button, color: window.GameConfig.COLORS.button, padding: { x: 20, y: 10 } };
        let muted = localStorage.getItem('bb_soundMuted') === 'true';

        const makeToggleButton = (label, yPos) => {
            const textObj = this.add.text(w / 2, yPos, label, style).setOrigin(0.5).setInteractive();
            const bg = this.add.graphics();
            const draw = (color) => {
                const b = textObj.getBounds();
                bg.clear();
                bg.fillStyle(color, 1);
                bg.fillRoundedRect(b.x, b.y, b.width, b.height, 16);
            };
            draw(window.GameConfig.COLORS.normal);
            this.children.moveBelow(bg, textObj);
            textObj.on('pointerover', () => draw(window.GameConfig.COLORS.hover));
            textObj.on('pointerout', () => draw(window.GameConfig.COLORS.normal));
            return { textObj, bg, draw };
        };

        const y0 = h / 2 - 100;
        const y1 = h / 2 - 40;
        const y2 = h / 2 + 20;
        const y3 = h / 2 + 80;

        const labelFor = (m) => `Sound: ${m ? 'Off' : 'On'}`;
        let toggle = makeToggleButton(labelFor(muted), y0);
        toggle.textObj.on('pointerdown', () => {
            muted = !muted;
            localStorage.setItem('bb_soundMuted', String(muted));
            if (this.sound && typeof this.sound.setMute === 'function') this.sound.setMute(muted);
            toggle.textObj.setText(labelFor(muted));
            toggle.draw(window.GameConfig.COLORS.hover);
        });

        // SFX Volume control (persisted, affects this.sound volume)
        const volKey = 'bb_sfxVolume';
        let volume = parseFloat(localStorage.getItem(volKey));
        if (isNaN(volume)) volume = 1;
        if (this.sound && typeof this.sound.setVolume === 'function') this.sound.setVolume(volume);
        const volStyle = { fontFamily: 'monospace', fontSize: window.GameConfig.FONT_SIZES.button, color: window.GameConfig.COLORS.button };
        const volLabel = this.add.text(w / 2, y1, `SFX Volume: ${Math.round(volume * 100)}%`, volStyle).setOrigin(0.5);
        const adjustVolume = (delta) => {
            volume = Phaser.Math.Clamp(Number((volume + delta).toFixed(2)), 0, 1);
            localStorage.setItem(volKey, String(volume));
            if (this.sound && typeof this.sound.setVolume === 'function') this.sound.setVolume(volume);
            volLabel.setText(`SFX Volume: ${Math.round(volume * 100)}%`);
            // Re-layout +/- buttons based on new label width
            layoutVolButtons();
        };
        // Create +/- buttons positioned relative to label bounds (avoids overlap)
        const btnStyle = { fontFamily: 'monospace', fontSize: window.GameConfig.FONT_SIZES.button, color: window.GameConfig.COLORS.button, padding: { x: 16, y: 6 } };
        const minusBtn = createRoundedButton(this, 0, y1, '−', btnStyle, () => adjustVolume(-0.1));
        const plusBtn = createRoundedButton(this, 0, y1, '+', btnStyle, () => adjustVolume(0.1));
        const layoutVolButtons = () => {
            const b = volLabel.getBounds();
            // center +/- with comfortable gap outside the label bounds
            const gap = 28;
            const minusCenterX = b.x - gap - 18; // 18 ~= half of small pill width visual
            const plusCenterX = b.x + b.width + gap + 18;
            // Update children positions inside our button groups
            const setGroupX = (group, cx) => {
                const [bg, txt] = group.getChildren();
                const dy = (txt && txt.y) || y1; // keep y
                if (txt) { txt.setX(cx); }
                if (bg && txt) {
                    const tb = txt.getBounds();
                    bg.clear();
                    bg.fillStyle(window.GameConfig.COLORS.normal, 1);
                    bg.fillRoundedRect(tb.x, tb.y, tb.width, tb.height, 16);
                }
            };
            setGroupX(minusBtn, minusCenterX);
            setGroupX(plusBtn, plusCenterX);
        };
        layoutVolButtons();

        // Procedural Levels toggle
        let useProcedural = localStorage.getItem('bb_useProceduralLevels') === 'true';
        const labelProc = () => `Procedural Levels: ${useProcedural ? 'On' : 'Off'}`;
    let procBtn = makeToggleButton(labelProc(), y2);
        procBtn.textObj.on('pointerdown', () => {
            useProcedural = !useProcedural;
            localStorage.setItem('bb_useProceduralLevels', String(useProcedural));
            procBtn.textObj.setText(labelProc());
            procBtn.draw(window.GameConfig.COLORS.hover);
        });

        // Reset High Score
        createRoundedButton(this, w / 2, y3, 'Reset High Score', { fontSize: window.GameConfig.FONT_SIZES.smallButton, color: window.GameConfig.COLORS.button, padding: { x: 20, y: 10 } }, () => {
            localStorage.removeItem('bb_highscore');
            const msg = this.add.text(w / 2, y3 + 40, 'High score reset', { fontSize: window.GameConfig.FONT_SIZES.smallButton, color: '#ffff00' }).setOrigin(0.5);
            this.time.delayedCall(1200, () => msg.destroy());
        });

    createRoundedButton(this, w / 2, h / 2 + 160, 'Back', { fontFamily: 'monospace', fontSize: window.GameConfig.FONT_SIZES.smallButton, color: window.GameConfig.COLORS.button, padding: { x: 20, y: 10 } }, () => {
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
