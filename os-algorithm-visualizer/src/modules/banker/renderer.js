/* ============================================
   银行家算法渲染器（全面优化版）
   采用统一卡片布局，与页面置换、CPU调度等模块风格一致
   包含：资源总量配置、进程表（教材标准格式）、安全性检测（Work/Finish矩阵）、资源请求
   优化：Available区域修复undefined、进程表重构、安全性检测可视化增强、底部控制面板联动
   ============================================ */

import { Renderer } from '../../core/renderer.js';
import { stateManager } from '../../core/stateManager.js';
import { EVENTS } from '../../utils/constants.js';
import { createElement, emptyElement } from '../../utils/dom.js';
import { PRESETS } from '../../presets/index.js';

export class BankerRenderer extends Renderer {
    constructor(simulator) {
        super();
        this._simulator = simulator;
        this._unsubscribers = [];

        // 当前输入状态
        this._numResources = 3;
        this._numProcesses = 5;
        this._processNames = ['P0', 'P1', 'P2', 'P3', 'P4'];
    }

    /**
     * 渲染主界面
     * @param {HTMLElement} container
     */
    render(container) {
        this.mount(container);
        this.clear();

        const mainLayout = createElement('div', { className: 'module-banker' });

        // 使用统一的卡片网格布局
        const grid = createElement('div', { className: 'banker-grid' });

        // 1. 系统资源总量配置卡片
        grid.appendChild(this._createTotalResourceCard());

        // 2. 当前可用资源卡片
        grid.appendChild(this._createAvailableCard());

        // 3. 进程资源表卡片（占两列，教材标准格式）
        grid.appendChild(this._createProcessTableCard());

        // 4. 资源请求卡片（紧接进程表，方便用户查看进程信息后直接填写请求）
        grid.appendChild(this._createRequestCard());

        // 5. 操作按钮卡片
        grid.appendChild(this._createActionCard());

        // 6. 安全性检测过程卡片（占两列，含Work/Finish矩阵）
        grid.appendChild(this._createSafetyProcessCard());

        // 7. 安全序列可视化卡片
        grid.appendChild(this._createSequenceCard());

        mainLayout.appendChild(grid);
        container.appendChild(mainLayout);

        // 注册事件监听
        this._registerListeners();

        // 初始渲染
        this._updateAll();
    }

    /**
     * 创建系统资源总量配置卡片
     * @returns {HTMLElement}
     */
    _createTotalResourceCard() {
        const card = createElement('div', { className: 'card banker-card' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '系统资源总量'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });
        const row = createElement('div', { className: 'banker-resource-row' });
        const resourceLabels = ['A', 'B', 'C'];
        // 从模拟器读取初始资源总量值，确保首次进入时显示正确的默认案例数据
        const defaultTotals = (this._simulator._totalResources && this._simulator._totalResources.length === 3)
            ? this._simulator._totalResources
            : [10, 5, 7];
        resourceLabels.forEach((label, idx) => {
            const group = createElement('div', { className: 'banker-resource-input' });
            const lbl = createElement('label', { className: 'input-label' }, `资源 ${label}`);
            const input = createElement('input', {
                className: 'input-field input-field--small',
                type: 'number',
                min: '0',
                max: '100',
                value: String(defaultTotals[idx])
            });
            input.id = `totalResource${label}`;
            input.dataset.resourceIndex = String(idx);
            input.addEventListener('input', () => this._onTotalResourceChange());
            group.appendChild(lbl);
            group.appendChild(input);
            row.appendChild(group);
        });
        body.appendChild(row);
        card.appendChild(body);

        return card;
    }

    /**
     * 创建当前可用资源卡片
     * @returns {HTMLElement}
     */
    _createAvailableCard() {
        const card = createElement('div', { className: 'card banker-card' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '当前可用资源 (Available)'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });
        const container = createElement('div', { className: 'banker-available-container' });
        container.id = 'bankerAvailableContainer';
        body.appendChild(container);
        card.appendChild(body);

        return card;
    }

