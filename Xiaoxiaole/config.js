const CONFIG = {
    ROWS: 8,
    COLS: 8,
    CELL_SIZE: 45,
    // 6种基础颜色
    COLORS: [
        '#ef4444', // 红
        '#f97316', // 橙
        '#eab308', // 黄
        '#22c55e', // 绿
        '#3b82f6', // 蓝
        '#a855f7'  // 紫
    ],
    // 道具类型枚举
    TYPES: {
        NORMAL: 'normal',
        ROW: 'type-row',       // 4连横
        COL: 'type-col',       // 4连竖
        AREA: 'type-area',     // T/L型5连炸弹
        RAINBOW: 'type-rainbow'// 直线5连彩虹球
    },
    // 分数配置
    SCORE: {
        BASE: 100,
        BONUS_PER_EXTRA: 50, // 超过3个每个额外加分
        CASCADE_MULT: 1.5,   // 连击乘数
        SPECIAL_BOMB: 300    // 引爆特殊道具额外加分
    },
    // 阶段动态规则
    STAGE: {
        BASE_TARGET: 2000,
        TARGET_GROWTH: 1.4, // 目标分数指数增长
        BASE_MOVES: 25,
        BONUS_MOVES: 15     // 每过一关奖励步数
    },
    ANIMATION_SPEED: 300 // 基础动画毫秒
};
