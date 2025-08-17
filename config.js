// Game configuration and constants
const config = {
    LEVELS: [
        // Level 1: 1 row, mixed bricks
        [
            [1, 2, 3, 4, 5, 5, 4, 3, 2, 1]
        ],
        // Level 2: 2 rows, mixed bricks
        [
            [1, 2, 3, 2, 1, 3, 2],
            [3, 1, 2, 3, 2, 1, 3]
        ]
    ],
    COMBO_TIMER_DURATION: 2000, // milliseconds
    POWERUP_DURATION: 10000, // milliseconds
    BRICK_POINTS: { 1: 10, 2: 25, 'crack': 5 },
    COLORS: {
        normal: 0x333333,
        hover: 0x555555,
        powerup: 0x00ff00,
        text: '#fff',
        button: '#0ff',
        helpBox: 0x222233
    },
    FONT_SIZES: {
        title: '48px',
        button: '32px',
        smallButton: '24px',
        hud: '18px',
        help: '18px'
    },
    // Bottom status display background opacity (0 disables background rectangle)
    STATUS_BG_ALPHA: 0,
    // Extra horizontal margin so the brick formation leaves a corridor near walls
    SIDE_MARGIN: 100
};

window.GameConfig = config;