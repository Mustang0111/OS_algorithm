/* ============================================
   磁盘调度渲染器
   双视图设计：
   1. 一维磁道分布图（DOM）— 展示磁道范围、请求位置、磁头位置
   2. 寻道轨迹图（Canvas）— 折线图展示寻道轨迹
   ============================================ */

import { Renderer } from '../../core/renderer.js';
import { createElement, emptyElement } from '../../utils/dom.js';
import { DiskCanvasRenderer } from './canvasRenderer.js';

export class DiskSchedulingRenderer extends Renderer {
    constructor() {
        super();
        this._canvasRenderer = new DiskCanvasRenderer();
        this._currentState = null;
        this._onAlgorithmChange = null;
        this._onApply = null;
    }

    /**
     * 设置回调
     * @param {Object} callbacks
     */
    setCallbacks(callbacks) {
        this._onAlgorithmChange = callbacks.onAlgorithmChange || null;
        this._onApply = callbacks.onApply || null;
    }

    /**
     * 应用预设（由 PresetPanel 调用）
     * @param {string} presetId - 预设名称
     */
    _applyPreset(presetId) {
        // 从 PRESETS 中查找匹配的预设
        import('../../presets/index.js').then(({ PRESETS }) => {
            const presets = PRESETS.diskScheduling || [];
            const preset = presets.find(p => p.name === presetId || p.id === presetId);
            if (!preset) return;

            const config = preset.config;

            // 转换预设配置为 renderer 可用的格式
            const minTrack = 0;
            const maxTrack = config.diskSize ? config.diskSize - 1 : 199;

            // 更新 UI 控件
            if (this._headInput) this._headInput.value = config.headPosition ?? 53;
            if (this._reqInput) this._reqInput.value = (config.requests || []).join(',');
            if (this._minInput) this._minInput.value = minTrack;
            if (this._maxInput) this._maxInput.value = maxTrack;
            if (this._dirSelect) this._dirSelect.value = config.direction || 'right';

            // 更新算法标签
            const algoName = config.algorithm || 'FCFS';
            const algoUpper = algoName.toUpperCase().replace(/\s+/g, '');
            const algoMap = {
                'FCFS': 'FCFS',
                'SSTF': 'SSTF',
                'SCAN': 'SCAN',
                'CSCAN': 'C-SCAN',
                'C-SCAN': 'C-SCAN',
                'LOOK': 'LOOK',
                'CLOOK': 'C-LOOK',
                'C-LOOK': 'C-LOOK'
            };
            const normalizedAlgo = algoMap[algoUpper] || 'FCFS';

            // 高亮对应的算法标签
            if (this._algoTabs) {
                Object.entries(this._algoTabs).forEach(([id, tab]) => {
                    tab.classList.toggle('active', id === normalizedAlgo);
                });
            }

            // 触发应用
            this._handleApply();
        }).catch(err => {
            console.warn('[DiskRenderer] Failed to load presets:', err);
        });
    }

    /**
     * 渲染整个模块
     * @param {HTMLElement} container
     */
    render(container) {
        this.mount(container);
        this._buildLayout();
    }

    /**
     * 构建布局
     */
    _buildLayout() {
        emptyElement(this._container);

        const wrapper = createElement('div', { className: 'module-disk-scheduling' });

        // 1. 控制区
        wrapper.appendChild(this._buildControlSection());

        // 2. 双视图区
        wrapper.appendChild(this._buildVisualizationSection());

        // 3. 统计信息
        wrapper.appendChild(this._buildStatsSection());

        // 4. 服务顺序
        wrapper.appendChild(this._buildServiceOrderSection());

        this._container.appendChild(wrapper);
    }

