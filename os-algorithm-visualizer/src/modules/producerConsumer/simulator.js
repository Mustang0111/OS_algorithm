/* ============================================
    生产者消费者问题模拟器
    实现经典的有界缓冲区（Bounded Buffer）问题
    使用信号量（Semaphore）实现同步
    支持手动触发生产/消费操作
    支持连续消费锁：消费者A必须连续消费n个后，其他消费者才能消费
    ============================================ */

import { Simulator } from '../../core/simulator.js';
import { stateManager } from '../../core/stateManager.js';
import { EVENTS } from '../../utils/constants.js';

export class ProducerConsumerSimulator extends Simulator {
    constructor() {
        super();
        this.moduleName = 'producerConsumer';
        this.algorithmName = 'ProducerConsumer';

        // 配置参数
        this._bufferSize = 5;
        this._numProducers = 2;
        this._numConsumers = 2;
        this._maxItems = 10;
        this._consumeBatchSize = 1; // 消费者连续消费数量（默认1=不限制）

        // 内部运行时状态
        this._buffer = [];
        this._producerStates = []; // 'idle' | 'producing' | 'waiting' | 'done'
        this._consumerStates = []; // 'idle' | 'consuming' | 'waiting' | 'done'
        this._producerItems = [];
        this._consumerItems = [];
        this._semMutex = 1;
        this._semEmpty = 0;
        this._semFull = 0;
        this._totalProduced = 0;
        this._totalConsumed = 0;
        this._currentActor = null;
        this._currentAction = '';
        this._phase = 'init';
        this._explanation = '等待开始...';
        this._logEntries = [];

        // 连续消费锁状态
        this._activeConsumer = null;       // 当前持有消费锁的消费者索引，null=无锁
        this._consumerBatchProgress = [];  // 每个消费者当前批次已消费数量
    }

    /**
     * 获取初始状态
     */
    _getInitialState() {
        return {
            bufferSize: 5,
            numProducers: 2,
            numConsumers: 2,
            maxItems: 10,
            consumeBatchSize: 1,
            buffer: [],
            producerStates: [],
            consumerStates: [],
            producerItems: [],
            consumerItems: [],
            semMutex: 1,
            semEmpty: 0,
            semFull: 0,
            totalProduced: 0,
            totalConsumed: 0,
            currentActor: null,
            currentAction: '',
            phase: 'init',
            isComplete: false,
            explanation: '等待开始...',
            logEntries: [],
            activeConsumer: null,
            consumerBatchProgress: []
        };
    }

    /**
     * 应用配置
     */
    _applyConfig(config) {
        if (config.bufferSize !== undefined) this._bufferSize = config.bufferSize;
        if (config.producers !== undefined) this._numProducers = config.producers;
        if (config.consumers !== undefined) this._numConsumers = config.consumers;
        if (config.maxItems !== undefined) this._maxItems = config.maxItems;
        if (config.consumeBatchSize !== undefined) this._consumeBatchSize = config.consumeBatchSize;

        // 重置内部运行时状态
        this._buffer = [];
        this._producerStates = new Array(this._numProducers).fill('idle');
        this._consumerStates = new Array(this._numConsumers).fill('idle');
        this._producerItems = new Array(this._numProducers).fill(0);
        this._consumerItems = new Array(this._numConsumers).fill(0);
        this._consumerBatchProgress = new Array(this._numConsumers).fill(0);
        this._activeConsumer = null;
        this._semMutex = 1;
        this._semEmpty = this._bufferSize;
        this._semFull = 0;
        this._totalProduced = 0;
        this._totalConsumed = 0;
        this._currentActor = null;
        this._currentAction = '';
        this._phase = 'init';
        this._logEntries = [];

        let batchDesc = '';
        if (this._consumeBatchSize > 1) {
            batchDesc = `，连续消费=${this._consumeBatchSize}个`;
        }
        this._explanation = `配置已更新：缓冲区大小=${this._bufferSize}，生产者=${this._numProducers}个，消费者=${this._numConsumers}个，总生产目标=${this._maxItems}个${batchDesc}`;

        // 同步到 _state
        this._syncStateToInternal();
        this._state.explanation = this._explanation;
    }

