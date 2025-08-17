// GameOverScene
class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOverScene'); }
    init(data) {
        this.score = data.score;
        this.highScore = data.highScore;
    }
    create() {
    // Play game over sound effect
    this.sound.play('gameover');
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const textStyle = {
            fontSize: '48px',
            color: '#ff4444',
            align: 'center',
            fontFamily: 'Arial',
            fontStyle: 'bold',
        };
        this.add.text(width / 2, height / 2 - 80, 'Game Over', textStyle).setOrigin(0.5);
        this.add.text(width / 2, height / 2, `Score: ${this.score || 0}`, { fontSize: '32px', color: '#fff' }).setOrigin(0.5);
        this.add.text(width / 2, height / 2 + 40, `High Score: ${this.highScore || 0}`, { fontSize: '28px', color: '#ffff00' }).setOrigin(0.5);
        const button = this.add.text(width / 2, height / 2 + 120, 'Return to Main Menu', {
            fontSize: '28px', color: '#00ffff', backgroundColor: '#222', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();
        button.on('pointerdown', () => {
            this.scene.start('MainMenu');
        });
    }
}
window.GameOverScene = GameOverScene;
