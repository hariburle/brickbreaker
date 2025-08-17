/**
 * A helper function to create a text button with a rounded background.
 * @param {Phaser.Scene} scene The scene to add the button to.
 * @param {number} x The x-coordinate of the button.
 * @param {number} y The y-coordinate of the button.
 * @param {string} text The text to display on the button.
 * @param {object} style The text style configuration.
 * @param {function} onClick The callback function to execute when the button is clicked.
 * @returns {Phaser.GameObjects.Group} A group containing the button's text and background.
 */
function createRoundedButton(scene, x, y, text, style, onClick) {
    const buttonText = scene.add.text(x, y, text, style).setOrigin(0.5).setInteractive();
    const textBounds = buttonText.getBounds();
    const background = scene.add.graphics();
    const drawBackground = (color) => {
        background.clear();
        background.fillStyle(color, 1);
        background.fillRoundedRect(textBounds.x, textBounds.y, textBounds.width, textBounds.height, 16);
    };
    drawBackground(window.GameConfig.COLORS.normal);
    scene.children.moveBelow(background, buttonText);
    buttonText.on('pointerover', () => drawBackground(window.GameConfig.COLORS.hover));
    buttonText.on('pointerout', () => drawBackground(window.GameConfig.COLORS.normal));
    buttonText.on('pointerdown', onClick);
    return scene.add.group([background, buttonText]);
}

/**
 * Create the enhanced Help panel used in both HelpScene and in-game overlay.
 * @param {Phaser.Scene} scene
 * @param {{ onBack: Function }} options
 * @returns {Phaser.GameObjects.Group} group of panel elements
 */
function createHelpPanel(scene, options = {}) {
    const w = scene.sys.game.config.width; const h = scene.sys.game.config.height;
    const panelW = Math.min(680, w * 0.9);
    const panelH = Math.min(520, h * 0.85);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    const g = scene.add.graphics();
    g.fillStyle(window.GameConfig.COLORS.helpBox, 1);
    g.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    g.lineStyle(2, 0x00ffff, 1);
    g.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);
    g.setDepth(1000);

    const title = scene.add.text(w/2, panelY + 32, 'Help', {
        fontSize: '44px',
        color: window.GameConfig.COLORS.text
    }).setOrigin(0.5).setDepth(1000);

    const left = panelX + 24; const right = panelX + panelW - 24;
    let y = panelY + 80;
    const makeLine = (t, fs) => scene.add.text(left, y, t, {
        fontFamily: 'monospace',
        fontSize: fs || '16px',
        color: window.GameConfig.COLORS.text,
        wordWrap: { width: panelW - 48, useAdvancedWrap: true }
    }).setOrigin(0, 0).setDepth(1000);

    const elements = [g, title];

    elements.push(makeLine('Controls:')); y += 24;
    elements.push(makeLine('• Move Paddle: Mouse or Arrow Keys')); y += 22;
    elements.push(makeLine('• Change Ball Speed: + / -')); y += 22;
    elements.push(makeLine('• Toggle Sound: Press S or click the HUD sound icon (🔊/🔇)')); y += 22;
    elements.push(makeLine('• Pause (in game): ESC')); y += 28;

    elements.push(makeLine('Scoring:')); y += 24;
    const pts = window.GameConfig.BRICK_POINTS || { 1: 10, 2: 25, crack: 5 };
    const iconRow = (texKey, text) => {
        const imgH = 24; let dx = left; let iconObj = null; let scale = 1;
        const tex = scene.textures.get(texKey);
        if (tex && tex.source[0]) {
            const srcH = tex.getSourceImage().height;
            scale = imgH / srcH;
            iconObj = scene.add.image(left, y + imgH/2, texKey).setOrigin(0, 0.5).setScale(scale).setDepth(1000);
            elements.push(iconObj);
            dx = left + iconObj.displayWidth + 10;
        }
        const wrapWidth = panelX + panelW - 24 - dx;
        const label = scene.add.text(dx, y, text, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: window.GameConfig.COLORS.text,
            wordWrap: { width: wrapWidth, useAdvancedWrap: true }
        }).setOrigin(0, 0).setDepth(1000);
        elements.push(label);
        y += imgH + 6;
    };
    iconRow('brick_green', `Normal Brick = +${pts[1]} pts`);
    iconRow('brick_blue', `Power-up Brick (2 hits): crack +${pts.crack}, destroy +${pts[2]} and drops a power-up`);
    iconRow('brick_yellow', `Power-up Brick (2 hits): crack +${pts.crack}, destroy +${pts[2]} and drops a power-up`);
    y += 8;

    elements.push(makeLine('Power-ups:')); y += 24;
    const powerRow = (texKey, label) => {
        const imgH = 24; let dx = left; let iconObj = null; let scale = 1;
        const tex = scene.textures.get(texKey);
        if (tex && tex.source[0]) {
            const srcH = tex.getSourceImage().height;
            scale = imgH / srcH;
            iconObj = scene.add.image(left, y + imgH/2, texKey).setOrigin(0, 0.5).setScale(scale).setDepth(1000);
            elements.push(iconObj);
            dx = left + iconObj.displayWidth + 10;
        }
        const wrapWidth = panelX + panelW - 24 - dx;
        const labelObj = scene.add.text(dx, y, label, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: window.GameConfig.COLORS.text,
            wordWrap: { width: wrapWidth, useAdvancedWrap: true }
        }).setOrigin(0, 0).setDepth(1000);
        elements.push(labelObj);
        y += imgH + 6;
    };
    powerRow('powerup_wide', 'Big Paddle: Temporarily widens the paddle (timed)');
    powerRow('powerup_multiball', 'Multi-ball: Spawns extra balls with varied angles/speeds');

    y += 8; elements.push(makeLine('Tip: Hit the ball off-center and move the paddle during impact to add spin and vary angles.'));

    const backBtnGroup = createRoundedButton(scene, w/2, panelY + panelH - 28, 'Back', {
        fontSize: '22px',
        color: window.GameConfig.COLORS.button,
        padding: { x: 20, y: 10 }
    }, () => {
        if (options.onBack) options.onBack();
    });
    // Push both background and text from Back button
    backBtnGroup.getChildren().forEach(c => { c.setDepth(1000); elements.push(c); });

    // Wrap in a container for easier layering and cleanup
    const container = scene.add.container(0, 0, elements);
    container.setDepth(1000);
    return container;
}

// expose helpers globally
window.createRoundedButton = createRoundedButton;
window.createHelpPanel = createHelpPanel;
