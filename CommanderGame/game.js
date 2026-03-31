// game.js
import BootScene from './bootScene.js';
// 提前引入 BattleScene，防止报错（如果还没有写，可以先注释掉 scene 里的 BattleScene）
// import BattleScene from './battleScene.js';

let game = null;

export function initPhaserGame() {
    if (game) return; // 防止重复初始化

    const config = {
        type: Phaser.AUTO,
        parent: 'game-container', // 挂载到 index.html 中的 div
        width: window.innerWidth,
        height: window.innerHeight,
        transparent: true, // 透明背景，露出底层的CSS星空/颜色
        scale: {
            mode: Phaser.Scale.RESIZE, // 窗口大小改变时自动调整
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        scene: [
            BootScene,
            BattleScene
        ]
    };

    game = new Phaser.Game(config);
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        game.scale.resize(window.innerWidth, window.innerHeight);
    });
}