    /**
     * 将内部运行时状态同步到 _state
     */
    _syncStateToInternal() {
        this._state.bufferSize = this._bufferSize;
        this._state.numProducers = this._numProducers;
        this._state.numConsumers = this._numConsumers;
        this._state.maxItems = this._maxItems;
        this._state.consumeBatchSize = this._consumeBatchSize;
        this._state.buffer = [...this._buffer];
        this._state.producerStates = [...this._producerStates];
        this._state.consumerStates = [...this._consumerStates];
        this._state.producerItems = [...this._producerItems];
        this._state.consumerItems = [...this._consumerItems];
        this._state.semMutex = this._semMutex;
        this._state.semEmpty = this._semEmpty;
        this._state.semFull = this._semFull;
        this._state.totalProduced = this._totalProduced;
        this._state.totalConsumed = this._totalConsumed;
        this._state.currentActor = this._currentActor;
        this._state.currentAction = this._currentAction;
        this._state.phase = this._phase;
        this._state.isComplete = this.isComplete;
        this._state.explanation = this._explanation;
        this._state.logEntries = [...this._logEntries];
        this._state.activeConsumer = this._activeConsumer;
        this._state.consumerBatchProgress = [...this._consumerBatchProgress];
    }

    /**
     * 手动触发生产者生产
     * @param {number} producerIdx - 生产者索引
     * @returns {boolean} 是否成功生产
     */
    produce(producerIdx) {
        if (this.isComplete) {
            this._explanation = '✓ 所有生产消费已完成！无法继续生产。';
            this._syncStateToInternal();
            this._notifyUpdate();
            return false;
        }

        // 检查生产者索引是否有效
        if (producerIdx < 0 || producerIdx >= this._numProducers) {
            console.warn(`[ProducerConsumer] Invalid producer index: ${producerIdx}`);
            return false;
        }

        this._currentActor = `P${producerIdx}`;
        this._currentAction = 'produce';
        this._phase = 'produce';

        // 生产者状态：开始生产
        this._producerStates[producerIdx] = 'producing';

        const itemId = this._totalProduced + 1;

        // 检查总生产目标是否已达
        if (this._totalProduced >= this._maxItems) {
            this._producerStates[producerIdx] = 'done';
            this._explanation = `⏹ 生产者 P${producerIdx} 无法生产：总生产目标 ${this._maxItems} 个已完成`;
            this._currentAction = 'idle';
            this._addLog(`⏹ P${producerIdx} 无法生产：总目标 ${this._maxItems} 已完成`);
            this._syncStateToInternal();
            this._saveSnapshot();
            this._notifyUpdate();
            this._emitExplanation();
            return false;
        }

        // 检查缓冲区是否已满
        if (this._buffer.length >= this._bufferSize) {
            this._producerStates[producerIdx] = 'waiting';
            this._explanation = `⏳ 生产者 P${producerIdx} 等待：缓冲区已满 (${this._buffer.length}/${this._bufferSize})，无法生产物品 #${itemId}`;
            this._currentAction = 'waiting';
            this._addLog(`⏳ P${producerIdx} 等待：缓冲区已满 (${this._buffer.length}/${this._bufferSize})`);
            this._syncStateToInternal();
            this._saveSnapshot();
            this._notifyUpdate();
            this._emitExplanation();
            return false;
        }

        // === 执行生产操作 ===

        // P操作：semEmpty（减少空缓冲区数量）
        this._semEmpty--;

        // P操作：mutex（进入临界区）
        this._semMutex = 0;

        // 生产物品放入缓冲区
        this._buffer.push(itemId);
        this._totalProduced++;
        this._producerItems[producerIdx]++;

        this._explanation = `▶ 生产者 P${producerIdx} 生产物品 #${itemId} → 放入缓冲区 [${this._buffer.join(', ')}]`;

        // V操作：mutex（离开临界区）
        this._semMutex = 1;

        // V操作：semFull（增加满缓冲区数量）
        this._semFull++;

        this._producerStates[producerIdx] = 'idle';

        // 检查是否所有生产已完成
        if (this._totalProduced >= this._maxItems) {
            this._explanation += ' （总生产目标已达成 ✓）';
            // 将所有生产者标记为 done
            for (let i = 0; i < this._numProducers; i++) {
                if (this._producerStates[i] === 'idle') {
                    this._producerStates[i] = 'done';
                }
            }
        }

        // 检查是否全部完成
        this._checkComplete();

        this._addLog(`▶ P${producerIdx} 生产 #${itemId} → 缓冲区 [${this._buffer.join(', ')}]`);
        this._syncStateToInternal();
        this._saveSnapshot();
        this._notifyUpdate();
        this._emitExplanation();

        return true;
    }

