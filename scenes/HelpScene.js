// HelpScene: Enhanced help with images and sections
class HelpScene extends Phaser.Scene {
  constructor() { super('HelpScene'); }
  create() {
    const group = window.createHelpPanel(this, {
      onBack: () => this.scene.start('MainMenu')
    });
    this.input.keyboard.once('keydown-ESC', () => this.scene.start('MainMenu'));
  }
}
window.HelpScene = HelpScene;
