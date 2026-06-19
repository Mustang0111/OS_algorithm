/* ============================================
    生产者消费者问题渲染器
    可视化缓冲区状态、生产者/消费者状态、信号量
    采用状态驱动UI：监听 STATE_CHANGE 事件自动更新
    每个生产者和消费者都有独立的"生产"/"消费"按钮
    ============================================ */

import { Renderer } from '../../core/renderer.js';
import { createElement, emptyElement } from '../../utils/dom.js';
import { stateManager } from '../../core/stateManager.js';
import { EVENTS } from '../../utils/constants.js';
import { PRESETS } from '../../presets/index.js';

export class ProducerConsumerRenderer extends Renderer {
    constructor(simulator) {
        super();
        this._simulator = simulator;
        this._unsubscribers = [];
        this._container = null;

        // DOM 元素引用
        this._bufferSizeInput = null;
        this._producersInput = null;
        this._consumersInput = null;
        this._maxItemsInput = null;
        this._consumeBatchSizeInput = null;
        this._producedStat = null;
        this._consumedStat = null;
        this._bufferStat = null;
        this._progressStat = null;
        this._explanationEl = null;
        this._bufferGrid = null;
        this._producersList = null;
        this._consumersList = null;
        this._emptyEl = null;
        this._fullEl = null;
        this._batchLockEl = null;
        this._ownerEl = null;
        this._logContainer = null;
        this._producerBtns = [];
        this._consumerBtns = [];
    }

    /**
     * 渲染主界面
     * @param {HTMLElement} container
     */
    render(container) {
        this.mount(container);
        this.clear();
        this._container = container;

        const mainWrapper = createElement('div', { className: 'module-producer-consumer' });

        // 配置面板
        const configCard = this._createConfigPanel();
        mainWrapper.appendChild(configCard);

        // 状态概览
        const overviewCard = this._createOverviewPanel();
        mainWrapper.appendChild(overviewCard);

        // 缓冲区可视化
        const bufferCard = this._createBufferPanel();
        mainWrapper.appendChild(bufferCard);

        // 生产者和消费者状态（含按钮）
        const actorsCard = this._createActorsPanel();
        mainWrapper.appendChild(actorsCard);

        // 信号量状态
        const semCard = this._createSemaphorePanel();
        mainWrapper.appendChild(semCard);

        // 步骤日志
        const logCard = this._createLogPanel();
        mainWrapper.appendChild(logCard);

        container.appendChild(mainWrapper);

        // 监听状态更新
        this._unsubscribers.push(
            stateManager.on(EVENTS.STATE_CHANGE, (state) => {
                if (state.moduleName === 'producerConsumer') {
                    this._updateUI(state);
                }
            })
        );

        // 监听预设选择
        this._unsubscribers.push(
            stateManager.on(EVENTS.PRESET_SELECT, (presetId) => {
                this._applyPreset(presetId);
            })
        );
    }

