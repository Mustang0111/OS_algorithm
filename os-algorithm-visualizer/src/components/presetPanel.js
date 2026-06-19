/* ============================================
   预设案例面板组件
   提供经典案例快速加载
   ============================================ */

import { createElement, emptyElement } from '../utils/dom.js';
import { stateManager } from '../core/stateManager.js';
import { scheduler } from '../core/scheduler.js';
import { PRESETS } from '../presets/index.js';

export class PresetPanel {
    constructor() {
        this._element = null;
        this._overlay = null;
        this._isOpen = false;
        this._cleanups = [];
    }

    /**
     * 渲染预设面板 - 使用HTML已有DOM结构
     * @param {HTMLElement} container - #preset-overlay 元素
     */
    render(container) {
        this._overlay = container;
        // HTML中使用 class="preset-panel"，用 querySelector 查找
        this._element = container.querySelector('.preset-panel');
        this._contentEl = document.getElementById('preset-list');
        this._closeBtn = document.getElementById('presetCloseBtn');

        if (!this._element || !this._contentEl) {
            console.warn('[PresetPanel] HTML DOM elements not found, creating dynamically');
            this._createDynamic(container);
        }

        // 绑定关闭按钮
        if (this._closeBtn) {
            this._closeBtn.addEventListener('click', () => this.close());
        }

        // 点击遮罩关闭
        if (this._overlay) {
            this._overlay.addEventListener('click', (e) => {
                if (e.target === this._overlay) this.close();
            });
        }

        // 订阅事件
        this._cleanups.push(
            stateManager.on('preset:open', () => this.open())
        );
    }

    /**
     * 动态创建预设面板（当HTML中不存在时）
     * @param {HTMLElement} container
     */
    _createDynamic(container) {
        // 面板（直接创建在 container 内，container 本身作为遮罩）
        this._element = createElement('div', { className: 'preset-panel hidden' });

        // 头部
        const header = createElement('div', { className: 'preset-header' });
        header.appendChild(createElement('div', { className: 'preset-title' }, '预设案例'));
        const closeBtn = createElement('button', {
            className: 'preset-close',
            onClick: () => this.close()
        });
        closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>`;
        header.appendChild(closeBtn);
        this._element.appendChild(header);

        // 内容区
        this._contentEl = createElement('div', { className: 'preset-content' });
        this._element.appendChild(this._contentEl);

        container.appendChild(this._element);
    }

    /**
     * 打开面板
     */
    open() {
        if (this._isOpen) return;
        this._isOpen = true;
        // 移除遮罩和面板的 hidden 类
        this._overlay.classList.remove('hidden');
        if (this._element) {
            this._element.classList.remove('hidden');
        }
        this._renderPresets();
    }

    /**
     * 关闭面板
     */
    close() {
        if (!this._isOpen) return;
        this._isOpen = false;
        this._overlay.classList.add('hidden');
        if (this._element) {
            this._element.classList.add('hidden');
        }
    }

    /**
     * 渲染预设列表
     */
    _renderPresets() {
        emptyElement(this._contentEl);

        const currentId = scheduler.getCurrentModuleId();
        const modulePresets = PRESETS[currentId];

        if (!modulePresets || modulePresets.length === 0) {
            this._contentEl.appendChild(
                createElement('div', { className: 'preset-empty' }, '当前模块暂无预设案例')
            );
            return;
        }

        modulePresets.forEach(preset => {
            const card = createElement('div', {
                className: 'preset-item',
                onClick: () => this._applyPreset(preset)
            });

            const name = createElement('div', { className: 'preset-item-title' }, preset.name);
            card.appendChild(name);

            if (preset.description) {
                const desc = createElement('div', { className: 'preset-item-desc' }, preset.description);
                card.appendChild(desc);
            }

            if (preset.tags) {
                const tags = createElement('div', { className: 'preset-item-tags' });
                preset.tags.forEach(tag => {
                    tags.appendChild(createElement('span', { className: 'preset-tag' }, tag));
                });
                card.appendChild(tags);
            }

            this._contentEl.appendChild(card);
        });
    }

    /**
     * 应用预设
     * @param {Object} preset
     */
    _applyPreset(preset) {
        console.log('[PresetPanel] _applyPreset called with:', preset);
        const module = scheduler.getCurrentModule();
        console.log('[PresetPanel] current module:', module);
        if (!module) {
            console.warn('[PresetPanel] No current module, cannot apply preset');
            return;
        }

        // 直接调用当前模块 renderer 的 _applyPreset 方法
        // 同时通过事件机制通知（兼容两种方式）
        if (module.renderer && typeof module.renderer._applyPreset === 'function') {
            const presetId = preset.id || preset.name;
            console.log('[PresetPanel] Directly calling renderer._applyPreset with:', presetId);
            module.renderer._applyPreset(presetId);
        } else {
            // 降级：通过 stateManager 发送预设选择事件
            const presetId = preset.id || preset.name;
            console.log('[PresetPanel] Emitting preset:select with:', presetId);
            stateManager.emit('preset:select', presetId);
        }

        this.close();
    }

    /**
     * 销毁
     */
    destroy() {
        this._cleanups.forEach(fn => fn());
        this._cleanups = [];
    }
}
