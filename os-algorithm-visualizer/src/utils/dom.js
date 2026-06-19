/* ============================================
   DOM 工具函数
   ============================================ */

/**
 * 创建DOM元素
 * @param {string} tag - 标签名
 * @param {Object} attrs - 属性对象
 * @param {string|HTMLElement|Array} children - 子元素
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = null) {
    const el = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('data')) {
            el.dataset[key.slice(4).toLowerCase()] = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, value);
        }
    }

    if (children !== null) {
        appendChildren(el, children);
    }

    return el;
}

/**
 * 追加子元素
 * @param {HTMLElement} parent
 * @param {string|HTMLElement|Array} children
 */
export function appendChildren(parent, children) {
    if (typeof children === 'string') {
        parent.textContent = children;
    } else if (children instanceof HTMLElement) {
        parent.appendChild(children);
    } else if (Array.isArray(children)) {
        children.forEach(child => {
            if (typeof child === 'string') {
                parent.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
                parent.appendChild(child);
            }
        });
    }
}

/**
 * 清空元素内容
 * @param {HTMLElement} el
 */
export function emptyElement(el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}

/**
 * 获取元素或抛出错误
 * @param {string} id
 * @returns {HTMLElement}
 */
export function getElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Element #${id} not found`);
    }
    return el;
}

/**
 * 切换类
 * @param {HTMLElement} el
 * @param {string} className
 * @param {boolean} force
 */
export function toggleClass(el, className, force) {
    if (force !== undefined) {
        el.classList.toggle(className, force);
    } else {
        el.classList.toggle(className);
    }
}

/**
 * 安全添加事件监听
 * @param {HTMLElement|Window} el
 * @param {string} event
 * @param {Function} handler
 * @param {Object} options
 * @returns {Function} 清理函数
 */
export function addEventListener(el, event, handler, options = {}) {
    el.addEventListener(event, handler, options);
    return () => el.removeEventListener(event, handler, options);
}

/**
 * 创建SVG元素
 * @param {string} svgString - SVG字符串
 * @returns {SVGElement}
 */
export function createSVG(svgString) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = svgString;
    return wrapper.firstElementChild;
}
