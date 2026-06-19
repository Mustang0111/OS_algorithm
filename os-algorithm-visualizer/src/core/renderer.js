/* ============================================
   渲染器基类
   提供DOM渲染和Canvas渲染的通用工具
   ============================================ */

import { createElement, emptyElement } from '../utils/dom.js';

export class Renderer {
    constructor() {
        this._container = null;
        this._canvas = null;
        this._ctx = null;
    }

    /**
     * 挂载到容器
     * @param {HTMLElement} container
     */
    mount(container) {
        this._container = container;
    }

    /**
     * 创建Canvas
     * @param {number} width
     * @param {number} height
     * @returns {HTMLCanvasElement}
     */
    createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');
        return canvas;
    }

    /**
     * 获取Canvas上下文
     * @returns {CanvasRenderingContext2D|null}
     */
    getContext() {
        return this._ctx;
    }

    /**
     * 清空Canvas
     */
    clearCanvas() {
        if (this._ctx && this._canvas) {
            this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        }
    }

    /**
     * 创建卡片
     * @param {string} title
     * @param {string|HTMLElement|Array} content
     * @returns {HTMLElement}
     */
    createCard(title, content) {
        const card = createElement('div', { className: 'card' });
        const header = createElement('div', { className: 'card-header' });
        const titleEl = createElement('div', { className: 'card-title' }, title);
        header.appendChild(titleEl);
        card.appendChild(header);

        const body = createElement('div', { className: 'card-body' });
        if (typeof content === 'string') {
            body.textContent = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        } else if (Array.isArray(content)) {
            content.forEach(c => body.appendChild(c));
        }
        card.appendChild(body);

        return card;
    }

    /**
     * 创建统计项
     * @param {string} label
     * @param {string} value
     * @param {string} colorClass
     * @returns {HTMLElement}
     */
    createStatItem(label, value, colorClass = '') {
        const item = createElement('div', { className: 'stat-item' });
        const valEl = createElement('div', { className: `stat-value ${colorClass}` }, String(value));
        const lblEl = createElement('div', { className: 'stat-label' }, label);
        item.appendChild(valEl);
        item.appendChild(lblEl);
        return item;
    }

    /**
     * 创建算法标签组
     * @param {Array} algorithms - [{id, name}]
     * @param {string} activeId
     * @param {Function} onChange
     * @returns {HTMLElement}
     */
    createAlgorithmTabs(algorithms, activeId, onChange) {
        const tabs = createElement('div', { className: 'algorithm-tabs' });

        algorithms.forEach(algo => {
            const tab = createElement('button', {
                className: `algorithm-tab ${algo.id === activeId ? 'active' : ''}`,
                onClick: () => {
                    if (algo.id !== activeId) {
                        onChange(algo.id);
                    }
                }
            }, algo.name);
            tabs.appendChild(tab);
        });

        return tabs;
    }

    /**
     * 创建引用序列显示
     * @param {Array} refs - 引用序列
     * @param {number} activeIndex - 当前活跃索引
     * @param {Object} statusMap - { index: 'fault'|'hit' }
     * @returns {HTMLElement}
     */
    createRefString(refs, activeIndex = -1, statusMap = {}) {
        const container = createElement('div', { className: 'ref-string' });

        refs.forEach((ref, index) => {
            let className = 'ref-item';
            if (index === activeIndex) {
                className += ' active';
            }
            if (statusMap[index]) {
                className += ` ${statusMap[index]}`;
            }
            const item = createElement('div', { className }, String(ref));
            container.appendChild(item);
        });

        return container;
    }

    /**
     * 清空容器
     */
    clear() {
        if (this._container) {
            emptyElement(this._container);
        }
    }

    /**
     * 销毁
     */
    destroy() {
        this._container = null;
        this._canvas = null;
        this._ctx = null;
    }
}