    /**
     * 构建控制区
     */
    _buildControlSection() {
        const section = createElement('div', { className: 'disk-control-section' });

        // 算法选择
        const algoGroup = createElement('div', { className: 'disk-control-group' });
        const algoLabel = createElement('label', { className: 'disk-control-label' }, '算法选择');
        const algoTabs = this._buildAlgorithmTabs();
        algoGroup.appendChild(algoLabel);
        algoGroup.appendChild(algoTabs);
        section.appendChild(algoGroup);

        // 磁头位置
        const headGroup = createElement('div', { className: 'disk-control-group' });
        const headLabel = createElement('label', { className: 'disk-control-label' }, '磁头位置');
        this._headInput = createElement('input', {
            className: 'disk-input disk-input--small',
            type: 'number',
            value: '53',
            min: '0',
            max: '199'
        });
        headGroup.appendChild(headLabel);
        headGroup.appendChild(this._headInput);
        section.appendChild(headGroup);

        // 请求序列
        const reqGroup = createElement('div', { className: 'disk-control-group disk-control-group--wide' });
        const reqLabel = createElement('label', { className: 'disk-control-label' }, '请求序列（逗号分隔）');
        this._reqInput = createElement('input', {
            className: 'disk-input',
            type: 'text',
            value: '98,183,37,122,14,124,65,67'
        });
        reqGroup.appendChild(reqLabel);
        reqGroup.appendChild(this._reqInput);
        section.appendChild(reqGroup);

        // 磁道范围
        const rangeGroup = createElement('div', { className: 'disk-control-group' });
        const rangeLabel = createElement('label', { className: 'disk-control-label' }, '磁道范围');
        const rangeRow = createElement('div', { className: 'disk-control-row' });
        this._minInput = createElement('input', {
            className: 'disk-input disk-input--small',
            type: 'number',
            value: '0',
            min: '0'
        });
        const rangeSep = createElement('span', { className: 'disk-range-sep' }, '~');
        this._maxInput = createElement('input', {
            className: 'disk-input disk-input--small',
            type: 'number',
            value: '199',
            min: '0'
        });
        rangeRow.appendChild(this._minInput);
        rangeRow.appendChild(rangeSep);
        rangeRow.appendChild(this._maxInput);
        rangeGroup.appendChild(rangeLabel);
        rangeGroup.appendChild(rangeRow);
        section.appendChild(rangeGroup);

        // 方向选择
        const dirGroup = createElement('div', { className: 'disk-control-group' });
        const dirLabel = createElement('label', { className: 'disk-control-label' }, '初始方向');
        this._dirSelect = createElement('select', { className: 'disk-select' });
        const optRight = createElement('option', { value: 'right' }, '→ 向右');
        const optLeft = createElement('option', { value: 'left' }, '← 向左');
        this._dirSelect.appendChild(optRight);
        this._dirSelect.appendChild(optLeft);
        dirGroup.appendChild(dirLabel);
        dirGroup.appendChild(this._dirSelect);
        section.appendChild(dirGroup);

        // 应用按钮
        const btnGroup = createElement('div', { className: 'disk-control-group' });
        const applyBtn = createElement('button', {
            className: 'disk-btn disk-btn-primary',
            onClick: () => this._handleApply()
        }, '应用参数');
        btnGroup.appendChild(applyBtn);
        section.appendChild(btnGroup);

        return section;
    }

    /**
     * 构建算法选择标签
     */
    _buildAlgorithmTabs() {
        const algorithms = [
            { id: 'FCFS', name: 'FCFS' },
            { id: 'SSTF', name: 'SSTF' },
            { id: 'SCAN', name: 'SCAN' },
            { id: 'C-SCAN', name: 'C-SCAN' },
            { id: 'LOOK', name: 'LOOK' },
            { id: 'C-LOOK', name: 'C-LOOK' }
        ];

        const tabs = createElement('div', { className: 'disk-algorithm-tabs' });
        this._algoTabs = {};

        algorithms.forEach(algo => {
            const tab = createElement('button', {
                className: `disk-algorithm-tab ${algo.id === 'FCFS' ? 'active' : ''}`,
                onClick: () => this._handleAlgorithmChange(algo.id)
            }, algo.name);
            tabs.appendChild(tab);
            this._algoTabs[algo.id] = tab;
        });

        return tabs;
    }

