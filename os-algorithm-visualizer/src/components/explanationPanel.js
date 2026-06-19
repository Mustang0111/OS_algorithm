/* ============================================
   教学解释面板组件
   动态展示当前步骤的算法执行逻辑
   ============================================ */

import { createElement, emptyElement } from '../utils/dom.js';
import { stateManager } from '../core/stateManager.js';
import { EVENTS } from '../utils/constants.js';

export class ExplanationPanel {
    constructor() {
        this._element = null;
        this._contentEl = null;
        this._cleanups = [];
    }

    /**
     * 渲染解释面板
     * @param {HTMLElement} container - 已存在于DOM中的解释面板容器
     */
    render(container) {
        this._element = container;
        this._element.classList.add('explanation-panel');

        // 清空容器（保留原有header结构）
        const existingHeader = this._element.querySelector('.explanation-header');
        const existingContent = this._element.querySelector('.explanation-content');

        if (existingContent) {
            this._contentEl = existingContent;
        } else {
            // 如果DOM中没有预置结构，则创建
            emptyElement(this._element);
            const header = createElement('div', { className: 'explanation-header' });
            const icon = createElement('div', { className: 'explanation-icon' });
            icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>`;
            header.appendChild(icon);
            header.appendChild(document.createTextNode('算法解释'));
            this._element.appendChild(header);

            this._contentEl = createElement('div', { className: 'explanation-content' });
            this._element.appendChild(this._contentEl);
        }

        this._showPlaceholder('选择算法并开始执行\n查看详细的步骤解释');

        // 订阅事件
        this._subscribeEvents();
    }

    /**
     * 订阅事件
     */
    _subscribeEvents() {
        this._cleanups.push(
            stateManager.on(EVENTS.EXPLANATION_UPDATE, (data) => {
                // 生产者消费者模块使用 { text, step, total } 格式
                if (data && data.text !== undefined) {
                    this._updateFromProducerConsumer(data);
                } else {
                    this._updateExplanation(data);
                }
            })
        );

        this._cleanups.push(
            stateManager.on(EVENTS.RESET, () => {
                this._showPlaceholder('已重置\n点击"下一步"开始执行');
            })
        );

        this._cleanups.push(
            stateManager.on(EVENTS.MODULE_SWITCH, () => {
                this._showPlaceholder('选择算法并开始执行\n查看详细的步骤解释');
            })
        );

        // 监听 STATE_CHANGE，从状态中提取 explanation 字段
        this._cleanups.push(
            stateManager.on(EVENTS.STATE_CHANGE, (state) => {
                if (state && state.explanation) {
                    this._updateFromState(state);
                }
            })
        );
    }

    /**
     * 显示占位信息
     * @param {string} text
     */
    _showPlaceholder(text) {
        emptyElement(this._contentEl);
        const placeholder = createElement('div', { className: 'explanation-placeholder' });
        placeholder.textContent = text;
        this._contentEl.appendChild(placeholder);
    }

    /**
     * 更新解释内容
     * @param {Object} data - 解释数据
     */
    _updateExplanation(data) {
        if (!this._contentEl) return;
        emptyElement(this._contentEl);

        if (!data || !data.steps || data.steps.length === 0) {
            this._showPlaceholder('暂无解释信息');
            return;
        }

        // 渲染步骤
        data.steps.forEach((step, index) => {
            const stepEl = createElement('div', { className: 'explanation-step' });

            // 步骤标题
            if (step.title) {
                const title = createElement('div', { className: 'explanation-step-title' }, step.title);
                stepEl.appendChild(title);
            }

            // 步骤内容行
            if (step.lines && Array.isArray(step.lines)) {
                step.lines.forEach(line => {
                    const lineEl = createElement('div', { className: 'explanation-line' });
                    lineEl.innerHTML = line;
                    stepEl.appendChild(lineEl);
                });
            }

            this._contentEl.appendChild(stepEl);

            // 分隔线
            if (index < data.steps.length - 1) {
                this._contentEl.appendChild(createElement('div', { className: 'explanation-divider' }));
            }
        });

        // 统计信息
        if (data.stats) {
            this._contentEl.appendChild(createElement('div', { className: 'explanation-divider' }));
            Object.entries(data.stats).forEach(([label, value]) => {
                const statEl = createElement('div', { className: 'explanation-stat' });
                statEl.appendChild(createElement('span', { className: 'explanation-stat-label' }, label));
                statEl.appendChild(createElement('span', { className: 'explanation-stat-value' }, String(value)));
                this._contentEl.appendChild(statEl);
            });
        }
    }

    /**
     * 从状态对象更新解释面板（用于磁盘调度等模块）
     * @param {Object} state - 模拟器状态
     */
    _updateFromState(state) {
        if (!this._contentEl) return;
        emptyElement(this._contentEl);

        const stepEl = createElement('div', { className: 'explanation-step' });

        // 步骤标题
        const title = createElement('div', { className: 'explanation-step-title' }, `步骤 ${state.completedCount || 0}`);
        stepEl.appendChild(title);

        // 解释文本
        if (state.explanation) {
            const lineEl = createElement('div', { className: 'explanation-line' });
            lineEl.textContent = state.explanation;
            stepEl.appendChild(lineEl);
        }

        this._contentEl.appendChild(stepEl);

        // 统计信息
        if (state.totalSeekLength !== undefined) {
            this._contentEl.appendChild(createElement('div', { className: 'explanation-divider' }));
            const stats = [
                { label: '总寻道长度', value: state.totalSeekLength },
                { label: '已完成请求', value: `${state.completedCount}/${state.requests?.length || 0}` },
                { label: '剩余请求', value: (state.remainingRequests || []).length }
            ];
            stats.forEach(({ label, value }) => {
                const statEl = createElement('div', { className: 'explanation-stat' });
                statEl.appendChild(createElement('span', { className: 'explanation-stat-label' }, label));
                statEl.appendChild(createElement('span', { className: 'explanation-stat-value' }, String(value)));
                this._contentEl.appendChild(statEl);
            });
        }
    }

    /**
     * 从生产者消费者模块更新解释面板
     * @param {Object} data - { text, step, total }
     */
    _updateFromProducerConsumer(data) {
        if (!this._contentEl) return;
        emptyElement(this._contentEl);

        const stepEl = createElement('div', { className: 'explanation-step' });

        // 步骤标题
        const title = createElement('div', { className: 'explanation-step-title' }, `步骤 ${data.step || 0}`);
        stepEl.appendChild(title);

        // 解释文本
        if (data.text) {
            const lineEl = createElement('div', { className: 'explanation-line' });
            lineEl.textContent = data.text;
            stepEl.appendChild(lineEl);
        }

        this._contentEl.appendChild(stepEl);
    }

    /**
     * 销毁
     */
    destroy() {
        this._cleanups.forEach(fn => fn());
        this._cleanups = [];
    }
}
