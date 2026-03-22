class BoardLogic {
    constructor() {
        this.grid = []; 
    }

    init() {
        this.grid = Array.from({ length: CONFIG.ROWS }, () => 
            Array.from({ length: CONFIG.COLS }, () => this.createRandomGem())
        );
        this.resolveInitialBoard();
    }

    createRandomGem() {
        return {
            id: Utils.generateId(),
            color: Utils.randomColor(),
            type: CONFIG.TYPES.NORMAL
        };
    }

    resolveInitialBoard() {
        // 消除初始盘面的连击，并确保有可移动的步数
        let hasMatches = true;
        while (hasMatches) {
            hasMatches = false;
            for (let r = 0; r < CONFIG.ROWS; r++) {
                for (let c = 0; c < CONFIG.COLS; c++) {
                    if ((c >= 2 && this.grid[r][c].color === this.grid[r][c-1].color && this.grid[r][c].color === this.grid[r][c-2].color) ||
                        (r >= 2 && this.grid[r][c].color === this.grid[r-1][c].color && this.grid[r][c].color === this.grid[r-2][c].color)) {
                        this.grid[r][c].color = Utils.randomColor();
                        hasMatches = true;
                    }
                }
            }
        }
        
        if (!this.hasPossibleMoves()) {
            this.smartShuffle();
        }
    }

    // 检查是否有可行的移动（死局检测）
    hasPossibleMoves() {
        for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS; c++) {
                // 向右交换预测
                if (c < CONFIG.COLS - 1) {
                    this.swapCoords(r, c, r, c + 1);
                    let matches = this.findMatches(false);
                    this.swapCoords(r, c, r, c + 1); // 还原
                    if (matches.cells.length > 0) return true;
                }
                // 向下交换预测
                if (r < CONFIG.ROWS - 1) {
                    this.swapCoords(r, c, r + 1, c);
                    let matches = this.findMatches(false);
                    this.swapCoords(r, c, r + 1, c); // 还原
                    if (matches.cells.length > 0) return true;
                }
            }
        }
        return false;
    }

    swapCoords(r1, c1, r2, c2) {
        let temp = this.grid[r1][c1];
        this.grid[r1][c1] = this.grid[r2][c2];
        this.grid[r2][c2] = temp;
    }

    // 智能洗牌
    smartShuffle() {
        let gems = [];
        for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS; c++) {
                gems.push(this.grid[r][c]);
            }
        }
        
        // Fisher-Yates 洗牌
        for (let i = gems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [gems[i], gems[j]] = [gems[j], gems[i]];
        }

        let index = 0;
        for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS; c++) {
                this.grid[r][c] = gems[index++];
            }
        }
        
        // 洗牌后重新清理死局和直接消除
        this.resolveInitialBoard();
    }

    // 完整版：支持 4连、5连直线 以及 T/L型交叉检测
    findMatches(createSpecials = true) {
        let matchedSet = new Set();
        let specialsToCreate = [];
        
        // 记录每个格子参与横向和纵向消除的长度，用于判断交叉
        let matchLenMap = Array.from({length: CONFIG.ROWS}, () => Array(CONFIG.COLS).fill({h: 0, v: 0}));

        // 1. 横向检测
        for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS - 2; c++) {
                let color = this.grid[r][c]?.color;
                if (color == null) continue;
                let matchLen = 1;
                while (c + matchLen < CONFIG.COLS && this.grid[r][c + matchLen]?.color === color) matchLen++;
                
                if (matchLen >= 3) {
                    for (let i = 0; i < matchLen; i++) {
                        matchedSet.add(`${r},${c+i}`);
                        matchLenMap[r][c+i] = { ...matchLenMap[r][c+i], h: matchLen }; // 记录横向长度
                    }
                    if (createSpecials && matchLen === 4) specialsToCreate.push({r, c, type: CONFIG.TYPES.ROW, color});
                    if (createSpecials && matchLen >= 5) specialsToCreate.push({r, c, type: CONFIG.TYPES.RAINBOW, color});
                    c += matchLen - 1;
                }
            }
        }

        // 2. 纵向检测
        for (let c = 0; c < CONFIG.COLS; c++) {
            for (let r = 0; r < CONFIG.ROWS - 2; r++) {
                let color = this.grid[r][c]?.color;
                if (color == null) continue;
                let matchLen = 1;
                while (r + matchLen < CONFIG.ROWS && this.grid[r + matchLen][c]?.color === color) matchLen++;
                
                if (matchLen >= 3) {
                    for (let i = 0; i < matchLen; i++) {
                        matchedSet.add(`${r+i},${c}`);
                        matchLenMap[r+i][c] = { ...matchLenMap[r+i][c], v: matchLen }; // 记录纵向长度
                    }
                    if (createSpecials && matchLen === 4 && matchLenMap[r][c].h < 5) specialsToCreate.push({r, c, type: CONFIG.TYPES.COL, color});
                    if (createSpecials && matchLen >= 5 && matchLenMap[r][c].h < 5) specialsToCreate.push({r, c, type: CONFIG.TYPES.RAINBOW, color});
                    r += matchLen - 1;
                }
            }
        }

        // 3. T/L型交叉检测 (生成 Area Bomb)
        if (createSpecials) {
            for (let r = 0; r < CONFIG.ROWS; r++) {
                for (let c = 0; c < CONFIG.COLS; c++) {
                    let hLen = matchLenMap[r][c].h;
                    let vLen = matchLenMap[r][c].v;
                    // 如果同一个点既参与了横向>=3消除，又参与了纵向>=3消除，且都不是5连直线，那就是T或L型
                    if (hLen >= 3 && vLen >= 3 && hLen < 5 && vLen < 5) {
                        let color = this.grid[r][c].color;
                        // 过滤掉同一个位置生成的其他道具
                        specialsToCreate = specialsToCreate.filter(sp => !(sp.r === r && sp.c === c));
                        specialsToCreate.push({r, c, type: CONFIG.TYPES.AREA, color});
                    }
                }
            }
        }

        return {
            cells: Array.from(matchedSet).map(s => {
                let [r, c] = s.split(',').map(Number);
                return {r, c};
            }),
            specials: specialsToCreate
        };
    }

    // 获取爆炸连锁反应的区域（触发特殊道具）
    getExplosionArea(matches) {
        let toRemove = new Set();
        let queue = [...matches];
        let processed = new Set();

        while (queue.length > 0) {
            let {r, c} = queue.shift();
            let key = `${r},${c}`;
            
            if (processed.has(key) || !this.grid[r][c]) continue;
            processed.add(key);
            toRemove.add(key);

            let type = this.grid[r][c].type;
            
            if (type === CONFIG.TYPES.ROW) {
                for (let i = 0; i < CONFIG.COLS; i++) queue.push({r, c: i});
            } else if (type === CONFIG.TYPES.COL) {
                for (let i = 0; i < CONFIG.ROWS; i++) queue.push({r: i, c});
            } else if (type === CONFIG.TYPES.AREA) {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        let nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < CONFIG.ROWS && nc >= 0 && nc < CONFIG.COLS) {
                            queue.push({r: nr, c: nc});
                        }
                    }
                }
            } else if (type === CONFIG.TYPES.RAINBOW) {
                let targetColor = this.grid[r][c].color;
                for (let i = 0; i < CONFIG.ROWS; i++) {
                    for (let j = 0; j < CONFIG.COLS; j++) {
                        if (this.grid[i][j] && this.grid[i][j].color === targetColor) queue.push({r: i, c: j});
                    }
                }
            }
        }

        return Array.from(toRemove).map(s => {
            let [r, c] = s.split(',').map(Number);
            return {r, c};
        });
    }

    applyGravity() {
        for (let c = 0; c < CONFIG.COLS; c++) {
            let emptySpaces = 0;
            for (let r = CONFIG.ROWS - 1; r >= 0; r--) {
                if (this.grid[r][c] === null) {
                    emptySpaces++;
                } else if (emptySpaces > 0) {
                    this.grid[r + emptySpaces][c] = this.grid[r][c];
                    this.grid[r][c] = null;
                }
            }
            // 顶层补充
            for (let r = 0; r < emptySpaces; r++) {
                this.grid[r][c] = this.createRandomGem();
            }
        }
    }
}
