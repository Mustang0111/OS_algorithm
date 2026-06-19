/* ============================================
   顶部工具栏组件
   使用HTML中已有的DOM结构
   ============================================ */

export class Toolbar {
    constructor() {
        this._element = null;
    }

    /**
     * 渲染工具栏 - 使用HTML已有结构
     * @param {HTMLElement} container
     */
    render(container) {
        // HTML中已有完整结构，直接引用
        this._element = container;
    }
}
