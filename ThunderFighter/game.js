// ==========================================
// 核心引擎与音频系统
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
let W = canvas.width = window.innerWidth;
let H = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initStars();
});

// 星空背景初始化
let stars = [];
function initStars() {
    stars = [];
    for(let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            size: Math.random() * 2 + 0.5,
            alpha: Math.random() * 0.3 + 0.05, 
            speed: Math.random() * 100 + 50 
        });
    }
}
initStars();

// Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isMuted = false;

function playSound(type) {
    if (isMuted || audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gainNode.gain.setValueAtTime(0.02, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gainNode.gain.setValueAtTime(0.05, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'player_hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        gainNode.gain.setValueAtTime(0.2, now); 
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'explode') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'powerup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.1);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'laser') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(500, now + 0.2);
        gainNode.gain.setValueAtTime(0.05, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'warning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.setValueAtTime(400, now + 0.25);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'shield') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.linearRampToValueAtTime(500, now + 0.2);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    }
}

// ==========================================
// 游戏状态与输入
// ==========================================
let gameState = 'menu'; // menu, playing, paused, gameover
let score = 0;
let stageLevel = 1; 
let bossMode = false;
let bossDefeatedCount = 0;
let nextBossScore = 5000;

let scoreMultiplier = 1.0; 
let lastPowerupScoreThreshold = 0; 
let guaranteedPowerup = false; 

const keys = {};
const mouse = { x: W/2, y: H/2, isDown: false };

window.addEventListener('keydown', e => { 
    keys[e.key.toLowerCase()] = true; 
    if(audioCtx.state==='suspended') audioCtx.resume();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', () => { mouse.isDown = true; if(audioCtx.state==='suspended') audioCtx.resume(); });
window.addEventListener('mouseup', () => { mouse.isDown = false; });
window.addEventListener('touchstart', e => { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; mouse.isDown = true; if(audioCtx.state==='suspended') audioCtx.resume(); });
window.addEventListener('touchmove', e => { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; });
window.addEventListener('touchend', () => { mouse.isDown = false; });

document.getElementById('startBtn').onclick = () => {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    document.getElementById('pauseBtn').style.display = 'block';
    initGame();
    gameState = 'playing';
    lastTime = performance.now();
};

document.getElementById('pauseBtn').onclick = () => {
    if (gameState === 'playing') { gameState = 'paused'; document.getElementById('pauseMenu').style.display = 'flex'; }
};
document.getElementById('resumeBtn').onclick = () => {
    if (gameState === 'paused') {
        gameState = 'playing'; 
        document.getElementById('pauseMenu').style.display = 'none';
        lastTime = performance.now(); 
    }
};

const restartGame = () => {
    initGame(); gameState = 'playing';
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('gameOverMenu').style.display = 'none';
    document.getElementById('bossUI').style.display = 'none';
    document.getElementById('warningScreen').style.display = 'none';
    lastTime = performance.now();
};

const returnToMenu = () => {
    gameState = 'menu';
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('gameOverMenu').style.display = 'none';
    document.getElementById('bossUI').style.display = 'none';
    document.getElementById('warningScreen').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';
    [bulletPool, particlePool, itemPool, enemyPool].forEach(p => p.items.forEach(i => i.active = false));
    boss.active = false;
};

document.getElementById('restartBtnPause').onclick = restartGame;
document.getElementById('restartBtn').onclick = restartGame;
document.getElementById('menuBtnPause').onclick = returnToMenu;
document.getElementById('menuBtnOver').onclick = returnToMenu;
document.getElementById('muteBtn').onclick = (e) => {
    isMuted = !isMuted;
    e.target.innerText = `音效: ${isMuted ? '关' : '开'}`;
};

// ==========================================
// 对象池与基础类
// ==========================================
class Pool {
    constructor(factory, size) {
        this.items = Array.from({length: size}, factory);
    }
    get() {
        for(let i=0; i<this.items.length; i++) {
            if(!this.items[i].active) {
                this.items[i].active = true;
                return this.items[i];
            }
        }
        return null;
    }
}

class Particle {
    constructor() { this.active = false; }
    spawn(x, y, vx, vy, color, life, size) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.color = color; this.life = life; this.maxLife = life;
        this.size = size; this.active = true;
    }
    update(dt) {
        if(!this.active) return;
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.life -= dt;
        if(this.life <= 0) this.active = false;
    }
    draw(ctx) {
        if(!this.active) return;
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}
const particlePool = new Pool(() => new Particle(), 500);

function createExplosion(x, y, color, count) {
    playSound('explode');
    for(let i=0; i<count; i++) {
        const p = particlePool.get();
        if(p) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 150 + 50;
            p.spawn(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, color, Math.random()*0.5+0.2, Math.random()*3+1);
        }
    }
}

class Bullet {
    constructor() { this.active = false; }
    spawn(x, y, vx, vy, color, isPlayer, dmg, isHoming = false) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.color = color; this.isPlayer = isPlayer; this.dmg = dmg;
        this.isHoming = isHoming;
        this.radius = isPlayer ? 3 : 4;
        if (this.isHoming) this.radius = 5;
        this.active = true;
    }
    update(dt) {
        if(!this.active) return;
        
        // 改进后的通用追踪逻辑，支持玩家打怪，也支持Boss打玩家
        if (this.isHoming) {
            let targetX, targetY;
            if (this.isPlayer) {
                let target = null;
                let minDist = 800; 
                enemyPool.items.forEach(e => {
                    if(e.active && e.y < H && e.y > -20) {
                        let d = Math.hypot(e.x - this.x, e.y - this.y);
                        if(d < minDist) { minDist = d; target = e; }
                    }
                });
                if(boss.active && boss.state === 'attack') {
                    let d = Math.hypot(boss.x - this.x, boss.y - this.y);
                    if(d < minDist) { minDist = d; target = boss; }
                }
                if(target) { targetX = target.x; targetY = target.y; }
            } else {
                // 如果是敌人的追踪弹，目标就是玩家
                targetX = player.x; targetY = player.y;
            }
            
            if(targetX !== undefined) {
                let angleToTarget = Math.atan2(targetY - this.y, targetX - this.x);
                let currentAngle = Math.atan2(this.vy, this.vx);
                let diff = angleToTarget - currentAngle;
                
                while (diff <= -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                
                // 玩家导弹转弯快，Boss导弹转弯慢(给玩家躲避空间)
                let turnSpeed = this.isPlayer ? 10 * dt : 1.5 * dt; 
                let newAngle = currentAngle + Math.sign(diff) * Math.min(Math.abs(diff), turnSpeed);
                
                let speed = Math.hypot(this.vx, this.vy);
                let maxSpeed = this.isPlayer ? 900 : 350;
                let accel = this.isPlayer ? 300 : 150;
                speed = Math.min(maxSpeed, speed + accel * dt); 
                
                this.vx = Math.cos(newAngle) * speed;
                this.vy = Math.sin(newAngle) * speed;
                
                if(Math.random() < 0.3) {
                    let p = particlePool.get();
                    if(p) p.spawn(this.x, this.y, -this.vx*0.2, -this.vy*0.2, this.color, 0.2, 1.5);
                }
            }
        }

        this.x += this.vx * dt; this.y += this.vy * dt;
        if(this.y < -50 || this.y > H + 50 || this.x < -50 || this.x > W + 50) this.active = false;
    }
    draw(ctx) {
        if(!this.active) return;
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    }
}
const bulletPool = new Pool(() => new Bullet(), 2500);

// ==========================================
// 玩家类
// ==========================================
class Player {
    constructor() {
        this.reset();
    }
    reset() {
        this.x = W / 2; this.y = H - 100;
        this.hp = 100; this.power = 1; this.speed = 350;
        this.shootCooldown = 0; this.radius = 12;
        this.laserCooldown = 0; this.laserActiveTime = 0;
        this.wingLaserCooldown = 0; this.wingLaserActiveTime = 0;
        this.wingmanAngle = 0;
        this.shieldActive = false;
        this.shieldTime = 0;
        this.hitTimer = 0; 
        this.bossHitSoundCooldown = 0; 
    }
    update(dt) {
        let dx = 0, dy = 0;
        if(keys['a'] || keys['arrowleft']) dx -= 1;
        if(keys['d'] || keys['arrowright']) dx += 1;
        if(keys['w'] || keys['arrowup']) dy -= 1;
        if(keys['s'] || keys['arrowdown']) dy += 1;
        
        if(dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            this.x += (dx/len) * this.speed * dt;
            this.y += (dy/len) * this.speed * dt;
        } else if (mouse.isDown) {
            this.x += (mouse.x - this.x) * 10 * dt;
            this.y += (mouse.y - this.y) * 10 * dt;
        }
        
        this.x = Math.max(this.radius + 20, Math.min(W - this.radius - 20, this.x));
        this.y = Math.max(this.radius + 20, Math.min(H - this.radius - 20, this.y));

        if(Math.random() < 0.5) {
            const p = particlePool.get();
            if(p) p.spawn(this.x + (Math.random()-0.5)*10, this.y + 15, 0, 150, '#0ff', 0.2, 2);
        }

        if(this.shieldActive) {
            this.shieldTime -= dt;
            if(this.shieldTime <= 0) this.shieldActive = false;
        }

        if(this.hitTimer > 0) this.hitTimer -= dt;
        if(this.bossHitSoundCooldown > 0) this.bossHitSoundCooldown -= dt;

        this.shootCooldown -= dt;
        if(this.shootCooldown <= 0) {
            this.shoot();
        }

        if (this.power >= 7) {
            if (this.laserActiveTime > 0) {
                this.laserActiveTime -= dt;
                this.processLaserDamage(dt, this.x, 20, 150); 
            } else {
                this.laserCooldown -= dt;
                if (this.laserCooldown <= 0) {
                    this.laserActiveTime = 0.5;
                    this.laserCooldown = 2.0;
                    playSound('laser');
                }
            }
        }

        if (this.power >= 8) {
            if (this.wingLaserActiveTime > 0) {
                this.wingLaserActiveTime -= dt;
                this.processLaserDamage(dt, this.x - 50, 10, 80); 
                this.processLaserDamage(dt, this.x + 50, 10, 80); 
            } else {
                this.wingLaserCooldown -= dt;
                if (this.wingLaserCooldown <= 0) {
                    this.wingLaserActiveTime = 0.3;
                    this.wingLaserCooldown = 1.5;
                }
            }
        }

        this.wingmanAngle += dt * 2;
    }
    shoot() {
        playSound('shoot');
        this.shootCooldown = Math.max(0.08, 0.2 - this.power * 0.015);
        const bSpeed = -600;
        const pX = this.x; const pY = this.y - 15;
        
        if (this.power === 1) {
            let b = bulletPool.get(); if(b) b.spawn(pX, pY, 0, bSpeed, '#0ff', true, 10);
        } else if (this.power === 2) {
            let b1 = bulletPool.get(); if(b1) b1.spawn(pX - 8, pY, 0, bSpeed, '#0ff', true, 10);
            let b2 = bulletPool.get(); if(b2) b2.spawn(pX + 8, pY, 0, bSpeed, '#0ff', true, 10);
        } else if (this.power >= 3) {
            let b1 = bulletPool.get(); if(b1) b1.spawn(pX - 12, pY, 0, bSpeed, '#0ff', true, 10 + this.power);
            let b2 = bulletPool.get(); if(b2) b2.spawn(pX, pY - 5, 0, bSpeed, '#0ff', true, 10 + this.power);
            let b3 = bulletPool.get(); if(b3) b3.spawn(pX + 12, pY, 0, bSpeed, '#0ff', true, 10 + this.power);
        }

        if (this.power >= 4) {
            let a1 = -0.2, a2 = 0.2;
            let b4 = bulletPool.get(); if(b4) b4.spawn(pX - 5, pY, Math.sin(a1)*bSpeed*-1, Math.cos(a1)*bSpeed, '#0ff', true, 8 + this.power);
            let b5 = bulletPool.get(); if(b5) b5.spawn(pX + 5, pY, Math.sin(a2)*bSpeed*-1, Math.cos(a2)*bSpeed, '#0ff', true, 8 + this.power);
        }

        if (this.power >= 5) {
            let a3 = -0.4, a4 = 0.4;
            let b6 = bulletPool.get(); if(b6) b6.spawn(pX - 10, pY, Math.sin(a3)*bSpeed*-1, Math.cos(a3)*bSpeed, '#0ff', true, 8 + this.power);
            let b7 = bulletPool.get(); if(b7) b7.spawn(pX + 10, pY, Math.sin(a4)*bSpeed*-1, Math.cos(a4)*bSpeed, '#0ff', true, 8 + this.power);
        }

        if (this.power >= 6) {
            let wx1 = this.x - 30; let wy1 = this.y + Math.sin(this.wingmanAngle)*5;
            let wx2 = this.x + 30; let wy2 = this.y + Math.cos(this.wingmanAngle)*5;
            let b8 = bulletPool.get(); if(b8) b8.spawn(wx1, wy1 - 10, 0, bSpeed, '#0f0', true, 10);
            let b9 = bulletPool.get(); if(b9) b9.spawn(wx2, wy2 - 10, 0, bSpeed, '#0f0', true, 10);
        }

        if (this.power >= 8) {
            let wx3 = this.x - 50; let wy3 = this.y + Math.sin(this.wingmanAngle+Math.PI)*5 + 10;
            let wx4 = this.x + 50; let wy4 = this.y + Math.cos(this.wingmanAngle+Math.PI)*5 + 10;
            let b10 = bulletPool.get(); if(b10) b10.spawn(wx3, wy3 - 10, 0, bSpeed, '#f0f', true, 10);
            let b11 = bulletPool.get(); if(b11) b11.spawn(wx4, wy4 - 10, 0, bSpeed, '#f0f', true, 10);
        }

        if (this.power >= 9) {
            let wx5 = this.x - 40; let wy5 = this.y + Math.sin(this.wingmanAngle*1.5)*5 + 25;
            let wx6 = this.x + 40; let wy6 = this.y + Math.cos(this.wingmanAngle*1.5)*5 + 25;
            let hbSpeed = -300; 
            let b12 = bulletPool.get(); if(b12) b12.spawn(wx5, wy5, -50, hbSpeed, '#f80', true, 15, true);
            let b13 = bulletPool.get(); if(b13) b13.spawn(wx6, wy6, 50, hbSpeed, '#f80', true, 15, true);
        }
    }
    processLaserDamage(dt, laserX, laserWidth, dmgRate) {
        enemyPool.items.forEach(e => {
            if (e.active && Math.abs(e.x - laserX) < laserWidth/2 + e.radius && e.y < this.y) {
                e.takeDamage(dmgRate * dt);
            }
        });
        if (boss.active && Math.abs(boss.x - laserX) < laserWidth/2 + 50 && boss.y < this.y) {
            boss.takeDamage(dmgRate * 1.5 * dt);
        }
    }
    takeHit(dmg) {
        if(this.shieldActive) {
            this.shieldActive = false;
            playSound('shield');
            createExplosion(this.x, this.y, '#0ff', 20);
            return;
        }
        this.hp -= dmg;
        this.power = Math.max(1, this.power - 1);
        playSound('player_hit');
        createExplosion(this.x, this.y, '#f00', 5);
        this.hitTimer = 0.1; 
        if(this.hp <= 0) gameOver();
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if(this.shieldActive) {
            ctx.shadowBlur = 15; ctx.shadowColor = '#0ff';
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + Math.sin(Date.now()/100)*0.3})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, this.radius + 20, 0, Math.PI*2); ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.shadowBlur = 15; ctx.shadowColor = '#0ff';
        
        if (this.hitTimer > 0) {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#fff';
        } else {
            ctx.fillStyle = '#113';
            ctx.strokeStyle = '#0ff';
        }
        
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -20); ctx.lineTo(15, 10); ctx.lineTo(0, 5); ctx.lineTo(-15, 10);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, -5, 3, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        if (this.power >= 6) {
            ctx.save();
            ctx.shadowBlur = 10; ctx.shadowColor = '#0f0';
            ctx.fillStyle = '#131'; ctx.strokeStyle = '#0f0'; ctx.lineWidth = 1.5;
            let yo1 = Math.sin(this.wingmanAngle)*5;
            let yo2 = Math.cos(this.wingmanAngle)*5;
            ctx.beginPath(); ctx.arc(this.x - 30, this.y + yo1, 5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(this.x + 30, this.y + yo2, 5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        if (this.power >= 8) {
            ctx.save();
            ctx.shadowBlur = 10; ctx.shadowColor = '#f0f';
            ctx.fillStyle = '#313'; ctx.strokeStyle = '#f0f'; ctx.lineWidth = 1.5;
            let yo3 = Math.sin(this.wingmanAngle+Math.PI)*5 + 10;
            let yo4 = Math.cos(this.wingmanAngle+Math.PI)*5 + 10;
            ctx.beginPath(); ctx.arc(this.x - 50, this.y + yo3, 4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(this.x + 50, this.y + yo4, 4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            
            if(this.wingLaserActiveTime > 0) {
                ctx.fillStyle = `rgba(255, 0, 255, ${Math.random()*0.5 + 0.3})`;
                ctx.fillRect(this.x - 55, 0, 10, this.y + yo3);
                ctx.fillRect(this.x + 45, 0, 10, this.y + yo4);
            }
            ctx.restore();
        }

        if (this.power >= 9) {
            ctx.save();
            ctx.shadowBlur = 10; ctx.shadowColor = '#f80';
            ctx.fillStyle = '#310'; ctx.strokeStyle = '#f80'; ctx.lineWidth = 1.5;
            let yo5 = Math.sin(this.wingmanAngle*1.5)*5 + 25;
            let yo6 = Math.cos(this.wingmanAngle*1.5)*5 + 25;
            
            ctx.beginPath();
            ctx.moveTo(this.x - 40, this.y + yo5 - 6);
            ctx.lineTo(this.x - 45, this.y + yo5 + 6);
            ctx.lineTo(this.x - 35, this.y + yo5 + 6);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(this.x + 40, this.y + yo6 - 6);
            ctx.lineTo(this.x + 35, this.y + yo6 + 6);
            ctx.lineTo(this.x + 45, this.y + yo6 + 6);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        if (this.power >= 7 && this.laserActiveTime > 0) {
            ctx.save();
            ctx.shadowBlur = 20; ctx.shadowColor = '#0ff';
            ctx.fillStyle = `rgba(0, 255, 255, ${Math.random()*0.5 + 0.5})`;
            ctx.fillRect(this.x - 10, 0, 20, this.y);
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x - 3, 0, 6, this.y);
            ctx.restore();
        }
    }
}
const player = new Player();

// ==========================================
// 敌机与道具
// ==========================================
class Item {
    constructor() { this.active = false; }
    spawn(x, y, type) { 
        this.x = x; this.y = y; this.active = true; this.radius = 10; this.vy = 80;
        this.type = type;
    }
    update(dt) {
        if(!this.active) return;
        this.y += this.vy * dt;
        
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if(dist < 150) {
            this.x += (player.x - this.x) * 3 * dt;
            this.y += (player.y - this.y) * 3 * dt;
        }

        if(dist < player.radius + this.radius) {
            this.active = false;
            playSound('powerup');
            if(this.type === 0) {
                if(player.power < 9) {
                    player.power++;
                } else {
                    player.shieldActive = true;
                    player.shieldTime = 30;
                }
            } else {
                player.hp = Math.min(100, player.hp + 30); 
            }
            updateHUD();
        }
        if(this.y > H + 20) this.active = false;
    }
    draw(ctx) {
        if(!this.active) return;
        const color = this.type === 0 ? '#ff0' : '#0f0';
        const text = this.type === 0 ? 'P' : 'H';
        ctx.shadowBlur = 15; ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = 'bold 12px Arial'; ctx.fillText(text, this.x-4, this.y+4);
        ctx.shadowBlur = 0;
    }
}
const itemPool = new Pool(() => new Item(), 20);

class Enemy {
    constructor() { this.active = false; }
    spawn(type, x, y, hpMulti) {
        this.type = type; this.x = x; this.y = y; this.active = true;
        this.time = 0; this.shootTimer = Math.random();
        this.hitTimer = 0; 
        
        this.radius = type === 2 ? 18 : 15;
        this.hp = [20, 30, 80, 60, 40, 70][type] * hpMulti;
        this.maxHp = this.hp;
        this.color = ['#f0f', '#0f0', '#ff0', '#f00', '#f80', '#b0f'][type];
        this.vx = 0; this.vy = [150, 100, 50, 80, 180, 60][type];
    }
    update(dt) {
        if(!this.active) return;
        this.time += dt;
        if(this.hitTimer > 0) this.hitTimer -= dt;
        
        if(this.type === 1) this.vx = Math.sin(this.time * 3) * 100;
        else if(this.type === 2 || this.type === 3 || this.type === 5) {
            if(this.y > 100) this.vy = 0; 
            this.vx = Math.sin(this.time) * 50;
        } else if(this.type === 4) {
            if(player.x < this.x) this.vx = -50; else this.vx = 50;
        }
        
        this.x += this.vx * dt; this.y += this.vy * dt;

        this.shootTimer -= dt;
        if(this.shootTimer <= 0) {
            const bSpeed = 200 + stageLevel * 10;
            if(this.type === 3 && this.y > 50) { 
                this.shootTimer = 1.0;
                for(let i=0; i<3; i++) {
                    let angle = (i-1)*0.2 + Math.PI/2;
                    let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(angle)*bSpeed, Math.sin(angle)*bSpeed, '#f00', false, 10);
                }
            } else if(this.type === 5 && this.y > 50) { 
                this.shootTimer = 0.5;
                for(let i=0; i<8; i++) {
                    let angle = (i/8)*Math.PI*2 + this.time;
                    let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(angle)*bSpeed*0.6, Math.sin(angle)*bSpeed*0.6, '#f0f', false, 10);
                }
            } else if(this.type === 2) {
                this.shootTimer = 1.5;
                let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, 0, bSpeed, '#ff0', false, 10);
            } else if(this.type === 0 || this.type === 1 || this.type === 4) {
                this.shootTimer = 2.0;
                let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, 0, bSpeed, this.color, false, 10);
            }
        }

        if(this.y > H + 50) this.active = false;
    }
    takeDamage(amt) {
        if(!this.active) return;
        this.hp -= amt;
        this.hitTimer = 0.05; 
        playSound('hit');
        if(this.hp <= 0) {
            this.active = false;
            let baseScore = (this.type + 1) * 10 + 60; 
            score += Math.floor(baseScore * scoreMultiplier); 
            createExplosion(this.x, this.y, this.color, 10);
            
            if(guaranteedPowerup) {
                let item = itemPool.get(); if(item) item.spawn(this.x, this.y, 0); 
                guaranteedPowerup = false;
            } else if(this.type === 2) { 
                let item = itemPool.get(); if(item) item.spawn(this.x, this.y, 0); 
            }
            
            checkDifficulty();
        }
    }
    draw(ctx) {
        if(!this.active) return;
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        
        if (this.hitTimer > 0) {
            ctx.strokeStyle = '#fff';
            ctx.fillStyle = '#fff';
        } else {
            ctx.strokeStyle = this.color;
            ctx.fillStyle = '#000';
        }
        
        ctx.lineWidth = 2;
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.beginPath();
        if(this.type === 2) { 
            for(let i=0; i<6; i++) {
                ctx.lineTo(Math.cos(i*Math.PI/3)*this.radius, Math.sin(i*Math.PI/3)*this.radius);
            }
        } else if(this.type === 3 || this.type === 5) {
            ctx.rect(-this.radius, -this.radius, this.radius*2, this.radius*2);
        } else {
            ctx.moveTo(0, this.radius); ctx.lineTo(-this.radius, -this.radius); ctx.lineTo(this.radius, -this.radius);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        
        if(this.hp < this.maxHp) {
            ctx.fillStyle = '#f00'; ctx.fillRect(-10, -this.radius-8, 20, 3);
            ctx.fillStyle = '#0f0'; ctx.fillRect(-10, -this.radius-8, 20 * (this.hp/this.maxHp), 3);
        }
        ctx.restore();
    }
}
const enemyPool = new Pool(() => new Enemy(), 100);

// ==========================================
// BOSS 系统
// ==========================================
const bossNames = ["毁灭核心", "虚空漫游者", "霓虹撕裂者", "量子巨兽", "终焉指令"];

class Boss {
    constructor() { this.active = false; }
    spawn(idx) {
        this.active = true; 
        this.idx = Math.min(idx, 4); 
        this.x = W/2; this.y = -100;
        this.maxHp = 6000 + idx * 6000; this.hp = this.maxHp;
        this.state = 'enter'; 
        this.time = 0;
        this.hitTimer = 0; 
        this.timers = [0, 0, 0, 0]; // 为不同弹幕阶段设置独立的攻击冷却计时器
        
        document.getElementById('bossUI').style.display = 'block';
        document.getElementById('bossName').innerText = `BOSS 0${this.idx + 1} - ${bossNames[this.idx]}`;
        this.updateHPBar();
    }
    updateHPBar() {
        document.getElementById('bossHpFill').style.width = `${(this.hp/this.maxHp)*100}%`;
    }
    update(dt) {
        if(!this.active) return;
        this.time += dt;
        if(this.hitTimer > 0) this.hitTimer -= dt;
        
        if(this.state === 'enter') {
            this.y += 50 * dt;
            if(this.y >= 120) { this.state = 'attack'; this.time = 0; }
        } else if(this.state === 'attack') {
            // Boss 基础移动逻辑：左右摇摆，加上轻微上下浮动，更显灵动
            this.x = W/2 + Math.sin(this.time * 1.5) * (W/3); 
            this.y = 120 + Math.sin(this.time * 2.5) * 20;
            
            // 基础子弹速度随 Boss 等级和关卡动态提升
            const bSpeed = 250 + this.idx * 30 + stageLevel * 10; 
            let pAngle = Math.atan2(player.y - this.y, player.x - this.x);

            // 更新攻击冷却计时器
            for(let i = 0; i < 4; i++) this.timers[i] += dt;

            // 各个 Boss 的复合攻击模式
            if(this.idx === 0) {
                // Boss 0: 双重逆向螺旋 + 周期环形爆发
                if (this.timers[0] > 0.08) {
                    this.timers[0] = 0;
                    let a1 = this.time * 3;
                    let a2 = -this.time * 3;
                    let b1 = bulletPool.get(); if(b1) b1.spawn(this.x, this.y, Math.cos(a1)*bSpeed, Math.sin(a1)*bSpeed, '#f00', false, 15);
                    let b2 = bulletPool.get(); if(b2) b2.spawn(this.x, this.y, Math.cos(a2)*bSpeed, Math.sin(a2)*bSpeed, '#f80', false, 15);
                }
                if (this.timers[1] > 2.5) {
                    this.timers[1] = 0;
                    for(let i=0; i<18; i++) {
                        let a = (i/18)*Math.PI*2;
                        let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(a)*(bSpeed+50), Math.sin(a)*(bSpeed+50), '#ff0', false, 20);
                    }
                }

            } else if(this.idx === 1) { 
                // Boss 1: 机枪点射瞄准 + 扇形扫射 + 跟踪弹
                if (this.timers[0] > 0.1) {
                    this.timers[0] = 0;
                    let a = pAngle + (Math.random()-0.5)*0.2; // 略微散射
                    let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(a)*(bSpeed+150), Math.sin(a)*(bSpeed+150), '#0ff', false, 15);
                }
                if (this.timers[1] > 1.2) {
                    this.timers[1] = 0;
                    for(let i=-2; i<=2; i++) {
                        let a = pAngle + i*0.2;
                        let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(a)*bSpeed, Math.sin(a)*bSpeed, '#f0f', false, 15);
                    }
                }
                if (this.timers[2] > 3.0) {
                    this.timers[2] = 0;
                    // 发射追踪玩家的导弹
                    let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(pAngle)*200, Math.sin(pAngle)*200, '#ff0', false, 20, true);
                }

            } else if(this.idx === 2) { 
                // Boss 2: 左右摇摆弹幕墙 + 极快自旋洒弹
                if (this.timers[0] > 0.3) {
                    this.timers[0] = 0;
                    let offset = Math.sin(this.time * 5) * 0.5; 
                    for(let i=-4; i<=4; i++) {
                        let a = Math.PI/2 + offset + i*0.15;
                        let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(a)*bSpeed, Math.sin(a)*bSpeed, '#ff0', false, 15);
                    }
                }
                if (this.timers[1] > 0.05) { 
                    this.timers[1] = 0;
                    let a = this.time * 8;
                    let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(a)*(bSpeed*0.8), Math.sin(a)*(bSpeed*0.8), '#0f0', false, 10);
                }

            } else if(this.idx === 3) { 
                // Boss 3: 大范围圈 + 密集瞄准散弹 + 双重跟踪导弹
                if (this.timers[0] > 1.5) {
                    this.timers[0] = 0;
                    let offset = this.time;
                    for(let i=0; i<24; i++) {
                        let a = (i/24)*Math.PI*2 + offset;
                        let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(a)*bSpeed*0.7, Math.sin(a)*bSpeed*0.7, '#0f0', false, 15);
                    }
                }
                if (this.timers[1] > 0.8) {
                    this.timers[1] = 0;
                    for(let i=-3; i<=3; i++) {
                        let a = pAngle + i*0.1;
                        let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(a)*(bSpeed*1.2), Math.sin(a)*(bSpeed*1.2), '#f00', false, 15);
                    }
                }
                if (this.timers[2] > 2.5) {
                    this.timers[2] = 0;
                    let b1 = bulletPool.get(); if(b1) b1.spawn(this.x - 30, this.y, 0, 150, '#f80', false, 20, true);
                    let b2 = bulletPool.get(); if(b2) b2.spawn(this.x + 30, this.y, 0, 150, '#f80', false, 20, true);
                }

            } else { 
                // Boss 4+ (终焉指令): 综合极难弹幕（四重花瓣 + 超速狙击 + 跟踪海 + 压迫大环）
                if (this.timers[0] > 0.08) {
                    this.timers[0] = 0;
                    for (let i=0; i<4; i++) {
                        let a = this.time * 2 + (i * Math.PI / 2);
                        let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(a)*bSpeed, Math.sin(a)*bSpeed, '#f0f', false, 15);
                        let a2 = -this.time * 2 + (i * Math.PI / 2);
                        let b2 = bulletPool.get(); if(b2) b2.spawn(this.x, this.y, Math.cos(a2)*bSpeed, Math.sin(a2)*bSpeed, '#0ff', false, 15);
                    }
                }
                if (this.timers[1] > 0.6) {
                    this.timers[1] = 0;
                    for(let i=-1; i<=1; i++) {
                        let a = pAngle + i * 0.08;
                        let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(a)*(bSpeed*1.5), Math.sin(a)*(bSpeed*1.5), '#fff', false, 20);
                    }
                }
                if (this.timers[2] > 3.0) {
                    this.timers[2] = 0;
                    for (let i=-2; i<=2; i++) {
                        let b = bulletPool.get(); if(b) b.spawn(this.x + i*20, this.y, Math.sin(i)*100, 100, '#f00', false, 15, true);
                    }
                }
                if (this.timers[3] > 4.0) {
                    this.timers[3] = 0;
                    for(let i=0; i<36; i++) {
                        let a = (i/36)*Math.PI*2;
                        let b = bulletPool.get(); if(b) b.spawn(this.x, this.y, Math.cos(a)*bSpeed*0.6, Math.sin(a)*bSpeed*0.6, '#ff0', false, 20);
                    }
                }
            }
        }
    }
    takeDamage(amt) {
        if(this.state === 'enter' || !this.active) return;
        this.hp -= amt;
        this.hitTimer = 0.05; 
        playSound('hit');
        this.updateHPBar();
        if(this.hp <= 0) {
            this.active = false;
            createExplosion(this.x, this.y, '#f00', 100);
            score += Math.floor(1000 * scoreMultiplier); 
            bossMode = false; 
            bossDefeatedCount++;
            
            if (bossDefeatedCount === 1) nextBossScore = 8000;
            else if (bossDefeatedCount === 2) nextBossScore = 12000;
            else if (bossDefeatedCount === 3) nextBossScore = 16000;
            else if (bossDefeatedCount === 4) nextBossScore = 20000;
            else nextBossScore += 6000;

            stageLevel = Math.min(6, bossDefeatedCount + 1);

            document.getElementById('bossUI').style.display = 'none';
            for(let i=0; i<3; i++) { 
                let it = itemPool.get(); if(it) it.spawn(this.x + (i-1)*30, this.y, 1); 
            }
            checkDifficulty();
        }
    }
    draw(ctx) {
        if(!this.active) return;
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.shadowBlur = 20; ctx.shadowColor = '#f00';
        
        if (this.hitTimer > 0) {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#fff';
        } else {
            ctx.fillStyle = '#100'; 
            ctx.strokeStyle = '#f00'; 
        }
        
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        if (this.idx === 0) {
            ctx.arc(0, 0, 40, 0, Math.PI*2);
            ctx.moveTo(-60, -20); ctx.lineTo(60, -20); ctx.lineTo(0, 60); ctx.closePath();
        } else if (this.idx === 1) {
            ctx.rect(-40, -40, 80, 80);
        } else if (this.idx === 2) {
            ctx.moveTo(0, 50); ctx.lineTo(-50, -30); ctx.lineTo(0, -50); ctx.lineTo(50, -30); ctx.closePath();
        } else if (this.idx === 3) {
            ctx.arc(0, 0, 50, 0, Math.PI); ctx.closePath();
        } else {
            ctx.arc(0, 0, 45, 0, Math.PI*2);
            ctx.moveTo(-70, 0); ctx.lineTo(70, 0); ctx.moveTo(0, -70); ctx.lineTo(0, 70);
        }
        ctx.fill(); ctx.stroke();
        
        ctx.fillStyle = '#f00';
        ctx.globalAlpha = 0.5 + Math.sin(this.time*10)*0.5;
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}
const boss = new Boss();

