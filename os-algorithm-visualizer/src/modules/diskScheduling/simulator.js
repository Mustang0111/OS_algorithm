/* ============================================
    磁盘调度模拟器
    支持 FCFS / SSTF / SCAN / C-SCAN / LOOK / C-LOOK
    采用快照回放策略 + 待处理步骤队列
    ============================================ */

import { Simulator } from '../../core/simulator.js';

export class DiskSchedulingSimulator extends Simulator {
    constructor() {
        super();
        this.moduleName = 'diskScheduling';
        this.algorithmName = 'FCFS';

        // 内部运行状态
        this._requests = [];
        this._headPosition = 0;
        this._initialHead = 0;
        this._minTrack = 0;
        this._maxTrack = 199;
        this._direction = 'right';
        this._remainingRequests = [];
        this._serviceOrder = [];
        this._totalSeekLength = 0;
        this._completedCount = 0;
        this._currentRequest = null;
        this._seekStart = null;
        this._seekEnd = null;
        this._seekDistance = 0;
        // 边界步骤索引（用于Canvas标记方向转折/到达边界）
        this._boundarySteps = [];
        // 待处理步骤队列：用于 SCAN/C-SCAN/C-LOOK 插入边界点
        this._pendingSteps = [];
    }

    /**
     * 获取初始状态
     * @returns {Object}
     */
    _getInitialState() {
        return {
            algorithm: 'FCFS',
            requests: [],
            headPosition: 0,
            initialHead: 0,
            minTrack: 0,
            maxTrack: 199,
            direction: 'right',
            remainingRequests: [],
            serviceOrder: [],
            totalSeekLength: 0,
            completedCount: 0,
            currentRequest: null,
            seekStart: null,
            seekEnd: null,
            seekDistance: 0,
            isComplete: false,
            explanation: '',
            boundarySteps: [],
            pendingSteps: []
        };
    }

    /**
     * 应用配置
     * @param {Object} config
     */
    _applyConfig(config) {
        this._requests = [...(config.requests || [])];
        this._headPosition = config.headPosition ?? 53;
        this._initialHead = config.headPosition ?? 53;
        this._minTrack = config.minTrack ?? 0;
        this._maxTrack = config.maxTrack ?? 199;
        this._direction = config.direction || 'right';
        // 标准化算法名：预设可能传 'scan'/'cscan'，统一转为 'SCAN'/'C-SCAN'
        this.algorithmName = this._normalizeAlgorithm(config.algorithm || 'FCFS');
        this._remainingRequests = [...this._requests];
        this._serviceOrder = [];
        this._totalSeekLength = 0;
        this._completedCount = 0;
        this._currentRequest = null;
        this._seekStart = null;
        this._seekEnd = null;
        this._seekDistance = 0;
        this._pendingSteps = [];

        // 对于 SCAN/C-SCAN/C-LOOK，总步骤数 = 请求数 + 额外边界步骤
        this.totalSteps = this._estimateTotalSteps();

        // 更新 _state
        this._state.algorithm = this.algorithmName;
        this._state.requests = [...this._requests];
        this._state.headPosition = this._headPosition;
        this._state.initialHead = this._initialHead;
        this._state.minTrack = this._minTrack;
        this._state.maxTrack = this._maxTrack;
        this._state.direction = this._direction;
        this._state.remainingRequests = [...this._remainingRequests];
        this._state.serviceOrder = [];
        this._state.totalSeekLength = 0;
        this._state.completedCount = 0;
        this._state.currentRequest = null;
        this._state.seekStart = null;
        this._state.seekEnd = null;
        this._state.seekDistance = 0;
        this._state.isComplete = false;
        this._state.explanation = '初始化完成，等待开始...';
        this._state.pendingSteps = [];
    }

    /**
     * 估算总步骤数（含边界点）
     * 用于进度显示
     */
    _estimateTotalSteps() {
        const n = this._requests.length;
        switch (this.algorithmName) {
            case 'SCAN':
                // 最多多2步（两个边界点）
                return n + 2;
            case 'C-SCAN':
                // 多2步（两个边界点）
                return n + 2;
            case 'C-LOOK':
                // 多1步（一次大跳）
                return n + 1;
            default:
                return n;
        }
    }

