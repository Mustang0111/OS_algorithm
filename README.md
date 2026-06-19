# OS Algorithm Visualizer

操作系统核心算法可视化教学平台，用动画和逐步执行的方式展示算法运行过程，适合课程学习、课堂演示和实验展示。

## 功能

- 页面置换：FIFO、LRU、OPT，展示内存块变化、缺页命中与缺页率。
- CPU 调度：FCFS、SJF、RR、优先级调度，展示甘特图、就绪队列和时间统计。
- 银行家算法：资源分配、安全性检测与请求模拟。
- 磁盘调度：FCFS、SCAN、C-SCAN、LOOK、C-LOOK，展示磁头移动轨迹。
- 生产者消费者：缓冲区状态、生产/消费动作和同步互斥过程。

## 技术栈

- Vite
- 原生 JavaScript ES Modules
- 原生 CSS
- DOM + Canvas

## 运行

```bash
npm install
npm run dev
```

构建与预览：

```bash
npm run build
npm run preview
```

## 目录

```text
os-algorithm-visualizer/
├─ index.html
├─ vite.config.js
└─ src/
   ├─ components/   # 通用 UI
   ├─ core/         # 模拟器、调度器、渲染等核心逻辑
   ├─ modules/      # 各类操作系统算法模块
   ├─ presets/      # 预设案例
   ├─ styles/       # 样式
   └─ utils/        # 工具函数
```

## License

MIT