    /**
     * 创建配置面板
     */
    _createConfigPanel() {
        const card = createElement('div', { className: 'card' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '⚙ 参数配置'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });
        const grid = createElement('div', { className: 'pc-config-grid' });

        // 缓冲区大小
        const bufGroup = createElement('div', { className: 'pc-config-group' });
        bufGroup.appendChild(createElement('label', { className: 'pc-config-label' }, '缓冲区大小'));
        this._bufferSizeInput = createElement('input', {
            className: 'pc-config-input',
            type: 'number',
            min: '1',
            max: '20',
            value: '5'
        });
        bufGroup.appendChild(this._bufferSizeInput);
        grid.appendChild(bufGroup);

        // 生产者数量
        const prodGroup = createElement('div', { className: 'pc-config-group' });
        prodGroup.appendChild(createElement('label', { className: 'pc-config-label' }, '生产者数量'));
        this._producersInput = createElement('input', {
            className: 'pc-config-input',
            type: 'number',
            min: '1',
            max: '10',
            value: '2'
        });
        prodGroup.appendChild(this._producersInput);
        grid.appendChild(prodGroup);

        // 消费者数量
        const consGroup = createElement('div', { className: 'pc-config-group' });
        consGroup.appendChild(createElement('label', { className: 'pc-config-label' }, '消费者数量'));
        this._consumersInput = createElement('input', {
            className: 'pc-config-input',
            type: 'number',
            min: '1',
            max: '10',
            value: '2'
        });
        consGroup.appendChild(this._consumersInput);
        grid.appendChild(consGroup);

        // 总生产目标
        const maxGroup = createElement('div', { className: 'pc-config-group' });
        maxGroup.appendChild(createElement('label', { className: 'pc-config-label' }, '总生产目标'));
        this._maxItemsInput = createElement('input', {
            className: 'pc-config-input',
            type: 'number',
            min: '1',
            max: '50',
            value: '10'
        });
        maxGroup.appendChild(this._maxItemsInput);
        grid.appendChild(maxGroup);

        // 连续消费数量
        const batchGroup = createElement('div', { className: 'pc-config-group' });
        batchGroup.appendChild(createElement('label', { className: 'pc-config-label' }, '连续消费数量'));
        this._consumeBatchSizeInput = createElement('input', {
            className: 'pc-config-input',
            type: 'number',
            min: '1',
            max: '10',
            value: '1'
        });
        const batchHint = createElement('div', { className: 'pc-config-hint' }, '设为1则不限制，>1时消费者需连续消费n个后其他消费者才能消费');
        batchGroup.appendChild(this._consumeBatchSizeInput);
        batchGroup.appendChild(batchHint);
        grid.appendChild(batchGroup);

        body.appendChild(grid);


        // 按钮行
        const btnRow = createElement('div', { className: 'pc-config-actions' });
        const applyBtn = createElement('button', {
            className: 'btn btn-primary',
            onClick: () => this._applyConfig()
        }, '应用配置');
        btnRow.appendChild(applyBtn);
        body.appendChild(btnRow);

        card.appendChild(body);
        return card;
    }

    /**
     * 创建概览面板
     */
    _createOverviewPanel() {
        const card = createElement('div', { className: 'card' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '📊 状态概览'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });
        const stats = createElement('div', { className: 'pc-stats' });

        this._producedStat = this._createStatItem('已生产', '0', 'text-success');
        this._consumedStat = this._createStatItem('已消费', '0', 'text-primary');
        this._bufferStat = this._createStatItem('缓冲区占用', '0/5', 'text-warning');
        this._progressStat = this._createStatItem('完成进度', '0%', '');

        stats.appendChild(this._producedStat);
        stats.appendChild(this._consumedStat);
        stats.appendChild(this._bufferStat);
        stats.appendChild(this._progressStat);
        body.appendChild(stats);

        // 解释面板
        this._explanationEl = createElement('div', { className: 'pc-explanation' });
        this._explanationEl.textContent = '点击"应用配置"开始，然后点击生产者/消费者旁的按钮手动触发操作';
        body.appendChild(this._explanationEl);

        card.appendChild(body);
        return card;
    }

    /**
     * 创建单个统计项
     * @param {string} label
     * @param {string} value
     * @param {string} colorClass
     * @returns {HTMLElement}
     */
    _createStatItem(label, value, colorClass) {
        const item = createElement('div', { className: 'stat-item' });
        const labelEl = createElement('div', { className: 'stat-label' }, label);
        const valueEl = createElement('div', { className: `stat-value ${colorClass}` }, value);
        item.appendChild(labelEl);
        item.appendChild(valueEl);
        return item;
    }

    /**
     * 创建缓冲区可视化面板
     */
    _createBufferPanel() {
        const card = createElement('div', { className: 'card' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '📦 缓冲区状态'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });

        // 缓冲区格子
        this._bufferGrid = createElement('div', { className: 'pc-buffer-grid' });
        body.appendChild(this._bufferGrid);

        // 缓冲区标签
        const labels = createElement('div', { className: 'pc-buffer-labels' });
        labels.appendChild(createElement('span', { className: 'pc-buffer-label' }, '← 消费者取出'));
        labels.appendChild(createElement('span', { className: 'pc-buffer-label' }, '生产者放入 →'));
        body.appendChild(labels);

        card.appendChild(body);
        return card;
    }

