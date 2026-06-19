/* ============================================
   银行家算法模拟器（预计算版）
   采用"预计算全部步骤 + 回放步骤"模式
   安全性检测和资源请求均一次性完成计算，
   生成步骤列表后通过 currentStep 索引回放
   ============================================ */

import { Simulator } from '../../core/simulator.js';

export class BankerSimulator extends Simulator {
    constructor() {
        super();
        this.moduleName = 'banker';
        this.algorithmName = 'Banker';

        // 系统配置
        this._totalResources = [10, 5, 7];
        this._processes = ['P0', 'P1', 'P2', 'P3', 'P4'];
        this._max = [
            [7, 5, 3],
            [3, 2, 2],
            [9, 0, 2],
            [2, 2, 2],
            [4, 3, 3]
        ];
        this._allocation = [
            [0, 1, 0],
            [2, 0, 0],
            [3, 0, 2],
            [2, 1, 1],
            [0, 0, 2]
        ];

        // 预计算步骤列表（回放用）
        this._precomputedSteps = [];

        // 首次创建时立即初始化状态
        this.reset();
    }

    /**
     * 获取初始状态
     */
    _getInitialState() {
        const need = this._computeNeed();
        const available = this._computeAvailable();
        return {
            totalResources: [10, 5, 7],
            processes: ['P0', 'P1', 'P2', 'P3', 'P4'],
            max: [
                [7, 5, 3],
                [3, 2, 2],
                [9, 0, 2],
                [2, 2, 2],
                [4, 3, 3]
            ],
            allocation: [
                [0, 1, 0],
                [2, 0, 0],
                [3, 0, 2],
                [2, 1, 1],
                [0, 0, 2]
            ],
            need,
            available,
            safetyResult: null,
            safetyProcess: [],
            requestResult: null,
            explanation: '等待操作...',
            currentStep: 0,
            totalSteps: 0,
            isComplete: false,
            highlightProcess: -1,
            workVector: [],
            finishVector: [],
            safetyStepIndex: 0,
            safetyTotalSteps: 0
        };
    }

    /**
     * 应用配置
     * @param {Object} config
     */
    _applyConfig(config) {
        if (config.totalResources) {
            this._totalResources = [...config.totalResources];
        }
        if (config.processes) {
            this._processes = [...config.processes];
        }
        if (config.max) {
            this._max = config.max.map(row => [...row]);
        }
        if (config.allocation) {
            this._allocation = config.allocation.map(row => [...row]);
        }

        // 计算 Need 和 Available
        const need = this._computeNeed();
        const available = this._computeAvailable();

        this._state.totalResources = [...this._totalResources];
        this._state.processes = [...this._processes];
        this._state.max = this._max.map(row => [...row]);
        this._state.allocation = this._allocation.map(row => [...row]);
        this._state.need = need;
        this._state.available = available;
        this._state.safetyResult = null;
        this._state.safetyProcess = [];
        this._state.requestResult = null;
        this._state.explanation = '参数已更新。点击"执行安全性检查"检测当前状态，或输入资源请求后点击"申请资源"。';
    }

    /**
     * 计算 Need 矩阵
     * Need[i][j] = Max[i][j] - Allocation[i][j]
     */
    _computeNeed() {
        return this._max.map((row, i) =>
            row.map((val, j) => Math.max(0, val - this._allocation[i][j]))
        );
    }

    /**
     * 计算 Available 向量
     * Available[j] = Total[j] - ΣAllocation[i][j]
     */
    _computeAvailable() {
        const numResources = this._totalResources.length;
        const sumAlloc = new Array(numResources).fill(0);
        this._allocation.forEach(row => {
            row.forEach((val, j) => {
                sumAlloc[j] += val;
            });
        });
        return this._totalResources.map((total, j) => Math.max(0, total - sumAlloc[j]));
    }

    /**
     * 向量比较：a <= b ?
     */
    _vectorLE(a, b) {
        for (let i = 0; i < a.length; i++) {
            if (a[i] > b[i]) return false;
        }
        return true;
    }

    /**
     * 向量加法
     */
    _vectorAdd(a, b) {
        return a.map((val, i) => val + b[i]);
    }

    /**
     * 向量减法
     */
    _vectorSub(a, b) {
        return a.map((val, i) => val - b[i]);
    }