    /**
     * 构建双视图可视化区
     */
    _buildVisualizationSection() {
        const section = createElement('div', { className: 'disk-viz-section' });

        // 视图一：一维磁道分布图（DOM）
        const trackView = createElement('div', { className: 'disk-track-view' });
        const trackTitle = createElement('div', { className: 'disk-section-title' }, '磁道分布图');
        trackView.appendChild(trackTitle);
        this._trackContainer = createElement('div', { className: 'disk-track-container' });
        trackView.appendChild(this._trackContainer);
        section.appendChild(trackView);

        // 视图二：寻道轨迹图（Canvas）
        const canvasView = createElement('div', { className: 'disk-canvas-view' });
        const canvasTitle = createElement('div', { className: 'disk-section-title' }, '寻道轨迹图');
        canvasView.appendChild(canvasTitle);
        this._canvas = document.createElement('canvas');
        this._canvas.className = 'disk-canvas';
        this._canvasRenderer.mount(this._canvas);
        canvasView.appendChild(this._canvas);
        section.appendChild(canvasView);

        return section;
    }

    /**
     * 构建统计信息区
     */
    _buildStatsSection() {
        const section = createElement('div', { className: 'disk-stats-section' });

        this._statsEls = {};

        const stats = [
            { id: 'completedCount', label: '已完成请求' },
            { id: 'totalSeekLength', label: '总寻道长度' },
            { id: 'avgSeekLength', label: '平均寻道长度' },
            { id: 'remainingCount', label: '剩余请求' }
        ];

        stats.forEach(stat => {
            const item = createElement('div', { className: 'disk-stat-item' });
            const value = createElement('div', { className: 'disk-stat-value' }, '0');
            const label = createElement('div', { className: 'disk-stat-label' }, stat.label);
            item.appendChild(value);
            item.appendChild(label);
            section.appendChild(item);
            this._statsEls[stat.id] = value;
        });

        return section;
    }

    /**
     * 构建服务顺序区
     */
    _buildServiceOrderSection() {
        const section = createElement('div', { className: 'disk-order-section' });
        const title = createElement('div', { className: 'disk-section-title' }, '服务顺序');
        section.appendChild(title);

        this._orderContainer = createElement('div', { className: 'disk-order-container' });
        section.appendChild(this._orderContainer);

        return section;
    }

    /**
     * 处理算法切换
     * @param {string} algoId
     */
    _handleAlgorithmChange(algoId) {
        Object.entries(this._algoTabs).forEach(([id, tab]) => {
            tab.classList.toggle('active', id === algoId);
        });

        if (this._onAlgorithmChange) {
            this._onAlgorithmChange(algoId);
        }
    }

