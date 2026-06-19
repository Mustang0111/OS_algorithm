/* ============================================
   动画引擎
   负责控制自动播放的定时调度
   ============================================ */

import { stateManager } from './stateManager.js';
import { EVENTS, SPEED_MAP, DEFAULT_INTERVAL } from '../utils/constants.js';

class AnimationEngine {
    constructor() {
        this._timerId = null;
        this._speed = 1.0;
        this._interval = DEFAULT_INTERVAL;
        this._simulator = null;
        this._isRunning = false;
    }

    /**
     * 初始化（兼容旧调用，实际无操作）
     */
    init() {
        // 兼容性方法，不做任何操作
    }

    /**
     * 绑定模拟器
     * @param {Object} simulator - 实现了 step() 方法的模拟器
     */
    bind(simulator) {
        this._simulator = simulator;
    }

    /**
     * 解绑
     */
    unbind() {
        this.stop();
        this._simulator = null;
    }

    /**
     * 开始自动播放
     */
    start() {
        if (!this._simulator || this._isRunning) return;

        this._isRunning = true;
        this._tick();
    }

    /**
     * 停止自动播放
     */
    stop() {
        this._isRunning = false;
        if (this._timerId) {
            clearTimeout(this._timerId);
            this._timerId = null;
        }
    }

    /**
     * 暂停
     */
    pause() {
        this.stop();
    }

    /**
     * 设置速度
     * @param {number} speedLevel - 1-10 的速度等级
     */
    setSpeed(speedLevel) {
        const speed = SPEED_MAP[speedLevel] || 1.0;
        this._speed = speed;
        this._interval = DEFAULT_INTERVAL / speed;

        // 如果正在运行，重新调度
        if (this._isRunning) {
            this.stop();
            this.start();
        }

        stateManager.emit(EVENTS.SPEED_CHANGE, { speed, speedLevel });
    }

    /**
     * 获取当前速度
     * @returns {number}
     */
    getSpeed() {
        return this._speed;
    }

    /**
     * 内部时钟
     */
    _tick() {
        if (!this._isRunning || !this._simulator) return;

        // 执行一步
        const hasMore = this._simulator.step();

        if (!hasMore) {
            // 播放完成
            this._isRunning = false;
            if (this._simulator) {
                this._simulator.isPlaying = false;
                this._simulator.isComplete = true;
            }
            stateManager.emit(EVENTS.PLAY_STOP, { moduleName: this._simulator?.moduleName });
            return;
        }

        // 调度下一步
        this._timerId = setTimeout(() => {
            this._tick();
        }, this._interval);
    }

    /**
     * 销毁
     */
    destroy() {
        this.stop();
        this._simulator = null;
    }
}

// 导出单例
export const animationEngine = new AnimationEngine();
