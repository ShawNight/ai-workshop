import { create } from 'zustand';

// 节点类型定义
export const nodeTypes = [
  {
    id: 'input',
    name: '输入',
    icon: '📥',
    color: 'bg-blue-500',
    description: '用户输入节点',
    inputs: [],
    outputs: [{ id: 'out-1', label: '数据' }],
    defaultConfig: { text: '' }
  },
  {
    id: 'llm',
    name: 'LLM',
    icon: '🤖',
    color: 'bg-purple-500',
    description: '语言模型处理',
    inputs: [{ id: 'in-1', label: '输入' }],
    outputs: [{ id: 'out-1', label: '输出' }],
    defaultConfig: { prompt: '', model: 'abab6.5s-chat' }
  },
  {
    id: 'music',
    name: '音乐',
    icon: '🎵',
    color: 'bg-pink-500',
    description: '音乐生成节点',
    inputs: [{ id: 'in-1', label: '歌词' }],
    outputs: [{ id: 'out-1', label: '音频' }],
    defaultConfig: { style: '流行', lyrics: '' }
  },
  {
    id: 'output',
    name: '输出',
    icon: '📤',
    color: 'bg-green-500',
    description: '结果输出节点',
    inputs: [{ id: 'in-1', label: '数据' }],
    outputs: [],
    defaultConfig: {}
  }
];

// 根据节点类型获取默认节点数据
export const createNodeData = (type, position) => {
  const nodeType = nodeTypes.find(t => t.id === type);
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    label: nodeType?.name || '节点',
    position,
    config: nodeType?.defaultConfig || {},
    inputs: nodeType?.inputs || [],
    outputs: nodeType?.outputs || []
  };
};

export const useWorkflowStore = create((set, get) => ({
  // 工作流列表
  workflows: [],
  // 当前编辑的工作流
  currentWorkflow: null,
  // 当前画布上的节点
  nodes: [],
  // 当前画布上的连线
  edges: [],
  // 选中的节点
  selectedNode: null,
  // 选中的连线
  selectedEdge: null,
  // 正在拖拽的连线（临时状态）
  connectingFrom: null, // { nodeId, portId, portType: 'output' }
  // 执行状态
  executionStatus: null, // 'idle' | 'running' | 'completed' | 'error'
  executionResults: {}, // { nodeId: { output, status, error } }
  finalOutput: null,

  // === 工作流列表操作 ===
  setWorkflows: (workflows) => set({ workflows }),

  addWorkflow: (workflow) => set((state) => ({
    workflows: [...state.workflows, workflow]
  })),

  removeWorkflow: (id) => set((state) => ({
    workflows: state.workflows.filter(w => w.id !== id),
    currentWorkflow: state.currentWorkflow?.id === id ? null : state.currentWorkflow
  })),

  // === 当前工作流操作 ===
  setCurrentWorkflow: (workflow) => set({
    currentWorkflow: workflow,
    nodes: workflow?.nodes || [],
    edges: workflow?.edges || [],
    selectedNode: null,
    selectedEdge: null,
    executionStatus: 'idle',
    executionResults: {},
    finalOutput: null
  }),

  clearCurrentWorkflow: () => set({
    currentWorkflow: null,
    nodes: [],
    edges: [],
    selectedNode: null,
    selectedEdge: null
  }),

  // === 节点操作 ===
  addNode: (node) => set((state) => ({
    nodes: [...state.nodes, node]
  })),

  updateNode: (nodeId, updates) => set((state) => ({
    nodes: state.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
    selectedNode: state.selectedNode?.id === nodeId
      ? { ...state.selectedNode, ...updates }
      : state.selectedNode
  })),

  updateNodePosition: (nodeId, position) => set((state) => ({
    nodes: state.nodes.map(n => n.id === nodeId ? { ...n, position } : n)
  })),

  updateNodeConfig: (nodeId, config) => set((state) => ({
    nodes: state.nodes.map(n => n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n),
    selectedNode: state.selectedNode?.id === nodeId
      ? { ...state.selectedNode, config: { ...state.selectedNode.config, ...config } }
      : state.selectedNode
  })),

  removeNode: (nodeId) => set((state) => ({
    nodes: state.nodes.filter(n => n.id !== nodeId),
    edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode
  })),

  setSelectedNode: (node) => set({
    selectedNode: node,
    selectedEdge: null // 选中节点时取消选中连线
  }),

  // === 连线操作 ===
  addEdge: (edge) => set((state) => ({
    edges: [...state.edges, edge]
  })),

  removeEdge: (edgeId) => set((state) => ({
    edges: state.edges.filter(e => e.id !== edgeId),
    selectedEdge: state.selectedEdge?.id === edgeId ? null : state.selectedEdge
  })),

  setSelectedEdge: (edge) => set({
    selectedEdge: edge,
    selectedNode: null // 选中连线时取消选中节点
  }),

  // === 连线拖拽状态 ===
  setConnectingFrom: (data) => set({ connectingFrom: data }),

  clearConnecting: () => set({ connectingFrom: null }),

  // 检查是否可以连接（避免重复连接和循环）
  canConnect: (sourceId, targetId) => {
    const state = get();
    // 检查是否已存在相同连接
    const existingEdge = state.edges.find(
      e => e.source === sourceId && e.target === targetId
    );
    if (existingEdge) return false;

    // 检查是否会形成循环（简单检查：target 不能连接回 source 的上游）
    const wouldCreateCycle = (from, to) => {
      const visited = new Set();
      const dfs = (nodeId) => {
        if (visited.has(nodeId)) return false;
        if (nodeId === from) return true;
        visited.add(nodeId);
        const upstreamEdges = state.edges.filter(e => e.target === nodeId);
        return upstreamEdges.some(e => dfs(e.source));
      };
      return dfs(to);
    };

    if (wouldCreateCycle(sourceId, targetId)) return false;

    return true;
  },

  // === 执行状态 ===
  setExecutionStatus: (status) => set({ executionStatus: status }),

  setExecutionResults: (results) => set({ executionResults: results }),

  setFinalOutput: (output) => set({ finalOutput: output }),

  resetExecution: () => set({
    executionStatus: 'idle',
    executionResults: {},
    finalOutput: null
  }),

  // === 保存工作流 ===
  getSaveData: () => {
    const state = get();
    return {
      nodes: state.nodes,
      edges: state.edges
    };
  }
}));