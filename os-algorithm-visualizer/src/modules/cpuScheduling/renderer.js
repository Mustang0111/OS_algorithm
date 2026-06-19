/* ============================================
    CPU调度渲染器
    负责CPU调度模块的DOM渲染和状态更新
    包含：甘特图、就绪队列、进程状态表、统计信息
    ============================================ */

import { Renderer } from '../../core/renderer.js';
import { stateManager } from '../../core/stateManager.js';
import { EVENTS } from '../../utils/constants.js';
import { createElement, emptyElement } from '../../utils/dom.js';
import { PRESETS } from '../../presets/index.js';

/**
 * 进程颜色映射
 */
const PROCESS_COLORS = [
    { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#3b82f6' },
    { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#22c55e' },
    { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#f59e0b' },
    { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#ef4444' },
    { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#a855f7' },
    { bg: 'rgba(14, 165, 233, 0.15)', border: '#0ea5e9', text: '#0ea5e9' },
    { bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899', text: '#ec4899' },
    { bg: 'rgba(132, 204, 22, 0.15)', border: '#84cc16', text: '#84cc16' }
];

export class CpuSchedulingRenderer extends Renderer {
    constructor(simulator) {
        super();
        this._simulator = simulator;
        this._unsubscribers = [];
        this._currentAlgorithm = 'FCFS';
        this._processInput = '';
        this._timeQuantum = 2;
    }

    /**
     * 渲染主界面
     * @param {HTMLElement} container
     */
    render(container) {
        this.mount(container);
        this.clear();

        const mainLayout = createElement('div', { className: 'module-cpu-scheduling' });

        // 1. 控制区
        mainLayout.appendChild(this._createControlSection());

        // 2. 进程信息表
        mainLayout.appendChild(this._createProcessTableSection());

        // 3. 就绪队列
        mainLayout.appendChild(this._createReadyQueueSection());

        // 4. 甘特图
        mainLayout.appendChild(this._createGanttSection());

        // 5. 统计信息
        mainLayout.appendChild(this._createStatsSection());

        container.appendChild(mainLayout);

        // 注册事件监听
        this._registerListeners();

        // 加载默认预设
        this._loadDefaultPreset();
    }

    /**
     * 加载默认预设
     */
    _loadDefaultPreset() {
        const defaultProcesses = 'P1,0,8;P2,1,4;P3,2,2;P4,3,1';
        const input = document.getElementById('cpuProcessInput');
        if (input) {
            input.value = defaultProcesses;
            this._processInput = defaultProcesses;
        }
        const quantumInput = document.getElementById('cpuTimeQuantum');
        if (quantumInput) {
            quantumInput.value = '2';
            this._timeQuantum = 2;
        }
        this._applyConfig();
    }

    /**
     * 创建控制区
     */
    _createControlSection() {
        const section = createElement('div', { className: 'cpu-control-section' });

        // 算法选择
        const algoGroup = createElement('div', { className: 'cpu-control-group' });
        const algoLabel = createElement('label', { className: 'cpu-control-label' }, '算法选择');
        const algoTabs = createElement('div', { className: 'cpu-algorithm-tabs' });

        const algorithms = [
            { id: 'FCFS', name: 'FCFS' },
            { id: 'SJF', name: 'SJF' },
            { id: 'SRTF', name: 'SRTF' },
            { id: 'RR', name: 'RR' },
            { id: 'HRRN', name: 'HRRN' }
        ];

        algorithms.forEach(algo => {
            const tab = createElement('button', {
                className: `cpu-algorithm-tab ${algo.id === this._currentAlgorithm ? 'active' : ''}`,
                dataset: { algo: algo.id },
                onClick: () => this._switchAlgorithm(algo.id)
            }, algo.name);
            algoTabs.appendChild(tab);
        });

        algoGroup.appendChild(algoLabel);
        algoGroup.appendChild(algoTabs);
        section.appendChild(algoGroup);

        // 进程输入
        const procGroup = createElement('div', { className: 'cpu-control-group cpu-control-group--wide' });
        const procLabel = createElement('label', { className: 'cpu-control-label' }, '进程列表');
        const procInput = createElement('input', {
            className: 'cpu-input',
            type: 'text',
            placeholder: '格式: ID,到达时间,CPU时间;... 例如: P1,0,6;P2,1,8;P3,2,7'
        });
        procInput.id = 'cpuProcessInput';
        procGroup.appendChild(procLabel);
        procGroup.appendChild(procInput);
        section.appendChild(procGroup);

        // 时间片（RR专用）
        const quantumGroup = createElement('div', { className: 'cpu-control-group' });
        const quantumLabel = createElement('label', { className: 'cpu-control-label' }, '时间片(RR)');
        const quantumInput = createElement('input', {
            className: 'cpu-input cpu-input--small',
            type: 'number',
            min: '1',
            max: '10',
            value: '2'
        });
        quantumInput.id = 'cpuTimeQuantum';
        quantumGroup.appendChild(quantumLabel);
        quantumGroup.appendChild(quantumInput);
        section.appendChild(quantumGroup);

        // 应用按钮
        const applyBtn = createElement('button', {
            className: 'cpu-btn cpu-btn-primary',
            onClick: () => this._applyConfig()
        }, '应用参数');
        section.appendChild(applyBtn);

        return section;
    }

    /**
     * 创建进程信息表
     */
    _createProcessTableSection() {
        const section = createElement('div', { className: 'cpu-table-section' });
        const title = createElement('div', { className: 'cpu-section-title' }, '进程信息');
        section.appendChild(title);

        const tableContainer = createElement('div', { className: 'cpu-table-container' });
        tableContainer.id = 'cpuProcessTable';
        section.appendChild(tableContainer);

        return section;
    }

    /**
     * 创建就绪队列区
     */
    _createReadyQueueSection() {
        const section = createElement('div', { className: 'cpu-queue-section' });
        const title = createElement('div', { className: 'cpu-section-title' }, '就绪队列');
        section.appendChild(title);

        const queueContainer = createElement('div', { className: 'cpu-queue-container' });
        queueContainer.id = 'cpuReadyQueue';
        section.appendChild(queueContainer);

        return section;
    }

    /**
     * 创建甘特图区
     */
    _createGanttSection() {
        const section = createElement('div', { className: 'cpu-gantt-section' });
        const title = createElement('div', { className: 'cpu-section-title' }, '甘特图');
        section.appendChild(title);

        const ganttContainer = createElement('div', { className: 'cpu-gantt-container' });
        ganttContainer.id = 'cpuGanttChart';
        section.appendChild(ganttContainer);

        return section;
    }

    /**
     * 创建统计信息区
     */
    _createStatsSection() {
        const section = createElement('div', { className: 'cpu-stats-section' });

        const stats = [
            { id: 'cpuStatAvgWait', label: '平均等待时间', value: '0', suffix: '' },
            { id: 'cpuStatAvgTurnaround', label: '平均周转时间', value: '0', suffix: '' },
            { id: 'cpuStatAvgResponse', label: '平均响应时间', value: '0', suffix: '' },
            { id: 'cpuStatUtilization', label: 'CPU利用率', value: '0', suffix: '%' }
        ];

        stats.forEach(stat => {
            const item = createElement('div', { className: 'cpu-stat-item' });
            const valEl = createElement('div', {
                className: 'cpu-stat-value',
                id: stat.id
            }, stat.value + stat.suffix);
            const lblEl = createElement('div', { className: 'cpu-stat-label' }, stat.label);
            item.appendChild(valEl);
            item.appendChild(lblEl);
            section.appendChild(item);
        });

        return section;
    }

    /**
     * 注册事件监听
     */
    _registerListeners() {
        const unsubState = stateManager.on(EVENTS.STATE_CHANGE, (state) => {
            this._updateVisualization(state);
        });

        const unsubPreset = stateManager.on(EVENTS.PRESET_SELECT, (presetId) => {
            this._applyPreset(presetId);
        });

        this._unsubscribers.push(unsubState, unsubPreset);
    }

    /**
     * 切换算法
     */
    _switchAlgorithm(algorithmId) {
        this._currentAlgorithm = algorithmId;

        // 更新算法tab高亮（仅限CPU模块内的tab）
        document.querySelectorAll('.cpu-algorithm-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.algo === algorithmId);
        });

        // 显示/隐藏时间片输入
        const quantumGroup = document.getElementById('cpuTimeQuantum')?.closest('.cpu-control-group');
        if (quantumGroup) {
            quantumGroup.style.display = algorithmId === 'RR' ? '' : 'none';
        }

        if (this._processInput.trim()) {
            this._applyConfig();
        }
    }

    /**
     * 应用配置
     */
    _applyConfig() {
        const input = document.getElementById('cpuProcessInput');
        const quantumInput = document.getElementById('cpuTimeQuantum');

        if (!input) return;

        const text = input.value.trim();
        this._processInput = text;

        if (!text) return;

        // 解析进程列表
        const processes = [];
        const lines = text.split(';');
        lines.forEach(line => {
            const parts = line.trim().split(',');
            if (parts.length >= 3) {
                processes.push({
                    id: parts[0].trim(),
                    arrivalTime: parseInt(parts[1]) || 0,
                    burstTime: parseInt(parts[2]) || 1
                });
            }
        });

        if (processes.length === 0) return;

        this._timeQuantum = parseInt(quantumInput?.value) || 2;

        this._simulator.init({
            processes,
            algorithm: this._currentAlgorithm,
            timeQuantum: this._timeQuantum
        });
    }

    /**
     * 应用预设
     */
    _applyPreset(presetId) {
        const preset = (PRESETS.cpuScheduling || []).find(
            p => p.name === presetId || p.id === presetId
        );

        if (!preset) return;

        const input = document.getElementById('cpuProcessInput');
        const quantumInput = document.getElementById('cpuTimeQuantum');

        if (input) {
            const processStr = preset.config.processes.map(p =>
                `${p.id},${p.arrivalTime},${p.burstTime}`
            ).join(';');
            input.value = processStr;
            this._processInput = input.value;
        }

        if (quantumInput && preset.config.timeQuantum) {
            quantumInput.value = String(preset.config.timeQuantum);
            this._timeQuantum = preset.config.timeQuantum;
        }

        if (preset.config.algorithm) {
            this._currentAlgorithm = preset.config.algorithm;
            document.querySelectorAll('.cpu-algorithm-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.algo === preset.config.algorithm);
            });
        }

        this._applyConfig();
    }

    /**
     * 更新可视化
     */
    _updateVisualization(state) {
        const s = state || this._simulator.getState();
        if (!s) return;

        this._updateProcessTable(s);
        this._updateReadyQueue(s);
        this._updateGanttChart(s);
        this._updateStats(s);
        this._updateExplanation(s);
    }

    /**
     * 更新进程信息表
     */
    _updateProcessTable(state) {
        const container = document.getElementById('cpuProcessTable');
        if (!container) return;

        emptyElement(container);

        const processes = state.processes || [];
        if (processes.length === 0) {
            container.textContent = '暂无进程数据，请先应用参数。';
            return;
        }

        const table = createElement('table', { className: 'cpu-process-table' });

        // 表头
        const thead = createElement('thead');
        const headerRow = createElement('tr');
        const headers = ['进程', '到达时间', 'CPU时间', '剩余时间', '等待时间', '周转时间', '响应时间', '状态'];
        headers.forEach(h => {
            headerRow.appendChild(createElement('th', {}, h));
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // 表体
        const tbody = createElement('tbody');
        processes.forEach((p, idx) => {
            const row = createElement('tr');

            const color = PROCESS_COLORS[idx % PROCESS_COLORS.length];

            // 进程ID（带颜色标识）
            const idCell = createElement('td', { className: 'cpu-process-id' });
            const dot = createElement('span', {
                className: 'cpu-process-dot',
                style: { background: color.border }
            });
            idCell.appendChild(dot);
            idCell.appendChild(document.createTextNode(p.id));
            row.appendChild(idCell);

            row.appendChild(createElement('td', {}, String(p.arrivalTime)));
            row.appendChild(createElement('td', {}, String(p.burstTime)));

            // 剩余时间（高亮）
            const remainCell = createElement('td', {
                className: p.remainingTime > 0 ? 'cpu-remain-active' : ''
            }, String(p.remainingTime));
            row.appendChild(remainCell);

            // 等待时间
            row.appendChild(createElement('td', {}, String(p.waitTime || 0)));

            // 周转时间（仅已完成进程有值）
            const turnaroundStr = p.finishTime !== null ? String(p.turnaroundTime) : '-';
            row.appendChild(createElement('td', {
                className: p.finishTime !== null ? '' : 'cpu-value-pending'
            }, turnaroundStr));

            // 响应时间（仅已开始执行的进程有值）
            const responseStr = p.responseTime !== null ? String(p.responseTime) : '-';
            row.appendChild(createElement('td', {
                className: p.responseTime !== null ? '' : 'cpu-value-pending'
            }, responseStr));

            // 状态（带颜色）
            const stateCell = createElement('td', { className: `cpu-state-${p.state}` }, this._getStateLabel(p.state));
            row.appendChild(stateCell);

            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        container.appendChild(table);
    }

    /**
     * 获取状态标签
     */
    _getStateLabel(state) {
        const labels = {
            'new': '新建',
            'ready': '就绪',
            'running': '运行中',
            'terminated': '已完成'
        };
        return labels[state] || state;
    }

    /**
     * 更新就绪队列
     */
    _updateReadyQueue(state) {
        const container = document.getElementById('cpuReadyQueue');
        if (!container) return;

        emptyElement(container);

        const readyIds = state.readyQueue || [];
        const processes = state.processes || [];
        const currentProcess = state.currentProcess;

        // 当前运行的进程
        if (currentProcess) {
            const runningEl = createElement('div', { className: 'cpu-queue-section-label' }, '当前运行:');
            container.appendChild(runningEl);

            const p = processes.find(pp => pp.id === currentProcess.id);
            if (p) {
                const idx = processes.indexOf(p);
                const color = PROCESS_COLORS[idx % PROCESS_COLORS.length];
                const procEl = createElement('div', {
                    className: 'cpu-queue-item cpu-queue-running',
                    style: {
                        borderColor: color.border,
                        background: color.bg,
                        color: color.text
                    }
                }, `${p.id} (剩余: ${p.remainingTime})`);
                container.appendChild(procEl);
            }
        }

        // 就绪队列
        const queueLabel = createElement('div', { className: 'cpu-queue-section-label' }, '就绪队列:');
        container.appendChild(queueLabel);

        if (readyIds.length === 0) {
            const emptyEl = createElement('div', { className: 'cpu-queue-empty' }, '(空)');
            container.appendChild(emptyEl);
        } else {
            const queueEl = createElement('div', { className: 'cpu-queue-list' });
            readyIds.forEach((pid, idx) => {
                const p = processes.find(pp => pp.id === pid);
                if (!p) return;

                const procIdx = processes.indexOf(p);
                const color = PROCESS_COLORS[procIdx % PROCESS_COLORS.length];
                const isCurrent = currentProcess && pid === currentProcess.id;

                if (!isCurrent) {
                    const item = createElement('div', {
                        className: 'cpu-queue-item',
                        style: {
                            borderColor: color.border,
                            background: color.bg,
                            color: color.text
                        }
                    }, `${p.id} (剩余: ${p.remainingTime})`);
                    queueEl.appendChild(item);
                }
            });
            container.appendChild(queueEl);
        }
    }

    /**
     * 更新甘特图
     */
    _updateGanttChart(state) {
        const container = document.getElementById('cpuGanttChart');
        if (!container) return;

        emptyElement(container);

        const ganttChart = state.ganttChart || [];
        const processes = state.processes || [];

        if (ganttChart.length === 0) {
            const emptyEl = createElement('div', { className: 'cpu-gantt-empty' }, '暂无调度记录');
            container.appendChild(emptyEl);
            return;
        }

        // 计算总时间范围
        const maxTime = ganttChart.reduce((max, g) => Math.max(max, g.end), 0);
        const minTime = ganttChart.reduce((min, g) => Math.min(min, g.start), 0);
        const totalDuration = Math.max(maxTime - minTime, 1);

        // 甘特图容器
        const chartEl = createElement('div', { className: 'cpu-gantt-chart' });

        // 时间轴
        const timelineEl = createElement('div', { className: 'cpu-gantt-timeline' });
        for (let t = minTime; t <= maxTime; t++) {
            const tick = createElement('div', {
                className: 'cpu-gantt-tick',
                style: { left: `${((t - minTime) / totalDuration) * 100}%` }
            }, String(t));
            timelineEl.appendChild(tick);
        }
        chartEl.appendChild(timelineEl);

        // 甘特图条
        const barsEl = createElement('div', { className: 'cpu-gantt-bars' });

        // 按进程分组
        const processGanttMap = new Map();
        ganttChart.forEach(entry => {
            if (!processGanttMap.has(entry.pid)) {
                processGanttMap.set(entry.pid, []);
            }
            processGanttMap.get(entry.pid).push(entry);
        });

        processGanttMap.forEach((entries, pid) => {
            const p = processes.find(pp => pp.id === pid);
            const idx = p ? processes.indexOf(p) : 0;
            const color = PROCESS_COLORS[idx % PROCESS_COLORS.length];

            const rowEl = createElement('div', { className: 'cpu-gantt-row' });

            // 进程标签
            const labelEl = createElement('div', {
                className: 'cpu-gantt-label',
                style: { color: color.text }
            }, pid);
            rowEl.appendChild(labelEl);

            // 条
            const barTrack = createElement('div', { className: 'cpu-gantt-track' });
            entries.forEach(entry => {
                const left = ((entry.start - minTime) / totalDuration) * 100;
                const width = ((entry.end - entry.start) / totalDuration) * 100;

                const bar = createElement('div', {
                    className: 'cpu-gantt-bar',
                    style: {
                        left: `${left}%`,
                        width: `${Math.max(width, 2)}%`,
                        background: color.border,
                        opacity: '0.8'
                    },
                    title: `${pid}: ${entry.start}-${entry.end}`
                }, `${entry.end - entry.start}`);
                barTrack.appendChild(bar);
            });
            rowEl.appendChild(barTrack);

            barsEl.appendChild(rowEl);
        });

        chartEl.appendChild(barsEl);
        container.appendChild(chartEl);
    }

    /**
     * 更新统计信息
     */
    _updateStats(state) {
        const avgWaitEl = document.getElementById('cpuStatAvgWait');
        const avgTurnaroundEl = document.getElementById('cpuStatAvgTurnaround');
        const avgResponseEl = document.getElementById('cpuStatAvgResponse');
        const utilizationEl = document.getElementById('cpuStatUtilization');

        if (avgWaitEl) avgWaitEl.textContent = state.avgWaitTime?.toFixed(2) || '0.00';
        if (avgTurnaroundEl) avgTurnaroundEl.textContent = state.avgTurnaroundTime?.toFixed(2) || '0.00';
        if (avgResponseEl) avgResponseEl.textContent = state.avgResponseTime?.toFixed(2) || '0.00';
        if (utilizationEl) utilizationEl.textContent = (state.cpuUtilization?.toFixed(1) || '0') + '%';
    }

    /**
     * 更新解释面板
     */
    _updateExplanation(state) {
        const explanation = state.explanation || '';
        const lines = explanation.split('\n');

        stateManager.emit(EVENTS.EXPLANATION_UPDATE, {
            steps: [{
                title: `时间 ${state.time || 0}`,
                lines: lines
            }],
            stats: {
                '算法': state.algorithm || this._currentAlgorithm,
                '已完成': `${state.completedCount || 0}/${state.totalProcesses || 0}`,
                '平均等待时间': (state.avgWaitTime || 0).toFixed(2),
                '平均周转时间': (state.avgTurnaroundTime || 0).toFixed(2)
            }
        });
    }

    /**
     * 统一更新接口
     */
    update(state) {
        // 已通过 STATE_CHANGE 监听自动更新
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
