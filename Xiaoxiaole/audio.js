// 使用 Web Audio API 纯代码合成音效，无需外部资源
const AudioSys = {
    ctx: null,
    enabled: true,

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    playTone(freq, type = 'sine', duration = 0.1, vol = 0.1) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    // 交互音效
    click() { this.playTone(600, 'sine', 0.05, 0.05); },
    swap() { this.playTone(400, 'triangle', 0.1, 0.05); },
    error() { this.playTone(150, 'sawtooth', 0.2, 0.1); },
    
    // 消除音效 (随连击次数音调升高)
    match(combo = 1) { 
        const baseFreq = 440 + (combo * 50);
        this.playTone(baseFreq, 'square', 0.15, 0.08); 
    },
    
    // 特殊道具爆炸
    bomb() { 
        this.playTone(100, 'square', 0.3, 0.2); 
        setTimeout(() => this.playTone(50, 'sawtooth', 0.4, 0.2), 50);
    },
    
    // 过关音效琶音
    levelUp() { 
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'sine', 0.2, 0.1), i * 100);
        });
    },
    
    // 游戏结束
    gameOver() {
        [392.00, 349.23, 329.63, 261.63].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'triangle', 0.4, 0.1), i * 250);
        });
    }
};
