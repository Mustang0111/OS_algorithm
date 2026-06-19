/* ============================================
   左侧导航栏组件
   使用HTML中已有的DOM结构
   ============================================ */

import { MODULE_NAMES } from '../utils/constants.js';

export class Sidebar {
    constructor() {
        this._element = null;
        this._activeId = null;
    }

    /**
     * 渲染侧边栏 - 使用HTML已有结构
     * @param {HTMLElement} container
     */
    render(container) {
        this._element = container;
    }

    /**
     * 激活指定项
     * @param {string} id
     */
    setActive(id) {
        if (this._activeId === id) return;
        this._activeId = id;

        const items = this._element?.querySelectorAll('.sidebar-item');
        items?.forEach(item => {
            item.classList.toggle('active', item.dataset.module === id);
        });
    }
}
