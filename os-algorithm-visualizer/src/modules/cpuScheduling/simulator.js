/* ============================================
    CPU调度模拟器
    支持 FCFS / SJF (非抢占) / SRTF (抢占) / RR / HRRN (非抢占)
    采用快照回放策略：每次 step() 推进一个时间片
    ============================================ */

import { Simulator } from '../../core/simulator.js';

/**
 * 进程控制块
 */
class PCB {
    constructor(id, arrivalTime, burstTime) {
        this.id = id;                    // 进程ID (如 'P1')
        this.arrivalTime = arrivalTime;  // 到达时间
        this.burstTime = burstTime;      // 总CPU突发时间
        this.remainingTime = burstTime;  // 剩余时间
        this.startTime = null;           // 首次开始执行时间
        this.finishTime = null;          // 完成时间
        this.responseTime = null;        // 响应时间
        this.waitTime = 0;               // 等待时间
        this.turnaroundTime = 0;         // 周转时间
        this.state = 'new';              // new / ready / running / terminated
        this.lastExecutedTime = null;    // 上次执行的时间点（用于RR）
    }
}

export class CpuSchedulingSimulator extends Simulator {
    constructor() {
        super();
        this.moduleName = 'cpuScheduling';
        this.algorithmName = 'FCFS';

        // 运行时状态
        this._processes = [];            // PCB 数组
        this._readyQueue = [];           // 就绪队列（PCB引用）
        this._currentProcess = null;     // 当前运行的进程
        this._completedProcesses = [];   // 已完成的进程
        this._time = 0;                  // 当前时间
        this._timeQuantum = 2;           // RR时间片
        this._ganttChart = [];           // 甘特图记录 [{ pid, start, end }]
        this._totalProcesses = 0;
        this._completedCount = 0;
        this._isPreemptive = false;
        this._rrQueue = [];              // RR专用队列
        this._rrCurrentIndex = 0;        // RR当前队列索引
        this._rrTimeSliceUsed = 0;       // RR当前时间片已使用量
        this._arrivedProcesses = [];     // 已到达但尚未进入就绪队列的进程
    }

    /**
     * 获取初始状态
     */
    _getInitialState() {
        return {
            processes: [],
            readyQueue: [],
            currentProcess: null,
            completedProcesses: [],
            time: 0,
            timeQuantum: 2,
            ganttChart: [],
            totalProcesses: 0,
            completedCount: 0,
            isComplete: false,
            algorithm: 'FCFS',
            explanation: '',
            avgWaitTime: 0,
            avgTurnaroundTime: 0,
            avgResponseTime: 0,
            cpuUtilization: 0
        };
    }

    /**
     * 应用配置
     * @param {Object} config
     */
    _applyConfig(config) {
        this.algorithmName = config.algorithm || 'FCFS';
        this._timeQuantum = config.timeQuantum || 2;
        this._time = 0;
        this._completedCount = 0;
        this._ganttChart = [];
        this._currentProcess = null;
        this._completedProcesses = [];
        this._rrQueue = [];
        this._rrCurrentIndex = 0;
        this._rrTimeSliceUsed = 0;

        // 解析进程列表
        this._processes = (config.processes || []).map((p, idx) => new PCB(
            p.id || `P${idx + 1}`,
            p.arrivalTime || 0,
            p.burstTime || 1
        ));

        this._totalProcesses = this._processes.length;
        this.totalSteps = this._totalProcesses * 10; // 预估最大步数

        // 初始化已到达进程列表（按到达时间排序）
        this._arrivedProcesses = [...this._processes].sort((a, b) => a.arrivalTime - b.arrivalTime);

        // 设置算法特性（仅SRTF为抢占式）
        this._isPreemptive = (this.algorithmName === 'SRTF');

        // 更新 _state
        this._state.processes = this._serializeProcesses();
        this._state.readyQueue = [];
        this._state.currentProcess = null;
        this._state.completedProcesses = [];
        this._state.time = 0;
        this._state.timeQuantum = this._timeQuantum;
        this._state.ganttChart = [];
        this._state.totalProcesses = this._totalProcesses;
        this._state.completedCount = 0;
        this._state.isComplete = false;
        this._state.algorithm = this.algorithmName;
        this._state.explanation = '初始化完成，等待开始调度...';
        this._state.avgWaitTime = 0;
        this._state.avgTurnaroundTime = 0;
        this._state.avgResponseTime = 0;
        this._state.cpuUtilization = 0;
    }

