/* ============================================
   页面置换渲染器
   负责页面置换模块的DOM渲染和状态更新
   ============================================ */

import { Renderer } from '../../core/renderer.js';
import { stateManager } from '../../core/stateManager.js';
import { EVENTS } from '../../utils/constants.js';
import { createElement, emptyElement } from '../../utils/dom.js';
import { PRESETS } from '../../presets/index.js';

export class PageReplacementRenderer extends Renderer {
    constructor(simulator) {
        super();
        this._simulator = simulator;
        this._unsubscribers = [];
        this._currentAlgorithm = 'FIFO';
        this._refStringInput = '';
        this._numFramesInput = 3;
    }

    /**
     * 渲染主界面
     * @param {HTMLElement} container
     */
    render(container) {
        this.mount(container);
        this.clear();

        // 创建主布局
        const mainLayout = createElement('div', { className: 'module-page-replacement' });

        // 1. 控制区（算法选择 + 参数输入）
        const controlSection = this._createControlSection();
        mainLayout.appendChild(controlSection);

        // 2. 引用序列显示
        const refSection = this._createRefSection();
        mainLayout.appendChild(refSection);

        // 3. 统计信息
        const statsSection = this._createStatsSection();
        mainLayout.appendChild(statsSection);

        // 4. 内存矩阵
        const matrixSection = this._createMatrixSection();
        mainLayout.appendChild(matrixSection);

        // 5. 当前内存状态
        const memorySection = this._createMemorySection();
        mainLayout.appendChild(memorySection);

        container.appendChild(mainLayout);

        // 注册事件监听
        this._registerListeners();

        // 初始渲染
        this._updateVisualization();

        // 自动填入默认示例序列并应用
        this._loadDefaultPreset();
    }

    /**
     * 加载默认预设示例
     */
    _loadDefaultPreset() {
        const refInput = document.getElementById('refStringInput');
        const frameInput = document.getElementById('numFramesInput');
        if (!refInput || !frameInput) return;

        // 默认示例：FIFO经典案例
        const defaultRefs = '7 0 1 2 0 3 0 4 2 3 0 3 2';
        refInput.value = defaultRefs;
        frameInput.value = '3';
        this._refStringInput = defaultRefs;
        this._numFramesInput = 3;

        // 自动应用参数
        this._applyConfig();
    }

    /**
     * 创建控制区
     * @returns {HTMLElement}
     */
    _createControlSection() {
        const section = createElement('div', { className: 'control-section' });

        // 算法选择
        const algoGroup = createElement('div', { className: 'input-group' });
        const algoLabel = createElement('label', { className: 'input-label' }, '算法选择');
        const algoTabs = createElement('div', { className: 'algorithm-tabs' });

        const algorithms = [
            { id: 'FIFO', name: 'FIFO' },
            { id: 'LRU', name: 'LRU' },
            { id: 'OPT', name: 'OPT' }
        ];

        algorithms.forEach(algo => {
            const tab = createElement('button', {
                className: `algorithm-tab ${algo.id === this._currentAlgorithm ? 'active' : ''}`,
                onClick: () => this._switchAlgorithm(algo.id)
            }, algo.name);
            algoTabs.appendChild(tab);
        });

        algoGroup.appendChild(algoLabel);
        algoGroup.appendChild(algoTabs);
        section.appendChild(algoGroup);

        // 引用序列输入
        const refGroup = createElement('div', { className: 'input-group' });
        const refLabel = createElement('label', { className: 'input-label' }, '页面引用序列');
        const refInput = createElement('input', {
            className: 'input-field',
            type: 'text',
            placeholder: '例如: 7 0 1 2 0 3 0 4 2 3 0 3 2',
            value: this._refStringInput
        });
        refInput.id = 'refStringInput';
        refGroup.appendChild(refLabel);
        refGroup.appendChild(refInput);
        section.appendChild(refGroup);

        // 物理块数量
        const frameGroup = createElement('div', { className: 'input-group' });
        const frameLabel = createElement('label', { className: 'input-label' }, '物理块数量');
        const frameInput = createElement('input', {
            className: 'input-field input-field--small',
            type: 'number',
            min: '1',
            max: '20',
            value: String(this._numFramesInput)
        });
        frameInput.id = 'numFramesInput';
        frameGroup.appendChild(frameLabel);
        frameGroup.appendChild(frameInput);
        section.appendChild(frameGroup);

        // 应用按钮
        const applyBtn = createElement('button', {
            className: 'btn btn-primary',
            onClick: () => this._applyConfig()
        }, '应用参数');
        section.appendChild(applyBtn);

        return section;
    }