    /**
     * 向量格式化输出
     */
    _formatVector(vec) {
        if (!vec || !Array.isArray(vec) || vec.length === 0) return '(?)';
        return `(${vec.join(', ')})`;
    }

    /**
     * 执行完整安全性检测（一次性计算）
     * 生成所有步骤保存到 _precomputedSteps
     * @param {Object} options - { allocation, need, available } 可选，用于试分配后的检测
     * @returns {Array} steps
     */
    _runFullSafetyCheck(options) {
        const allocation = options && options.allocation ? options.allocation : this._allocation;
        const need = options && options.need ? options.need : this._computeNeed();
        const available = options && options.available ? options.available : this._computeAvailable();

        const numProcesses = this._processes.length;
        const steps = [];
        const finish = new Array(numProcesses).fill(false);
        const sequence = [];
        let work = [...available];

        // 步骤1：初始化
        steps.push({
            type: 'init',
            work: [...work],
            finish: [...finish],
            description: `初始化：Work = ${this._formatVector(work)}，所有进程均未完成`
        });

        // 循环查找可满足的进程
        let found = true;
        while (found) {
            found = false;
            for (let i = 0; i < numProcesses; i++) {
                if (!finish[i] && this._vectorLE(need[i], work)) {
                    finish[i] = true;
                    const oldWork = [...work];
                    work = this._vectorAdd(work, allocation[i]);
                    sequence.push(i);

                    steps.push({
                        type: 'found',
                        processIndex: i,
                        processName: this._processes[i],
                        need: [...need[i]],
                        oldWork: [...oldWork],
                        allocation: [...allocation[i]],
                        newWork: [...work],
                        finish: [...finish],
                        description: `进程 ${this._processes[i]} 满足条件：Need${this._formatVector(need[i])} ≤ Work${this._formatVector(oldWork)}，` +
                            `分配资源后释放，Work 更新为 ${this._formatVector(work)}`
                    });

                    found = true;
                    break;
                }
            }
        }

        // 检查是否所有进程都完成了
        const safe = finish.every(f => f === true);
        if (!safe) {
            const unfinished = [];
            for (let i = 0; i < numProcesses; i++) {
                if (!finish[i]) unfinished.push(this._processes[i]);
            }
            steps.push({
                type: 'notFound',
                unfinished: unfinished,
                work: [...work],
                finish: [...finish],
                description: `剩余进程 ${unfinished.join(', ')} 均不满足条件：Need > Work${this._formatVector(work)}，检测终止`
            });
        }

        return {
            steps,
            safe,
            sequence: sequence.map(i => this._processes[i]),
            sequenceIndices: [...sequence],
            finish,
            work
        };
    }

    /**
     * 启动安全性检测（一次性完成）
     */
    startSafetyCheck() {
        const need = this._computeNeed();
        const available = this._computeAvailable();

        // 执行完整安全性检测
        const result = this._runFullSafetyCheck();

        // 保存预计算步骤
        this._precomputedSteps = result.steps;

        // 更新状态
        this._state.need = need;
        this._state.available = available;
        this._state.safetyProcess = result.steps;
        this._state.safetyResult = {
            safe: result.safe,
            sequence: result.sequence,
            sequenceIndices: result.sequenceIndices
        };
        this._state.requestResult = null;
        this._state.currentStep = 0;
        this._state.totalSteps = result.steps.length;
        this._state.isComplete = false;
        this._state.workVector = result.work;
        this._state.finishVector = result.finish;

        // 同步基类属性
        this.totalSteps = result.steps.length;
        this.isComplete = false;

        if (result.safe) {
            const seqStr = result.sequence.join(' → ');
            this._state.explanation = `✓ 系统处于安全状态。安全序列：${seqStr}`;
        } else {
            this._state.explanation = '✗ 系统处于不安全状态！无法找到完整的安全序列。';
        }

        this._saveSnapshot();
        this._notifyUpdate();
    }

