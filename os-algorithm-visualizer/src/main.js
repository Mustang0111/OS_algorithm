/* ============================================
   OS Algorithm Visualizer - 主入口
   初始化所有组件，启动应用
   ============================================ */

import { stateManager } from './core/stateManager.js';
import { scheduler } from './core/scheduler.js';
import { animationEngine } from './core/animationEngine.js';
import { Toolbar } from './components/toolbar.js';
import { Sidebar } from './components/sidebar.js';
import { ControlPanel } from './components/controlPanel.js';
import { ExplanationPanel } from './components/explanationPanel.js';
import { PresetPanel } from './components/presetPanel.js';

// 导入模块
import { PageReplacementSimulator, PageReplacementRenderer } from './modules/pageReplacement/index.js';
import { CpuSchedulingSimulator, CpuSchedulingRenderer } from './modules/cpuScheduling/index.js';
import { DiskSchedulingSimulator, DiskSchedulingRenderer } from './modules/diskScheduling/index.js';
import { BankerSimulator, BankerRenderer } from './modules/banker/index.js';
import { ProducerConsumerSimulator, ProducerConsumerRenderer } from './modules/producerConsumer/index.js';
import { PlaceholderSimulator } from './modules/placeholder/simulator.js';
import { PlaceholderRenderer } from './modules/placeholder/renderer.js';

// 导入样式
import './styles/base.css';
import './styles/theme.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/animations.css';

class App {
    constructor() {
        this._components = {};
        this._modules = {};
        this._currentModuleId = null;
    }

    /**
     * 初始化应用
     */
    async init() {
        // 获取容器
        const appEl = document.getElementById('app');
        if (!appEl) {
            console.error('App container not found');
            return;
        }

        // 注册模块
        this._registerModules();

        // 初始化调度器
        scheduler.init(this._modules);

        // 初始化组件
        this._initComponents();

        // 默认加载页面置换模块
        this._switchModule('pageReplacement');

        // 启动动画引擎（兼容旧调用）
        animationEngine.init();

        console.log('OS Algorithm Visualizer initialized');
    }

    /**
     * 初始化组件
     */
    _initComponents() {
        // 顶部工具栏
        const toolbar = new Toolbar();
        toolbar.render(document.getElementById('toolbar'));
        this._components.toolbar = toolbar;

        // 左侧导航栏
        const sidebar = new Sidebar();
        sidebar.render(document.getElementById('sidebar'));
        this._components.sidebar = sidebar;

        // 默认激活页面置换
        sidebar.setActive('pageReplacement');

        // 底部控制面板
        const controlPanel = new ControlPanel();
        controlPanel.render(document.getElementById('control-panel'));
        this._components.controlPanel = controlPanel;

        // 教学解释面板
        const explanationPanel = new ExplanationPanel();
        explanationPanel.render(document.getElementById('explanation-panel'));
        this._components.explanationPanel = explanationPanel;

        // 预设面板
        const presetPanel = new PresetPanel();
        presetPanel.render(document.getElementById('preset-overlay'));
        this._components.presetPanel = presetPanel;

        // 绑定HTML sidebar按钮点击事件
        document.querySelectorAll('.sidebar-item[data-module]').forEach(btn => {
            btn.addEventListener('click', () => {
                stateManager.emit('module:switch', btn.dataset.module);
            });
        });

        // 绑定HTML控制按钮事件
        document.getElementById('btnPlay')?.addEventListener('click', () => {
            stateManager.emit('control:play');
        });
        document.getElementById('btnNext')?.addEventListener('click', () => {
            stateManager.emit('control:next');
        });
        document.getElementById('btnPrev')?.addEventListener('click', () => {
            stateManager.emit('control:prev');
        });
        document.getElementById('btnReset')?.addEventListener('click', () => {
            stateManager.emit('control:reset');
        });
        document.getElementById('btnPreset')?.addEventListener('click', () => {
            stateManager.emit('preset:open');
        });
        document.getElementById('speedSlider')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const speed = value / 5;
            document.getElementById('speedValue').textContent = speed.toFixed(1) + 'x';
            animationEngine.setSpeed(value);
        });

        // 监听模块切换事件
        stateManager.on('module:switch', (moduleId) => {
            this._switchModule(moduleId);
        });

        // 监听模块加载完成事件，更新侧边栏高亮
        stateManager.on('module:loaded', (data) => {
            if (this._components.sidebar) {
                this._components.sidebar.setActive(data.moduleId);
            }
        });
    }

    /**
     * 注册模块
     */
    _registerModules() {
        // 页面置换模块（真实实现）
        const pageReplacementSim = new PageReplacementSimulator();
        const pageReplacementRenderer = new PageReplacementRenderer(pageReplacementSim);

        this._modules.pageReplacement = {
            id: 'pageReplacement',
            name: '页面置换',
            simulator: pageReplacementSim,
            renderer: pageReplacementRenderer
        };

        // CPU调度模块（真实实现）
        const cpuSchedulingSim = new CpuSchedulingSimulator();
        const cpuSchedulingRenderer = new CpuSchedulingRenderer(cpuSchedulingSim);
        this._modules.cpuScheduling = {
            id: 'cpuScheduling',
            name: 'CPU调度',
            simulator: cpuSchedulingSim,
            renderer: cpuSchedulingRenderer
        };

        // 银行家算法模块（真实实现）
        const bankerSim = new BankerSimulator();
        const bankerRenderer = new BankerRenderer(bankerSim);
        this._modules.banker = {
            id: 'banker',
            name: '银行家算法',
            simulator: bankerSim,
            renderer: bankerRenderer
        };

        // 磁盘调度模块（真实实现）
        const diskSchedulingSim = new DiskSchedulingSimulator();
        const diskSchedulingRenderer = new DiskSchedulingRenderer();
        this._modules.diskScheduling = {
            id: 'diskScheduling',
            name: '磁盘调度',
            simulator: diskSchedulingSim,
            renderer: diskSchedulingRenderer
        };

        // 生产者消费者模块（真实实现）
        const producerConsumerSim = new ProducerConsumerSimulator();
        const producerConsumerRenderer = new ProducerConsumerRenderer(producerConsumerSim);
        this._modules.producerConsumer = {
            id: 'producerConsumer',
            name: '生产者消费者',
            simulator: producerConsumerSim,
            renderer: producerConsumerRenderer
        };
    }

    /**
     * 切换模块 - 统一使用 scheduler 进行切换
     * @param {string} moduleId
     */
    _switchModule(moduleId) {
        if (moduleId === this._currentModuleId) return;

        const module = this._modules[moduleId];
        if (!module) {
            console.warn(`Module "${moduleId}" not found`);
            return;
        }

        this._currentModuleId = moduleId;

        // 获取渲染容器
        const container = document.getElementById('module-container');
        if (!container) return;

        // 使用调度器进行切换（包含完整的生命周期管理）
        scheduler.switchTo(moduleId, container);
    }

    /**
     * 获取当前模块ID
     */
    getCurrentModuleId() {
        return this._currentModuleId;
    }
}

// 启动应用
const app = new App();

// DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

export default app;
