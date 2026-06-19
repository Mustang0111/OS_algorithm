/* ============================================
   模块调度器
   负责模块的注册、切换、生命周期管理
   ============================================ */

import { stateManager } from './stateManager.js';
import { animationEngine } from './animationEngine.js';
import { EVENTS } from '../utils/constants.js';

class ModuleScheduler {
    constructor() {
        this._modules = new Map();
        this._currentModule = null;
        this._currentModuleId = null;
        this._cleanupFns = [];
    }

    /**
     * 注册模块
     * @param {string} id - 模块ID
     * @param {Object} module - 模块实例 { id, name, simulator, renderer }
     */
    register(id, module) {
        this._modules.set(id, module);
    }

    /**
     * 初始化调度器（幂等，已存在的模块跳过注册）
     * @param {Object} modules - 模块映射表 { id: { id, name, simulator, renderer } }
     */
    init(modules) {
        Object.entries(modules).forEach(([id, mod]) => {
            if (!this._modules.has(id)) {
                this.register(id, mod);
            }
        });
    }

    /**
     * 切换到指定模块
     * @param {string} id - 模块ID
     * @param {HTMLElement} container - 渲染容器
     */
    async switchTo(id, container) {
        if (id === this._currentModuleId) return;

        const module = this._modules.get(id);
        if (!module) {
            console.error(`[Scheduler] Module "${id}" not found`);
            return;
        }

        // 停止当前模块
        if (this._currentModule) {
            // 停止动画引擎
            animationEngine.stop();
            animationEngine.unbind();

            // 暂停模拟器
            if (this._currentModule.simulator) {
                this._currentModule.simulator.pause();
            }

            // 销毁渲染器
            if (this._currentModule.renderer) {
                this._currentModule.renderer.destroy();
            }
        }

        // 清理旧的事件监听器
        this._cleanupListeners();

        // 更新状态
        this._currentModule = module;
        this._currentModuleId = id;

        // 更新标题
        const titleEl = document.getElementById('moduleTitle');
        if (titleEl) {
            titleEl.textContent = module.name || id;
        }

        // 通知模块切换
        stateManager.emit(EVENTS.MODULE_SWITCH, { moduleId: id });

        // 渲染模块
        if (container && module.renderer) {
            container.innerHTML = '';
            module.renderer.render(container);

            // 为磁盘调度模块设置回调
            if (module.renderer.setCallbacks) {
                module.renderer.setCallbacks({
                    onAlgorithmChange: (algoId) => {
                        // 算法切换时更新模拟器算法
                        if (module.simulator && module.simulator.setAlgorithm) {
                            module.simulator.setAlgorithm(algoId);
                        }
                    },
                    onApply: (config) => {
                        // 应用参数时初始化模拟器
                        // init() 内部会调用 _notifyUpdate() 触发 STEP_UPDATE
                        if (module.simulator && module.simulator.init) {
                            module.simulator.init(config);
                        }
                    }
                });
            }
        }

        // 绑定动画引擎到simulator
        if (module.simulator) {
            animationEngine.bind(module.simulator);
        }

        // 注册控制事件监听
        this._registerControlListeners(module);

        // 注册 STATE_CHANGE 监听，自动更新渲染器
        const unsubState = stateManager.on(EVENTS.STATE_CHANGE, (state) => {
            if (module.renderer && typeof module.renderer.update === 'function') {
                module.renderer.update(state);
            }
        });
        this._cleanupFns.push(unsubState);

        stateManager.emit(EVENTS.MODULE_LOADED, { moduleId: id });
    }

    /**
     * 注册控制事件监听
     * @param {Object} module
     */
    _registerControlListeners(module) {
        const sim = module.simulator;
        if (!sim) return;

        // 注意：播放/暂停、下一步、上一步、重置 均由 controlPanel 组件统一处理
        // 这里不再注册任何控制事件监听，避免与 controlPanel 重复触发

        this._cleanupFns.push();
    }


    /**
     * 清理事件监听器
     */
    _cleanupListeners() {
        this._cleanupFns.forEach(fn => fn());
        this._cleanupFns = [];
    }

    /**
     * 获取当前模块
     * @returns {Object|null} { id, name, simulator, renderer }
     */
    getCurrentModule() {
        return this._currentModule;
    }

    /**
     * 获取当前模块ID
     * @returns {string|null}
     */
    getCurrentModuleId() {
        return this._currentModuleId;
    }

    /**
     * 设置当前模块（由外部切换时同步状态）
     * @param {string} id
     */
    setCurrentModule(id) {
        this._currentModuleId = id;
        this._currentModule = this._modules.get(id) || null;
    }

    /**
     * 获取模块
     * @param {string} id
     * @returns {Object|undefined}
     */
    getModule(id) {
        return this._modules.get(id);
    }

    /**
     * 获取所有已注册模块
     * @returns {Array}
     */
    getModules() {
        return Array.from(this._modules.keys());
    }
}

// 导出单例
export const scheduler = new ModuleScheduler();