// ==========================================
// 游戏流程与生成逻辑
// ==========================================
let spawnTimer = 0;
function spawnEnemies(dt) {
    if(bossMode) return;
    spawnTimer -= dt;
    if(spawnTimer <= 0) {
        spawnTimer = Math.max(0.4, 1.5 - stageLevel * 0.15);
        let maxEnemies = Math.min(8, 3 + stageLevel);
        let activeCount = enemyPool.items.filter(e => e.active).length;
        
        if(activeCount < maxEnemies) {
            let type = Math.floor(Math.random() * 6);
            
            if (type === 2 && Math.random() > 0.9) {
                type = [0, 1, 3, 4, 5][Math.floor(Math.random() * 5)];
            }
            
            if([2,3,5].includes(type) && enemyPool.items.some(e => e.active && [2,3,5].includes(e.type))) {
                type = Math.random() < 0.5 ? 0 : 1;
            }

            let e = enemyPool.get();
            if(e) e.spawn(type, Math.random()*(W-60)+30, -30, 1 + stageLevel*0.3);
        }
    }
}

function checkDifficulty() {
    scoreMultiplier = 1 + (stageLevel - 1) * 0.2;
    
    if(score - lastPowerupScoreThreshold >= 2000) {
        guaranteedPowerup = true;
        lastPowerupScoreThreshold = Math.floor(score / 2000) * 2000;
    }

    if(score >= nextBossScore && !bossMode) {
        bossMode = true;
        
        enemyPool.items.forEach(e => {
            if(e.active) { e.active = false; createExplosion(e.x, e.y, e.color, 5); }
        });
        
        document.getElementById('warningScreen').style.display = 'block';
        playSound('warning');
        setTimeout(() => {
            document.getElementById('warningScreen').style.display = 'none';
            boss.spawn(bossDefeatedCount);
        }, 3000);
    }
    updateHUD();
}

