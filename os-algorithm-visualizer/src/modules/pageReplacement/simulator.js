/* ============================================
   页面置换模拟器
   支持 FIFO / LRU / OPT 算法
   采用快照回放策略：所有状态存储在 _state 中，
   每次 step() 修改 _state 后调用 _saveSnapshot()
   ============================================ */

import { Simulator } from '../../core/simulator.js';

export class PageReplacementSimulator extends Simulator {
    constructor() {
        super();
        this.moduleName = 'pageReplacement';
        this.algorithmName = 'FIFO';

        // 算法内部运行状态（不直接暴露给渲染器）
        this._refString = [];
        this._numFrames = 3;
        this._currentRefIndex = 0;
        this._frames = [];       // 当前内存块（数组，每个元素为页面号或 null）
        this._queue = [];        // FIFO 队列
        this._lastUsed = {};     // LRU 最近使用时间
        this._faultCount = 0;
        this._hitCount = 0;
        this._totalRefs = 0;
    }

    /**
     * 获取初始状态
     * @returns {Object}
     */
    _getInitialState() {
        return {
            frames: [],
            queue: [],
            faultCount: 0,
            hitCount: 0,
            totalRefs: 0,
            currentRefIndex: -1,
            currentPage: null,
            isFault: false,
            replacedPage: null,
            history: [],
            refString: [],
            numFrames: 3,
            algorithm: 'FIFO',
            isComplete: false,
            explanation: ''
        };
    }

    /**
     * 应用配置
     * @param {Object} config
     */
    _applyConfig(config) {
        this._refString = config.refString || [];
        this._numFrames = config.numFrames || 3;
        this.algorithmName = config.algorithm || 'FIFO';
        this._currentRefIndex = 0;
        this._frames = new Array(this._numFrames).fill(null);
        this._queue = [];
        this._lastUsed = {};
        this._faultCount = 0;
        this._hitCount = 0;
        this._totalRefs = this._refString.length;

        // 设置总步骤数（控制面板依赖此值启用按钮）
        this.totalSteps = this._totalRefs;

        // 更新 _state
        this._state.refString = [...this._refString];
        this._state.numFrames = this._numFrames;
        this._state.algorithm = this.algorithmName;
        this._state.frames = [...this._frames];
        this._state.queue = [];
        this._state.faultCount = 0;
        this._state.hitCount = 0;
        this._state.totalRefs = this._totalRefs;
        this._state.currentRefIndex = -1;
        this._state.currentPage = null;
        this._state.isFault = false;
        this._state.replacedPage = null;
        this._state.isComplete = false;
        this._state.history = [];
        this._state.explanation = '初始化完成，等待开始...';
    }

    /**
     * 执行一步页面置换
     * @returns {boolean} 是否还有下一步
     */
    step() {
        if (!this.isInitialized) return false;
        if (this.isComplete) return false;

        // 如果当前步骤在历史范围内（回放模式），从历史快照恢复并前进
        if (this.currentStep < this.history.length - 1) {
            this.currentStep++;
            // 从历史快照恢复 _state
            if (this.history[this.currentStep]) {
                this._state = JSON.parse(JSON.stringify(this.history[this.currentStep]));
            }
            this._notifyUpdate();
            return this.currentStep < this.totalSteps;
        }

        // 执行新的一步
        if (this._currentRefIndex >= this._totalRefs) {
            this.isComplete = true;
            this._state.isComplete = true;
            this._state.explanation = '所有页面引用已处理完毕。';
            this._notifyUpdate();
            return false;
        }

        const page = this._refString[this._currentRefIndex];
        const algorithm = this.algorithmName;

        // 检查是否缺页
        const isFault = !this._frames.includes(page);

        let replacedPage = null;

        if (isFault) {
            this._faultCount++;

            if (algorithm === 'FIFO') {
                replacedPage = this._handleFIFO(page);
            } else if (algorithm === 'LRU') {
                replacedPage = this._handleLRU(page);
            } else if (algorithm === 'OPT') {
                replacedPage = this._handleOPT(page);
            }
        } else {
            this._hitCount++;
            // LRU 需要更新访问时间
            if (algorithm === 'LRU') {
                this._lastUsed[page] = this._currentRefIndex;
            }
        }

        // 更新 _state
        this._state.frames = [...this._frames];
        this._state.queue = [...this._queue];
        this._state.faultCount = this._faultCount;
        this._state.hitCount = this._hitCount;
        this._state.currentRefIndex = this._currentRefIndex;
        this._state.currentPage = page;
        this._state.isFault = isFault;
        this._state.replacedPage = replacedPage;
        this._state.totalRefs = this._totalRefs;

        // 生成解释文本
        this._state.explanation = this._generateExplanation(page, isFault, replacedPage);

        // 保存快照（此时 this.history 会新增一条记录）
        this._saveSnapshot();

        // 构建历史记录（用于矩阵显示）- 使用保存后的完整 history
        this._state.history = this.history.map((h, idx) => ({
            frames: [...(h.frames || [])],
            isFault: h.isFault || false,
            replacedPage: h.replacedPage || null,
            currentPage: h.currentPage || null,
            step: idx
        }));

        // 更新索引
        this._currentRefIndex++;
        this.totalSteps = this._totalRefs;

        // 检查是否完成
        if (this._currentRefIndex >= this._totalRefs) {
            this.isComplete = true;
            this._state.isComplete = true;
            this._state.explanation = '所有页面引用已处理完毕。';
        }

        this._notifyUpdate();

        return this._currentRefIndex < this._totalRefs;
    }

