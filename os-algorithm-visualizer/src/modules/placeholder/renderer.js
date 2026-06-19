/* ============================================
   占位渲染器 - 用于未实现的模块
   显示"正在开发中"提示
   ============================================ */

import { Renderer } from '../../core/renderer.js';
import { createElement } from '../../utils/dom.js';

export class PlaceholderRenderer extends Renderer {
    constructor(simulator) {
        super();
        this._simulator = simulator;
    }

    /**
     * 渲染占位界面
     * @param {HTMLElement} container
     */
    render(container) {
        this.mount(container);
        this.clear();

        const wrapper = createElement('div', { className: 'placeholder-module' });

        // 图标
        const icon = createElement('div', { className: 'placeholder-icon' });
        icon.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
        `;
        wrapper.appendChild(icon);

        // 标题
        const title = createElement('div', { className: 'placeholder-title' }, '模块开发中');
        wrapper.appendChild(title);

        // 描述
        const desc = createElement('div', { className: 'placeholder-desc' }, '该算法模块正在开发中，敬请期待...');
        wrapper.appendChild(desc);

        // 模块列表
        const moduleList = createElement('div', { className: 'placeholder-modules' });
        const modules = [
            { name: 'CPU调度算法', status: '开发中' },
            { name: '银行家算法', status: '开发中' },
            { name: '磁盘调度算法', status: '开发中' },
            { name: '生产者消费者问题', status: '开发中' }
        ];
        modules.forEach(m => {
            const item = createElement('div', { className: 'placeholder-module-item' });
            const nameEl = createElement('span', { className: 'placeholder-module-name' }, m.name);
            const statusEl = createElement('span', { className: 'placeholder-module-status' }, m.status);
            item.appendChild(nameEl);
            item.appendChild(statusEl);
            moduleList.appendChild(item);
        });
        wrapper.appendChild(moduleList);

        container.appendChild(wrapper);
    }

    destroy() {
        super.destroy();
    }
}