    /**
     * 创建引用序列显示区
     * @returns {HTMLElement}
     */
    _createRefSection() {
        const section = createElement('div', { className: 'ref-section' });
        const title = createElement('div', { className: 'section-title' }, '引用序列');
        section.appendChild(title);

        const refContainer = createElement('div', { className: 'ref-string-container' });
        refContainer.id = 'refStringContainer';
        section.appendChild(refContainer);

        return section;
    }

    /**
     * 创建统计信息区
     * @returns {HTMLElement}
     */
    _createStatsSection() {
        const section = createElement('div', { className: 'stats-section' });

        const stats = [
            { id: 'statFaults', label: '缺页次数', value: '0', color: 'danger' },
            { id: 'statHits', label: '命中次数', value: '0', color: 'success' },
            { id: 'statFaultRate', label: '缺页率', value: '0%', color: 'warning' },
            { id: 'statTotal', label: '总引用数', value: '0', color: '' }
        ];

        stats.forEach(stat => {
            const item = createElement('div', { className: 'stat-item' });
            const valEl = createElement('div', {
                className: `stat-value ${stat.color}`,
                id: stat.id
            }, stat.value);
            const lblEl = createElement('div', { className: 'stat-label' }, stat.label);
            item.appendChild(valEl);
            item.appendChild(lblEl);
            section.appendChild(item);
        });

        return section;
    }

    /**
     * 创建内存矩阵区
     * @returns {HTMLElement}
     */
    _createMatrixSection() {
        const section = createElement('div', { className: 'matrix-section' });
        const title = createElement('div', { className: 'section-title' }, '内存块变化矩阵');
        section.appendChild(title);

        const matrixContainer = createElement('div', { className: 'matrix-container' });
        matrixContainer.id = 'matrixContainer';
        section.appendChild(matrixContainer);

        return section;
    }

    /**
     * 创建当前内存状态区
     * @returns {HTMLElement}
     */
    _createMemorySection() {
        const section = createElement('div', { className: 'memory-section' });
        const title = createElement('div', { className: 'section-title' }, '当前内存状态');
        section.appendChild(title);

        const memoryContainer = createElement('div', { className: 'memory-container' });
        memoryContainer.id = 'memoryContainer';
        section.appendChild(memoryContainer);

        return section;
    }

    /**
     * 注册事件监听
     */
    _registerListeners() {
        // 监听状态变化
        const unsubState = stateManager.on(EVENTS.STATE_CHANGE, (state) => {
            this._updateVisualization(state);
        });

        // 监听预设选择
        const unsubPreset = stateManager.on(EVENTS.PRESET_SELECT, (presetId) => {
            this._applyPreset(presetId);
        });

        this._unsubscribers.push(unsubState, unsubPreset);
    }

    /**
     * 切换算法
     * @param {string} algorithmId
     */
    _switchAlgorithm(algorithmId) {
        this._currentAlgorithm = algorithmId;

        // 更新算法标签高亮
        document.querySelectorAll('.algorithm-tab').forEach(tab => {
            tab.classList.toggle('active', tab.textContent === algorithmId);
        });

        // 如果有已初始化的配置，重新应用
        if (this._refStringInput.trim()) {
            this._applyConfig();
        }
    }