    /**
     * 序列化进程列表
     */
    _serializeProcesses() {
        return this._processes.map(p => ({
            id: p.id,
            arrivalTime: p.arrivalTime,
            burstTime: p.burstTime,
            remainingTime: p.remainingTime,
            startTime: p.startTime,
            finishTime: p.finishTime,
            responseTime: p.responseTime,
            waitTime: p.waitTime,
            turnaroundTime: p.turnaroundTime,
            state: p.state
        }));
    }

    /**
     * 执行一步（推进一个时间片）
     * @returns {boolean} 是否还有下一步
     */
    step() {
        if (!this.isInitialized) return false;
        if (this.isComplete) return false;

        // 如果当前步骤在历史范围内（回放模式），从历史快照恢复并前进
        if (this.currentStep < this.history.length - 1) {
            this.currentStep++;
            if (this.history[this.currentStep]) {
                this._state = JSON.parse(JSON.stringify(this.history[this.currentStep]));
                this._restoreRuntimeState();
            }
            this._notifyUpdate();
            return this.currentStep < this.totalSteps;
        }

        // 检查是否所有进程都已完成
        if (this._completedCount >= this._totalProcesses) {
            this.isComplete = true;
            this._state.isComplete = true;
            this._state.explanation = '所有进程调度完成。';
            this._calculateStats();
            this._notifyUpdate();
            return false;
        }

        // 1. 处理新到达的进程
        this._handleArrivals();

        // 2. 根据算法选择下一个要执行的进程
        const previousProcess = this._currentProcess;
        this._selectNextProcess();

        // 3. 执行一个时间片
        this._executeTimeSlice(previousProcess);

        // 4. 更新状态
        this._updateState();

        // 5. 保存快照
        this._saveSnapshot();

        // 6. 通知更新
        this._notifyUpdate();

        return !this.isComplete;
    }

    /**
     * 处理新到达的进程
     */
    _handleArrivals() {
        while (this._arrivedProcesses.length > 0) {
            const next = this._arrivedProcesses[0];
            if (next.arrivalTime <= this._time) {
                this._arrivedProcesses.shift();
                next.state = 'ready';
                this._readyQueue.push(next);
            } else {
                break;
            }
        }
    }