    /**
     * 启动资源请求（一次性完成）
     * @param {number} processIndex
     * @param {Array} request
     */
    startRequestCheck(processIndex, request) {
        const need = this._computeNeed();
        const available = this._computeAvailable();

        // 检查进程索引有效性
        if (!need[processIndex]) {
            this._state.requestResult = {
                allowed: false,
                reason: '进程索引无效',
                details: `错误：进程索引 ${processIndex} 无效，无法执行资源请求。`
            };
            this._state.explanation = this._state.requestResult.details;
            this._state.isComplete = true;
            this.isComplete = true;
            this._state.totalSteps = 1;
            this.totalSteps = 1;
            this._saveSnapshot();
            this._notifyUpdate();
            return;
        }

        // 步骤1：检查 Request <= Need
        if (!this._vectorLE(request, need[processIndex])) {
            this._state.requestResult = {
                allowed: false,
                reason: '超过Need',
                details: `进程 ${this._processes[processIndex]} 的请求 ${this._formatVector(request)} 超过了其最大需求 Need${this._formatVector(need[processIndex])}，拒绝分配。`
            };
            this._state.explanation = this._state.requestResult.details;
            this._state.isComplete = true;
            this.isComplete = true;
            this._state.totalSteps = 1;
            this.totalSteps = 1;
            this._saveSnapshot();
            this._notifyUpdate();
            return;
        }

        // 步骤2：检查 Request <= Available
        if (!this._vectorLE(request, available)) {
            this._state.requestResult = {
                allowed: false,
                reason: '资源不足',
                details: `进程 ${this._processes[processIndex]} 的请求 ${this._formatVector(request)} 超过了当前可用资源 Available${this._formatVector(available)}，资源不足，拒绝分配。`
            };
            this._state.explanation = this._state.requestResult.details;
            this._state.isComplete = true;
            this.isComplete = true;
            this._state.totalSteps = 1;
            this.totalSteps = 1;
            this._saveSnapshot();
            this._notifyUpdate();
            return;
        }

        // 步骤3：试分配
        const newAvailable = this._vectorSub(available, request);
        const newAllocation = this._allocation.map(row => [...row]);
        newAllocation[processIndex] = this._vectorAdd(newAllocation[processIndex], request);
        const newNeed = this._max.map((row, i) =>
            row.map((val, j) => Math.max(0, val - newAllocation[i][j]))
        );

        // 步骤4：对试分配后的状态执行安全性检测
        const safetyResult = this._runFullSafetyCheck({
            allocation: newAllocation,
            need: newNeed,
            available: newAvailable
        });

        // 保存预计算步骤
        this._precomputedSteps = safetyResult.steps;

        if (safetyResult.safe) {
            // 正式分配
            this._allocation = newAllocation.map(row => [...row]);
            const finalNeed = this._computeNeed();
            const finalAvailable = this._computeAvailable();

            this._state.allocation = this._allocation.map(row => [...row]);
            this._state.need = finalNeed;
            this._state.available = finalAvailable;

            const seqStr = safetyResult.sequence.join(' → ');
            this._state.requestResult = {
                allowed: true,
                reason: '允许分配',
                details: `✓ 资源分配成功！分配后系统仍处于安全状态。安全序列：${seqStr}`
            };
            this._state.safetyResult = {
                safe: true,
                sequence: safetyResult.sequence,
                sequenceIndices: safetyResult.sequenceIndices
            };
            this._state.explanation = this._state.requestResult.details;
        } else {
            this._state.requestResult = {
                allowed: false,
                reason: '分配后进入不安全状态',
                details: `✗ 拒绝分配！试分配后系统将进入不安全状态，无法保证所有进程能顺利完成。`
            };
            this._state.safetyResult = {
                safe: false,
                sequence: safetyResult.sequence,
                sequenceIndices: safetyResult.sequenceIndices
            };
            this._state.explanation = this._state.requestResult.details;
        }

        // 更新 safetyProcess 为安全性检测步骤
        this._state.safetyProcess = safetyResult.steps;
        this._state.workVector = safetyResult.work;
        this._state.finishVector = safetyResult.finish;
        this._state.currentStep = 0;
        this._state.totalSteps = safetyResult.steps.length;
        this._state.isComplete = false;

        // 同步基类属性
        this.totalSteps = safetyResult.steps.length;
        this.isComplete = false;

        this._saveSnapshot();
        this._notifyUpdate();
    }

