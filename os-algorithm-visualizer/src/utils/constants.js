/* ============================================
   全局常量定义
   ============================================ */

/** 模块名称映射 */
export const MODULE_NAMES = {
    pageReplacement: '页面置换算法',
    cpuScheduling: 'CPU调度算法',
    banker: '银行家算法',
    diskScheduling: '磁盘调度算法',
    producerConsumer: '生产者消费者问题'
};

/** 模块显示顺序 */
export const MODULE_ORDER = [
    'pageReplacement',
    'cpuScheduling',
    'banker',
    'diskScheduling',
    'producerConsumer'
];

/** 速度倍率映射（滑块值 → 实际倍率） */
export const SPEED_MAP = {
    1: 0.25,
    2: 0.5,
    3: 0.75,
    4: 0.9,
    5: 1.0,
    6: 1.25,
    7: 1.5,
    8: 2.0,
    9: 3.0,
    10: 5.0
};

/** 默认动画间隔（毫秒） */
export const DEFAULT_INTERVAL = 800;

/** 事件名称 */
export const EVENTS = {
    MODULE_SWITCH: 'module:switch',
    MODULE_LOADED: 'module:loaded',
    STEP_UPDATE: 'step:update',
    STATE_CHANGE: 'state:change',
    PLAY_START: 'play:start',
    PLAY_PAUSE: 'play:pause',
    PLAY_STOP: 'play:stop',
    RESET: 'simulator:reset',
    SPEED_CHANGE: 'speed:change',
    PRESET_SELECT: 'preset:select',
    EXPLANATION_UPDATE: 'explanation:update'
};