    /**
     * 创建生产者和消费者状态面板（含手动按钮）
     */
    _createActorsPanel() {
        const card = createElement('div', { className: 'card' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '👤 生产者和消费者状态'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });

        // 生产者区域
        this._producersContainer = createElement('div', { className: 'pc-actors-section' });
        const prodTitle = createElement('div', { className: 'pc-actors-section-title' }, '生产者（点击"生产"按钮手动生产）');
        this._producersContainer.appendChild(prodTitle);
        this._producersList = createElement('div', { className: 'pc-actors-list' });
        this._producersContainer.appendChild(this._producersList);
        body.appendChild(this._producersContainer);

        // 消费者区域
        this._consumersContainer = createElement('div', { className: 'pc-actors-section' });
        const consTitle = createElement('div', { className: 'pc-actors-section-title' }, '消费者（点击"消费"按钮手动消费）');
        this._consumersContainer.appendChild(consTitle);
        this._consumersList = createElement('div', { className: 'pc-actors-list' });
        this._consumersContainer.appendChild(this._consumersList);
        body.appendChild(this._consumersContainer);

        card.appendChild(body);
        return card;
    }

    /**
     * 创建信号量状态面板
     */
    _createSemaphorePanel() {
        const card = createElement('div', { className: 'card' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '🔒 信号量状态'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });
        const semGrid = createElement('div', { className: 'pc-sem-grid' });

        // empty
        const emptyItem = this._createSemItem('empty（空位）', 0, 'counting');
        this._emptyEl = emptyItem;
        semGrid.appendChild(emptyItem);

        // full
        const fullItem = this._createSemItem('full（满缓冲区）', 0, 'counting');
        this._fullEl = fullItem;
        semGrid.appendChild(fullItem);

        // batchLock（消费锁）
        const batchLockItem = this._createSemItem('batchLock（消费锁）', 1, 'binary');
        this._batchLockEl = batchLockItem;
        semGrid.appendChild(batchLockItem);

        // 消费锁持有者
        const ownerItem = this._createOwnerItem();
        this._ownerEl = ownerItem;
        semGrid.appendChild(ownerItem);

        body.appendChild(semGrid);
        card.appendChild(body);
        return card;
    }

    /**
     * 创建消费锁持有者显示项
     * @returns {HTMLElement}
     */
    _createOwnerItem() {
        const item = createElement('div', { className: 'pc-sem-owner' });
        const nameEl = createElement('div', { className: 'pc-sem-name' }, '持有者');
        const valueEl = createElement('div', { className: 'pc-sem-value' }, '空闲');
        item.appendChild(nameEl);
        item.appendChild(valueEl);
        return item;
    }

    /**
     * 创建单个信号量显示项
     * @param {string} name
     * @param {number} value
     * @param {string} type - 'binary' | 'counting'
     * @returns {HTMLElement}
     */
    _createSemItem(name, value, type) {
        const item = createElement('div', { className: 'pc-sem-item' });
        const nameEl = createElement('div', { className: 'pc-sem-name' }, name);
        const valueEl = createElement('div', { className: 'pc-sem-value' }, String(value));
        const barContainer = createElement('div', { className: 'pc-sem-bar-container' });
        const bar = createElement('div', { className: 'pc-sem-bar' });
        bar.style.width = type === 'binary' ? (value > 0 ? '100%' : '0%') : '0%';
        barContainer.appendChild(bar);

        item.appendChild(nameEl);
        item.appendChild(valueEl);
        item.appendChild(barContainer);
        return item;
    }

    /**
     * 创建步骤日志面板
     */
    _createLogPanel() {
        const card = createElement('div', { className: 'card' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '📝 操作日志'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });
        this._logContainer = createElement('div', { className: 'pc-log-container' });
        body.appendChild(this._logContainer);

        card.appendChild(body);
        return card;
    }

    /**
     * 应用配置
     */
    _applyConfig() {
        const bufferSize = parseInt(this._bufferSizeInput.value) || 5;
        const producers = parseInt(this._producersInput.value) || 2;
        const consumers = parseInt(this._consumersInput.value) || 2;
        const maxItems = parseInt(this._maxItemsInput.value) || 10;
        const consumeBatchSize = parseInt(this._consumeBatchSizeInput.value) || 1;

        this._simulator.init({
            bufferSize,
            producers,
            consumers,
            maxItems,
            consumeBatchSize
        });
    }


