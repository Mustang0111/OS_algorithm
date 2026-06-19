/* ============================================
   格式化工具函数
   ============================================ */

/**
 * 格式化百分比
 * @param {number} value
 * @param {number} decimals
 * @returns {string}
 */
export function formatPercent(value, decimals = 1) {
    if (typeof value !== 'number' || isNaN(value)) return '0%';
    return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 格式化数字
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
    if (typeof value !== 'number' || isNaN(value)) return '0';
    return value.toLocaleString();
}

/**
 * 格式化数组为字符串
 * @param {Array} arr
 * @param {string} separator
 * @returns {string}
 */
export function formatArray(arr, separator = ', ') {
    if (!Array.isArray(arr)) return '';
    return arr.map(v => v === null || v === undefined ? '□' : v).join(separator);
}

/**
 * 格式化步骤信息
 * @param {number} current
 * @param {number} total
 * @returns {string}
 */
export function formatStep(current, total) {
    return `步骤: ${current} / ${total}`;
}

/**
 * 截断字符串
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen = 50) {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + '...';
}

/**
 * 安全获取对象属性
 * @param {Object} obj
 * @param {string} path
 * @param {*} defaultValue
 * @returns {*}
 */
export function get(obj, path, defaultValue = undefined) {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result === null || result === undefined) {
            return defaultValue;
        }
        result = result[key];
    }
    return result !== undefined ? result : defaultValue;
}