    /**
     * 执行一步磁盘调度
     * @returns {boolean} 是否还有下一步
     */
    step() {
        if (!this.isInitialized) return false;
        if (this.isComplete) return false;

        // 回放模式：从历史快照恢复并前进
        if (this.currentStep < this.history.length - 1) {
            this.currentStep++;
            if (this.history[this.currentStep]) {
                this._state = JSON.parse(JSON.stringify(this.history[this.currentStep]));
                // 同步内部状态
                this._syncFromState();
            }
            this._notifyUpdate();
            return this.currentStep < this.totalSteps;
        }

        // 检查是否还有剩余请求或待处理步骤
        if (this._remainingRequests.length === 0 && this._pendingSteps.length === 0) {
            this.isComplete = true;
            this._state.isComplete = true;
            this._state.explanation = '所有磁盘请求已处理完毕。';
            this._notifyUpdate();
            return false;
        }

        // 根据算法选择下一个请求
        const selected = this._selectNext();
        if (!selected) {
            this.isComplete = true;
            this._state.isComplete = true;
            this._state.explanation = '所有磁盘请求已处理完毕。';
            this._notifyUpdate();
            return false;
        }

        const { request, seekDistance, isBoundary } = selected;

        // 更新状态
        this._seekStart = this._headPosition;
        this._seekEnd = request;
        // 距离统一在 step() 中实时计算，确保与 serviceOrder 完全一致
        this._seekDistance = Math.abs(request - this._seekStart);
        this._totalSeekLength += this._seekDistance;
        this._headPosition = request;
        this._currentRequest = request;

        // 从剩余请求中移除（仅当是真实请求时）
        // 只有真实请求才递增 completedCount，边界点（isBoundary）不计数
        const idx = this._remainingRequests.indexOf(request);
        if (idx !== -1) {
            this._remainingRequests.splice(idx, 1);
            this._completedCount++;
        }
        this._serviceOrder.push(request);

        // 更新 _state
        this._syncToState();

        // 生成解释文本（使用 step() 中实时计算的 this._seekDistance）
        this._state.explanation = this._generateExplanation(request, this._seekDistance, isBoundary);

        // 保存快照
        this._saveSnapshot();

        // 检查是否完成
        if (this._remainingRequests.length === 0 && this._pendingSteps.length === 0) {
            this.isComplete = true;
            this._state.isComplete = true;
            this._state.explanation = '所有磁盘请求已处理完毕。';
        }

        this._notifyUpdate();
        return this._remainingRequests.length > 0 || this._pendingSteps.length > 0;
    }

    /**
     * 根据算法选择下一个请求
     * @returns {{ request: number, seekDistance: number, isBoundary?: boolean } | null}
     */
    _selectNext() {
        // 优先处理待处理步骤队列
        if (this._pendingSteps.length > 0) {
            return this._pendingSteps.shift();
        }

        switch (this.algorithmName) {
            case 'FCFS': return this._selectFCFS();
            case 'SSTF': return this._selectSSTF();
            case 'SCAN': return this._selectSCAN();
            case 'C-SCAN': return this._selectCSCAN();
            case 'LOOK': return this._selectLOOK();
            case 'C-LOOK': return this._selectCLOOK();
            default: return this._selectFCFS();
        }
    }

    /**
     * FCFS：按请求到达顺序服务
     */
    _selectFCFS() {
        const request = this._remainingRequests[0];
        const seekDistance = Math.abs(request - this._headPosition);
        return { request, seekDistance, isBoundary: false };
    }

    /**
     * SSTF：优先服务距离最近的请求
     */
    _selectSSTF() {
        let minDist = Infinity;
        let selected = null;

        for (const req of this._remainingRequests) {
            const dist = Math.abs(req - this._headPosition);
            if (dist < minDist) {
                minDist = dist;
                selected = req;
            }
        }

        return { request: selected, seekDistance: minDist, isBoundary: false };
    }

