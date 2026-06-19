/* ============================================
   磁盘调度 - 寻道轨迹图Canvas渲染器
   绘制折线图：横轴为访问步骤，纵轴为磁道号
   展示不同算法的寻道轨迹形态
   支持边界步骤（方向转折/到达边界）特殊标记
   ============================================ */

export class DiskCanvasRenderer {
    constructor() {
        this._canvas = null;
        this._ctx = null;
        this._width = 0;
        this._height = 0;
        this._resizeObserver = null;
    }

    /**
     * 挂载Canvas
     * @param {HTMLCanvasElement} canvas
     */
    mount(canvas) {
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');

        // 使用 ResizeObserver 监听尺寸变化
        this._resizeObserver = new ResizeObserver(() => {
            this._resize();
        });
        this._resizeObserver.observe(canvas);

        // 初始调整尺寸
        requestAnimationFrame(() => this._resize());
    }

    /**
     * 调整Canvas尺寸
     */
    _resize() {
        if (!this._canvas) return;
        const rect = this._canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const dpr = window.devicePixelRatio || 1;
        this._canvas.width = rect.width * dpr;
        this._canvas.height = rect.height * dpr;
        this._ctx.scale(dpr, dpr);
        this._canvas.style.width = rect.width + 'px';
        this._canvas.style.height = rect.height + 'px';
        this._width = rect.width;
        this._height = rect.height;
    }

    /**
     * 渲染寻道轨迹图
     * @param {Object} state - 模拟器状态
     */
    render(state) {
        if (!this._ctx || !this._canvas) return;

        this._resize();
        const ctx = this._ctx;
        const w = this._width;
        const h = this._height;

        // 清空
        ctx.clearRect(0, 0, w, h);

        const padding = { top: 24, bottom: 28, left: 48, right: 24 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        if (plotW < 20 || plotH < 20) return;

        const minTrack = state.minTrack ?? 0;
        const maxTrack = state.maxTrack ?? 199;
        const trackRange = maxTrack - minTrack || 1;

        // 服务顺序（含初始磁头位置）
        const serviceOrder = state.serviceOrder || [];
        const initialHead = state.initialHead ?? 0;
        const allPoints = [initialHead, ...serviceOrder];
        const totalSteps = allPoints.length - 1; // 线段数

        // 边界步骤标记（从 state 中获取）
        const boundarySteps = state.boundarySteps || [];

        // 映射函数
        const mapX = (step) => padding.left + (step / Math.max(totalSteps, 1)) * plotW;
        const mapY = (track) => padding.top + plotH - ((track - minTrack) / trackRange) * plotH;

        // --- 绘制网格 ---
        this._drawGrid(ctx, padding, plotW, plotH, minTrack, maxTrack, totalSteps);

        // --- 绘制坐标轴标签 ---
        this._drawAxisLabels(ctx, padding, plotW, plotH, minTrack, maxTrack, totalSteps);

        // --- 绘制轨迹折线 ---
        if (allPoints.length >= 2) {
            this._drawTrajectory(ctx, allPoints, mapX, mapY, totalSteps, boundarySteps);
        }

        // --- 绘制数据点 ---
        this._drawPoints(ctx, allPoints, mapX, mapY, totalSteps, serviceOrder.length, boundarySteps);

        // --- 绘制图例 ---
        this._drawLegend(ctx, w, padding);
    }

    /**
     * 绘制网格
     */
    _drawGrid(ctx, padding, plotW, plotH, minTrack, maxTrack, totalSteps) {
        const trackRange = maxTrack - minTrack || 1;

        // 水平网格线（磁道刻度）
        const hLines = 5;
        ctx.strokeStyle = 'rgba(43, 47, 58, 0.5)';
        ctx.lineWidth = 1;

        for (let i = 0; i <= hLines; i++) {
            const track = minTrack + (i / hLines) * trackRange;
            const y = padding.top + plotH - ((track - minTrack) / trackRange) * plotH;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotW, y);
            ctx.stroke();
        }

        // 垂直网格线（步骤刻度）
        if (totalSteps > 0) {
            const vLines = Math.min(totalSteps, 10);
            ctx.strokeStyle = 'rgba(43, 47, 58, 0.3)';
            for (let i = 0; i <= vLines; i++) {
                const step = Math.round((i / vLines) * totalSteps);
                const x = padding.left + (step / totalSteps) * plotW;
                ctx.beginPath();
                ctx.moveTo(x, padding.top);
                ctx.lineTo(x, padding.top + plotH);
                ctx.stroke();
            }
        }
    }

    /**
     * 绘制坐标轴标签
     */
    _drawAxisLabels(ctx, padding, plotW, plotH, minTrack, maxTrack, totalSteps) {
        const trackRange = maxTrack - minTrack || 1;

        ctx.fillStyle = '#6b7280';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Y轴标签（磁道号）
        const hLines = 5;
        for (let i = 0; i <= hLines; i++) {
            const track = Math.round(minTrack + (i / hLines) * trackRange);
            const y = padding.top + plotH - ((track - minTrack) / trackRange) * plotH;
            ctx.fillText(String(track), padding.left - 8, y);
        }

        // X轴标签（步骤）
        if (totalSteps > 0) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const vLines = Math.min(totalSteps, 10);
            for (let i = 0; i <= vLines; i++) {
                const step = Math.round((i / vLines) * totalSteps);
                const x = padding.left + (step / totalSteps) * plotW;
                ctx.fillText(String(step), x, padding.top + plotH + 6);
            }
        }

