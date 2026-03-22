const Game = {
    state: 'MENU', 
    logic: new BoardLogic(),
    ui: new UIController(),
    
    stage: 1,
    score: 0,
    moves: 0,
    target: 0,
    isBonusTime: false, // 标记是否进入过关奖励时间

    touchStartX: 0,
    touchStartY: 0,
    startR: -1,
    startC: -1,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('btn-start').onclick = () => { AudioSys.init(); AudioSys.click(); this.startNewGame(); };
        document.getElementById('btn-pause').onclick = () => { AudioSys.click(); this.togglePause(); };
        document.getElementById('btn-resume').onclick = () => { AudioSys.click(); this.togglePause(); };
        document.getElementById('btn-quit').onclick = () => { AudioSys.click(); this.showScreen('main-menu'); };
        document.getElementById('btn-restart').onclick = () => { AudioSys.click(); this.startNewGame(); };

        const board = document.getElementById('board');
        
        const handleStart = (e) => {
            if (this.state !== 'PLAYING') return;
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const rect = board.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            
            this.startC = Math.floor(x / CONFIG.CELL_SIZE);
            this.startR = Math.floor(y / CONFIG.CELL_SIZE);
            this.touchStartX = clientX;
            this.touchStartY = clientY;

            if (this.startR >= 0 && this.startR < CONFIG.ROWS && this.startC >= 0 && this.startC < CONFIG.COLS) {
                this.handleCellSelect(this.startR, this.startC);
            }
        };

        const handleEnd = (e) => {
            if (this.state !== 'PLAYING' || this.startR === -1) return;
            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

            const dx = clientX - this.touchStartX;
            const dy = clientY - this.touchStartY;

            if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
                let targetR = this.startR;
                let targetC = this.startC;

                if (Math.abs(dx) > Math.abs(dy)) {
                    targetC += (dx > 0 ? 1 : -1); 
                } else {
                    targetR += (dy > 0 ? 1 : -1); 
                }

                if (targetR >= 0 && targetR < CONFIG.ROWS && targetC >= 0 && targetC < CONFIG.COLS) {
                    this.attemptSwap(this.startR, this.startC, targetR, targetC);
                }
            }
            this.startR = -1;
            this.startC = -1;
        };

        board.addEventListener('touchstart', handleStart, {passive: false});
        board.addEventListener('touchend', handleEnd);
        board.addEventListener('mousedown', handleStart);
        board.addEventListener('mouseup', handleEnd);
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        document.getElementById('pause-menu').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');
    },

    startNewGame() {
        this.stage = 1;
        this.score = 0;
        this.isBonusTime = false;
        this.setupStage();
        this.showScreen('game-ui');
    },

    setupStage() {
        this.target = Math.floor(CONFIG.STAGE.BASE_TARGET * Math.pow(CONFIG.STAGE.TARGET_GROWTH, this.stage - 1));
        this.moves = CONFIG.STAGE.BASE_MOVES + (this.stage > 1 ? CONFIG.STAGE.BONUS_MOVES : 0);
        this.isBonusTime = false;
        
        this.logic.init();
        this.ui.initBoard(this.logic.grid);
        this.ui.updateStats(this.stage, this.score, this.moves, this.target);
        this.state = 'PLAYING';
        
        if (this.stage > 1) this.ui.showFloatingText(`Stage ${this.stage}`, '#3b82f6');
    },

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            document.getElementById('pause-menu').classList.remove('hidden');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            document.getElementById('pause-menu').classList.add('hidden');
        }
    },

    handleCellSelect(r, c) {
        if (!this.ui.selectedCell) {
            this.ui.selectCell(r, c, this.logic.grid);
            AudioSys.click();
        } else {
            const sr = this.ui.selectedCell.r;
            const sc = this.ui.selectedCell.c;
            
            if (sr === r && sc === c) {
                this.ui.clearSelection(this.logic.grid);
                return;
            }

            if (Math.abs(sr - r) + Math.abs(sc - c) === 1) {
                this.attemptSwap(sr, sc, r, c);
            } else {
                this.ui.selectCell(r, c, this.logic.grid);
                AudioSys.click();
            }
        }
    },

    async attemptSwap(sr, sc, r, c) {
        this.ui.clearSelection(this.logic.grid);
        this.state = 'ANIMATING';
        AudioSys.swap();
        
        // 获取交换前的对象引用
        const item1 = this.logic.grid[sr][sc];
        const item2 = this.logic.grid[r][c];

        await this.ui.animateSwap(item1, item2, sr, sc, r, c);
        
        // 逻辑层交换，交换后 item1在(r,c)，item2在(sr,sc)
        this.logic.swapCoords(sr, sc, r, c);

        // 两个特殊道具强制互相引爆
        let forceExplode = false;
        if (item1.type !== CONFIG.TYPES.NORMAL && item2.type !== CONFIG.TYPES.NORMAL) {
            forceExplode = true;
        }

        let matchResult = this.logic.findMatches();
        
        // 合法换位检测：要么有基础消除，要么是双特效交换
        if (matchResult.cells.length > 0 || forceExplode) {
            this.moves--;
            
            // 只要换位合法，参与换位的特殊元素自动引爆
            if (item1.type !== CONFIG.TYPES.NORMAL) {
                if (!matchResult.cells.some(cell => cell.r === r && cell.c === c)) {
                    matchResult.cells.push({r, c});
                }
            }
            if (item2.type !== CONFIG.TYPES.NORMAL) {
                if (!matchResult.cells.some(cell => cell.r === sr && cell.c === sc)) {
                    matchResult.cells.push({r: sr, c: sc});
                }
            }

            await this.processCascades(matchResult, 1);
        } else {
            // 无效交换，原路退回
            AudioSys.error();
            await this.ui.animateSwap(item1, item2, r, c, sr, sc);
            this.logic.swapCoords(sr, sc, r, c);
            this.state = 'PLAYING';
        }
    },

    async processCascades(matchResult, combo) {
        while (matchResult.cells.length > 0) {
            AudioSys.match(combo);
            if (combo > 1 && !this.isBonusTime) {
                this.ui.showFloatingText(`${combo} 連擊!`, '#facc15');
            }

            // 获取特效波及的全部范围
            let allToRemove = this.logic.getExplosionArea(matchResult.cells);

            let points = allToRemove.length * CONFIG.SCORE.BASE * (1 + (combo - 1) * 0.5);
            this.score += Math.floor(points);
            this.ui.updateStats(this.stage, this.score, this.moves, this.target);

            if (allToRemove.length > matchResult.cells.length) {
                AudioSys.bomb();
            }

            await this.ui.animateRemoval(allToRemove, this.logic.grid);

            // 清理并生成新的特殊道具
            allToRemove.forEach(({r, c}) => { this.logic.grid[r][c] = null; });
            matchResult.specials.forEach(sp => {
                if (!this.logic.grid[sp.r][sp.c]) {
                    this.logic.grid[sp.r][sp.c] = { id: Utils.generateId(), color: sp.color, type: sp.type };
                }
            });

            this.logic.applyGravity();
            this.ui.updateBoardVisually(this.logic.grid);
            await Utils.sleep(CONFIG.ANIMATION_SPEED);

            combo++;
            // 继续检测下落后的自然消除
            matchResult = this.logic.findMatches();
        }

        if (!this.logic.hasPossibleMoves()) {
            this.state = 'ANIMATING';
            this.ui.showFloatingText('死局重排!', '#ec4899');
            await Utils.sleep(800);
            this.logic.smartShuffle();
            this.ui.updateBoardVisually(this.logic.grid, true);
            await Utils.sleep(500);
        }

        this.checkGameState();
    },

    checkGameState() {
        if (this.score >= this.target) {
            // 阶段达标时，检查是否还有特殊能力元素残留
            let specials = [];
            for (let r = 0; r < CONFIG.ROWS; r++) {
                for (let c = 0; c < CONFIG.COLS; c++) {
                    if (this.logic.grid[r][c] && this.logic.grid[r][c].type !== CONFIG.TYPES.NORMAL) {
                        specials.push({r, c});
                    }
                }
            }

            if (specials.length > 0) {
                // 如果有残留特效，进入 Bonus Time，全部引爆并结算自然掉落的消除
                this.state = 'ANIMATING';
                if (!this.isBonusTime) {
                    this.isBonusTime = true;
                    this.ui.showFloatingText('Bonus Time!', '#facc15');
                }
                setTimeout(() => {
                    this.processCascades({ cells: specials, specials: [] }, 1);
                }, 500);
            } else {
                // 完全结算完毕，进入下一阶段
                this.isBonusTime = false;
                AudioSys.levelUp();
                this.stage++;
                this.setupStage();
            }
        } else if (this.moves <= 0) {
            this.state = 'GAMEOVER';
            AudioSys.gameOver();
            document.getElementById('final-score').innerText = this.score;
            document.getElementById('final-stage').innerText = this.stage;
            document.getElementById('game-over').classList.remove('hidden');
        } else {
            this.state = 'PLAYING';
        }
    }
};

window.onload = () => Game.init();