    /**
     * SCAN：电梯算法
     * 向右时扫描到 maxTrack 边界后反向，向左时扫描到 minTrack 边界后反向
     */
    _selectSCAN() {
        const direction = this._direction;
        const sorted = [...this._remainingRequests].sort((a, b) => a - b);

        // 如果没有剩余请求，直接返回 null
        if (sorted.length === 0) return null;

        // 基于当前磁头位置分割请求（不依赖pivot索引，避免已服务请求不在_remainingRequests中的问题）
        const rightReqs = sorted.filter(r => r >= this._headPosition);
        const leftReqs = sorted.filter(r => r < this._headPosition).reverse();

        if (direction === 'right') {

            // 向右：选择大于等于当前位置的最小请求
            if (rightReqs.length > 0) {
                const request = rightReqs[0];
                const seekDistance = Math.abs(request - this._headPosition);
                return { request, seekDistance, isBoundary: false };
            } else {
                // 没有右侧请求：先到右边界 maxTrack，再反向向左
                const distToBoundary = this._maxTrack - this._headPosition;
                if (distToBoundary > 0) {
                    // 插入边界点作为待处理步骤
                    this._direction = 'left';
                    // 将左侧请求按从大到小顺序放入待处理队列
                    for (const req of leftReqs) {
                        this._pendingSteps.push({ request: req, seekDistance: 0, isBoundary: false });
                    }
                    // 返回边界点步骤
                    return { request: this._maxTrack, seekDistance: distToBoundary, isBoundary: true };
                } else {
                    // 已经在边界，直接反向
                    this._direction = 'left';
                    if (leftReqs.length > 0) {
                        const request = leftReqs[0];
                        const seekDistance = Math.abs(request - this._headPosition);
                        return { request, seekDistance, isBoundary: false };
                    }
                }
            }
        } else {
            // 向左：选择小于等于当前位置的最大请求
            if (leftReqs.length > 0) {
                const request = leftReqs[0];
                const seekDistance = Math.abs(request - this._headPosition);
                return { request, seekDistance, isBoundary: false };
            } else {
                // 没有左侧请求：先到左边界 minTrack，再反向向右
                const distToBoundary = this._headPosition - this._minTrack;
                if (distToBoundary > 0) {
                    // 插入边界点作为待处理步骤
                    this._direction = 'right';
                    // 将右侧请求按从小到大顺序放入待处理队列
                    for (const req of rightReqs) {
                        this._pendingSteps.push({ request: req, seekDistance: 0, isBoundary: false });
                    }
                    // 返回边界点步骤
                    return { request: this._minTrack, seekDistance: distToBoundary, isBoundary: true };
                } else {
                    // 已经在边界，直接反向
                    this._direction = 'right';
                    if (rightReqs.length > 0) {
                        const request = rightReqs[0];
                        const seekDistance = Math.abs(request - this._headPosition);
                        return { request, seekDistance, isBoundary: false };
                    }
                }
            }
        }

        return null;
    }

    /**
     * C-SCAN：单向扫描到边界后回到另一边界继续
     * 向右：扫描右侧请求 → 到 maxTrack → 跳转到 minTrack → 扫描左侧请求
     * 向左：扫描左侧请求 → 到 minTrack → 跳转到 maxTrack → 扫描右侧请求
     */
    _selectCSCAN() {
        const sorted = [...this._remainingRequests].sort((a, b) => a - b);

        // 基于当前磁头位置分割请求（不依赖pivot索引）
        const rightReqs = sorted.filter(r => r >= this._headPosition);
        const leftReqs = sorted.filter(r => r < this._headPosition);

        if (this._direction === 'right') {
            // 向右：选择大于等于当前位置的最小请求
            if (rightReqs.length > 0) {
                const request = rightReqs[0];
                const seekDistance = Math.abs(request - this._headPosition);
                return { request, seekDistance, isBoundary: false };
            }

            // 没有右侧请求：到 maxTrack → 跳转到 minTrack → 处理左侧请求
            if (sorted.length > 0) {
                const distToMax = this._maxTrack - this._headPosition;

                // 将左侧请求按从小到大放入待处理队列
                for (const req of leftReqs) {
                    this._pendingSteps.push({ request: req, seekDistance: 0, isBoundary: false });
                }

                // 在左侧请求之前插入 minTrack 跳转步骤
                // 路径: head → maxTrack → minTrack → leftReq1 → leftReq2 → ...
                // 先插入 minTrack 跳转（距离 = maxTrack - minTrack）
                this._pendingSteps.unshift({
                    request: this._minTrack,
                    seekDistance: this._maxTrack - this._minTrack,
                    isBoundary: true
                });

                // 第一步：到 maxTrack
                return { request: this._maxTrack, seekDistance: distToMax, isBoundary: true };
            }
        } else {
            // 向左：选择小于等于当前位置的最大请求
            const leftReqsRev = [...leftReqs].reverse();
            if (leftReqsRev.length > 0) {
                const request = leftReqsRev[0];
                const seekDistance = Math.abs(request - this._headPosition);
                return { request, seekDistance, isBoundary: false };
            }

            // 没有左侧请求：到 minTrack → 跳转到 maxTrack → 处理右侧请求
            if (sorted.length > 0) {
                const distToMin = this._headPosition - this._minTrack;

                // 将右侧请求按从大到小放入待处理队列
                const rightReqsRev = [...rightReqs].reverse();
                for (const req of rightReqsRev) {
                    this._pendingSteps.push({ request: req, seekDistance: 0, isBoundary: false });
                }

                // 在右侧请求之前插入 maxTrack 跳转步骤
                // 路径: head → minTrack → maxTrack → rightReq1 → rightReq2 → ...
                this._pendingSteps.unshift({
                    request: this._maxTrack,
                    seekDistance: this._maxTrack - this._minTrack,
                    isBoundary: true
                });

                // 第一步：到 minTrack
                return { request: this._minTrack, seekDistance: distToMin, isBoundary: true };
            }
        }

        return null;
    }


