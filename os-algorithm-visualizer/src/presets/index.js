/* ============================================
   预设案例数据
   所有模块的经典案例预设
   ============================================ */

export const PRESETS = {
    pageReplacement: [
        {
            name: 'FIFO Belady异常',
            description: 'Belady异常经典案例：物理块增加但缺页率反而上升',
            tags: ['FIFO', 'Belady异常', '经典'],
            config: {
                algorithm: 'FIFO',
                refString: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5],
                numFrames: 3
            }
        },
        {
            name: 'LRU局部性对比',
            description: '局部性访问模式：LRU利用时间局部性显著优于FIFO（3块内存）',
            tags: ['LRU', 'FIFO', '局部性', '对比'],
            config: {
                algorithm: 'LRU',
                refString: [1, 2, 3, 1, 2, 4, 1, 2, 5, 1, 2, 6, 1, 2],
                numFrames: 3
            }
        }
    ],


    cpuScheduling: [
        {
            name: 'FCFS护航效应',
            description: '长作业先到达导致后续短作业长时间等待，体现先来先服务的缺点。',
            tags: ['FCFS', '护航效应', 'Convoy Effect'],
            config: {
                algorithm: 'FCFS',
                processes: [
                    { id: 'P1', arrivalTime: 0, burstTime: 20 },
                    { id: 'P2', arrivalTime: 1, burstTime: 2 },
                    { id: 'P3', arrivalTime: 2, burstTime: 1 },
                    { id: 'P4', arrivalTime: 3, burstTime: 2 }
                ],
                timeQuantum: 2
            }
        },
        {
            name: 'SJF最优周转',
            description: '所有进程同时到达，对比FCFS和SJF时可明显观察平均周转时间差异。',
            tags: ['SJF', '最优周转', '对比'],
            config: {
                algorithm: 'SJF',
                processes: [
                    { id: 'P1', arrivalTime: 0, burstTime: 10 },
                    { id: 'P2', arrivalTime: 0, burstTime: 2 },
                    { id: 'P3', arrivalTime: 0, burstTime: 1 },
                    { id: 'P4', arrivalTime: 0, burstTime: 3 }
                ],
                timeQuantum: 2
            }
        },
        {
            name: 'SRTF抢占演示',
            description: '不断有更短作业到达，可观察最短剩余时间优先算法的连续抢占过程。',
            tags: ['SRTF', '抢占', '演示'],
            config: {
                algorithm: 'SRTF',
                processes: [
                    { id: 'P1', arrivalTime: 0, burstTime: 12 },
                    { id: 'P2', arrivalTime: 2, burstTime: 4 },
                    { id: 'P3', arrivalTime: 4, burstTime: 2 },
                    { id: 'P4', arrivalTime: 6, burstTime: 1 }
                ],
                timeQuantum: 2
            }
        },
        {
            name: 'RR轮转调度',
            description: '所有进程同时到达，可明显观察时间片轮转与公平调度机制。',
            tags: ['RR', '时间片轮转', '公平调度'],
            config: {
                algorithm: 'RR',
                processes: [
                    { id: 'P1', arrivalTime: 0, burstTime: 6 },
                    { id: 'P2', arrivalTime: 0, burstTime: 5 },
                    { id: 'P3', arrivalTime: 0, burstTime: 4 },
                    { id: 'P4', arrivalTime: 0, burstTime: 3 }
                ],
                timeQuantum: 2
            }
        },
        {
            name: 'HRRN防饥饿',
            description: '体现响应比随等待时间增长而提高，避免长作业长期得不到调度。',
            tags: ['HRRN', '防饥饿', '响应比'],
            config: {
                algorithm: 'HRRN',
                processes: [
                    { id: 'P1', arrivalTime: 0, burstTime: 10 },
                    { id: 'P2', arrivalTime: 1, burstTime: 2 },
                    { id: 'P3', arrivalTime: 2, burstTime: 2 },
                    { id: 'P4', arrivalTime: 3, burstTime: 2 }
                ],
                timeQuantum: 2
            }
        }
    ],

    banker: [
        {
            name: '① 经典教材案例（默认）',
            description: '教材经典案例：安全序列 P1→P3→P4→P0→P2，展示完整安全性检测过程',
            tags: ['安全', '经典', '教材'],
            config: {
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
                ]
            }
        },
        {
            name: '② 最简单安全状态',
            description: '所有进程都可立即执行，适合新手第一次接触。理解 Need ≤ Work 的含义',
            tags: ['安全', '简单', '新手'],
            config: {
                totalResources: [8, 6, 5],
                processes: ['P0', 'P1', 'P2'],
                max: [
                    [3, 2, 2],
                    [2, 2, 2],
                    [4, 3, 2]
                ],
                allocation: [
                    [1, 0, 0],
                    [1, 1, 0],
                    [1, 1, 1]
                ]
            }
        },
        {
            name: '③ 多轮安全检测',
            description: '需要多轮查找才能形成安全序列，清晰展示 Work 变化与资源释放过程',
            tags: ['安全', '多轮', '课堂演示'],
            config: {
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
                ]
            }
        },
        {
            name: '④ 不安全状态',
            description: '无进程满足 Need ≤ Work，系统不安全。演示安全状态 ≠ 死锁但存在死锁风险',
            tags: ['不安全', '检测', '重要'],
            config: {
                totalResources: [7, 4, 5],
                processes: ['P0', 'P1', 'P2'],
                max: [
                    [4, 2, 2],
                    [3, 2, 2],
                    [5, 3, 3]
                ],
                allocation: [
                    [2, 1, 1],
                    [2, 1, 1],
                    [2, 2, 2]
                ]
            }
        },
        {
            name: '⑤ 资源请求成功',
            description: 'P1 请求 (1,0,2)：Request ≤ Need ∧ Request ≤ Available → 试分配后仍安全 → 批准',
            tags: ['请求', '成功', '教学'],
            config: {
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
                requestProcess: 'P1',
                requestVector: [1, 0, 2]
            }
        },
        {
            name: '⑥ 资源请求失败',
            description: 'P4 请求 (3,3,0)：试分配后不存在安全序列 → 拒绝分配。Request≤Available 不代表一定能分配',
            tags: ['请求', '失败', '重要'],
            config: {
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
                requestProcess: 'P4',
                requestVector: [3, 3, 0]
            }
        }
    ],

    diskScheduling: [
        {
            name: '① 局部聚簇型（SSTF优势）',
            description: '强局部连续 + 单个远点簇，SSTF在局部密集场景下优势明显',
            tags: ['SSTF', '局部性', '对比'],
            config: {
                algorithm: 'SSTF',
                requests: [48, 49, 50, 51, 52, 150, 151, 152, 153],
                headPosition: 53,
                direction: 'right',
                minTrack: 0,
                maxTrack: 199
            }
        },
        {
            name: '② 极端对称分布型（SCAN vs LOOK）',
            description: '均匀对称分布，SCAN到边界反向 vs LOOK不到边界，对比差异明显',
            tags: ['SCAN', 'LOOK', '对比'],
            config: {
                algorithm: 'SCAN',
                requests: [10, 30, 50, 70, 90, 110, 130, 150],
                headPosition: 53,
                direction: 'right',
                minTrack: 0,
                maxTrack: 199
            }
        },
        {
            name: '③ 单侧密集+远端孤点（SCAN/C-SCAN差异）',
            description: '大部分集中在55-70，单个远点180，SCAN会到边界而C-SCAN大跳回起点',
            tags: ['SCAN', 'C-SCAN', '对比'],
            config: {
                algorithm: 'SCAN',
                requests: [55, 58, 60, 62, 65, 68, 70, 180],
                headPosition: 53,
                direction: 'right',
                minTrack: 0,
                maxTrack: 199
            }
        },
        {
            name: '④ 极端交错序列（所有算法差异最大）',
            description: '高低交替+强烈跨磁盘跳跃，FCFS/SSTF/SCAN/C-SCAN表现差异最大',
            tags: ['FCFS', 'SSTF', 'SCAN', 'C-SCAN', '对比'],
            config: {
                algorithm: 'FCFS',
                requests: [10, 190, 20, 180, 30, 170, 40, 160],
                headPosition: 53,
                direction: 'right',
                minTrack: 0,
                maxTrack: 199
            }
        }
    ],

    producerConsumer: [
        {
            name: '缓冲区竞争',
            description: '多生产者多消费者共享缓冲区竞争场景',
            tags: ['竞争', '经典'],
            config: {
                bufferSize: 5,
                producers: 2,
                consumers: 2,
                maxItems: 10,
                consumeBatchSize: 1
            }
        },
        {
            name: '缓冲区满等待',
            description: '小缓冲区+多生产者，演示缓冲区满时生产者等待的场景',
            tags: ['等待', '满缓冲区', '阻塞'],
            config: {
                bufferSize: 3,
                producers: 3,
                consumers: 1,
                maxItems: 12,
                consumeBatchSize: 1
            }
        },
        {
            name: '缓冲区空等待',
            description: '消费者多于生产者，演示缓冲区空时消费者等待的场景',
            tags: ['等待', '空缓冲区', '阻塞'],
            config: {
                bufferSize: 4,
                producers: 1,
                consumers: 3,
                maxItems: 8,
                consumeBatchSize: 1
            }
        },
        {
            name: '1对1经典同步',
            description: '一个生产者一个消费者，最简单的同步互斥演示',
            tags: ['1对1', '同步', '基础'],
            config: {
                bufferSize: 5,
                producers: 1,
                consumers: 1,
                maxItems: 10,
                consumeBatchSize: 1
            }
        },
        {
            name: '多对多高并发',
            description: '多个生产者和消费者同时工作，演示高并发场景下的同步机制',
            tags: ['多对多', '高并发', '复杂'],
            config: {
                bufferSize: 8,
                producers: 4,
                consumers: 4,
                maxItems: 20,
                consumeBatchSize: 1
            }
        },
        {
            name: '批量消费演示',
            description: '演示消费者一次连续消费多个物品的场景',
            tags: ['批量消费', '演示'],
            config: {
                bufferSize: 6,
                producers: 1,
                consumers: 1,
                maxItems: 12,
                consumeBatchSize: 3
            }
        }
    ]
};