    /**
     * 应用预设
     * @param {string} presetId
     */
    _applyPreset(presetId) {
        const preset = (PRESETS.producerConsumer || []).find(
            p => p.name === presetId || p.id === presetId
        );
        if (!preset) {
            console.warn('[ProducerConsumerRenderer] Preset not found:', presetId);
            return;
        }

        const config = preset.config;

        // 更新输入框
        if (this._bufferSizeInput) {
            this._bufferSizeInput.value = config.bufferSize || 5;
        }
        if (this._producersInput) {
            this._producersInput.value = config.producers || 2;
        }
        if (this._consumersInput) {
            this._consumersInput.value = config.consumers || 2;
        }
        if (this._maxItemsInput) {
            this._maxItemsInput.value = config.maxItems || 10;
        }

        // 应用配置
        this._applyConfig();
    }

    /**
     * 更新UI（状态驱动）
     * @param {Object} state
     */
    _updateUI(state) {
        if (!state) return;

        // 更新概览统计
        this._updateStats(state);

        // 更新解释
        if (this._explanationEl && state.explanation) {
            this._explanationEl.textContent = state.explanation;
        }

        // 更新缓冲区
        this._updateBuffer(state);

        // 更新生产者和消费者（含按钮）
        this._updateActors(state);

        // 更新信号量
        this._updateSemaphores(state);

        // 更新日志
        this._updateLog(state);
    }

    /**
     * 更新统计信息
     * @param {Object} state
     */
    _updateStats(state) {
        if (this._producedStat) {
            const valEl = this._producedStat.querySelector('.stat-value');
            if (valEl) valEl.textContent = String(state.totalProduced || 0);
        }
        if (this._consumedStat) {
            const valEl = this._consumedStat.querySelector('.stat-value');
            if (valEl) valEl.textContent = String(state.totalConsumed || 0);
        }
        if (this._bufferStat) {
            const valEl = this._bufferStat.querySelector('.stat-value');
            if (valEl) {
                const bufferSize = state.bufferSize || 5;
                const bufferLen = (state.buffer || []).length;
                valEl.textContent = `${bufferLen}/${bufferSize}`;
            }
        }
        if (this._progressStat) {
            const valEl = this._progressStat.querySelector('.stat-value');
            if (valEl) {
                const maxItems = state.maxItems || 10;
                const progress = maxItems > 0
                    ? Math.min(100, Math.round((state.totalProduced || 0) / maxItems * 100))
                    : 0;
                valEl.textContent = `${progress}%`;
            }
        }
    }

    /**
     * 更新缓冲区可视化
     * @param {Object} state
     */
    _updateBuffer(state) {
        if (!this._bufferGrid) return;

        emptyElement(this._bufferGrid);

        const bufferSize = state.bufferSize || 5;
        const buffer = state.buffer || [];

        for (let i = 0; i < bufferSize; i++) {
            const cell = createElement('div', { className: 'pc-buffer-cell' });
            if (i < buffer.length) {
                cell.classList.add('filled');
                cell.textContent = String(buffer[i]);
                // 高亮最新放入的物品
                if (i === buffer.length - 1 && state.currentAction === 'produce') {
                    cell.classList.add('highlight-produce');
                }
            } else {
                cell.classList.add('empty');
                cell.textContent = '□';
            }
            this._bufferGrid.appendChild(cell);
        }
    }