    /**
     * LOOK：同SCAN但不到边界，只到最远请求位置
     */
    _selectLOOK() {
        const direction = this._direction;
        const sorted = [...this._remainingRequests].sort((a, b) => a - b);

        // 基于当前磁头位置分割请求（不依赖pivot索引）
        const rightReqs = sorted.filter(r => r >= this._headPosition);
        const leftReqs = sorted.filter(r => r < this._headPosition).reverse();

        if (direction === 'right') {
            if (rightReqs.length > 0) {
                const request = rightReqs[0];
                const seekDistance = Math.abs(request - this._headPosition);
                return { request, seekDistance, isBoundary: false };
            } else {
                // 没有右侧请求，反向向左
                this._direction = 'left';
                if (leftReqs.length > 0) {
                    const request = leftReqs[0];
                    const seekDistance = Math.abs(request - this._headPosition);
                    return { request, seekDistance, isBoundary: false };
                }
            }
        } else {
            if (leftReqs.length > 0) {
                const request = leftReqs[0];
                const seekDistance = Math.abs(request - this._headPosition);
                return { request, seekDistance, isBoundary: false };
            } else {
                // 没有左侧请求，反向向右
                this._direction = 'right';
                if (rightReqs.length > 0) {
                    const request = rightReqs[0];
                    const seekDistance = Math.abs(request - this._headPosition);
                    return { request, seekDistance, isBoundary: false };
                }
            }
        }

        return null;
    }

    /**
     * C-LOOK：同C-SCAN但只在请求范围内循环
     * 向右：扫描右侧请求 → 跳转到最小请求 → 扫描左侧请求
     * 向左：扫描左侧请求 → 跳转到最大请求 → 扫描右侧请求
     */
    _selectCLOOK() {
        const sorted = [...this._remainingRequests].sort((a, b) => a - b);

        // 基于当前磁头位置分割请求（不依赖pivot索引）
        const rightReqs = sorted.filter(r => r >= this._headPosition);
        const leftReqs = sorted.filter(r => r < this._headPosition);

        if (this._direction === 'right') {
            // 向右：选择大于等于当前位置的最小请求
            if (rightReqs.length > 0) {
                const request = rightReqs[0];
                const seekDistance = Math.abs(request - this._headPosition);
                return { request, seekDistance, isBoundary: false };
            }

            // 没有右侧请求：跳转到最小请求
            if (sorted.length > 0) {
                const maxReq = sorted[sorted.length - 1];
                const minReq = sorted[0];
                const jumpDist = maxReq - minReq;

                // 将左侧请求按从小到大放入待处理队列
                // 跳过 minReq，因为跳转步骤已经包含了它，避免重复访问
                for (const req of leftReqs) {
                    if (req === minReq) continue;
                    this._pendingSteps.push({ request: req, seekDistance: 0, isBoundary: false });
                }

                // 返回跳转步骤（从 maxReq 跳转到 minReq）
                // 注意：实际路径是 head → maxReq → minReq → leftReq
                // 但这里我们直接跳转到 minReq，距离 = maxReq - minReq
                return { request: minReq, seekDistance: jumpDist, isBoundary: true };
            }
        } else {
            // 向左：选择小于等于当前位置的最大请求
            const leftReqsRev = [...leftReqs].reverse();
            if (leftReqsRev.length > 0) {
                const request = leftReqsRev[0];
                const seekDistance = Math.abs(request - this._headPosition);
                return { request, seekDistance, isBoundary: false };
            }

            // 没有左侧请求：跳转到最大请求
            if (sorted.length > 0) {
                const maxReq = sorted[sorted.length - 1];
                const minReq = sorted[0];
                const jumpDist = maxReq - minReq;

                // 将右侧请求按从大到小放入待处理队列
                // 跳过 maxReq，因为跳转步骤已经包含了它，避免重复访问
                const rightReqsRev = [...rightReqs].reverse();
                for (const req of rightReqsRev) {
                    if (req === maxReq) continue;
                    this._pendingSteps.push({ request: req, seekDistance: 0, isBoundary: false });
                }

                // 返回跳转步骤（从 minReq 跳转到 maxReq）
                return { request: maxReq, seekDistance: jumpDist, isBoundary: true };
            }
        }

        return null;
    }