        // 轴标题
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('访问步骤 →', padding.left + plotW / 2, padding.top + plotH + 18);

        ctx.save();
        ctx.translate(12, padding.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('磁道号', 0, 0);
        ctx.restore();
    }

    /**
     * 绘制轨迹折线
     * 边界步骤用虚线/不同颜色区分
     */
    _drawTrajectory(ctx, allPoints, mapX, mapY, totalSteps, boundarySteps) {
        // 渐变填充区域
        const gradient = ctx.createLinearGradient(0, 0, 0, this._height);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.12)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

        // 绘制填充区域
        ctx.beginPath();
        ctx.moveTo(mapX(0), mapY(allPoints[0]));
        for (let i = 1; i < allPoints.length; i++) {
            ctx.lineTo(mapX(i), mapY(allPoints[i]));
        }
        ctx.lineTo(mapX(totalSteps), this._height);
        ctx.lineTo(mapX(0), this._height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // 逐段绘制折线，边界步骤用虚线
        for (let i = 1; i < allPoints.length; i++) {
            const isBoundary = boundarySteps.includes(i);

            ctx.beginPath();
            ctx.moveTo(mapX(i - 1), mapY(allPoints[i - 1]));
            ctx.lineTo(mapX(i), mapY(allPoints[i]));

            if (isBoundary) {
                // 边界步骤：虚线 + 紫色
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
            } else {
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
            }
            ctx.stroke();
        }

        // 重置虚线
        ctx.setLineDash([]);

        // 当前线段高亮（最后一段）
        if (allPoints.length >= 2) {
            const last = allPoints.length - 1;
            const isLastBoundary = boundarySteps.includes(last);

            ctx.beginPath();
            ctx.moveTo(mapX(last - 1), mapY(allPoints[last - 1]));
            ctx.lineTo(mapX(last), mapY(allPoints[last]));

            if (isLastBoundary) {
                ctx.strokeStyle = '#c084fc';
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 4]);
            } else {
                ctx.strokeStyle = '#60a5fa';
                ctx.lineWidth = 3;
                ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
                ctx.shadowBlur = 6;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.setLineDash([]);
        }
    }

    /**
     * 绘制数据点
     * 边界步骤用紫色菱形标记
     */
    _drawPoints(ctx, allPoints, mapX, mapY, totalSteps, completedCount, boundarySteps) {
        for (let i = 0; i < allPoints.length; i++) {
            const x = mapX(i);
            const y = mapY(allPoints[i]);
            const isCurrent = (i === allPoints.length - 1) && completedCount > 0;
            const isStart = i === 0;
            const isBoundary = boundarySteps.includes(i);

            let color, radius, borderColor;

            if (isStart) {
                // 起点（磁头初始位置）
                color = '#9ca3af';
                radius = 4;
                borderColor = null;
            } else if (isBoundary) {
                // 边界步骤：紫色菱形
                color = '#a855f7';
                radius = 5;
                borderColor = '#ffffff';
            } else if (isCurrent) {
                // 当前访问点
                color = '#3b82f6';
                radius = 6;
                borderColor = '#ffffff';
            } else {
                // 历史访问点
                color = '#22c55e';
                radius = 3;
                borderColor = null;
            }

            if (isBoundary) {
                // 绘制菱形
                ctx.beginPath();
                ctx.moveTo(x, y - radius);
                ctx.lineTo(x + radius, y);
                ctx.lineTo(x, y + radius);
                ctx.lineTo(x - radius, y);
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
                if (borderColor) {
                    ctx.strokeStyle = borderColor;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            } else {
                // 绘制圆点
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();

                if (borderColor) {
                    ctx.strokeStyle = borderColor;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            // 标签（磁道号）
            if (isCurrent || isStart || isBoundary) {
                ctx.fillStyle = isBoundary ? '#a855f7' : (isCurrent ? '#3b82f6' : '#9ca3af');
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(String(allPoints[i]), x, y - radius - 4);
            } else if (i % 2 === 0 || i === allPoints.length - 1) {
                // 隔一个显示一个，避免拥挤
                ctx.fillStyle = '#6b7280';
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(String(allPoints[i]), x, y + radius + 3);
            }
        }
    }

    /**
     * 绘制图例
     */
    _drawLegend(ctx, w, padding) {
        const x = w - 180;
        const y = 6;
        const gap = 14;

        ctx.font = '10px monospace';

        const items = [
            { color: '#3b82f6', label: '当前访问', radius: 4, shape: 'circle' },
            { color: '#22c55e', label: '已完成', radius: 3, shape: 'circle' },
            { color: '#a855f7', label: '边界/转折', radius: 4, shape: 'diamond' },
            { color: '#9ca3af', label: '磁头起点', radius: 3, shape: 'circle' }
        ];

        items.forEach((item, i) => {
            const ly = y + i * gap;
            if (item.shape === 'diamond') {
                ctx.beginPath();
                ctx.moveTo(x, ly - item.radius);
                ctx.lineTo(x + item.radius, ly);
                ctx.lineTo(x, ly + item.radius);
                ctx.lineTo(x - item.radius, ly);
                ctx.closePath();
                ctx.fillStyle = item.color;
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(x, ly, item.radius, 0, Math.PI * 2);
                ctx.fillStyle = item.color;
                ctx.fill();
            }
            ctx.fillStyle = '#9ca3af';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.label, x + 10, ly);
        });
    }

    /**
     * 销毁
     */
    destroy() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        this._canvas = null;
        this._ctx = null;
    }
}