    /**
     * 处理应用参数
     */
    _handleApply() {
        const headPosition = parseInt(this._headInput.value, 10);
        const requestsStr = this._reqInput.value.trim();
        const minTrack = parseInt(this._minInput.value, 10);
        const maxTrack = parseInt(this._maxInput.value, 10);
        const direction = this._dirSelect.value;

        const requests = requestsStr.split(/[,，\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

        if (requests.length === 0) {
            this._showError('请输入有效的请求序列');
            return;
        }

        if (isNaN(headPosition)) {
            this._showError('请输入有效的磁头位置');
            return;
        }

        let algorithm = 'FCFS';
        for (const [id, tab] of Object.entries(this._algoTabs)) {
            if (tab.classList.contains('active')) {
                algorithm = id;
                break;
            }
        }

        if (this._onApply) {
            this._onApply({
                algorithm,
                headPosition,
                requests,
                minTrack,
                maxTrack,
                direction
            });
        }
    }

    /**
     * 显示错误提示
     * @param {string} msg
     */
    _showError(msg) {
        const old = this._container.querySelector('.disk-error');
        if (old) old.remove();

        const error = createElement('div', { className: 'disk-error' }, msg);
        this._container.appendChild(error);
        setTimeout(() => error.remove(), 2000);
    }

    /**
     * 更新渲染
     * @param {Object} state
     */
    update(state) {
        if (!this._container) return;
        this._currentState = state;

        // 更新一维磁道分布图（DOM）
        this._updateTrackView(state);

        // 更新寻道轨迹图（Canvas）
        this._canvasRenderer.render(state);

        // 更新统计信息
        this._updateStats(state);

        // 更新服务顺序
        this._updateServiceOrder(state);
    }

    /**
     * 更新一维磁道分布图
     * @param {Object} state
     */
    _updateTrackView(state) {
        if (!this._trackContainer) return;

        emptyElement(this._trackContainer);

        const minTrack = state.minTrack ?? 0;
        const maxTrack = state.maxTrack ?? 199;
        const trackRange = maxTrack - minTrack || 1;
        const headPos = state.headPosition ?? 0;
        const requests = state.requests || [];
        const remaining = state.remainingRequests || [];
        const completed = state.serviceOrder || [];
        const currentReq = state.currentRequest;

        // 创建SVG磁道视图
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'disk-track-svg');
        svg.setAttribute('viewBox', '0 0 1000 80');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        const trackY = 40;
        const startX = 50;
        const endX = 950;
        const trackWidth = endX - startX;

        const mapX = (track) => {
            return startX + ((track - minTrack) / trackRange) * trackWidth;
        };

        // --- 磁道线 ---
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', String(startX));
        line.setAttribute('y1', String(trackY));
        line.setAttribute('x2', String(endX));
        line.setAttribute('y2', String(trackY));
        line.setAttribute('stroke', '#2b2f3a');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);

        // --- 刻度 + 标签 ---
        const tickCount = 10;
        for (let i = 0; i <= tickCount; i++) {
            const track = minTrack + (i / tickCount) * trackRange;
            const x = mapX(track);
            const tick = Math.round(track);

            // 刻度线
            const tickLine = document.createElementNS(svgNS, 'line');
            tickLine.setAttribute('x1', String(x));
            tickLine.setAttribute('y1', String(trackY - 5));
            tickLine.setAttribute('x2', String(x));
            tickLine.setAttribute('y2', String(trackY + 5));
            tickLine.setAttribute('stroke', '#1e2230');
            tickLine.setAttribute('stroke-width', '1');
            svg.appendChild(tickLine);

            // 标签
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', String(x));
            text.setAttribute('y', String(trackY + 18));
            text.setAttribute('fill', '#6b7280');
            text.setAttribute('font-size', '9');
            text.setAttribute('font-family', 'monospace');
            text.setAttribute('text-anchor', 'middle');
            text.textContent = String(tick);
            svg.appendChild(text);
        }

        // --- 请求标记 ---
        // 已完成（绿色）
        for (const req of completed) {
            if (req === currentReq) continue;
            const x = mapX(req);
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', String(x));
            dot.setAttribute('cy', String(trackY));
            dot.setAttribute('r', '4');
            dot.setAttribute('fill', '#22c55e');
            dot.setAttribute('opacity', '0.6');
            svg.appendChild(dot);
        }

        // 当前请求（蓝色高亮）
        if (currentReq !== null && currentReq !== undefined) {
            const x = mapX(currentReq);
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', String(x));
            dot.setAttribute('cy', String(trackY));
            dot.setAttribute('r', '6');
            dot.setAttribute('fill', '#3b82f6');
            dot.setAttribute('stroke', '#ffffff');
            dot.setAttribute('stroke-width', '2');
            svg.appendChild(dot);

            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', String(x));
            label.setAttribute('y', String(trackY - 12));
            label.setAttribute('fill', '#3b82f6');
            label.setAttribute('font-size', '10');
            label.setAttribute('font-family', 'monospace');
            label.setAttribute('font-weight', 'bold');
            label.setAttribute('text-anchor', 'middle');
            label.textContent = `← ${currentReq}`;
            svg.appendChild(label);
        }

        // 剩余请求（灰色）
        for (const req of remaining) {
            if (req === currentReq) continue;
            const x = mapX(req);
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', String(x));
            dot.setAttribute('cy', String(trackY));
            dot.setAttribute('r', '4');
            dot.setAttribute('fill', '#6b7280');
            svg.appendChild(dot);

            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', String(x));
            label.setAttribute('y', String(trackY - 10));
            label.setAttribute('fill', '#6b7280');
            label.setAttribute('font-size', '8');
            label.setAttribute('font-family', 'monospace');
            label.setAttribute('text-anchor', 'middle');
            label.textContent = String(req);
            svg.appendChild(label);
        }

        // --- 磁头标记 ---
        const headX = mapX(headPos);
        const headGroup = document.createElementNS(svgNS, 'g');

        // 磁头三角形
        const headPoly = document.createElementNS(svgNS, 'polygon');
        const dir = state.direction || 'right';
        const size = 8;
        if (dir === 'right') {
            headPoly.setAttribute('points', `${headX + size},${trackY} ${headX - size},${trackY - 6} ${headX - size},${trackY + 6}`);
        } else {
            headPoly.setAttribute('points', `${headX - size},${trackY} ${headX + size},${trackY - 6} ${headX + size},${trackY + 6}`);
        }
        headPoly.setAttribute('fill', '#3b82f6');
        headGroup.appendChild(headPoly);

        // 磁头标签
        const headLabel = document.createElementNS(svgNS, 'text');
        headLabel.setAttribute('x', String(headX));
        headLabel.setAttribute('y', String(trackY - 14));
        headLabel.setAttribute('fill', '#3b82f6');
        headLabel.setAttribute('font-size', '10');
        headLabel.setAttribute('font-family', 'monospace');
        headLabel.setAttribute('font-weight', 'bold');
        headLabel.setAttribute('text-anchor', 'middle');
        headLabel.textContent = '磁头';
        headGroup.appendChild(headLabel);

        svg.appendChild(headGroup);

        // --- 图例 ---
        const legendItems = [
            { color: '#3b82f6', label: '磁头', x: 820 },
            { color: '#22c55e', label: '已完成', x: 870 },
            { color: '#6b7280', label: '待处理', x: 930 }
        ];

        legendItems.forEach(item => {
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', String(item.x));
            dot.setAttribute('cy', '12');
            dot.setAttribute('r', '3');
            dot.setAttribute('fill', item.color);
            svg.appendChild(dot);

            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', String(item.x + 6));
            label.setAttribute('y', '15');
            label.setAttribute('fill', '#9ca3af');
            label.setAttribute('font-size', '8');
            label.setAttribute('font-family', 'monospace');
            label.textContent = item.label;
            svg.appendChild(label);
        });

        this._trackContainer.appendChild(svg);
    }