    /**
     * FIFO 页面置换
     * @param {number} page
     * @returns {number|null} 被替换的页面
     */
    _handleFIFO(page) {
        let replaced = null;
        this._lastReplacedIndex = null;

        // 查找空位
        const emptyIndex = this._frames.indexOf(null);
        if (emptyIndex !== -1) {
            this._frames[emptyIndex] = page;
            this._queue.push(page);
        } else {
            // 替换队首
            const oldest = this._queue.shift();
            const replaceIndex = this._frames.indexOf(oldest);
            if (replaceIndex !== -1) {
                replaced = this._frames[replaceIndex];
                this._lastReplacedIndex = replaceIndex;
                this._frames[replaceIndex] = page;
                this._queue.push(page);
            }
        }

        return replaced;
    }

    /**
     * LRU 页面置换
     * @param {number} page
     * @returns {number|null} 被替换的页面
     */
    _handleLRU(page) {
        let replaced = null;
        this._lastReplacedIndex = null;

        // 查找空位
        const emptyIndex = this._frames.indexOf(null);
        if (emptyIndex !== -1) {
            this._frames[emptyIndex] = page;
            this._lastUsed[page] = this._currentRefIndex;
        } else {
            // 找到最久未使用的页面
            let lruPage = null;
            let lruTime = Infinity;

            for (const p of this._frames) {
                const time = this._lastUsed[p] !== undefined ? this._lastUsed[p] : -1;
                if (time < lruTime) {
                    lruTime = time;
                    lruPage = p;
                }
            }

            const replaceIndex = this._frames.indexOf(lruPage);
            if (replaceIndex !== -1) {
                replaced = this._frames[replaceIndex];
                this._lastReplacedIndex = replaceIndex;
                delete this._lastUsed[replaced];
                this._frames[replaceIndex] = page;
                this._lastUsed[page] = this._currentRefIndex;
            }
        }

        return replaced;
    }

    /**
     * OPT 页面置换
     * @param {number} page
     * @returns {number|null} 被替换的页面
     */
    _handleOPT(page) {
        let replaced = null;
        this._lastReplacedIndex = null;

        // 查找空位
        const emptyIndex = this._frames.indexOf(null);
        if (emptyIndex !== -1) {
            this._frames[emptyIndex] = page;
        } else {
            // 找到未来最远使用的页面
            let optPage = null;
            let farthestIndex = -1;

            for (const p of this._frames) {
                // 查找未来出现位置
                let nextUse = -1;
                for (let i = this._currentRefIndex + 1; i < this._totalRefs; i++) {
                    if (this._refString[i] === p) {
                        nextUse = i;
                        break;
                    }
                }

                // 如果未来不再使用，优先替换
                if (nextUse === -1) {
                    optPage = p;
                    break;
                }

                if (nextUse > farthestIndex) {
                    farthestIndex = nextUse;
                    optPage = p;
                }
            }

            const replaceIndex = this._frames.indexOf(optPage);
            if (replaceIndex !== -1) {
                replaced = this._frames[replaceIndex];
                this._lastReplacedIndex = replaceIndex;
                this._frames[replaceIndex] = page;
            }
        }

        return replaced;
    }