    /**
     * 应用配置
     */
    _applyConfig() {
        const refInput = document.getElementById('refStringInput');
        const frameInput = document.getElementById('numFramesInput');

        if (!refInput || !frameInput) return;

        const refText = refInput.value.trim();
        this._refStringInput = refText;

        // 空输入校验
        if (!refText) {
            // 显示错误提示
            const errorEl = document.getElementById('refStringError');
            if (errorEl) {
                errorEl.textContent = '请输入页面引用序列';
                errorEl.style.display = 'block';
            }
            return;
        }

        // 隐藏错误提示
        const errorEl = document.getElementById('refStringError');
        if (errorEl) {
            errorEl.style.display = 'none';
        }

        // 解析引用序列
        const refString = refText.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
        if (refString.length === 0) return;

        const numFrames = parseInt(frameInput.value) || 3;
        this._numFramesInput = numFrames;

        // 初始化模拟器
        this._simulator.init({
            refString,
            numFrames,
            algorithm: this._currentAlgorithm
        });
    }

    /**
     * 应用预设
     * @param {string} presetId
     */
    _applyPreset(presetId) {
        console.log('[PageReplacementRenderer] _applyPreset called with presetId:', presetId);
        
        // PRESETS.pageReplacement 是数组，需要用 find 查找
        const preset = (PRESETS.pageReplacement || []).find(
            p => p.name === presetId || p.id === presetId
        );
        console.log('[PageReplacementRenderer] Found preset:', preset);
        
        if (!preset) {
            console.warn(`[PageReplacementRenderer] Preset "${presetId}" not found`);
            return;
        }

        // 填充输入
        const refInput = document.getElementById('refStringInput');
        const frameInput = document.getElementById('numFramesInput');
        console.log('[PageReplacementRenderer] DOM elements:', { refInput, frameInput });

        if (refInput) {
            refInput.value = preset.config.refString.join(' ');
            this._refStringInput = refInput.value; // 同步更新内部状态
        }
        if (frameInput) {
            frameInput.value = String(preset.config.numFrames || 3);
            this._numFramesInput = parseInt(frameInput.value);
        }

        // 切换算法（仅更新 UI 高亮，不触发 _applyConfig）
        if (preset.config.algorithm) {
            this._currentAlgorithm = preset.config.algorithm;
            document.querySelectorAll('.algorithm-tab').forEach(tab => {
                tab.classList.toggle('active', tab.textContent === preset.config.algorithm);
            });
        }

        // 应用配置
        this._applyConfig();
    }


    /**
     * 更新可视化
     * @param {Object} state
     */
    _updateVisualization(state) {
        const s = state || this._simulator.getState();
        if (!s) return;

        // 更新引用序列显示
        this._updateRefString(s);

        // 更新统计信息
        this._updateStats(s);

        // 更新内存矩阵
        this._updateMatrix(s);

        // 更新当前内存状态
        this._updateMemoryState(s);

        // 更新解释面板
        this._updateExplanation(s);
    }

    /**
     * 更新引用序列显示
     * @param {Object} state
     */
    _updateRefString(state) {
        const container = document.getElementById('refStringContainer');
        if (!container) return;

        emptyElement(container);

        const refs = state.refString || [];
        const currentIndex = state.currentRefIndex ?? -1;

        refs.forEach((ref, index) => {
            let className = 'ref-item';
            if (index === currentIndex) {
                className += ' active';
                if (state.isFault) {
                    className += ' fault';
                } else {
                    className += ' hit';
                }
            } else if (index < currentIndex) {
                // 已处理的历史引用
                className += ' processed';
            }

            const item = createElement('div', { className }, String(ref));
            container.appendChild(item);
        });
    }

    /**
     * 更新统计信息
     * @param {Object} state
     */
    _updateStats(state) {
        const faultEl = document.getElementById('statFaults');
        const hitEl = document.getElementById('statHits');
        const rateEl = document.getElementById('statFaultRate');
        const totalEl = document.getElementById('statTotal');

        if (faultEl) faultEl.textContent = String(state.faultCount || 0);
        if (hitEl) hitEl.textContent = String(state.hitCount || 0);
        if (totalEl) totalEl.textContent = String(state.totalRefs || 0);

        // 缺页率：即使 currentStep 为 0 也显示 0%
        if (rateEl) {
            const total = state.totalRefs || 0;
            const faults = state.faultCount || 0;
            if (total > 0) {
                const rate = ((faults / total) * 100).toFixed(1);
                rateEl.textContent = rate + '%';
            } else {
                rateEl.textContent = '0%';
            }
        }
    }