    /**
     * 更新统计信息
     * @param {Object} state
     */
    _updateStats(state) {
        if (!this._statsEls) return;

        const completed = state.completedCount || 0;
        const totalSeek = state.totalSeekLength || 0;
        const remaining = (state.remainingRequests || []).length;
        const avgSeek = completed > 0 ? (totalSeek / completed).toFixed(1) : '0';

        this._statsEls.completedCount.textContent = `${completed}/${state.requests?.length || 0}`;
        this._statsEls.totalSeekLength.textContent = totalSeek;
        this._statsEls.avgSeekLength.textContent = avgSeek;
        this._statsEls.remainingCount.textContent = remaining;
    }

    /**
     * 更新服务顺序
     * 边界步骤用特殊样式标记
     * @param {Object} state
     */
    _updateServiceOrder(state) {
        if (!this._orderContainer) return;

        const order = state.serviceOrder || [];
        const boundarySteps = state.boundarySteps || [];
        emptyElement(this._orderContainer);

        if (order.length === 0) {
            this._orderContainer.textContent = '暂无服务记录';
            this._orderContainer.style.color = 'var(--text-muted)';
            this._orderContainer.style.fontSize = 'var(--text-sm)';
            return;
        }

        order.forEach((req, index) => {
            // 边界步骤索引：serviceOrder 中第 index 个请求对应步骤索引 index+1（因为索引0是初始磁头位置）
            const stepIndex = index + 1;
            const isBoundary = boundarySteps.includes(stepIndex);
            const isCurrent = index === order.length - 1;

            let className = 'disk-order-item';
            if (isCurrent) className += ' current';
            if (isBoundary) className += ' boundary';

            const item = createElement('div', { className });
            const idxLabel = createElement('span', { className: 'disk-order-index' }, `${index + 1}.`);
            const reqLabel = createElement('span', { className: 'disk-order-req' }, String(req));
            item.appendChild(idxLabel);
            item.appendChild(reqLabel);

            // 边界步骤添加标记
            if (isBoundary) {
                const badge = createElement('span', {
                    className: 'disk-order-badge'
                }, '↻');
                item.appendChild(badge);
            }

            this._orderContainer.appendChild(item);
        });
    }

    /**
     * 销毁
     */
    destroy() {
        this._canvasRenderer.destroy();
        this._canvas = null;
        this._currentState = null;
        this._algoTabs = null;
        this._statsEls = null;
        this._orderContainer = null;
        this._trackContainer = null;
        super.destroy();
    }
}