    /**
     * 生成解释文本
     * @param {number} page
     * @param {boolean} isFault
     * @param {number|null} replacedPage
     * @returns {string}
     */
    _generateExplanation(page, isFault, replacedPage) {
        const algoName = this.algorithmName;
        const step = this._currentRefIndex + 1;

        if (isFault) {
            if (replacedPage !== null) {
                // 找到被替换页面所在的物理块索引
                // 注意：此时 this._frames 中已经完成了替换，新页面已进入
                // 被替换的页面已不在 _frames 中，所以我们需要用 _lastReplacedIndex
                const blockIdx = (this._lastReplacedIndex !== undefined && this._lastReplacedIndex !== null)
                    ? this._lastReplacedIndex + 1
                    : '?';

                let detail = '';
                if (algoName === 'FIFO') {
                    detail = `物理块${blockIdx}中驻留的页面${replacedPage}是最先进入内存的，根据先进先出（FIFO）置换策略，该页面被选为置换目标。`;
                } else if (algoName === 'LRU') {
                    detail = `物理块${blockIdx}中驻留的页面${replacedPage}是最久未被访问的，根据最近最久未使用（LRU）置换策略，该页面被选为置换目标。`;
                } else if (algoName === 'OPT') {
                    // 计算被替换页面的未来引用距离
                    let nextUse = -1;
                    for (let i = this._currentRefIndex; i < this._totalRefs; i++) {
                        if (this._refString[i] === replacedPage) {
                            nextUse = i;
                            break;
                        }
                    }
                    if (nextUse === -1) {
                        detail = `物理块${blockIdx}中驻留的页面${replacedPage}在未来不会被再次引用，根据最佳置换（OPT）策略，该页面被选为置换目标。`;
                    } else {
                        const dist = nextUse - this._currentRefIndex;
                        detail = `物理块${blockIdx}中驻留的页面${replacedPage}在未来第${dist}次引用时才会被访问（距离最远），根据最佳置换（OPT）策略，该页面被选为置换目标。`;
                    }
                }
                return `[步骤 ${step}] 访问页面 ${page} → 缺页中断。${detail}将页面 ${page} 载入物理块${blockIdx}。`;
            } else {
                // 有空闲块，找到新页面载入的块索引
                const emptyIndex = this._frames.indexOf(page);
                const blockIdx = emptyIndex !== -1 ? emptyIndex + 1 : '?';
                return `[步骤 ${step}] 访问页面 ${page} → 缺页中断。物理块${blockIdx}当前为空闲状态，直接将页面 ${page} 载入该空闲块。`;
            }
        } else {
            const hitIndex = this._frames.indexOf(page);
            const blockIdx = hitIndex !== -1 ? hitIndex + 1 : '?';
            return `[步骤 ${step}] 访问页面 ${page} → 命中。页面 ${page} 已驻留在物理块${blockIdx}中，无需进行页面置换。`;
        }
    }

    /**
     * 重置模拟器
     */
    reset() {
        this._refString = [];
        this._numFrames = 3;
        this._currentRefIndex = 0;
        this._frames = [];
        this._queue = [];
        this._lastUsed = {};
        this._faultCount = 0;
        this._hitCount = 0;
        this._totalRefs = 0;

        super.reset();
    }

    /**
     * 获取当前状态（增强版，包含运行时状态）
     * 注意：不覆盖 history 字段，由基类 getState() 负责截断
     * @returns {Object}
     */
    getState() {
        const baseState = super.getState();
        return {
            ...baseState,
            frames: this._state.frames || [],
            queue: this._state.queue || [],
            faultCount: this._state.faultCount || 0,
            hitCount: this._state.hitCount || 0,
            totalRefs: this._state.totalRefs || 0,
            currentRefIndex: this._state.currentRefIndex ?? -1,
            currentPage: this._state.currentPage,
            isFault: this._state.isFault || false,
            replacedPage: this._state.replacedPage,
            // 不覆盖 history，使用基类截断后的 history
            refString: this._state.refString || [],
            numFrames: this._state.numFrames || 3,
            algorithm: this._state.algorithm || 'FIFO',
            explanation: this._state.explanation || ''
        };
    }
}