    /**
     * 根据算法选择下一个要执行的进程
     */
    _selectNextProcess() {
        if (this._readyQueue.length === 0) {
            this._currentProcess = null;
            return;
        }

        switch (this.algorithmName) {
            case 'FCFS':
                // 先来先服务：选择就绪队列中第一个
                if (!this._currentProcess || this._currentProcess.state !== 'running') {
                    this._currentProcess = this._readyQueue[0];
                }
                break;

            case 'SJF':
                // 非抢占式短作业优先：当前进程完成时才选择新的
                if (!this._currentProcess || this._currentProcess.state !== 'running') {
                    this._readyQueue.sort((a, b) => a.burstTime - b.burstTime);
                    this._currentProcess = this._readyQueue[0];
                }
                break;

            case 'SRTF':
                // 抢占式最短剩余时间优先：每次都要重新选择
                this._readyQueue.sort((a, b) => a.remainingTime - b.remainingTime);
                this._currentProcess = this._readyQueue[0];
                break;

            case 'RR': {
                // 轮转法
                if (!this._currentProcess || this._currentProcess.state !== 'running') {
                    // 从就绪队列中取出第一个
                    this._currentProcess = this._readyQueue.shift();
                    if (this._currentProcess) {
                        this._readyQueue.push(this._currentProcess); // 放回队尾（RR循环）
                    }
                    this._rrTimeSliceUsed = 0;
                } else {
                    // 检查时间片是否用完
                    if (this._rrTimeSliceUsed >= this._timeQuantum) {
                        // 时间片用完，切换下一个
                        const idx = this._readyQueue.indexOf(this._currentProcess);
                        if (idx !== -1) {
                            this._readyQueue.splice(idx, 1);
                            this._readyQueue.push(this._currentProcess);
                        }
                        this._currentProcess = this._readyQueue.length > 0 ? this._readyQueue.shift() : null;
                        if (this._currentProcess) {
                            this._readyQueue.push(this._currentProcess);
                        }
                        this._rrTimeSliceUsed = 0;
                    }
                }
                break;
            }

            case 'HRRN': {
                // 最高响应比优先（非抢占）
                if (!this._currentProcess || this._currentProcess.state !== 'running') {
                    // 计算每个就绪进程的响应比 = (等待时间 + 服务时间) / 服务时间
                    this._readyQueue.forEach(p => {
                        const waitTime = this._time - p.arrivalTime;
                        p._responseRatio = (waitTime + p.burstTime) / p.burstTime;
                    });
                    // 按响应比降序排序
                    this._readyQueue.sort((a, b) => b._responseRatio - a._responseRatio);
                    this._currentProcess = this._readyQueue[0];
                }
                break;
            }

            default:
                this._currentProcess = this._readyQueue[0];
        }
    }

    /**
     * 执行一个时间片
     * @param {Object} previousProcess - 上一个时间片执行的进程
     */
    _executeTimeSlice(previousProcess) {
        if (!this._currentProcess) {
            // CPU空闲，时间推进
            this._time++;
            // 检查是否有新进程到达
            this._handleArrivals();
            return;
        }

        // 如果当前进程刚被选中（状态从ready变为running）
        if (this._currentProcess.state !== 'running') {
            this._currentProcess.state = 'running';
            if (this._currentProcess.startTime === null) {
                this._currentProcess.startTime = this._time;
                this._currentProcess.responseTime = this._time - this._currentProcess.arrivalTime;
            }

            // 记录甘特图
            if (previousProcess !== this._currentProcess) {
                // 如果前一个进程正在运行（被抢占），将其状态改回ready
                if (previousProcess && previousProcess.state === 'running') {
                    previousProcess.state = 'ready';
                    // 确保被抢占的进程在就绪队列中
                    if (!this._readyQueue.includes(previousProcess)) {
                        this._readyQueue.push(previousProcess);
                    }
                }
                this._ganttChart.push({
                    pid: this._currentProcess.id,
                    start: this._time,
                    end: this._time + 1
                });
            }
        } else {
            // 继续执行，更新甘特图结束时间
            const lastEntry = this._ganttChart[this._ganttChart.length - 1];
            if (lastEntry && lastEntry.pid === this._currentProcess.id) {
                lastEntry.end = this._time + 1;
            }
        }

        // 执行一个时间片
        this._currentProcess.remainingTime--;
        this._rrTimeSliceUsed++;
        this._time++;

        // 更新就绪队列中其他进程的等待时间
        this._readyQueue.forEach(p => {
            if (p !== this._currentProcess) {
                p.waitTime++;
            }
        });

        // 检查进程是否完成
        if (this._currentProcess.remainingTime <= 0) {
            this._currentProcess.state = 'terminated';
            this._currentProcess.finishTime = this._time;
            this._currentProcess.turnaroundTime = this._currentProcess.finishTime - this._currentProcess.arrivalTime;

            // 从就绪队列中移除
            const idx = this._readyQueue.indexOf(this._currentProcess);
            if (idx !== -1) {
                this._readyQueue.splice(idx, 1);
            }

            this._completedProcesses.push(this._currentProcess);
            this._completedCount++;
            this._currentProcess = null;
            this._rrTimeSliceUsed = 0;
        }

        // 处理新到达的进程（在当前时间片结束后）
        this._handleArrivals();

        // 如果是抢占式算法，执行后重新选择
        // 注意：SRTF的抢占选择已在 step() 的 _selectNextProcess() 中完成，
        // 这里只需要处理时间片执行后新到达进程导致的抢占
        if (this._isPreemptive && this._currentProcess) {
            const prevProcess = this._currentProcess;
            this._selectNextProcess();
            if (this._currentProcess !== prevProcess) {
                // 发生抢占：新进程抢占了当前进程
                // 将被抢占的进程状态改回ready
                if (prevProcess && prevProcess.state === 'running') {
                    prevProcess.state = 'ready';
                    if (!this._readyQueue.includes(prevProcess)) {
                        this._readyQueue.push(prevProcess);
                    }
                }
                // 设置新进程为running，并创建甘特图记录
                if (this._currentProcess) {
                    this._currentProcess.state = 'running';
                    if (this._currentProcess.startTime === null) {
                        this._currentProcess.startTime = this._time;
                        this._currentProcess.responseTime = this._time - this._currentProcess.arrivalTime;
                    }
                    this._ganttChart.push({
                        pid: this._currentProcess.id,
                        start: this._time,
                        end: this._time + 1
                    });
                }
            }
        }
    }