    /**
     * 从 _state 同步到内部变量（用于回放模式）
     */
    _syncFromState() {
        this._headPosition = this._state.headPosition;
        this._remainingRequests = [...(this._state.remainingRequests || [])];
        this._serviceOrder = [...(this._state.serviceOrder || [])];
        this._totalSeekLength = this._state.totalSeekLength || 0;
        this._completedCount = this._state.completedCount || 0;
        this._currentRequest = this._state.currentRequest;
        this._seekStart = this._state.seekStart;
        this._seekEnd = this._state.seekEnd;
        this._seekDistance = this._state.seekDistance || 0;
        this._direction = this._state.direction || 'right';
        this._boundarySteps = [...(this._state.boundarySteps || [])];
        this._pendingSteps = [...(this._state.pendingSteps || [])];
    }

    /**
     * 同步到 _state
     * 同时计算边界步骤（方向转折点、到达边界点）
     */
    _syncToState() {
        this._state.headPosition = this._headPosition;
        this._state.initialHead = this._initialHead;
        this._state.remainingRequests = [...this._remainingRequests];
        this._state.serviceOrder = [...this._serviceOrder];
        this._state.totalSeekLength = this._totalSeekLength;
        this._state.completedCount = this._completedCount;
        this._state.currentRequest = this._currentRequest;
        this._state.seekStart = this._seekStart;
        this._state.seekEnd = this._seekEnd;
        this._state.seekDistance = this._seekDistance;
        this._state.direction = this._direction;
        this._state.algorithm = this.algorithmName;
        this._state.requests = [...this._requests];
        this._state.minTrack = this._minTrack;
        this._state.maxTrack = this._maxTrack;
        this._state.pendingSteps = [...this._pendingSteps];

        // 计算边界步骤
        this._computeBoundarySteps();
        this._state.boundarySteps = [...this._boundarySteps];
    }

    /**
     * 计算边界步骤索引
     * 边界步骤定义：
     * 1. 方向发生转折的步骤（如 SCAN/LOOK 反向）
     * 2. 到达磁道范围边界的步骤（如 C-SCAN 跳到起点）
     * 3. 寻道距离异常的步骤（如 C-SCAN/C-LOOK 的大跳）
     *
     * 通过分析 serviceOrder 中相邻请求的移动方向变化来检测
     */
    _computeBoundarySteps() {
        const order = this._serviceOrder;
        if (order.length < 2) {
            this._boundarySteps = [];
            return;
        }

        const boundarySteps = [];

        // 从第2个已服务请求开始检测（索引1对应第2个请求）
        for (let i = 1; i < order.length; i++) {
            const prev = order[i - 1];
            const curr = order[i];
            const prevPrev = i >= 2 ? order[i - 2] : null;

            // 计算移动方向
            const currDir = curr - prev;
            const prevDir = prevPrev !== null ? prev - prevPrev : null;

            // 1. 方向转折检测：当前方向与上一次方向相反
            if (prevDir !== null && currDir !== 0 && prevDir !== 0) {
                if ((prevDir > 0 && currDir < 0) || (prevDir < 0 && currDir > 0)) {
                    boundarySteps.push(i); // 第i步是转折后的第一步
                    continue;
                }
            }

            // 2. 大跳检测：寻道距离异常大（超过磁道范围的一半）
            const seekDist = Math.abs(curr - prev);
            const trackRange = this._maxTrack - this._minTrack;
            if (seekDist > trackRange * 0.5) {
                boundarySteps.push(i);
                continue;
            }

            // 3. 到达边界检测：当前请求是 minTrack 或 maxTrack
            if (curr === this._minTrack || curr === this._maxTrack) {
                boundarySteps.push(i);
                continue;
            }
        }

        this._boundarySteps = boundarySteps;
    }

