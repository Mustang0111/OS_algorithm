/* ============================================
   底部控制面板组件
   绑定到HTML已有控制按钮，管理播放控制逻辑
   ============================================ */

import { stateManager } from '../core/stateManager.js';
import { animationEngine } from '../core/animationEngine.js';
import { scheduler } from '../core/scheduler.js';
import { EVENTS } from '../utils/constants.js';

export class ControlPanel {
    constructor() {
        this._isPlaying = false;
        this._cleanups = [];
    }

    /**
     * 渲染控制面板 - 绑定到HTML已有元素
     * @param {HTMLElement} container
     */
    render(container) {
        // 绑定到HTML已有元素
        this._stepDisplay = document.getElementById('stepIndicator');
        this._btnPlay = document.getElementById('btnPlay');
        this._btnNext = document.getElementById('btnNext');
        this._btnPrev = document.getElementById('btnPrev');
        this._btnReset = document.getElementById('btnReset');
        this._speedSlider = document.getElementById('speedSlider');
        this._speedValue = document.getElementById('speedValue');

        // 初始禁用所有控制按钮（等待模块加载）
        this._setControlsEnabled(false);

        // 订阅事件
        this._subscribeEvents();

        // 监听控制事件（由main.js中HTML按钮触发）
        this._cleanups.push(
            stateManager.on('control:play', () => this._handlePlayPause())
        );
        this._cleanups.push(
            stateManager.on('control:next', () => this._handleNext())
        );
        this._cleanups.push(
            stateManager.on('control:prev', () => this._handlePrev())
        );
        this._cleanups.push(
            stateManager.on('control:reset', () => this._handleReset())
        );
    }

    /**
     * 订阅状态事件
     */
    _subscribeEvents() {
        this._cleanups.push(
            stateManager.on(EVENTS.STEP_UPDATE, (data) => {
                this._updateStepDisplay(data.current, data.total);
                this._updateButtonStates(data);
            })
        );

        this._cleanups.push(
            stateManager.on(EVENTS.PLAY_START, () => {
                this._setPlayingState(true);
            })
        );

        this._cleanups.push(
            stateManager.on(EVENTS.PLAY_PAUSE, () => {
                this._setPlayingState(false);
            })
        );

        this._cleanups.push(
            stateManager.on(EVENTS.PLAY_STOP, () => {
                this._setPlayingState(false);
            })
        );

        this._cleanups.push(
            stateManager.on(EVENTS.RESET, () => {
                this._setPlayingState(false);
                this._updateStepDisplay(0, 0);
                this._updateButtonStates({ current: 0, total: 0 });
            })
        );

        // 模块切换时启用控制按钮
        this._cleanups.push(
            stateManager.on(EVENTS.MODULE_SWITCH, () => {
                this._setControlsEnabled(true);
                this._updateStepDisplay(0, 0);
            })
        );

        // 模块加载完成时启用控制按钮
        this._cleanups.push(
            stateManager.on(EVENTS.MODULE_LOADED, () => {
                this._setControlsEnabled(true);
            })
        );
    }

    /**
     * 启用或禁用控制按钮
     * @param {boolean} enabled
     */
    _setControlsEnabled(enabled) {
        const btns = [this._btnPlay, this._btnNext, this._btnPrev, this._btnReset];
        btns.forEach(btn => {
            if (btn) {
                btn.disabled = !enabled;
                btn.classList.toggle('disabled', !enabled);
            }
        });
    }

    /**
     * 更新步骤显示
     */
    _updateStepDisplay(current, total) {
        if (this._stepDisplay) {
            this._stepDisplay.textContent = `步骤: ${current} / ${total}`;
        }
    }

    /**
     * 根据当前步骤更新按钮状态
     * @param {Object} data - { current, total, isComplete }
     */
    _updateButtonStates(data) {
        const current = data?.current ?? 0;
        const total = data?.total ?? 0;
        const isComplete = data?.isComplete ?? false;

        // 上一步：current > 0 时启用
        if (this._btnPrev) {
            const canPrev = current > 0;
            this._btnPrev.disabled = !canPrev;
            this._btnPrev.classList.toggle('disabled', !canPrev);
        }

        // 下一步：未完成时启用
        if (this._btnNext) {
            const canNext = !isComplete && total > 0;
            this._btnNext.disabled = !canNext;
            this._btnNext.classList.toggle('disabled', !canNext);
        }

        // 重置：有步骤时启用
        if (this._btnReset) {
            const canReset = total > 0;
            this._btnReset.disabled = !canReset;
            this._btnReset.classList.toggle('disabled', !canReset);
        }

        // 播放：未完成时启用
        if (this._btnPlay) {
            const canPlay = !isComplete && total > 0;
            this._btnPlay.disabled = !canPlay;
            this._btnPlay.classList.toggle('disabled', !canPlay);
        }
    }

    /**
     * 设置播放状态
     */
    _setPlayingState(isPlaying) {
        this._isPlaying = isPlaying;
        if (this._btnPlay) {
            this._btnPlay.classList.toggle('playing', isPlaying);
            this._btnPlay.title = isPlaying ? '暂停' : '播放';
            this._btnPlay.innerHTML = isPlaying
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                </svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>`;
        }
    }

    /**
     * 处理播放/暂停
     */
    _handlePlayPause() {
        const module = scheduler.getCurrentModule();
        if (!module) return;

        if (this._isPlaying) {
            module.simulator.pause();
            animationEngine.pause();
        } else {
            if (module.simulator.isComplete) {
                module.simulator.reset();
            }
            // 绑定动画引擎到当前模拟器
            animationEngine.bind(module.simulator);
            module.simulator.play();
            animationEngine.start();
        }
    }

    /**
     * 处理下一步
     */
    _handleNext() {
        const module = scheduler.getCurrentModule();
        if (!module || module.simulator.isComplete) return;

        if (this._isPlaying) {
            animationEngine.pause();
        }
        module.simulator.step();
    }

    /**
     * 处理上一步
     */
    _handlePrev() {
        const module = scheduler.getCurrentModule();
        if (!module) return;

        if (this._isPlaying) {
            animationEngine.pause();
        }
        module.simulator.prevStep();
    }

    /**
     * 处理重置
     */
    _handleReset() {
        const module = scheduler.getCurrentModule();
        if (!module) return;

        animationEngine.pause();
        module.simulator.reset();
    }

    /**
     * 销毁
     */
    destroy() {
        this._cleanups.forEach(fn => fn());
        this._cleanups = [];
    }
}