    /**
     * 更新内存矩阵
     * @param {Object} state
     */
    _updateMatrix(state) {
        const container = document.getElementById('matrixContainer');
        if (!container) return;

        emptyElement(container);

        const history = state.history || [];
        const numFrames = state.numFrames || 3;
        const currentIndex = state.currentRefIndex ?? -1;

        if (history.length === 0) {
            container.textContent = '暂无数据，请先应用参数并执行步骤。';
            return;
        }

        // 创建表格
        const table = createElement('table', { className: 'matrix-table' });

        // 表头：引用序列
        const thead = createElement('thead');
        const headerRow = createElement('tr');

        // 空角标
        const corner = createElement('th', { className: 'matrix-corner' }, '');
        headerRow.appendChild(corner);

        // 第一列显示"初始"状态
        const initHeader = createElement('th', {
            className: `matrix-ref-header ${-1 === currentIndex ? 'active' : ''}`
        }, '初始');
        headerRow.appendChild(initHeader);

        // 引用序列头（从第2列开始对应 refs[0], refs[1], ...）
        const refs = state.refString || [];
        refs.forEach((ref, idx) => {
            const th = createElement('th', {
                className: `matrix-ref-header ${idx === currentIndex ? 'active' : ''}`
            }, String(ref));
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // 表体：每个内存块一行
        const tbody = createElement('tbody');
        for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
            const row = createElement('tr');

            // 行标签
            const label = createElement('td', { className: 'matrix-row-label' }, `块 ${frameIdx + 1}`);
            row.appendChild(label);

            // 每个步骤的该内存块状态
            // history[0] = 初始状态, history[1] = 第1步后, history[2] = 第2步后...
            for (let stepIdx = 0; stepIdx < history.length; stepIdx++) {
                const step = history[stepIdx];
                const frames = step.frames || [];
                const page = frames[frameIdx];
                // currentIndex 范围: -1(初始), 0(第1步), 1(第2步)...
                // history 索引与 currentIndex 的关系: stepIdx = currentIndex + 1
                const isCurrentStep = stepIdx === currentIndex + 1;
                const isFaultStep = step.isFault && isCurrentStep;
                const isHitStep = !step.isFault && isCurrentStep;
                // 被替换的页面标记：检查下一步骤（如果有）是否发生了替换，
                // 且当前单元格的页面等于被替换的页面（即这个页面在下一步被换出了）
                let isReplaced = false;
                if (isCurrentStep && stepIdx < history.length - 1) {
                    const nextStep = history[stepIdx + 1];
                    if (nextStep.replacedPage !== null && nextStep.replacedPage !== undefined) {
                        if (page === nextStep.replacedPage) {
                            isReplaced = true;
                        }
                    }
                }

                let className = 'matrix-cell';
                if (isCurrentStep) {
                    className += ' current';
                }
                if (isFaultStep) {
                    className += ' fault';
                }
                if (isHitStep) {
                    className += ' hit';
                }
                if (isReplaced) {
                    className += ' replaced';
                }

                const cell = createElement('td', { className }, page !== null && page !== undefined ? String(page) : '');
                row.appendChild(cell);
            }

            tbody.appendChild(row);
        }

        table.appendChild(tbody);
        container.appendChild(table);
    }

    /**
     * 更新当前内存状态
     * @param {Object} state
     */
    _updateMemoryState(state) {
        const container = document.getElementById('memoryContainer');
        if (!container) return;

        emptyElement(container);

        const frames = state.frames || [];
        const currentPage = state.currentPage;
        const isFault = state.isFault;
        const replacedPage = state.replacedPage;

        // 获取历史记录中上一步的帧状态，用于对比变化
        const history = state.history || [];
        const currentIndex = state.currentRefIndex ?? -1;
        // 上一步的帧状态（history 中索引为 currentIndex 的步骤）
        let prevFrames = null;
        if (currentIndex >= 0 && history.length > currentIndex) {
            const prevStep = history[currentIndex];
            if (prevStep && prevStep.frames) {
                prevFrames = prevStep.frames;
            }
        }

        // 创建内存块显示
        const memoryBlocks = createElement('div', { className: 'memory-blocks' });

        frames.forEach((page, index) => {
            const block = createElement('div', { className: 'memory-block' });

            // 块标签
            const label = createElement('div', { className: 'memory-block-label' }, `块 ${index + 1}`);

            // 判断该块是否发生了变化
            let hasChanged = false;
            let oldPage = null;
            if (prevFrames && prevFrames[index] !== undefined) {
                const prevPage = prevFrames[index];
                if (prevPage !== page) {
                    hasChanged = true;
                    oldPage = prevPage;
                }
            }

            // 块内容
            let contentClass = 'memory-block-content';
            if (page !== null && page !== undefined) {
                contentClass += ' occupied';
            }
            if (hasChanged) {
                contentClass += ' changed';
            }

            const content = createElement('div', { className: contentClass },
                page !== null && page !== undefined ? String(page) : '空'
            );

            block.appendChild(label);
            block.appendChild(content);

            // 如果该块发生了变化，显示变化标注
            if (hasChanged) {
                const changeBadge = createElement('div', { className: 'memory-block-change' });
                const oldVal = (oldPage !== null && oldPage !== undefined) ? String(oldPage) : '空';
                changeBadge.textContent = `${oldVal} → ${page !== null && page !== undefined ? page : '空'}`;
                block.appendChild(changeBadge);
            }

            memoryBlocks.appendChild(block);
        });

        container.appendChild(memoryBlocks);

        // 显示当前访问状态
        if (currentPage !== null && currentPage !== undefined) {
            const statusEl = createElement('div', { className: 'access-status' });
            let statusText = '';
            if (isFault) {
                if (replacedPage !== null) {
                    statusText = `访问页面 ${currentPage} → 缺页中断，置换页面 ${replacedPage}`;
                } else {
                    statusText = `访问页面 ${currentPage} → 缺页中断，载入空闲块`;
                }
            } else {
                statusText = `访问页面 ${currentPage} → 命中`;
            }
            const statusClass = isFault ? 'status-fault' : 'status-hit';
            statusEl.textContent = statusText;
            statusEl.className = `access-status ${statusClass}`;
            container.appendChild(statusEl);
        }
    }

    /**
     * 更新解释面板
     * @param {Object} state
     */
    _updateExplanation(state) {
        const explanation = state.explanation || '';
        const stepNum = (state.currentRefIndex ?? -1) + 1;
        const total = state.totalRefs || 0;
        const faults = state.faultCount || 0;
        const hits = state.hitCount || 0;
        const rate = total > 0 ? ((faults / total) * 100).toFixed(1) + '%' : '0%';

        stateManager.emit(EVENTS.EXPLANATION_UPDATE, {
            steps: [{
                title: `步骤 ${stepNum} / ${total}`,
                lines: [explanation]
            }],
            stats: {
                '算法': state.algorithm || this._currentAlgorithm,
                '缺页次数': String(faults),
                '命中次数': String(hits),
                '缺页率': rate
            }
        });
    }

    /**
     * 统一更新接口（由 scheduler 的 STATE_CHANGE 监听调用）
     * 页面置换模块已通过内部监听 STATE_CHANGE 自动更新，此方法为空实现
     * @param {Object} state
     */
    update(state) {
        // 页面置换模块已在 _subscribeEvents 中监听 STATE_CHANGE
        // 此方法仅用于满足统一接口约定
    }

    /**
     * 销毁
     */
    destroy() {
        // 清理事件监听
        this._unsubscribers.forEach(fn => fn());
        this._unsubscribers = [];

        super.destroy();
    }
}