    /**
     * 生成解释文本
     * @param {number} request
     * @param {number} seekDistance
     * @param {boolean} isBoundary
     * @returns {string}
     */
    _generateExplanation(request, seekDistance, isBoundary) {
        const algoName = this.algorithmName;
        // 使用 serviceOrder.length 作为步骤号，反映实际执行步数（含边界点）
        const step = this._serviceOrder.length;
        const total = this._requests.length;

        let reason = '';

        if (isBoundary) {
            if (request === this._maxTrack) {
                reason = `到达右边界磁道 ${request}，准备反向扫描。`;
            } else if (request === this._minTrack) {
                reason = `到达左边界磁道 ${request}，准备反向扫描。`;
            } else {
                reason = `大跳转到磁道 ${request}，寻道距离 ${seekDistance}。`;
            }
        } else {
            switch (algoName) {
                case 'FCFS':
                    reason = `按照请求到达顺序，下一个服务的是磁道 ${request}。`;
                    break;
                case 'SSTF':
                    reason = `磁道 ${request} 距离当前磁头位置 ${this._seekStart} 最近（距离 ${seekDistance}），优先服务。`;
                    break;
                case 'SCAN':
                    reason = `当前方向 ${this._direction === 'right' ? '→ 向右' : '← 向左'}，磁道 ${request} 是扫描路径上的下一个请求。`;
                    break;
                case 'C-SCAN':
                    reason = `单向向右扫描，磁道 ${request} 是路径上的下一个请求。`;
                    break;
                case 'LOOK':
                    reason = `当前方向 ${this._direction === 'right' ? '→ 向右' : '← 向左'}（仅扫描到最远请求），磁道 ${request} 是路径上的下一个请求。`;
                    break;
                case 'C-LOOK':
                    reason = `单向循环扫描（仅扫描到最远请求），磁道 ${request} 是路径上的下一个请求。`;
                    break;
            }
        }

        return `[步骤 ${step}/${total}] 磁头从 ${this._seekStart} 移动到 ${request}，寻道距离 ${seekDistance}。${reason}`;
    }

    /**
     * 标准化算法名
     * @param {string} algo
     * @returns {string}
     */
    _normalizeAlgorithm(algo) {
        if (!algo) return 'FCFS';
        const upper = algo.toUpperCase().replace(/\s+/g, '');
        const map = {
            'FCFS': 'FCFS',
            'SSTF': 'SSTF',
            'SCAN': 'SCAN',
            'CSCAN': 'C-SCAN',
            'C-SCAN': 'C-SCAN',
            'LOOK': 'LOOK',
            'CLOOK': 'C-LOOK',
            'C-LOOK': 'C-LOOK'
        };
        return map[upper] || 'FCFS';
    }

    /**
     * 重置模拟器
     */
    reset() {
        this._requests = [];
        this._headPosition = 0;
        this._initialHead = 0;
        this._minTrack = 0;
        this._maxTrack = 199;
        this._direction = 'right';
        this._remainingRequests = [];
        this._serviceOrder = [];
        this._totalSeekLength = 0;
        this._completedCount = 0;
        this._currentRequest = null;
        this._seekStart = null;
        this._seekEnd = null;
        this._seekDistance = 0;
        this._pendingSteps = [];

        super.reset();
    }

    /**
     * 获取当前状态（增强版）
     * @returns {Object}
     */
    getState() {
        const baseState = super.getState();
        return {
            ...baseState,
            algorithm: this._state.algorithm || this.algorithmName,
            requests: this._state.requests || [],
            headPosition: this._state.headPosition ?? 0,
            initialHead: this._state.initialHead ?? 0,
            minTrack: this._state.minTrack ?? 0,
            maxTrack: this._state.maxTrack ?? 199,
            direction: this._state.direction || 'right',
            remainingRequests: this._state.remainingRequests || [],
            serviceOrder: this._state.serviceOrder || [],
            totalSeekLength: this._state.totalSeekLength || 0,
            completedCount: this._state.completedCount || 0,
            currentRequest: this._state.currentRequest,
            seekStart: this._state.seekStart,
            seekEnd: this._state.seekEnd,
            seekDistance: this._state.seekDistance || 0,
            boundarySteps: this._state.boundarySteps || [],
            explanation: this._state.explanation || ''
        };
    }
}