    /**
     * 手动触发消费者消费
     * 支持连续消费锁：当 consumeBatchSize > 1 时，
     * 消费者A必须连续消费 consumeBatchSize 个后，其他消费者才能消费
     * @param {number} consumerIdx - 消费者索引
     * @returns {boolean} 是否成功消费
     */
    consume(consumerIdx) {
        if (this.isComplete) {
            this._explanation = '✓ 所有生产消费已完成！无法继续消费。';
            this._syncStateToInternal();
            this._notifyUpdate();
            return false;
        }

        // 检查消费者索引是否有效
        if (consumerIdx < 0 || consumerIdx >= this._numConsumers) {
            console.warn(`[ProducerConsumer] Invalid consumer index: ${consumerIdx}`);
            return false;
        }

        this._currentActor = `C${consumerIdx}`;
        this._currentAction = 'consume';
        this._phase = 'consume';

        // 消费者状态：开始消费
        this._consumerStates[consumerIdx] = 'consuming';

        // === 连续消费锁检查 ===
        // 如果 consumeBatchSize > 1，启用连续消费锁
        if (this._consumeBatchSize > 1) {
            // 情况1：有其他消费者正在持有消费锁，当前消费者被拒绝
            if (this._activeConsumer !== null && this._activeConsumer !== consumerIdx) {
                this._consumerStates[consumerIdx] = 'waiting';
                this._explanation = `🔒 消费者 C${consumerIdx} 等待：消费者 C${this._activeConsumer} 正在连续消费中（${this._consumerBatchProgress[this._activeConsumer]}/${this._consumeBatchSize}），请等待其完成批次`;
                this._currentAction = 'waiting';
                this._addLog(`🔒 C${consumerIdx} 等待：C${this._activeConsumer} 正在连续消费中（${this._consumerBatchProgress[this._activeConsumer]}/${this._consumeBatchSize}）`);
                this._syncStateToInternal();
                this._saveSnapshot();
                this._notifyUpdate();
                this._emitExplanation();
                return false;
            }

            // 情况2：当前消费者获得消费锁（首次消费）
            if (this._activeConsumer === null) {
                this._activeConsumer = consumerIdx;
                this._consumerBatchProgress[consumerIdx] = 0;
            }
        }

        // 检查缓冲区是否为空
        if (this._buffer.length === 0) {
            this._consumerStates[consumerIdx] = 'waiting';
            this._explanation = `⏳ 消费者 C${consumerIdx} 等待：缓冲区为空，无法消费`;
            this._currentAction = 'waiting';
            this._addLog(`⏳ C${consumerIdx} 等待：缓冲区为空`);
            this._syncStateToInternal();
            this._saveSnapshot();
            this._notifyUpdate();
            this._emitExplanation();
            return false;
        }

        // 检查是否所有生产已完成且缓冲区已空
        if (this._totalProduced >= this._maxItems && this._buffer.length === 0) {
            this._consumerStates[consumerIdx] = 'done';
            this._explanation = `⏹ 消费者 C${consumerIdx} 无法消费：所有物品已消费完毕`;
            this._currentAction = 'idle';
            this._addLog(`⏹ C${consumerIdx} 无法消费：所有物品已消费完毕`);
            this._syncStateToInternal();
            this._saveSnapshot();
            this._notifyUpdate();
            this._emitExplanation();
            return false;
        }

        // === 执行消费操作 ===

        // P操作：semFull（减少满缓冲区数量）
        this._semFull--;

        // P操作：mutex（进入临界区）
        this._semMutex = 0;

        // 从缓冲区取出物品（从头部取出，FIFO）
        const item = this._buffer.shift();
        this._totalConsumed++;
        this._consumerItems[consumerIdx]++;

        // 更新批次进度
        if (this._consumeBatchSize > 1) {
            this._consumerBatchProgress[consumerIdx]++;
        }

        this._explanation = `▶ 消费者 C${consumerIdx} 从缓冲区取出物品 #${item} → 消费完成 [${this._buffer.join(', ')}]`;

        // V操作：mutex（离开临界区）
        this._semMutex = 1;

        // V操作：semEmpty（增加空缓冲区数量）
        this._semEmpty++;

        // === 连续消费锁释放检查 ===
        if (this._consumeBatchSize > 1 && this._activeConsumer === consumerIdx) {
            if (this._consumerBatchProgress[consumerIdx] >= this._consumeBatchSize) {
                // 批次完成，释放消费锁
                this._explanation += ` （批次完成：${this._consumerBatchProgress[consumerIdx]}/${this._consumeBatchSize} ✓）`;
                this._activeConsumer = null;
                this._consumerBatchProgress[consumerIdx] = 0;
            } else {
                // 批次进行中，显示进度
                const remaining = this._consumeBatchSize - this._consumerBatchProgress[consumerIdx];
                this._explanation += ` （批次进度：${this._consumerBatchProgress[consumerIdx]}/${this._consumeBatchSize}，还需 ${remaining} 个）`;
            }
        }

        this._consumerStates[consumerIdx] = 'idle';

        // 检查是否全部完成
        this._checkComplete();

        this._addLog(`▶ C${consumerIdx} 消费 #${item} → 缓冲区 [${this._buffer.join(', ')}]`);
        this._syncStateToInternal();
        this._saveSnapshot();
        this._notifyUpdate();
        this._emitExplanation();

        return true;
    }