    /**
     * 更新状态对象
     */
    _updateState() {
        this._state.processes = this._serializeProcesses();
        this._state.readyQueue = this._readyQueue.map(p => p.id);
        this._state.currentProcess = this._currentProcess ? {
            id: this._currentProcess.id,
            remainingTime: this._currentProcess.remainingTime,
            startTime: this._currentProcess.startTime
        } : null;
        this._state.completedProcesses = this._completedProcesses.map(p => ({
            id: p.id,
            finishTime: p.finishTime,
            turnaroundTime: p.turnaroundTime,
            waitTime: p.waitTime,
            responseTime: p.responseTime
        }));
        this._state.time = this._time;
        this._state.ganttChart = [...this._ganttChart];
        this._state.completedCount = this._completedCount;
        this._state.totalProcesses = this._totalProcesses;

        // 生成解释文本
        this._state.explanation = this._generateExplanation();

        // 计算统计信息
        this._calculateStats();

        // 检查是否完成
        if (this._completedCount >= this._totalProcesses) {
            this.isComplete = true;
            this._state.isComplete = true;
            this._state.explanation = '所有进程调度完成。\n' + this._state.explanation;
        }
    }

    /**
     * 计算统计信息
     */
    _calculateStats() {
        const completed = this._completedProcesses;
        if (completed.length === 0) return;

        const totalWait = completed.reduce((sum, p) => sum + p.waitTime, 0);
        const totalTurnaround = completed.reduce((sum, p) => sum + p.turnaroundTime, 0);
        const totalResponse = completed.reduce((sum, p) => sum + (p.responseTime || 0), 0);

        this._state.avgWaitTime = totalWait / completed.length;
        this._state.avgTurnaroundTime = totalTurnaround / completed.length;
        this._state.avgResponseTime = totalResponse / completed.length;

        // CPU利用率
        const totalBurst = this._processes.reduce((sum, p) => sum + p.burstTime, 0);
        this._state.cpuUtilization = this._time > 0 ? (totalBurst / this._time) * 100 : 0;
    }

    /**
     * 生成解释文本
     */
    _generateExplanation() {
        const algoNames = {
            'FCFS': '先来先服务 (FCFS)',
            'SJF': '短作业优先 (SJF)',
            'SRTF': '最短剩余时间优先 (SRTF)',
            'RR': '轮转法 (RR)',
            'HRRN': '最高响应比优先 (HRRN)'
        };

        const algoName = algoNames[this.algorithmName] || this.algorithmName;
        let lines = [`当前时间: ${this._time}`];
        lines.push(`调度算法: ${algoName}`);

        if (this._currentProcess) {
            lines.push(`当前执行: ${this._currentProcess.id} (剩余时间: ${this._currentProcess.remainingTime})`);
        } else {
            lines.push(`当前执行: (CPU空闲)`);
        }

        if (this._readyQueue.length > 0) {
            const queueInfo = this._readyQueue
                .filter(p => p !== this._currentProcess)
                .map(p => `${p.id}(剩余:${p.remainingTime})`);
            if (queueInfo.length > 0) {
                lines.push(`就绪队列: [${queueInfo.join(', ')}]`);
            }
        } else {
            lines.push('就绪队列: (空)');
        }

        if (this._completedCount > 0) {
            lines.push(`已完成: ${this._completedCount}/${this._totalProcesses}`);
            lines.push(`平均等待时间: ${this._state.avgWaitTime?.toFixed(1) || '0.0'}`);
            lines.push(`平均周转时间: ${this._state.avgTurnaroundTime?.toFixed(1) || '0.0'}`);
        }

        return lines.join('\n');
    }