    /**
     * 创建进程资源表卡片（教材标准格式）
     * 显示：进程 | Max | Allocation | Need | 状态(Finish)
     * @returns {HTMLElement}
     */
    _createProcessTableCard() {
        const card = createElement('div', { className: 'card banker-card banker-card-wide' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '进程资源信息（教材标准格式）'));

        // 添加/删除进程按钮
        const btnGroup = createElement('div', { className: 'banker-btn-group' });
        const addBtn = createElement('button', {
            className: 'btn btn-sm',
            onClick: () => this._addProcess()
        }, '+ 添加进程');
        const removeBtn = createElement('button', {
            className: 'btn btn-sm btn-danger',
            onClick: () => this._removeProcess()
        }, '- 删除进程');
        btnGroup.appendChild(addBtn);
        btnGroup.appendChild(removeBtn);
        header.appendChild(btnGroup);
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });
        const tableContainer = createElement('div', { className: 'banker-table-container' });
        tableContainer.id = 'bankerTableContainer';
        body.appendChild(tableContainer);
        card.appendChild(body);

        return card;
    }

    /**
     * 创建操作按钮卡片
     * @returns {HTMLElement}
     */
    _createActionCard() {
        const card = createElement('div', { className: 'card banker-card' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '操作'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });
        const actionRow = createElement('div', { className: 'banker-action-row' });

        const safetyBtn = createElement('button', {
            className: 'btn btn-primary',
            onClick: () => this._runSafetyCheck()
        }, '🔍 执行安全性检查');

        const resetBtn = createElement('button', {
            className: 'btn btn-secondary',
            onClick: () => this._resetToDefault()
        }, '↺ 重置默认');

        actionRow.appendChild(safetyBtn);
        actionRow.appendChild(resetBtn);
        body.appendChild(actionRow);

        // 提示：可使用底部控制面板逐步推进
        const tip = createElement('div', { className: 'banker-tip' });
        tip.textContent = '💡 点击"执行安全性检查"后，使用底部控制面板的"下一步"逐步推进检测过程';
        body.appendChild(tip);

        card.appendChild(body);

        return card;
    }

    /**
     * 创建安全性检测过程卡片（含Work/Finish矩阵）
     * @returns {HTMLElement}
     */
    _createSafetyProcessCard() {
        const card = createElement('div', { className: 'card banker-card banker-card-wide' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '安全性检测过程'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });

        // Work/Finish 矩阵可视化
        const matrixContainer = createElement('div', { className: 'banker-matrix-container' });
        matrixContainer.id = 'bankerMatrixContainer';
        body.appendChild(matrixContainer);

        // 步骤描述
        const processContainer = createElement('div', { className: 'banker-safety-process' });
        processContainer.id = 'bankerSafetyProcess';
        body.appendChild(processContainer);

        card.appendChild(body);

        return card;
    }

    /**
     * 创建安全序列可视化卡片
     * @returns {HTMLElement}
     */
    _createSequenceCard() {
        const card = createElement('div', { className: 'card banker-card' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '安全序列'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });
        const container = createElement('div', { className: 'banker-sequence-container' });
        container.id = 'bankerSequenceContainer';
        body.appendChild(container);
        card.appendChild(body);

        return card;
    }

    /**
     * 创建资源请求卡片
     * @returns {HTMLElement}
     */
    _createRequestCard() {
        const card = createElement('div', { className: 'card banker-card banker-card-wide' });
        const header = createElement('div', { className: 'card-header' });
        header.appendChild(createElement('div', { className: 'card-title' }, '资源请求'));
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });

        // 请求输入行
        const row = createElement('div', { className: 'banker-request-row' });

        // 进程选择
        const procGroup = createElement('div', { className: 'input-group' });
        const procLabel = createElement('label', { className: 'input-label' }, '请求进程');
        const procSelect = createElement('select', { className: 'input-field input-field--small' });
        procSelect.id = 'requestProcessSelect';
        ['P0', 'P1', 'P2', 'P3', 'P4'].forEach(name => {
            const opt = createElement('option', { value: name }, name);
            procSelect.appendChild(opt);
        });
        procGroup.appendChild(procLabel);
        procGroup.appendChild(procSelect);
        row.appendChild(procGroup);

        // 请求资源输入
        const resourceLabels = ['A', 'B', 'C'];
        resourceLabels.forEach((label, idx) => {
            const group = createElement('div', { className: 'banker-resource-input' });
            const lbl = createElement('label', { className: 'input-label' }, `Request ${label}`);
            const input = createElement('input', {
                className: 'input-field input-field--small',
                type: 'number',
                min: '0',
                max: '20',
                value: '0'
            });
            input.id = `requestResource${label}`;
            group.appendChild(lbl);
            group.appendChild(input);
            row.appendChild(group);
        });

        body.appendChild(row);

        // 申请按钮
        const actionRow = createElement('div', { className: 'banker-request-action' });
        const requestBtn = createElement('button', {
            className: 'btn btn-primary',
            onClick: () => this._runRequestCheck()
        }, '📤 申请资源');
        actionRow.appendChild(requestBtn);

        // 提示
        const tip = createElement('span', { className: 'banker-tip-inline' });
        tip.textContent = '💡 点击"申请资源"后，使用底部控制面板的"下一步"逐步推进';
        actionRow.appendChild(tip);

        body.appendChild(actionRow);

        // 请求结果
        const resultContainer = createElement('div', { className: 'banker-request-result' });
        resultContainer.id = 'bankerRequestResult';
        body.appendChild(resultContainer);

        card.appendChild(body);
        return card;
    }

    /**
     * 注册事件监听
     */
    _registerListeners() {
        const unsubState = stateManager.on(EVENTS.STATE_CHANGE, (state) => {
            this._updateAll(state);
        });

        const unsubPreset = stateManager.on(EVENTS.PRESET_SELECT, (presetId) => {
            this._applyPreset(presetId);
        });

        this._unsubscribers.push(unsubState, unsubPreset);
    }

    /**
     * 系统资源总量变更
     */
    _onTotalResourceChange() {
        const resources = this._readTotalResources();
        this._simulator.updateConfig({ totalResources: resources });
        this._updateAll();
    }

    /**
     * 读取系统资源总量输入
     * @returns {Array}
     */
    _readTotalResources() {
        const labels = ['A', 'B', 'C'];
        return labels.map(label => {
            const el = document.getElementById(`totalResource${label}`);
            return el ? (parseInt(el.value) || 0) : 0;
        });
    }

    /**
     * 读取进程表数据
     * @returns {Object} { processes, max, allocation }
     */
    _readProcessTableData() {
        const numProcesses = this._numProcesses;
        const numResources = this._numResources;
        const processes = [];
        const max = [];
        const allocation = [];

        for (let i = 0; i < numProcesses; i++) {
            processes.push(this._processNames[i] || `P${i}`);
            const maxRow = [];
            const allocRow = [];
            for (let j = 0; j < numResources; j++) {
                const maxEl = document.getElementById(`max_${i}_${j}`);
                const allocEl = document.getElementById(`alloc_${i}_${j}`);
                maxRow.push(maxEl ? (parseInt(maxEl.value) || 0) : 0);
                allocRow.push(allocEl ? (parseInt(allocEl.value) || 0) : 0);
            }
            max.push(maxRow);
            allocation.push(allocRow);
        }

        return { processes, max, allocation };
    }

    /**
     * 执行安全性检查（逐步模式）
     * 初始化后，用户通过底部控制面板的"下一步"逐步推进
     */
    _runSafetyCheck() {
        this._syncInputToSimulator();
        if (this._simulator.isComplete) {
            this._simulator.reset();
        }
        this._simulator.startSafetyCheck();
    }

    /**
     * 执行资源请求（逐步模式）
     * 初始化后，用户通过底部控制面板的"下一步"逐步推进
     */
    _runRequestCheck() {
        this._syncInputToSimulator();

        if (this._simulator.isComplete) {
            this._simulator.reset();
        }

        const select = document.getElementById('requestProcessSelect');
        const processName = select ? select.value : 'P0';
        const processIndex = this._processNames.indexOf(processName);
        if (processIndex === -1) return;

        const labels = ['A', 'B', 'C'];
        const request = labels.map(label => {
            const el = document.getElementById(`requestResource${label}`);
            return el ? (parseInt(el.value) || 0) : 0;
        });

        this._simulator.startRequestCheck(processIndex, request);
    }

    /**
     * 同步输入数据到模拟器
     */
    _syncInputToSimulator() {
        const resources = this._readTotalResources();
        const { processes, max, allocation } = this._readProcessTableData();
        this._simulator.updateConfig({
            totalResources: resources,
            processes,
            max,
            allocation
        });
    }

    /**
     * 添加进程
     */
    _addProcess() {
        const newIndex = this._numProcesses;
        this._processNames.push(`P${newIndex}`);
        this._numProcesses++;

        const resources = this._readTotalResources();
        const { max, allocation } = this._readProcessTableData();
        max.push(new Array(this._numResources).fill(0));
        allocation.push(new Array(this._numResources).fill(0));
        this._simulator.updateConfig({
            totalResources: resources,
            processes: [...this._processNames],
            max,
            allocation
        });

        this._renderProcessTable();
        this._updateAll();
    }

    /**
     * 删除最后一个进程
     */
    _removeProcess() {
        if (this._numProcesses <= 1) return;
        this._numProcesses--;
        this._processNames.pop();

        const resources = this._readTotalResources();
        const { max, allocation } = this._readProcessTableData();
        max.pop();
        allocation.pop();
        this._simulator.updateConfig({
            totalResources: resources,
            processes: [...this._processNames],
            max,
            allocation
        });

        this._renderProcessTable();
        this._updateAll();
    }

    /**
     * 重置为默认案例
     */
    _resetToDefault() {
        this._numProcesses = 5;
        this._numResources = 3;
        this._processNames = ['P0', 'P1', 'P2', 'P3', 'P4'];

        const defaultTotals = [10, 5, 7];
        ['A', 'B', 'C'].forEach((label, idx) => {
            const el = document.getElementById(`totalResource${label}`);
            if (el) el.value = String(defaultTotals[idx]);
        });

        this._simulator.reset();
        this._renderProcessTable();
        this._updateAll();
    }

    /**
     * 应用预设案例
     * @param {string} presetId
     */
    _applyPreset(presetId) {
        console.log('[BankerRenderer] _applyPreset called with presetId:', presetId);

        const preset = (PRESETS.banker || []).find(
            p => p.name === presetId || p.id === presetId
        );
        console.log('[BankerRenderer] Found preset:', preset);

        if (!preset) {
            console.warn(`[BankerRenderer] Preset "${presetId}" not found`);
            return;
        }

        const config = preset.config;

        // 更新进程数量
        const numProcesses = config.processes ? config.processes.length : 5;
        const numResources = config.totalResources ? config.totalResources.length : 3;
        this._numProcesses = numProcesses;
        this._numResources = numResources;
        this._processNames = config.processes ? [...config.processes] : 
            Array.from({ length: numProcesses }, (_, i) => `P${i}`);

        // 填充资源总量输入
        if (config.totalResources) {
            const labels = ['A', 'B', 'C'];
            config.totalResources.forEach((val, idx) => {
                const el = document.getElementById(`totalResource${labels[idx]}`);
                if (el) el.value = String(val);
            });
        }

        // 更新模拟器配置
        this._simulator.updateConfig({
            totalResources: config.totalResources ? [...config.totalResources] : [10, 5, 7],
            processes: [...this._processNames],
            max: config.max ? config.max.map(row => [...row]) : [],
            allocation: config.allocation ? config.allocation.map(row => [...row]) : []
        });

        // 重新渲染进程表
        this._renderProcessTable();

        // 如果有请求预设，填充请求输入
        if (config.requestProcess !== undefined && config.requestVector !== undefined) {
            const select = document.getElementById('requestProcessSelect');
            if (select) {
                select.value = config.requestProcess;
            }
            const labels = ['A', 'B', 'C'];
            config.requestVector.forEach((val, idx) => {
                const el = document.getElementById(`requestResource${labels[idx]}`);
                if (el) el.value = String(val);
            });
        }

        // 更新所有可视化
        this._updateAll();

        // 重置模拟器状态
        this._simulator.reset();
    }

    /**
     * 渲染进程资源表（教材标准格式）
     * 显示：进程 | Max | Allocation | Need | 状态(Finish)
     */
    _renderProcessTable() {
        const container = document.getElementById('bankerTableContainer');
        if (!container) return;

        emptyElement(container);

        const state = this._simulator.getState();
        const processes = state.processes || this._processNames;
        const max = state.max || [];
        const allocation = state.allocation || [];
        const need = state.need || [];
        const numResources = this._numResources;

        const table = createElement('table', { className: 'banker-table' });

        // 表头
        const thead = createElement('thead');
        const headerRow = createElement('tr');

        const headers = ['进程', 'Max', 'Allocation', 'Need', '状态'];
        headers.forEach(h => {
            const th = createElement('th', { className: 'banker-th' }, h);
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // 子表头：资源维度
        const subHeaderRow = createElement('tr');
        const emptyTh = createElement('th', { className: 'banker-th banker-th-sub' });
        subHeaderRow.appendChild(emptyTh);

        // Max 子列
        const maxTh = createElement('th', { className: 'banker-th banker-th-sub' });
        const maxLabels = createElement('div', { className: 'banker-sub-labels' });
        ['A', 'B', 'C'].slice(0, numResources).forEach(l => {
            maxLabels.appendChild(createElement('span', { className: 'banker-sub-label' }, l));
        });
        maxTh.appendChild(maxLabels);
        subHeaderRow.appendChild(maxTh);

        // Allocation 子列
        const allocTh = createElement('th', { className: 'banker-th banker-th-sub' });
        const allocLabels = createElement('div', { className: 'banker-sub-labels' });
        ['A', 'B', 'C'].slice(0, numResources).forEach(l => {
            allocLabels.appendChild(createElement('span', { className: 'banker-sub-label' }, l));
        });
        allocTh.appendChild(allocLabels);
        subHeaderRow.appendChild(allocTh);

        // Need 子列
        const needTh = createElement('th', { className: 'banker-th banker-th-sub' });
        const needLabels = createElement('div', { className: 'banker-sub-labels' });
        ['A', 'B', 'C'].slice(0, numResources).forEach(l => {
            needLabels.appendChild(createElement('span', { className: 'banker-sub-label' }, l));
        });
        needTh.appendChild(needLabels);
        subHeaderRow.appendChild(needTh);

        // 状态列
        const statusTh = createElement('th', { className: 'banker-th banker-th-sub' });
        subHeaderRow.appendChild(statusTh);

        thead.appendChild(subHeaderRow);
        table.appendChild(thead);

        // 表体
        const tbody = createElement('tbody');
        for (let i = 0; i < processes.length; i++) {
            const row = createElement('tr');

            // 进程名
            const nameCell = createElement('td', { className: 'banker-td banker-td-name' }, processes[i]);
            row.appendChild(nameCell);

            // Max（可编辑）
            const maxCell = createElement('td', { className: 'banker-td' });
            const maxInputs = createElement('div', { className: 'banker-vector-inputs' });
            for (let j = 0; j < numResources; j++) {
                const input = createElement('input', {
                    className: 'input-field input-field--mini',
                    type: 'number',
                    min: '0',
                    max: '100',
                    value: String((max[i] && max[i][j] !== undefined) ? max[i][j] : 0)
                });
                input.id = `max_${i}_${j}`;
                input.addEventListener('input', () => this._onTableChange());
                maxInputs.appendChild(input);
            }
            maxCell.appendChild(maxInputs);
            row.appendChild(maxCell);

            // Allocation（可编辑）
            const allocCell = createElement('td', { className: 'banker-td' });
            const allocInputs = createElement('div', { className: 'banker-vector-inputs' });
            for (let j = 0; j < numResources; j++) {
                const input = createElement('input', {
                    className: 'input-field input-field--mini',
                    type: 'number',
                    min: '0',
                    max: '100',
                    value: String((allocation[i] && allocation[i][j] !== undefined) ? allocation[i][j] : 0)
                });
                input.id = `alloc_${i}_${j}`;
                input.addEventListener('input', () => this._onTableChange());
                allocInputs.appendChild(input);
            }
            allocCell.appendChild(allocInputs);
            row.appendChild(allocCell);

            // Need（只读显示）
            const needCell = createElement('td', { className: 'banker-td' });
            const needDisplay = createElement('div', { className: 'banker-vector-display' });
            if (need[i]) {
                needDisplay.textContent = `(${need[i].join(', ')})`;
            } else {
                needDisplay.textContent = '(?, ?, ?)';
            }
            needCell.appendChild(needDisplay);
            row.appendChild(needCell);

            // 状态（Finish）
            const statusCell = createElement('td', { className: 'banker-td' });
            const finishState = state.finishVector || [];
            const isFinished = finishState[i];
            const statusBadge = createElement('span', {
                className: `banker-finish-badge ${isFinished ? 'finished' : 'pending'}`
            }, isFinished ? '✓ 完成' : '○ 等待');
            statusCell.appendChild(statusBadge);
            row.appendChild(statusCell);

            tbody.appendChild(row);
        }
        table.appendChild(tbody);

        // Available 汇总行
        const tfoot = createElement('tfoot');
        const footRow = createElement('tr');
        const footLabel = createElement('td', { className: 'banker-td banker-td-foot-label' }, 'Available');
        footRow.appendChild(footLabel);

        // Max 列空
        const footMax = createElement('td', { className: 'banker-td' });
        footRow.appendChild(footMax);

        // Allocation 列空
        const footAlloc = createElement('td', { className: 'banker-td' });
        footRow.appendChild(footAlloc);

        // Need 列空
        const footNeed = createElement('td', { className: 'banker-td' });
        footRow.appendChild(footNeed);

        // Available 值
        const footAvail = createElement('td', { className: 'banker-td' });
        const availDisplay = createElement('div', { className: 'banker-vector-display banker-avail-display' });
        const available = state.available || [];
        if (available.length > 0) {
            availDisplay.textContent = `(${available.join(', ')})`;
        } else {
            availDisplay.textContent = '(?, ?, ?)';
        }
        footAvail.appendChild(availDisplay);
        footRow.appendChild(footAvail);

        tfoot.appendChild(footRow);
        table.appendChild(tfoot);

        container.appendChild(table);
    }

    /**
     * 表格数据变更
     */
    _onTableChange() {
        this._syncInputToSimulator();
        this._updateAll();
    }

    /**
     * 更新所有可视化
     * @param {Object} state
     */
    _updateAll(state) {
        const s = state || this._simulator.getState();
        if (!s) return;

        this._updateAvailable(s);
        this._renderProcessTable();
        this._updateMatrix(s);
        this._updateSafetyProcess(s);
        this._updateSequence(s);
        this._updateRequestResult(s);
        this._updateExplanation(s);
    }

    /**
     * 更新 Available 显示
     * @param {Object} state
     */
    _updateAvailable(state) {
        const container = document.getElementById('bankerAvailableContainer');
        if (!container) return;

        emptyElement(container);

        const available = state.available || [];
        const resourceLabels = ['A', 'B', 'C'];

        // 处理空数组或undefined情况
        if (!available || available.length === 0) {
            const placeholder = createElement('div', { className: 'banker-available-placeholder' });
            placeholder.textContent = '请配置系统资源总量和进程资源信息后自动计算';
            container.appendChild(placeholder);
            return;
        }

        const row = createElement('div', { className: 'banker-available-row' });
        available.forEach((val, idx) => {
            const item = createElement('div', { className: 'banker-available-item' });
            const label = createElement('div', { className: 'banker-available-label' }, resourceLabels[idx] || `R${idx}`);
            const value = createElement('div', {
                className: `banker-available-value ${val > 0 ? 'positive' : 'zero'}`
            }, String(val));
            item.appendChild(label);
            item.appendChild(value);
            row.appendChild(item);
        });
        container.appendChild(row);

        // 显示计算公式
        const total = state.totalResources || [];
        if (total.length > 0) {
            const formula = createElement('div', { className: 'banker-available-formula' });
            const sumAlloc = new Array(available.length).fill(0);
            (state.allocation || []).forEach(row => {
                row.forEach((v, j) => { if (j < sumAlloc.length) sumAlloc[j] += v; });
            });
            const parts = total.map((t, j) => {
                const label = resourceLabels[j] || `R${j}`;
                return `Available(${label}) = ${t} - ${sumAlloc[j] || 0} = ${available[j] !== undefined ? available[j] : '?'}`;
            });
            formula.textContent = parts.join('    ');
            container.appendChild(formula);
        }
    }

    /**
     * 更新 Work/Finish 矩阵可视化
     * @param {Object} state
     */
    _updateMatrix(state) {
        const container = document.getElementById('bankerMatrixContainer');
        if (!container) return;

        emptyElement(container);

        const safetyProcess = state.safetyProcess || [];
        const phase = state.phase || 'idle';

        // 只在安全性检测阶段显示矩阵
        if (safetyProcess.length === 0) {
            const placeholder = createElement('div', { className: 'banker-matrix-placeholder' });
            placeholder.textContent = '执行安全性检测后，此处将显示 Work/Finish 矩阵的逐步变化过程';
            container.appendChild(placeholder);
            return;
        }

        // 根据 currentStep 截取可见的步骤范围
        // currentStep 表示当前已推进到的步骤索引（0-based）
        // 可见步骤为 safetyProcess[0..currentStep]
        const visibleSteps = safetyProcess.slice(0, state.currentStep + 1);
        const lastVisibleStep = visibleSteps.length > 0 ? visibleSteps[visibleSteps.length - 1] : null;

        // 获取当前可见的最新 Work 和 Finish 状态
        const currentWork = lastVisibleStep ? (lastVisibleStep.newWork || lastVisibleStep.work || lastVisibleStep.oldWork || []) : [];
        const currentFinish = lastVisibleStep ? (lastVisibleStep.finish || []) : [];

        // 为每个进程计算其完成时的 Work 值（用于 prevStep 回退时正确显示）
        // 遍历可见步骤，为每个已完成的进程记录其完成时的 newWork
        const processFinishWork = {};
        for (let s = 0; s < visibleSteps.length; s++) {
            const step = visibleSteps[s];
            if (step.type === 'found' && step.processIndex !== undefined) {
                processFinishWork[step.processIndex] = {
                    oldWork: step.oldWork || [],
                    newWork: step.newWork || [],
                    allocation: step.allocation || []
                };
            }
        }

        // 创建 Work/Finish 矩阵表
        const matrixTitle = createElement('div', { className: 'banker-matrix-title' }, 'Work / Finish 矩阵');
        container.appendChild(matrixTitle);

        const matrixTable = createElement('table', { className: 'banker-matrix-table' });

        // 表头
        const thead = createElement('thead');
        const headerRow = createElement('tr');
        headerRow.appendChild(createElement('th', { className: 'banker-matrix-th' }, '进程'));
        headerRow.appendChild(createElement('th', { className: 'banker-matrix-th' }, 'Work'));
        headerRow.appendChild(createElement('th', { className: 'banker-matrix-th' }, 'Need'));
        headerRow.appendChild(createElement('th', { className: 'banker-matrix-th' }, 'Allocation'));
        headerRow.appendChild(createElement('th', { className: 'banker-matrix-th' }, 'Work+Alloc'));
        headerRow.appendChild(createElement('th', { className: 'banker-matrix-th' }, 'Finish'));
        thead.appendChild(headerRow);
        matrixTable.appendChild(thead);

        // 表体
        const tbody = createElement('tbody');
        const processes = state.processes || this._processNames;
        const need = state.need || [];
        const allocation = state.allocation || [];

        for (let i = 0; i < processes.length; i++) {
            const row = createElement('tr');
            const isFinished = currentFinish[i] || false;
            const isCurrentStep = lastVisibleStep && lastVisibleStep.processIndex === i && lastVisibleStep.type === 'found';
            const finishInfo = processFinishWork[i];

            if (isCurrentStep) {
                row.classList.add('banker-matrix-row-current');
            }
            if (isFinished) {
                row.classList.add('banker-matrix-row-finished');
            }

            // 进程名
            row.appendChild(createElement('td', { className: 'banker-matrix-td' }, processes[i]));

            // Work
            // 对于已完成的进程，显示其完成时的 oldWork（即分配前的 Work）
            // 对于当前步骤的进程，显示 oldWork（比较前的值）
            // 对于未完成的进程，显示当前 Work
            const workTd = createElement('td', { className: 'banker-matrix-td' });
            if (isFinished && finishInfo) {
                // 已完成进程：显示其完成时的 oldWork（分配前的 Work）
                workTd.textContent = `(${finishInfo.oldWork.join(', ')})`;
                if (isCurrentStep) {
                    workTd.classList.add('banker-matrix-old');
                }
            } else if (isCurrentStep) {
                // 当前步骤进程（未完成状态不应出现，但以防万一）
                const oldWork = lastVisibleStep.oldWork || [];
                workTd.textContent = `(${oldWork.join(', ')})`;
                workTd.classList.add('banker-matrix-old');
            } else {
                workTd.textContent = currentWork.length > 0 ? `(${currentWork.join(', ')})` : '-';
            }
            row.appendChild(workTd);

            // Need
            const needTd = createElement('td', { className: 'banker-matrix-td' });
            if (need[i]) {
                needTd.textContent = `(${need[i].join(', ')})`;
                if (isCurrentStep) {
                    needTd.classList.add('banker-matrix-highlight');
                }
            } else {
                needTd.textContent = '-';
            }
            row.appendChild(needTd);

            // Allocation
            const allocTd = createElement('td', { className: 'banker-matrix-td' });
            if (allocation[i]) {
                allocTd.textContent = `(${allocation[i].join(', ')})`;
            } else {
                allocTd.textContent = '-';
            }
            row.appendChild(allocTd);

            // Work+Alloc (新Work)
            // 对于已完成的进程，显示其完成时的 newWork（分配释放后的 Work）
            // 对于当前步骤的进程，显示 newWork
            // 对于未完成的进程，显示 '-'
            const newWorkTd = createElement('td', { className: 'banker-matrix-td' });
            if (isFinished && finishInfo) {
                // 已完成进程：显示其完成时的 newWork
                newWorkTd.textContent = `(${finishInfo.newWork.join(', ')})`;
                if (isCurrentStep) {
                    newWorkTd.classList.add('banker-matrix-new');
                }
            } else if (isCurrentStep) {
                // 当前步骤进程
                const newWork = lastVisibleStep.newWork || [];
                newWorkTd.textContent = `(${newWork.join(', ')})`;
                newWorkTd.classList.add('banker-matrix-new');
            } else if (lastVisibleStep && lastVisibleStep.type === 'init') {
                // init 步骤：所有进程的 Work+Alloc 显示初始 Work 值
                newWorkTd.textContent = `(${currentWork.join(', ')})`;
            } else {
                newWorkTd.textContent = '-';
            }
            row.appendChild(newWorkTd);

            // Finish
            const finishTd = createElement('td', { className: 'banker-matrix-td' });
            const badge = createElement('span', {
                className: `banker-matrix-badge ${isFinished ? 'done' : 'waiting'}`
            }, isFinished ? '✓' : '○');
            finishTd.appendChild(badge);
            row.appendChild(finishTd);

            tbody.appendChild(row);
        }
        matrixTable.appendChild(tbody);
        container.appendChild(matrixTable);

        // 图例
        const legend = createElement('div', { className: 'banker-matrix-legend' });
        legend.innerHTML = `
            <span class="banker-matrix-legend-item"><span class="banker-matrix-legend-dot current"></span> 当前步骤</span>
            <span class="banker-matrix-legend-item"><span class="banker-matrix-legend-dot finished"></span> 已完成</span>
            <span class="banker-matrix-legend-item"><span class="banker-matrix-legend-dot old"></span> 旧Work</span>
            <span class="banker-matrix-legend-item"><span class="banker-matrix-legend-dot new"></span> 新Work</span>
        `;
        container.appendChild(legend);
    }

    /**
     * 更新安全性检测过程（根据 currentStep 截取可见步骤）
     * @param {Object} state
     */
    _updateSafetyProcess(state) {
        const container = document.getElementById('bankerSafetyProcess');
        if (!container) return;

        emptyElement(container);

        const process = state.safetyProcess || [];
        if (process.length === 0) {
            container.textContent = '尚未执行安全性检测。点击上方"执行安全性检查"按钮开始检测。';
            return;
        }

        // 根据 currentStep 截取可见步骤（只显示已推进到的步骤）
        const currentStep = state.currentStep || 0;
        const visibleSteps = process.slice(0, currentStep + 1);

        visibleSteps.forEach((step, idx) => {
            const stepEl = createElement('div', { className: 'banker-safety-step' });

            // 高亮当前最新步骤
            if (idx === visibleSteps.length - 1) {
                stepEl.classList.add('banker-safety-step-active');
            }

            // 步骤序号
            const stepNum = createElement('div', { className: 'banker-safety-step-num' }, String(idx + 1));
            stepEl.appendChild(stepNum);

            // 步骤内容
            const content = createElement('div', { className: 'banker-safety-step-content' });

            if (step.type === 'init') {
                content.innerHTML = `<span class="text-muted">${step.description}</span>`;
            } else if (step.type === 'found') {
                const workBefore = this._formatVec(step.oldWork || []);
                const workAfter = this._formatVec(step.newWork || []);
                const needStr = this._formatVec(step.need || []);
                const allocStr = this._formatVec(step.allocation || []);

                content.innerHTML = `
                    <div class="banker-safety-found">
                        <span class="text-success">✓ ${step.processName}</span> 满足条件
                    </div>
                    <div class="banker-safety-detail">
                        Need${needStr} ≤ Work${workBefore} → 分配后释放
                    </div>
                    <div class="banker-safety-detail">
                        Work = Work${workBefore} + Allocation${allocStr} = ${workAfter}
                    </div>
                `;
            } else if (step.type === 'notFound') {
                const workStr = this._formatVec(step.work || []);
                const unfinished = (step.unfinished || []).join(', ');
                content.innerHTML = `
                    <div class="banker-safety-notfound">
                        <span class="text-danger">✗ 无法继续</span>
                    </div>
                    <div class="banker-safety-detail">
                        剩余进程 ${unfinished} 均不满足 Need ≤ Work${workStr}
                    </div>
                `;
            }

            stepEl.appendChild(content);
            container.appendChild(stepEl);
        });
    }

    /**
     * 更新安全序列（根据 currentStep 截取可见部分）
     * @param {Object} state
     */
    _updateSequence(state) {
        const container = document.getElementById('bankerSequenceContainer');
        if (!container) return;

        emptyElement(container);

        // 从 safetyResult 中读取安全序列和状态
        const safetyResult = state.safetyResult || null;
        const sequence = safetyResult ? (safetyResult.sequence || []) : [];
        const sequenceIndices = safetyResult ? (safetyResult.sequenceIndices || []) : [];
        const isSafe = safetyResult ? safetyResult.safe : undefined;
        const phase = state.phase || 'idle';

        // 阶段名称对照（simulator 中使用的是 safety_check 而非 safety_checking）
        const isSafetyPhase = phase === 'safety_check' || phase === 'safety_init' || phase === 'request_safety';

        if (sequence.length === 0 && !isSafetyPhase) {
            const placeholder = createElement('div', { className: 'banker-sequence-placeholder' });
            placeholder.textContent = '执行安全性检测后，此处将显示安全序列';
            container.appendChild(placeholder);
            return;
        }

        if (isSafetyPhase && sequence.length === 0) {
            const placeholder = createElement('div', { className: 'banker-sequence-placeholder' });
            placeholder.textContent = '正在检测中...';
            container.appendChild(placeholder);
            return;
        }

        // 根据 currentStep 截取安全序列的可见部分
        // 从 safetyProcess 中统计已完成的 found 步骤数量
        const safetyProcess = state.safetyProcess || [];
        const currentStep = state.currentStep || 0;
        const visibleSteps = safetyProcess.slice(0, currentStep + 1);
        const completedCount = visibleSteps.filter(s => s.type === 'found').length;

        // 只显示已完成的进程（根据 currentStep 截取）
        const visibleSequence = sequence.slice(0, completedCount);

        // 安全序列可视化
        const seqRow = createElement('div', { className: 'banker-sequence-row' });
        visibleSequence.forEach((name, idx) => {
            const item = createElement('div', { className: 'banker-sequence-item' });
            const index = createElement('div', { className: 'banker-sequence-index' }, String(idx + 1));
            const label = createElement('div', { className: 'banker-sequence-label' }, name);
            item.appendChild(index);
            item.appendChild(label);
            if (idx < visibleSequence.length - 1) {
                const arrow = createElement('div', { className: 'banker-sequence-arrow' }, '→');
                item.appendChild(arrow);
            }
            seqRow.appendChild(item);
        });

        // 如果还有未完成的进程，显示占位
        if (completedCount < sequence.length) {
            const remaining = sequence.length - completedCount;
            for (let i = 0; i < remaining; i++) {
                const item = createElement('div', { className: 'banker-sequence-item banker-sequence-item-pending' });
                const index = createElement('div', { className: 'banker-sequence-index' }, '?');
                const label = createElement('div', { className: 'banker-sequence-label' }, '...');
                item.appendChild(index);
                item.appendChild(label);
                if (i < remaining - 1 || completedCount > 0) {
                    const arrow = createElement('div', { className: 'banker-sequence-arrow' }, '→');
                    item.appendChild(arrow);
                }
                seqRow.appendChild(item);
            }
        }

        container.appendChild(seqRow);

        // 安全/不安全状态
        if (isSafe !== undefined) {
            const statusEl = createElement('div', {
                className: `banker-sequence-status ${isSafe ? 'safe' : 'unsafe'}`
            }, isSafe ? '✓ 系统处于安全状态' : '✗ 系统处于不安全状态');
            container.appendChild(statusEl);
        }
    }


    /**
     * 更新资源请求结果
     * @param {Object} state
     */
    _updateRequestResult(state) {
        const container = document.getElementById('bankerRequestResult');
        if (!container) return;

        emptyElement(container);

        const requestResult = state.requestResult;
        const phase = state.phase || '';

        // 如果 requestResult 为 null 但处于请求阶段，显示中间步骤提示
        if (!requestResult) {
            if (phase === 'request_step1' || phase === 'request_step2' || phase === 'request_step3' || phase === 'request_safety') {
                const progressEl = createElement('div', { className: 'banker-request-progress' });
                const phaseLabels = {
                    'request_step1': '步骤1：检查 Request ≤ Need...',
                    'request_step2': '步骤2：检查 Request ≤ Available...',
                    'request_step3': '步骤3：试分配...',
                    'request_safety': '步骤4：安全性检测中...'
                };
                progressEl.textContent = phaseLabels[phase] || '处理中...';
                progressEl.classList.add('text-info');
                container.appendChild(progressEl);
            }
            return;
        }

        // 兼容两种字段名：allowed/granted, details/description
        const isGranted = requestResult.allowed !== undefined ? requestResult.allowed : requestResult.granted;
        const detailText = requestResult.details || requestResult.description || '';

        const resultEl = createElement('div', {
            className: `banker-request-result-item ${isGranted ? 'granted' : 'denied'}`
        });

        if (isGranted) {
            resultEl.innerHTML = `
                <div class="text-success">✓ 资源请求已批准</div>
                <div class="text-muted">${detailText}</div>
            `;
        } else {
            // 构建详细的拒绝分析
            let detailedAnalysis = '';
            const processes = state.processes || [];
            const need = state.need || [];
            const available = state.available || [];

            // 如果是在安全性检测阶段被拒绝，展示详细分析
            if (phase === 'request_safety' || phase === 'request_done') {
                const safetyProcess = state.safetyProcess || [];
                const lastStep = safetyProcess.length > 0 ? safetyProcess[safetyProcess.length - 1] : null;
                const work = lastStep ? (lastStep.work || lastStep.newWork || []) : available;

                // 找出所有未完成的进程及其 Need 与 Work 的对比
                const unfinishedRows = [];
                for (let i = 0; i < processes.length; i++) {
                    const finishState = state.finishVector || [];
                    if (!finishState[i] && need[i]) {
                        const needStr = `(${need[i].join(', ')})`;
                        const workStr = `(${work.join(', ')})`;
                        const canAlloc = need[i].every((v, j) => v <= work[j]);
                        unfinishedRows.push({
                            name: processes[i],
                            need: needStr,
                            work: workStr,
                            canAlloc
                        });
                    }
                }

                if (unfinishedRows.length > 0) {
                    detailedAnalysis = `
                        <div class="banker-request-analysis">
                            <div class="banker-request-analysis-title">📊 详细分析：为什么没有进程能满足条件？</div>
                            <table class="banker-analysis-table">
                                <thead>
                                    <tr>
                                        <th>进程</th>
                                        <th>Need</th>
                                        <th>Work</th>
                                        <th>Need ≤ Work?</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${unfinishedRows.map(row => `
                                        <tr>
                                            <td>${row.name}</td>
                                            <td>${row.need}</td>
                                            <td>${row.work}</td>
                                            <td class="${row.canAlloc ? 'text-success' : 'text-danger'}">${row.canAlloc ? '✓ 是' : '✗ 否'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            <div class="banker-request-analysis-conclusion">
                                ${unfinishedRows.every(r => !r.canAlloc)
                                    ? '所有未完成进程的 Need 均大于当前 Work，无法继续推进，系统将进入不安全状态。'
                                    : '存在可满足的进程但算法未找到（异常情况）。'}
                            </div>
                        </div>
                    `;
                }
            }

            resultEl.innerHTML = `
                <div class="text-danger">✗ 资源请求被拒绝</div>
                <div class="text-muted">${detailText}</div>
                ${detailedAnalysis}
            `;
        }

        container.appendChild(resultEl);
    }

    /**
     * 更新解释面板
     * 使用 explanationPanel 期望的格式：{ steps: [{ title, lines }], stats: {} }
     * @param {Object} state
     */
    _updateExplanation(state) {
        const explanation = state.explanation;
        if (!explanation) return;

        // 构建 steps 数组格式
        const steps = [];
        const safetyProcess = state.safetyProcess || [];
        const phase = state.phase || 'idle';

        // 添加当前步骤的解释
        if (typeof explanation === 'string') {
            steps.push({
                title: `步骤 ${state.currentStep || 0}`,
                lines: [explanation]
            });
        } else if (typeof explanation === 'object' && explanation.text) {
            steps.push({
                title: `步骤 ${state.currentStep || 0}`,
                lines: [explanation.text]
            });
        }

        // 添加安全性检测过程的详细步骤
        if (safetyProcess.length > 0) {
            // 只显示最近几步（最多显示5步，避免太长）
            const recentSteps = safetyProcess.slice(-5);
            recentSteps.forEach((step, idx) => {
                if (step.type === 'init') {
                    steps.push({
                        title: `检测步骤 ${safetyProcess.indexOf(step) + 1}`,
                        lines: [step.description || '初始化安全性检测']
                    });
                } else if (step.type === 'found') {
                    const workBefore = this._formatVec(step.oldWork || []);
                    const workAfter = this._formatVec(step.newWork || []);
                    const needStr = this._formatVec(step.need || []);
                    const allocStr = this._formatVec(step.allocation || []);
                    steps.push({
                        title: `检测步骤 ${safetyProcess.indexOf(step) + 1}`,
                        lines: [
                            `<span class="text-success">✓ ${step.processName}</span> 满足 Need${needStr} ≤ Work${workBefore}`,
                            `Work = Work${workBefore} + Allocation${allocStr} = ${workAfter}`,
                            `标记 ${step.processName} 为 Finish`
                        ]
                    });
                } else if (step.type === 'notFound') {
                    const workStr = this._formatVec(step.work || []);
                    const unfinished = (step.unfinished || []).join(', ');
                    steps.push({
                        title: `检测步骤 ${safetyProcess.indexOf(step) + 1}`,
                        lines: [
                            `<span class="text-danger">✗ 无法继续</span>`,
                            `剩余进程 ${unfinished} 均不满足 Need ≤ Work${workStr}`,
                            `系统处于不安全状态！`
                        ]
                    });
                }
            });
        }

        // 构建统计信息
        const stats = {};
        const safetyResult = state.safetyResult || null;
        if (safetyResult) {
            stats['安全状态'] = safetyResult.safe ? '安全 ✓' : '不安全 ✗';
            stats['安全序列'] = safetyResult.sequence ? safetyResult.sequence.join(' → ') : '无';
        }
        if (state.currentStep !== undefined) {
            stats['当前步骤'] = String(state.currentStep);
        }
        if (state.totalSteps !== undefined) {
            stats['总步骤数'] = String(state.totalSteps);
        }

        // 通过事件系统通知解释面板更新
        stateManager.emit(EVENTS.EXPLANATION_UPDATE, {
            title: '银行家算法',
            steps: steps,
            stats: Object.keys(stats).length > 0 ? stats : undefined,
            currentStep: state.currentStep || 0,
            totalSteps: state.totalSteps || 0
        });
    }

    /**
     * 格式化向量为字符串
     * @param {Array} vec
     * @returns {string}
     */
    _formatVec(vec) {
        if (!vec || vec.length === 0) return '(?)';
        return `(${vec.join(', ')})`;
    }

    /**
     * 销毁
     */
    destroy() {
        this._unsubscribers.forEach(fn => fn());
        this._unsubscribers = [];
        super.destroy();
    }
}