    /**
     * 更新生产者和消费者状态（含手动按钮）
     * @param {Object} state
     */
    _updateActors(state) {
        // 更新生产者
        if (this._producersList) {
            emptyElement(this._producersList);
            this._producerBtns = [];
            const numProducers = state.numProducers || 2;
            const producerStates = state.producerStates || [];
            const producerItems = state.producerItems || [];

            for (let i = 0; i < numProducers; i++) {
                const item = createElement('div', { className: 'pc-actor-item' });
                const pState = producerStates[i] || 'idle';
                item.classList.add(`pc-actor-${pState}`);

                const icon = createElement('div', { className: 'pc-actor-icon' }, '🏭');
                const info = createElement('div', { className: 'pc-actor-info' });
                const name = createElement('div', { className: 'pc-actor-name' }, `P${i}`);
                const status = createElement('div', { className: 'pc-actor-status' }, this._getStateText(pState));
                const count = createElement('div', { className: 'pc-actor-count' }, `已生产: ${producerItems[i] || 0}`);

                info.appendChild(name);
                info.appendChild(status);
                info.appendChild(count);
                item.appendChild(icon);
                item.appendChild(info);

                // 生产按钮
                const btn = createElement('button', {
                    className: 'pc-actor-btn pc-produce-btn',
                    onClick: () => {
                        this._simulator.produce(i);
                    }
                }, '生产');
                // 如果已完成或等待中，禁用按钮
                if (pState === 'done' || state.isComplete) {
                    btn.disabled = true;
                    btn.classList.add('disabled');
                }
                item.appendChild(btn);
                this._producerBtns.push(btn);

                // 高亮当前活跃的生产者
                if (state.currentActor === `P${i}` && state.currentAction === 'produce') {
                    item.classList.add('pc-actor-active');
                }

                this._producersList.appendChild(item);
            }
        }

        // 更新消费者
        if (this._consumersList) {
            emptyElement(this._consumersList);
            this._consumerBtns = [];
            const numConsumers = state.numConsumers || 2;
            const consumerStates = state.consumerStates || [];
            const consumerItems = state.consumerItems || [];
            const activeConsumer = state.activeConsumer;
            const consumerBatchProgress = state.consumerBatchProgress || [];
            const consumeBatchSize = state.consumeBatchSize || 1;

            for (let i = 0; i < numConsumers; i++) {
                const item = createElement('div', { className: 'pc-actor-item' });
                const cState = consumerStates[i] || 'idle';
                item.classList.add(`pc-actor-${cState}`);

                // 高亮持有消费锁的消费者
                if (activeConsumer === i && consumeBatchSize > 1) {
                    item.classList.add('pc-actor-lock-holder');
                }

                const icon = createElement('div', { className: 'pc-actor-icon' }, '👤');
                const info = createElement('div', { className: 'pc-actor-info' });
                const name = createElement('div', { className: 'pc-actor-name' }, `C${i}`);
                
                // 构建状态文字（含批次进度信息）
                let statusText = this._getStateText(cState);
                if (consumeBatchSize > 1) {
                    const batchProgress = consumerBatchProgress[i] || 0;
                    if (activeConsumer === i) {
                        statusText += ` | 批次 ${batchProgress}/${consumeBatchSize}`;
                    } else if (activeConsumer !== null) {
                        statusText += ` | 等待锁释放...`;
                    } else {
                        statusText += ` | 批次 ${batchProgress}/${consumeBatchSize}`;
                    }
                }
                const status = createElement('div', { className: 'pc-actor-status' }, statusText);
                const count = createElement('div', { className: 'pc-actor-count' }, `已消费: ${consumerItems[i] || 0}`);

                info.appendChild(name);
                info.appendChild(status);
                info.appendChild(count);

                item.appendChild(icon);
                item.appendChild(info);

                // 消费按钮
                const btn = createElement('button', {
                    className: 'pc-actor-btn pc-consume-btn',
                    onClick: () => {
                        this._simulator.consume(i);
                    }
                }, '消费');
                if (cState === 'done' || state.isComplete) {
                    btn.disabled = true;
                    btn.classList.add('disabled');
                }
                item.appendChild(btn);
                this._consumerBtns.push(btn);

                // 高亮当前活跃的消费者
                if (state.currentActor === `C${i}` && state.currentAction === 'consume') {
                    item.classList.add('pc-actor-active');
                }

                this._consumersList.appendChild(item);
            }
        }

    }

    /**
     * 获取状态文本
     * @param {string} state
     * @returns {string}
     */
    _getStateText(state) {
        const map = {
            'idle': '空闲',
            'producing': '生产中...',
            'consuming': '消费中...',
            'waiting': '等待中',
            'done': '已完成'
        };
        return map[state] || state;
    }