function updateHUD() {
    document.getElementById('scoreVal').innerText = score;
    let lvText = stageLevel >= 6 ? '无尽' : stageLevel;
    document.getElementById('levelVal').innerText = lvText;
    document.getElementById('hpVal').innerText = Math.floor(player.hp);
    let powerText = player.power >= 9 ? 'MAX' : player.power;
    document.getElementById('powerVal').innerText = powerText;
}

// ==========================================
// 渲染与主循环
// ==========================================
function drawBackground(dt) {
    ctx.fillStyle = '#000'; 
    ctx.fillRect(0, 0, W, H);
    
    ctx.fillStyle = '#fff';
    stars.forEach(star => {
        if(gameState === 'playing') {
            star.y += star.speed * dt;
            if(star.y > H) {
                star.y = 0;
                star.x = Math.random() * W;
            }
        }
        ctx.globalAlpha = star.alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

let lastTime = performance.now();
function gameLoop(now) {
    requestAnimationFrame(gameLoop);
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if(dt > 0.1) dt = 0.1;

    if(gameState !== 'playing') {
        let dtForBg = (gameState === 'menu' || gameState === 'gameover') ? dt : 0;
        drawBackground(dtForBg); 
        return;
    }

    drawBackground(dt); 

    player.update(dt);
    spawnEnemies(dt);
    boss.update(dt);

    const pools = [bulletPool, particlePool, itemPool, enemyPool];
    pools.forEach(p => p.items.forEach(item => item.update(dt)));

    bulletPool.items.forEach(b => {
        if(!b.active) return;
        if(b.isPlayer) {
            enemyPool.items.forEach(e => {
                if(e.active && Math.hypot(b.x - e.x, b.y - e.y) < e.radius + b.radius) {
                    b.active = false; e.takeDamage(b.dmg);
                    createExplosion(b.x, b.y, '#fff', 3);
                }
            });
            if(boss.active && boss.state === 'attack' && Math.hypot(b.x - boss.x, b.y - boss.y) < 50) {
                b.active = false; boss.takeDamage(b.dmg);
                createExplosion(b.x, b.y, '#ff0', 3);
            }
        } else {
            if(Math.hypot(b.x - player.x, b.y - player.y) < player.radius + b.radius) {
                b.active = false;
                player.takeHit(b.dmg);
                updateHUD();
            }
        }
    });

    enemyPool.items.forEach(e => {
        if(e.active && Math.hypot(e.x - player.x, e.y - player.y) < e.radius + player.radius) {
            e.active = false;
            player.takeHit(20);
            createExplosion(e.x, e.y, e.color, 10);
            updateHUD();
        }
    });

    if(boss.active && Math.hypot(boss.x - player.x, boss.y - player.y) < 50 + player.radius) {
         if(!player.shieldActive) {
             player.hp -= 1 * dt * 60; 
             player.hitTimer = 0.1;
             
             if (player.bossHitSoundCooldown <= 0) {
                 playSound('player_hit');
                 player.bossHitSoundCooldown = 0.3; 
             }
             
             updateHUD();
             if(player.hp <= 0) gameOver();
         } else {
             player.takeHit(0); 
             player.y += 50; 
         }
    }

    pools.forEach(p => p.items.forEach(item => item.draw(ctx)));
    boss.draw(ctx);
    player.draw(ctx);
    
    if (player.hp <= 30 && player.hp > 0) {
        let pulseAlpha = 0.2 + Math.sin(now / 150) * 0.15; 
        ctx.save();
        ctx.lineWidth = 30;
        ctx.strokeStyle = `rgba(255, 0, 0, ${pulseAlpha})`;
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#f00';
        ctx.strokeRect(15, 15, W - 30, H - 30);
        ctx.restore();
    }
    
    updateHUD();
}

function gameOver() {
    gameState = 'gameover';
    document.getElementById('finalScore').innerText = score;
    document.getElementById('gameOverMenu').style.display = 'flex';
}

function initGame() {
    score = 0; stageLevel = 1; bossMode = false; 
    bossDefeatedCount = 0; nextBossScore = 5000;
    scoreMultiplier = 1.0;
    lastPowerupScoreThreshold = 0;
    guaranteedPowerup = false;
    player.reset();
    [bulletPool, particlePool, itemPool, enemyPool].forEach(p => p.items.forEach(i => i.active = false));
    boss.active = false;
    updateHUD();
}

requestAnimationFrame(gameLoop);