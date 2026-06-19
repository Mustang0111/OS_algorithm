/* ============================================
   状态管理器 - 发布订阅模式
   负责全局状态管理和事件通信
   ============================================ */

class StateManager {
    constructor() {
        this._listeners = new Map();
        this._state = {};
        this._instance = null;
    }

    /**
     * 获取单例
     * @returns {StateManager}
     */
    static getInstance() {
        if (!this._instance) {
            this._instance = new StateManager();
        }
        return this._instance;
    }

    /**
     * 订阅事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);

        // 返回取消订阅函数
        return () => {
            this._listeners.get(event)?.delete(callback);
        };
    }

    /**
     * 取消订阅
     * @param {string} event
     * @param {Function} callback
     */
    off(event, callback) {
        this._listeners.get(event)?.delete(callback);
    }

    /**
     * 触发事件
     * @param {string} event
     * @param {*} data
     */
    emit(event, data) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[StateManager] Error in event "${event}":`, error);
                }
            });
        }
    }

    /**
     * 更新全局状态
     * @param {string} key
     * @param {*} value
     */
    setState(key, value) {
        this._state[key] = value;
        this.emit('state:change', { key, value });
    }

    /**
     * 获取全局状态
     * @param {string} key
     * @param {*} defaultValue
     * @returns {*}
     */
    getState(key, defaultValue = undefined) {
        return this._state[key] !== undefined ? this._state[key] : defaultValue;
    }

    /**
     * 移除所有监听器
     */
    clear() {
        this._listeners.clear();
        this._state = {};
    }
}

// 导出单例
export const stateManager = StateManager.getInstance();