    /**
     * 更新信号量显示
     * @param {Object} state
     */
    _updateSemaphores(state) {
        if (this._emptyEl) {
            const val = state.semEmpty !== undefined ? state.semEmpty : 0;
            const bufferSize = state.bufferSize || 5;
            const valEl = this._emptyEl.querySelector('.pc-sem-value');
            if (valEl) valEl.textContent = String(val);
            const bar = this._emptyEl.querySelector('.pc-sem-bar');
            if (bar) {
                const pct = bufferSize > 0 ? Math.min(100, (val / bufferSize) * 100) : 0;
                bar.style.width = `${pct}%`;
                bar.className = 'pc-sem-bar' + (val > 0 ? ' active' : '');
            }
        }

        if (this._fullEl) {
            const val = state.semFull !== undefined ? state.semFull : 0;
            const bufferSize = state.bufferSize || 5;
            const valEl = this._fullEl.querySelector('.pc-sem-value');
            if (valEl) valEl.textContent = String(val);
            const bar = this._fullEl.querySelector('.pc-sem-bar');
            if (bar) {
                const pct = bufferSize > 0 ? Math.min(100, (val / bufferSize) * 100) : 0;
                bar.style.width = `${pct}%`;
                bar.className = 'pc-sem-bar' + (val > 0 ? ' active' : '');
            }
        }

        // batchLock（消费锁）更新
        if (this._batchLockEl) {
            const isLocked = state.activeConsumer !== null;
            const val = isLocked ? 0 : 1;
            const valEl = this._batchLockEl.querySelector('.pc-sem-value');
            if (valEl) valEl.textContent = String(val);
            const bar = this._batchLockEl.querySelector('.pc-sem-bar');
            if (bar) {
                bar.style.width = isLocked ? '0%' : '100%';
                bar.className = 'pc-sem-bar' + (!isLocked ? ' active' : '');
            }
        }

        // 消费锁持有者更新
        if (this._ownerEl) {
            const ownerText = state.activeConsumer !== null
                ? `C${state.activeConsumer}`
                : '空闲';
            const valEl = this._ownerEl.querySelector('.pc-sem-value');
            if (valEl) valEl.textContent = ownerText;
        }
    }

    /**
     * 更新日志
     * @param {Object} state
     */
    _updateLog(state) {
        if (!this._logContainer) return;

        emptyElement(this._logContainer);

        // 从 logEntries 构建日志
        const logEntries = state.logEntries || [];
        if (logEntries.length === 0) {
            const emptyMsg = createElement('div', { className: 'pc-log-empty' }, '暂无操作记录\n点击生产者或消费者旁的按钮开始操作');
            this._logContainer.appendChild(emptyMsg);
            return;
        }

        logEntries.forEach((entry, idx) => {
            const text = entry.text || '';
            if (!text) return;

            const logItem = createElement('div', { className: 'pc-log-item' });

            // 检测日志类型
            if (text.includes('等待')) {
                logItem.classList.add('pc-log-waiting');
            } else if (text.includes('✓')) {
                logItem.classList.add('pc-log-success');
            } else if (text.includes('⏹')) {
                logItem.classList.add('pc-log-done');
            }

            // 步骤编号
            const stepEl = createElement('span', { className: 'pc-log-step' }, `#${idx}`);
            const desc = createElement('span', { className: 'pc-log-desc' }, text);

            logItem.appendChild(stepEl);
            logItem.appendChild(desc);

            // 高亮最新一条
            if (idx === logEntries.length - 1) {
                logItem.classList.add('pc-log-latest');
            }

            this._logContainer.appendChild(logItem);
        });

        // 滚动到底部
        this._logContainer.scrollTop = this._logContainer.scrollHeight;
    }

    /**
     * 销毁
     */
    destroy() {
        this._unsubscribers.forEach(fn => fn());
        this._unsubscribers = [];
        this._container = null;
        this._bufferSizeInput = null;
        this._producersInput = null;
        this._consumersInput = null;
        this._maxItemsInput = null;
        this._producedStat = null;
        this._consumedStat = null;
        this._bufferStat = null;
        this._progressStat = null;
        this._explanationEl = null;
        this._bufferGrid = null;
        this._producersList = null;
        this._consumersList = null;
        this._emptyEl = null;
        this._fullEl = null;
        this._logContainer = null;
        this._producerBtns = [];
        this._consumerBtns = [];
        super.destroy();
    }
}