    /**
     * 执行一步（推进 currentStep 并更新状态）
     * 每次 step() 推进 currentStep，renderer 根据 currentStep 截取可见步骤
     * @returns {boolean} 是否还有下一步
     */
    step() {
        if (!this.isInitialized) return false;
        if (this.isComplete) return false;

        // 推进 currentStep
        if (this.currentStep < this.totalSteps - 1) {
            this.currentStep++;
            // 同步 _state 中的 currentStep
            this._state.currentStep = this.currentStep;

            // 根据 currentStep 更新解释文本
            const steps = this._state.safetyProcess || [];
            if (steps.length > 0 && this.currentStep < steps.length) {
                const currentStepData = steps[this.currentStep];
                if (currentStepData) {
                    if (currentStepData.type === 'init') {
                        this._state.explanation = currentStepData.description || '初始化安全性检测';
                    } else if (currentStepData.type === 'found') {
                        const workBefore = this._formatVector(currentStepData.oldWork || []);
                        const workAfter = this._formatVector(currentStepData.newWork || []);
                        const needStr = this._formatVector(currentStepData.need || []);
                        this._state.explanation = `✓ ${currentStepData.processName} 满足 Need${needStr} ≤ Work${workBefore}，Work 更新为 ${workAfter}`;
                    } else if (currentStepData.type === 'notFound') {
                        this._state.explanation = `✗ 无法继续，系统处于不安全状态`;
                    }
                }
            }

            // 更新 finishVector 和 workVector
            if (steps.length > 0 && this.currentStep < steps.length) {
                const currentStepData = steps[this.currentStep];
                if (currentStepData.finish) {
                    this._state.finishVector = [...currentStepData.finish];
                }
                if (currentStepData.newWork) {
                    this._state.workVector = [...currentStepData.newWork];
                } else if (currentStepData.work) {
                    this._state.workVector = [...currentStepData.work];
                }
            }

            this._notifyUpdate();
            return true;
        }

        this.isComplete = true;
        this._state.isComplete = true;
        this._state.explanation = '✓ 安全性检测完成';
        this._notifyUpdate();
        return false;
    }

    /**
     * 获取当前状态
     */
    getState() {
        const base = super.getState();
        return {
            ...base,
            totalResources: this._state.totalResources || [10, 5, 7],
            processes: this._state.processes || ['P0', 'P1', 'P2', 'P3', 'P4'],
            max: this._state.max || [],
            allocation: this._state.allocation || [],
            need: this._state.need || [],
            available: this._state.available || [],
            safetyResult: this._state.safetyResult || null,
            safetyProcess: this._state.safetyProcess || [],
            requestResult: this._state.requestResult || null,
            explanation: this._state.explanation || ''
        };
    }

    /**
     * 更新系统配置（由渲染器调用）
     * @param {Object} config
     */
    updateConfig(config) {
        this._applyConfig(config);
    }

    /**
     * 重置
     */
    reset() {
        this._totalResources = [10, 5, 7];
        this._processes = ['P0', 'P1', 'P2', 'P3', 'P4'];
        this._max = [
            [7, 5, 3],
            [3, 2, 2],
            [9, 0, 2],
            [2, 2, 2],
            [4, 3, 3]
        ];
        this._allocation = [
            [0, 1, 0],
            [2, 0, 0],
            [3, 0, 2],
            [2, 1, 1],
            [0, 0, 2]
        ];

        this._precomputedSteps = [];

        // 调用基类 reset
        super.reset();

        // 重新初始化状态
        const need = this._computeNeed();
        const available = this._computeAvailable();

        this._state.totalResources = [...this._totalResources];
        this._state.processes = [...this._processes];
        this._state.max = this._max.map(row => [...row]);
        this._state.allocation = this._allocation.map(row => [...row]);
        this._state.need = need;
        this._state.available = available;
        this._state.safetyResult = null;
        this._state.safetyProcess = [];
        this._state.requestResult = null;
        this._state.explanation = '等待操作...';
        this._state.currentStep = 0;
        this._state.totalSteps = 0;
        this._state.isComplete = false;
        this._state.highlightProcess = -1;
        this._state.workVector = [];
        this._state.finishVector = [];
        this._state.safetyStepIndex = 0;
        this._state.safetyTotalSteps = 0;

        this._saveSnapshot();
        this._notifyUpdate();
    }
}

export default BankerSimulator;