    /**
     * 检查是否全部完成
     */
    _checkComplete() {
        const allProduced = this._totalProduced >= this._maxItems;
        const allConsumed = this._totalConsumed >= this._totalProduced && allProduced && this._buffer.length === 0;

        if (allProduced && allConsumed) {
            this.isComplete = true;
            this._phase = 'done';
            this._explanation = '✓ 所有生产消费已完成！';
            this._addLog('✓ 所有生产消费已完成！');
        } else if (allProduced && !allConsumed) {
            this._explanation = '⏳ 生产已完成，等待消费者消费剩余物品...';
        }
    }

    /**
     * 添加日志条目
     * @param {string} text
     */
    _addLog(text) {
        this._logEntries.push({
            step: this._logEntries.length,
            text: text,
            timestamp: Date.now()
        });
    }

    /**
     * 发射解释更新事件
     */
    _emitExplanation() {
        stateManager.emit(EVENTS.EXPLANATION_UPDATE, {
            moduleName: this.moduleName,
            text: this._explanation,
            step: this.currentStep,
            total: this.totalSteps
        });
    }

    /**
     * 获取当前状态
     * @returns {Object}
     */
    getState() {
        const base = super.getState();
        return {
            ...base,
            bufferSize: this._bufferSize,
            numProducers: this._numProducers,
            numConsumers: this._numConsumers,
            maxItems: this._maxItems,
            consumeBatchSize: this._consumeBatchSize,
            buffer: [...this._buffer],
            producerStates: [...this._producerStates],
            consumerStates: [...this._consumerStates],
            producerItems: [...this._producerItems],
            consumerItems: [...this._consumerItems],
            semMutex: this._semMutex,
            semEmpty: this._semEmpty,
            semFull: this._semFull,
            totalProduced: this._totalProduced,
            totalConsumed: this._totalConsumed,
            currentActor: this._currentActor,
            currentAction: this._currentAction,
            phase: this._phase,
            explanation: this._explanation,
            logEntries: [...this._logEntries],
            activeConsumer: this._activeConsumer,
            consumerBatchProgress: [...this._consumerBatchProgress]
        };
    }

    /**
     * 重置
     */
    reset() {
        this._bufferSize = 5;
        this._numProducers = 2;
        this._numConsumers = 2;
        this._maxItems = 10;
        this._consumeBatchSize = 1;
        this._buffer = [];
        this._producerStates = [];
        this._consumerStates = [];
        this._producerItems = [];
        this._consumerItems = [];
        this._consumerBatchProgress = [];
        this._activeConsumer = null;
        this._semMutex = 1;
        this._semEmpty = 0;
        this._semFull = 0;
        this._totalProduced = 0;
        this._totalConsumed = 0;
        this._currentActor = null;
        this._currentAction = '';
        this._phase = 'init';
        this._logEntries = [];
        this._explanation = '已重置，请点击"应用配置"开始';
        super.reset();
    }

    /**
     * 上一步钩子：恢复内部运行时状态
     */
    _onPrevStep() {
        if (this.history[this.currentStep]) {
            const snap = this.history[this.currentStep];
            this._bufferSize = snap.bufferSize || 5;
            this._numProducers = snap.numProducers || 2;
            this._numConsumers = snap.numConsumers || 2;
            this._maxItems = snap.maxItems || 10;
            this._consumeBatchSize = snap.consumeBatchSize !== undefined ? snap.consumeBatchSize : 1;
            this._buffer = [...(snap.buffer || [])];
            this._producerStates = [...(snap.producerStates || [])];
            this._consumerStates = [...(snap.consumerStates || [])];
            this._producerItems = [...(snap.producerItems || [])];
            this._consumerItems = [...(snap.consumerItems || [])];
            this._consumerBatchProgress = [...(snap.consumerBatchProgress || [])];
            this._activeConsumer = snap.activeConsumer !== undefined ? snap.activeConsumer : null;
            this._semMutex = snap.semMutex !== undefined ? snap.semMutex : 1;
            this._semEmpty = snap.semEmpty !== undefined ? snap.semEmpty : 0;
            this._semFull = snap.semFull !== undefined ? snap.semFull : 0;
            this._totalProduced = snap.totalProduced || 0;
            this._totalConsumed = snap.totalConsumed || 0;
            this._currentActor = snap.currentActor || null;
            this._currentAction = snap.currentAction || '';
            this._phase = snap.phase || 'init';
            this._explanation = snap.explanation || '';
            this._logEntries = [...(snap.logEntries || [])];
        }
    }

    /**
     * step() 方法保留但不再用于自动调度
     * 改为手动模式后，step() 不做任何操作
     * @returns {boolean}
     */
    step() {
        // 手动模式下，step() 不执行自动调度
        // 所有操作通过 produce() 和 consume() 手动触发
        return !this.isComplete;
    }
}