    /**
     * 从历史快照恢复运行时状态
     */
    _restoreRuntimeState() {
        // 从序列化状态恢复运行时对象
        const stateProcesses = this._state.processes || [];
        this._processes = stateProcesses.map(sp => {
            const pcb = new PCB(sp.id, sp.arrivalTime, sp.burstTime);
            pcb.remainingTime = sp.remainingTime;
            pcb.startTime = sp.startTime;
            pcb.finishTime = sp.finishTime;
            pcb.responseTime = sp.responseTime;
            pcb.waitTime = sp.waitTime;
            pcb.turnaroundTime = sp.turnaroundTime;
            pcb.state = sp.state;
            return pcb;
        });

        this._readyQueue = [];
        const readyIds = this._state.readyQueue || [];
        readyIds.forEach(id => {
            const p = this._processes.find(pp => pp.id === id);
            if (p) this._readyQueue.push(p);
        });

        this._currentProcess = this._state.currentProcess
            ? this._processes.find(p => p.id === this._state.currentProcess.id) || null
            : null;

        this._completedProcesses = [];
        (this._state.completedProcesses || []).forEach(cp => {
            const p = this._processes.find(pp => pp.id === cp.id);
            if (p) this._completedProcesses.push(p);
        });

        this._time = this._state.time || 0;
        this._ganttChart = (this._state.ganttChart || []).map(g => ({ ...g }));
        this._completedCount = this._state.completedCount || 0;
        this._totalProcesses = this._state.totalProcesses || 0;
        this._timeQuantum = this._state.timeQuantum || 2;
        this._rrTimeSliceUsed = 0;

        // 重建 arrivedProcesses
        this._arrivedProcesses = this._processes
            .filter(p => p.state === 'new' || (p.state === 'ready' && p.startTime === null))
            .sort((a, b) => a.arrivalTime - b.arrivalTime);
    }

    /**
     * 重置
     */
    reset() {
        this._processes = [];
        this._readyQueue = [];
        this._currentProcess = null;
        this._completedProcesses = [];
        this._time = 0;
        this._ganttChart = [];
        this._completedCount = 0;
        this._totalProcesses = 0;
        this._arrivedProcesses = [];
        this._rrQueue = [];
        this._rrCurrentIndex = 0;
        this._rrTimeSliceUsed = 0;

        super.reset();
    }

    /**
     * 获取当前状态
     */
    getState() {
        const baseState = super.getState();
        return {
            ...baseState,
            processes: this._state.processes || [],
            readyQueue: this._state.readyQueue || [],
            currentProcess: this._state.currentProcess,
            completedProcesses: this._state.completedProcesses || [],
            time: this._state.time || 0,
            timeQuantum: this._state.timeQuantum || 2,
            ganttChart: this._state.ganttChart || [],
            totalProcesses: this._state.totalProcesses || 0,
            completedCount: this._state.completedCount || 0,
            algorithm: this._state.algorithm || 'FCFS',
            explanation: this._state.explanation || '',
            avgWaitTime: this._state.avgWaitTime || 0,
            avgTurnaroundTime: this._state.avgTurnaroundTime || 0,
            avgResponseTime: this._state.avgResponseTime || 0,
            cpuUtilization: this._state.cpuUtilization || 0
        };
    }
}
