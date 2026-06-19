/* ============================================
   Simulator 基类
   所有算法模块必须继承此类
   提供统一的状态推进、历史快照、播放控制接口
   采用"快照回放"策略：history 存储所有状态快照，
   currentStep 作为唯一索引，prevStep 只需索引减一
   ============================================ */

import { stateManager } from './stateManager.js';
import { EVENTS } from '../utils/constants.js';

export class Simulator {
    constructor() {
        // 当前状态（由 history[currentStep] 恢复）
        this._state = {};

        // 历史状态快照数组
        this.history = [];

        // 当前步骤索引（唯一索引，指向 history 中的位置）
        this.currentStep = 0;

        // 总步骤数
        this.totalSteps = 0;

        // 播放状态
        this.isPlaying = false;

        // 是否已完成
        this.isComplete = false;

        // 是否已初始化
        this.isInitialized = false;

        // 模块名称（子类覆盖）
        this.moduleName = 'base';

        // 算法名称（子类覆盖）
        this.algorithmName = 'base';
    }

    /**
     * 获取初始状态（子类覆盖）
     * @returns {Object}
     */
    _getInitialState() {
        return {};
    }

    /**
     * 初始化模拟器
     * @param {Object} config - 配置参数
     */
    init(config) {
        this._state = this._getInitialState();
        this.history = [];
        this.currentStep = 0;
        this.totalSteps = 0;
        this.isPlaying = false;
        this.isComplete = false;
        this.isInitialized = true;

        this._applyConfig(config);
        this._saveSnapshot();
        // 更新 totalSteps 以反映已保存的快照数量
        this.totalSteps = this.history.length;
        this._notifyUpdate();
    }

    /**
     * 应用配置（子类覆盖）
     * @param {Object} config
     */
    _applyConfig(config) {
        // 子类实现
    }

    /**
     * 执行一步（子类必须实现）
     * 子类应：
     *   1. 执行一步算法逻辑，更新 this._state
     *   2. 调用 this._saveSnapshot() 保存快照
     *   3. 调用 this._notifyUpdate() 通知更新
     * @returns {boolean} 是否还有下一步
     */
    step() {
        throw new Error('子类必须实现 step() 方法');
    }

    /**
     * 开始自动播放
     */
    play() {
        if (this.isComplete || !this.isInitialized) return;
        this.isPlaying = true;
        stateManager.emit(EVENTS.PLAY_START, { moduleName: this.moduleName });
    }

    /**
     * 暂停播放
     */
    pause() {
        this.isPlaying = false;
        stateManager.emit(EVENTS.PLAY_PAUSE, { moduleName: this.moduleName });
    }

    /**
     * 重置模拟器
     */
    reset() {
        this._state = this._getInitialState();
        this.history = [];
        this.currentStep = 0;
        this.totalSteps = 0;
        this.isPlaying = false;
        this.isComplete = false;
        this._saveSnapshot();
        // 更新 totalSteps 以反映已保存的快照数量
        this.totalSteps = this.history.length;
        this._notifyUpdate();
        stateManager.emit(EVENTS.RESET, { moduleName: this.moduleName });
    }

    /**
     * 获取当前状态
     * 从 history 中根据 currentStep 恢复状态
     * @returns {Object}
     */
    getState() {
        // 如果有历史快照，从快照恢复
        if (this.history.length > 0 && this.currentStep < this.history.length) {
            const snapshot = this.history[this.currentStep];
            // 构建截断到当前步骤的 history（用于矩阵渲染）
            const truncatedHistory = this.history.slice(0, this.currentStep + 1).map((h, idx) => ({
                frames: [...(h.frames || [])],
                isFault: h.isFault || false,
                replacedPage: h.replacedPage || null,
                currentPage: h.currentPage || null,
                step: idx
            }));
            return {
                ...snapshot,
                history: truncatedHistory,
                currentStep: this.currentStep,
                totalSteps: this.totalSteps,
                isComplete: this.isComplete,
                isPlaying: this.isPlaying,
                isInitialized: this.isInitialized,
                moduleName: this.moduleName,
                algorithmName: this.algorithmName
            };
        }

        return {
            ...this._state,
            currentStep: this.currentStep,
            totalSteps: this.totalSteps,
            isComplete: this.isComplete,
            isPlaying: this.isPlaying,
            isInitialized: this.isInitialized,
            moduleName: this.moduleName,
            algorithmName: this.algorithmName
        };
    }

    /**
     * 获取历史记录
     * @returns {Array}
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * 上一步（快照回放：从历史快照恢复 _state）
     * @returns {boolean} 是否成功
     */
    prevStep() {
        if (this.currentStep <= 0) return false;

        this.currentStep--;
        this.isComplete = false;

        // 从历史快照恢复 _state，确保矩阵等UI能正确回退
        if (this.history[this.currentStep]) {
            this._state = JSON.parse(JSON.stringify(this.history[this.currentStep]));
        }

        // 子类钩子：恢复运行时状态（如银行家算法的内部状态机变量）
        this._onPrevStep();

        this._notifyUpdate();
        return true;
    }

    /**
     * 上一步钩子（子类覆盖）
     * 用于在 prevStep() 后恢复子类特有的运行时状态
     */
    _onPrevStep() {
        // 子类实现
    }

    /**
     * 保存当前状态快照
     * 子类在 step() 中修改完 _state 后调用此方法
     */
    _saveSnapshot() {
        this.history.push(JSON.parse(JSON.stringify(this._state)));
        this.currentStep = this.history.length - 1;
    }

    /**
     * 通知状态更新
     */
    _notifyUpdate() {
        stateManager.emit(EVENTS.STATE_CHANGE, this.getState());
        stateManager.emit(EVENTS.STEP_UPDATE, {
            current: this.currentStep,
            total: this.totalSteps
        });
    }

    /**
     * 渲染（子类覆盖）
     * @param {HTMLElement} container
     */
    render(container) {
        // 子类实现
    }

    /**
     * 销毁清理
     */
    destroy() {
        this.reset();
        this.isInitialized = false;
    }
}
