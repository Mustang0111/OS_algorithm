/* ============================================
   占位模拟器 - 用于未实现的模块
   显示"正在开发中"提示
   ============================================ */

import { Simulator } from '../../core/simulator.js';

export class PlaceholderSimulator extends Simulator {
    constructor(moduleName) {
        super();
        this.moduleName = moduleName || 'placeholder';
        this.algorithmName = 'placeholder';
    }

    _getInitialState() {
        return {
            message: '该模块正在开发中...',
            isComplete: false
        };
    }

    _applyConfig(config) {
        this._state.message = config?.message || '该模块正在开发中...';
    }

    step() {
        return false;
    }

    getState() {
        return {
            ...this._state,
            currentStep: 0,
            totalSteps: 0,
            isComplete: false,
            isPlaying: false,
            isInitialized: this.isInitialized,
            moduleName: this.moduleName,
            algorithmName: this.algorithmName
        };
    }
}
