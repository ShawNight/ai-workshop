import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Label, Textarea } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { workflowApi } from '../api';
import { toast } from '../components/ui/Toast';
import {
  useWorkflowStore,
  nodeTypes,
  createNodeData
} from '../store/workflowStore';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  useDraggable
} from '@dnd-kit/core';
import {
  Workflow,
  Plus,
  Trash2,
  Play,
  Save,
  X,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

// 可拖拽的节点模板（从节点库拖出）
function DraggableNodeTemplate({ nodeType }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${nodeType.id}`,
    data: { type: 'template', nodeType }
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-grab active:cursor-grabbing hover:border-[var(--primary)] transition-colors ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded ${nodeType.color} flex items-center justify-center text-white`}>
          {nodeType.icon}
        </div>
        <div>
          <p className="font-medium text-sm">{nodeType.name}</p>
          <p className="text-xs text-[var(--text-secondary)]">{nodeType.description}</p>
        </div>
      </div>
    </div>
  );
}

// 画布上的工作流节点
function WorkflowCanvasNode({ node, isSelected, onSelect, onMove, onPortDragStart, onPortDragEnd }) {
  const nodeRef = useRef(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const nodeType = nodeTypes.find(t => t.id === node.type);

  // 节点拖拽移动
  const handleMouseDown = (e) => {
    // 如果点击的是端口，不触发节点拖拽
    if (e.target.closest('.node-port')) return;

    e.preventDefault();
    setIsDraggingNode(true);
    const rect = nodeRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  useEffect(() => {
    if (!isDraggingNode) return;

    const handleMouseMove = (e) => {
      const canvas = nodeRef.current?.closest('.workflow-canvas');
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const newX = e.clientX - canvasRect.left - dragOffset.x;
      const newY = e.clientY - canvasRect.top - dragOffset.y;

      // 限制在画布范围内
      const clampedX = Math.max(0, Math.min(newX, canvasRect.width - 180));
      const clampedY = Math.max(0, Math.min(newY, canvasRect.height - 100));

      onMove(node.id, { x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      setIsDraggingNode(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingNode, dragOffset, node.id, onMove]);

  return (
    <div
      ref={nodeRef}
      className={`absolute select-none ${isDraggingNode ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ left: node.position.x, top: node.position.y }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
    >
      <div className={`p-4 rounded-lg border-2 min-w-[180px] max-w-[200px] transition-shadow ${isSelected ? 'border-[var(--primary)] shadow-lg ring-2 ring-[var(--primary)]/20' : 'border-[var(--border)] hover:border-[var(--primary)]/50'} bg-[var(--surface)]`}>
        {/* 节点头部 */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded ${nodeType?.color} flex items-center justify-center text-white text-sm`}>
            {nodeType?.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{node.label}</p>
            <p className="text-xs text-[var(--text-secondary)] truncate">{nodeType?.name}</p>
          </div>
        </div>

        {/* 端口区域 */}
        <div className="relative">
          {/* 输入端口（左侧） */}
          {node.inputs?.map((port, idx) => (
            <div
              key={port.id}
              className="node-port absolute -left-3 flex items-center"
              style={{ top: `${idx * 24 + 8}px` }}
              onMouseUp={(e) => {
                e.stopPropagation();
                onPortDragEnd(node.id, port.id, 'input');
              }}
            >
              <div className="w-6 h-6 rounded-full bg-[var(--border)] border-2 border-[var(--text-secondary)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors flex items-center justify-center cursor-pointer" title={port.label}>
                <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)]" />
              </div>
            </div>
          ))}

          {/* 输出端口（右侧） */}
          {node.outputs?.map((port, idx) => (
            <div
              key={port.id}
              className="node-port absolute -right-3 flex items-center justify-end"
              style={{ top: `${idx * 24 + 8}px` }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onPortDragStart(node.id, port.id, 'output');
              }}
            >
              <div className="w-6 h-6 rounded-full bg-[var(--border)] border-2 border-[var(--text-secondary)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors flex items-center justify-center cursor-grab" title={port.label}>
                <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 连线组件
function ConnectionLine({ edge, nodes, isSelected, onSelect, onDelete }) {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  if (!sourceNode || !targetNode) return null;

  // 计算连线的起点和终点
  const sourceX = sourceNode.position.x + 180 + 3; // 节点宽度 + 端口偏移
  const sourceY = sourceNode.position.y + 50; // 端口高度偏移
  const targetX = targetNode.position.x - 3;
  const targetY = targetNode.position.y + 50;

  // 贝塞尔曲线控制点
  const controlOffset = Math.min(80, Math.abs(targetX - sourceX) / 2);
  const path = `M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`;

  return (
    <g
      className={`cursor-pointer ${isSelected ? 'stroke-[var(--primary)]' : 'stroke-[var(--text-secondary)]'}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(edge);
      }}
    >
      {/* 背景粗线用于更好的点击检测 */}
      <path
        d={path}
        strokeWidth={10}
        fill="none"
        stroke="transparent"
      />
      {/* 实际显示的连线 */}
      <path
        d={path}
        strokeWidth={2}
        fill="none"
        className={`${isSelected ? 'stroke-[var(--primary)]' : 'stroke-[var(--text-secondary)] opacity-50'} hover:stroke-[var(--primary)] hover:opacity-100 transition-all`}
      />
      {/* 箭头 */}
      <circle cx={targetX} cy={targetY} r={4} fill={isSelected ? 'var(--primary)' : 'var(--text-secondary)'} className="opacity-50" />
    </g>
  );
}

// 正在拖拽的临时连线
function DraggingConnection({ fromNode, toPosition }) {
  if (!fromNode) return null;

  const sourceX = fromNode.position.x + 180 + 3;
  const sourceY = fromNode.position.y + 50;
  const targetX = toPosition.x;
  const targetY = toPosition.y;

  const controlOffset = Math.min(80, Math.abs(targetX - sourceX) / 2);
  const path = `M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`;

  return (
    <path
      d={path}
      strokeWidth={2}
      fill="none"
      stroke="var(--primary)"
      className="opacity-70"
      strokeDasharray="5,5"
    />
  );
}

// 画布组件
function WorkflowCanvas({
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  connectingFrom,
  dragPosition,
  onNodeSelect,
  onNodeMove,
  onEdgeSelect,
  onEdgeDelete,
  onPortDragStart,
  onPortDragEnd,
  onCanvasDrop
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });
  const canvasRef = useRef(null);

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        canvasRef.current = el;
      }}
      className={`workflow-canvas flex-1 min-h-[500px] bg-[var(--background)] rounded-lg border border-[var(--border)] relative overflow-hidden ${isOver ? 'ring-2 ring-[var(--primary)]' : ''}`}
      onClick={() => {
        onNodeSelect(null);
        onEdgeSelect(null);
      }}
    >
      {/* 网格背景 */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />

      {/* 空状态提示 */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-[var(--text-secondary)]">
            <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>从左侧拖拽节点到此处</p>
          </div>
        </div>
      )}

      {/* SVG 连线层 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ zIndex: 1 }}>
        {/* 已有连线 */}
        {edges.map((edge) => (
          <ConnectionLine
            key={edge.id}
            edge={edge}
            nodes={nodes}
            isSelected={selectedEdge?.id === edge.id}
            onSelect={onEdgeSelect}
            onDelete={onEdgeDelete}
          />
        ))}
        {/* 正在拖拽的临时连线 */}
        {connectingFrom && dragPosition && (
          <DraggingConnection
            fromNode={nodes.find(n => n.id === connectingFrom.nodeId)}
            toPosition={dragPosition}
          />
        )}
      </svg>

      {/* 节点层 */}
      <div className="absolute inset-0" style={{ zIndex: 2 }}>
        {nodes.map((node) => (
          <WorkflowCanvasNode
            key={node.id}
            node={node}
            isSelected={selectedNode?.id === node.id}
            onSelect={onNodeSelect}
            onMove={onNodeMove}
            onPortDragStart={onPortDragStart}
            onPortDragEnd={onPortDragEnd}
          />
        ))}
      </div>
    </div>
  );
}

// 节点配置面板
function NodeConfigPanel({ node, onUpdateConfig, onDelete }) {
  const nodeType = nodeTypes.find(t => t.id === node.type);

  if (!node) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded ${nodeType?.color} flex items-center justify-center text-white text-xs`}>
            {nodeType?.icon}
          </div>
          {node.label} 配置
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={() => onDelete(node.id)}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 通用：节点名称 */}
        <div>
          <Label>节点名称</Label>
          <Input
            value={node.label || ''}
            onChange={(e) => onUpdateConfig(node.id, { label: e.target.value })}
            placeholder="输入节点名称..."
            className="mt-1"
          />
        </div>

        {/* 类型特定配置 */}
        {node.type === 'input' && (
          <div>
            <Label>输入内容</Label>
            <Textarea
              value={node.config?.text || ''}
              onChange={(e) => onUpdateConfig(node.id, { config: { ...node.config, text: e.target.value } })}
              placeholder="输入初始数据..."
              className="mt-1 min-h-[100px]"
            />
          </div>
        )}

        {node.type === 'llm' && (
          <>
            <div>
              <Label>Prompt 模板</Label>
              <Textarea
                value={node.config?.prompt || ''}
                onChange={(e) => onUpdateConfig(node.id, { config: { ...node.config, prompt: e.target.value } })}
                placeholder="输入提示词模板，使用 {{input}} 引用上游数据..."
                className="mt-1 min-h-[80px]"
              />
              <p className="text-xs text-[var(--text-secondary)] mt-1">使用 {'{{input}}'} 表示上游节点的输出</p>
            </div>
            <div>
              <Label>模型选择</Label>
              <Select
                value={node.config?.model || 'abab6.5s-chat'}
                onChange={(e) => onUpdateConfig(node.id, { config: { ...node.config, model: e.target.value } })}
                className="mt-1"
              >
                <option value="abab6.5s-chat">abab6.5s-chat</option>
                <option value="abab6.5g-chat">abab6.5g-chat</option>
                <option value="abab5.5-chat">abab5.5-chat</option>
              </Select>
            </div>
          </>
        )}

        {node.type === 'music' && (
          <>
            <div>
              <Label>歌词（可选，覆盖上游输入）</Label>
              <Textarea
                value={node.config?.lyrics || ''}
                onChange={(e) => onUpdateConfig(node.id, { config: { ...node.config, lyrics: e.target.value } })}
                placeholder="留空则使用上游节点的输出作为歌词..."
                className="mt-1 min-h-[80px]"
              />
            </div>
            <div>
              <Label>音乐风格</Label>
              <Select
                value={node.config?.style || '流行'}
                onChange={(e) => onUpdateConfig(node.id, { config: { ...node.config, style: e.target.value } })}
                className="mt-1"
              >
                <option value="流行">流行</option>
                <option value="摇滚">摇滚</option>
                <option value="民谣">民谣</option>
                <option value="电子">电子</option>
                <option value="古典">古典</option>
              </Select>
            </div>
          </>
        )}

        {node.type === 'output' && (
          <div className="p-4 bg-[var(--background)] rounded-lg border border-[var(--border)]">
            <p className="text-sm text-[var(--text-secondary)]">
              此节点将显示工作流的最终输出结果。执行工作流后可在此查看结果。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 连线信息面板
function EdgeInfoPanel({ edge, nodes, onDelete }) {
  if (!edge) return null;

  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>连接详情</CardTitle>
        <Button size="sm" variant="ghost" onClick={() => onDelete(edge.id)}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{sourceNode?.label}</span>
          <span className="text-[var(--text-secondary)]">→</span>
          <span className="font-medium">{targetNode?.label}</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-2">点击删除按钮可移除此连接</p>
      </CardContent>
    </Card>
  );
}

// 执行结果面板
function ExecutionResultPanel({ status, results, finalOutput }) {
  if (status === 'idle') return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          执行结果
          {status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />}
          {status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
          {status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(results).map(([nodeId, result]) => (
          <div key={nodeId} className="p-3 bg-[var(--background)] rounded-lg border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-sm">{result.nodeName}</span>
              {result.status === 'success' && <CheckCircle className="h-3 w-3 text-green-500" />}
              {result.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
              {result.status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
            </div>
            {result.output && (
              <p className="text-xs text-[var(--text-secondary)] line-clamp-3">{result.output}</p>
            )}
            {result.error && (
              <p className="text-xs text-red-500">{result.error}</p>
            )}
          </div>
        ))}

        {finalOutput && (
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
            <p className="text-sm font-medium text-green-600 mb-1">最终输出</p>
            <p className="text-xs text-[var(--text-secondary)]">{finalOutput}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 主页面组件
export function WorkflowsPage() {
  const store = useWorkflowStore();
  const {
    workflows,
    currentWorkflow,
    nodes,
    edges,
    selectedNode,
    selectedEdge,
    executionStatus,
    executionResults,
    finalOutput,
    setWorkflows,
    addWorkflow,
    removeWorkflow,
    setCurrentWorkflow,
    clearCurrentWorkflow,
    addNode,
    updateNodePosition,
    updateNodeConfig,
    removeNode,
    setSelectedNode,
    addEdge,
    removeEdge,
    setSelectedEdge,
    setConnectingFrom,
    clearConnecting,
    canConnect,
    setExecutionStatus,
    setExecutionResults,
    setFinalOutput,
    resetExecution,
    getSaveData
  } = store;

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [activeData, setActiveData] = useState(null); // 保存拖拽时的数据
  const [connectingFromState, setConnectingFromLocal] = useState(null);
  const [dragPosition, setDragPosition] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const response = await workflowApi.getWorkflows();
      if (response.data.success) {
        setWorkflows(response.data.workflows);
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newName.trim()) {
      toast.error('请输入工作流名称');
      return;
    }

    try {
      const response = await workflowApi.createWorkflow({ name: newName });
      if (response.data.success) {
        addWorkflow(response.data.workflow);
        setCurrentWorkflow(response.data.workflow);
        setIsCreating(false);
        setNewName('');
        toast.success('工作流创建成功');
      }
    } catch (error) {
      toast.error('创建失败');
    }
  };

  const handleSaveWorkflow = async () => {
    if (!currentWorkflow) return;

    try {
      const saveData = getSaveData();
      await workflowApi.updateWorkflow(currentWorkflow.id, saveData);
      toast.success('保存成功');
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const handleExecuteWorkflow = async () => {
    if (!currentWorkflow || nodes.length === 0) {
      toast.warning('请先添加节点');
      return;
    }

    setIsExecuting(true);
    resetExecution();
    setExecutionStatus('running');

    try {
      const response = await workflowApi.executeWorkflow(currentWorkflow.id, {
        nodes,
        edges
      });

      if (response.data.success) {
        setExecutionStatus('completed');
        setExecutionResults(response.data.results || {});
        setFinalOutput(response.data.finalOutput);
        toast.success('执行完成');
      } else {
        setExecutionStatus('error');
        toast.error(response.data.error || '执行失败');
      }
    } catch (error) {
      setExecutionStatus('error');
      toast.error('执行失败');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDeleteWorkflow = async (id) => {
    try {
      await workflowApi.deleteWorkflow(id);
      removeWorkflow(id);
      toast.success('已删除');
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // === DnD Kit 事件处理 ===

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    // 在拖拽开始时保存数据，避免在结束时数据丢失
    setActiveData(event.active.data.current);
  };

  const handleDragEnd = (event) => {
    const { over } = event;
    setActiveId(null);
    setActiveData(null);

    if (!over || over.id !== 'canvas') return;

    // 使用在 handleDragStart 时保存的数据
    if (activeData?.type === 'template') {
      // 从节点库拖拽新节点到画布
      const canvasRect = over.rect;
      const dropX = event.activatorEvent?.clientX - canvasRect.left - 90 || 100;
      const dropY = event.activatorEvent?.clientY - canvasRect.top - 50 || 100;

      const newNode = createNodeData(activeData.nodeType.id, { x: Math.max(0, dropX), y: Math.max(0, dropY) });
      addNode(newNode);
      toast.success(`已添加 ${activeData.nodeType.name} 节点`);
    }
  };

  // === 端口连线处理 ===

  const handlePortDragStart = (nodeId, portId, portType) => {
    if (portType === 'output') {
      setConnectingFromLocal({ nodeId, portId, portType });
    }
  };

  const handlePortDragEnd = (targetNodeId, targetPortId, targetPortType) => {
    if (!connectingFromState || targetPortType !== 'input') {
      setConnectingFromLocal(null);
      setDragPosition(null);
      return;
    }

    const sourceNodeId = connectingFromState.nodeId;

    if (sourceNodeId === targetNodeId) {
      toast.warning('不能连接到自己');
      setConnectingFromLocal(null);
      setDragPosition(null);
      return;
    }

    if (!canConnect(sourceNodeId, targetNodeId)) {
      toast.warning('连接已存在或会形成循环');
      setConnectingFromLocal(null);
      setDragPosition(null);
      return;
    }

    const newEdge = {
      id: `edge-${Date.now()}`,
      source: sourceNodeId,
      sourcePort: connectingFromState.portId,
      target: targetNodeId,
      targetPort: targetPortId
    };

    addEdge(newEdge);
    toast.success('连接创建成功');
    setConnectingFromLocal(null);
    setDragPosition(null);
  };

  // 鼠标移动时更新拖拽连线位置
  useEffect(() => {
    if (!connectingFromState) return;

    const handleMouseMove = (e) => {
      const canvas = document.querySelector('.workflow-canvas');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      setDragPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    };

    const handleMouseUp = () => {
      // 如果鼠标释放时没有落到输入端口，取消连线
      setConnectingFromLocal(null);
      setDragPosition(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [connectingFromState]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="h-6 w-6 text-[var(--accent)]" />
            工作流编排
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">拖拽式工作流构建器</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4" />
          新建工作流
        </Button>
      </div>

      {/* 创建新工作流对话框 */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>创建新工作流</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>工作流名称</Label>
              <Input
                placeholder="输入工作流名称..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateWorkflow}>
                <Save className="h-4 w-4" />
                创建
              </Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 工作流列表或编辑器 */}
      {!currentWorkflow ? (
        /* 工作流列表 */
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold group-hover:text-[var(--primary)] transition-colors">
                      {workflow.name}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {workflow.nodes?.length || 0} 节点 · {workflow.edges?.length || 0} 连接
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWorkflow(workflow.id);
                    }}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
                  {workflow.description || '暂无描述'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentWorkflow(workflow)}
                >
                  编辑
                </Button>
              </CardContent>
            </Card>
          ))}
          {workflows.length === 0 && (
            <div className="col-span-full text-center py-12 text-[var(--text-secondary)]">
              <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>还没有工作流</p>
              <p className="text-sm">点击右上角按钮创建第一个工作流</p>
            </div>
          )}
        </div>
      ) : (
        /* 工作流编辑器 */
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="space-y-4">
          {/* 工具栏 */}
          <Card>
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => clearCurrentWorkflow()}>
                  <X className="h-4 w-4" />
                  返回
                </Button>
                <h2 className="font-semibold">{currentWorkflow.name}</h2>
                <span className="text-xs text-[var(--text-secondary)]">
                  {nodes.length} 节点 · {edges.length} 连接
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleSaveWorkflow}>
                  <Save className="h-4 w-4" />
                  保存
                </Button>
                <Button onClick={handleExecuteWorkflow} disabled={isExecuting || nodes.length === 0}>
                  {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {isExecuting ? '执行中...' : '执行'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 编辑器主体 */}
          <div className="grid lg:grid-cols-4 gap-4">
            {/* 节点库 */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>节点库</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {nodeTypes.map((nodeType) => (
                  <DraggableNodeTemplate key={nodeType.id} nodeType={nodeType} />
                ))}
              </CardContent>
            </Card>

            {/* 画布 */}
            <div className="lg:col-span-3">
              <WorkflowCanvas
                nodes={nodes}
                edges={edges}
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                connectingFrom={connectingFromState}
                dragPosition={dragPosition}
                onNodeSelect={setSelectedNode}
                onNodeMove={updateNodePosition}
                onEdgeSelect={setSelectedEdge}
                onEdgeDelete={removeEdge}
                onPortDragStart={handlePortDragStart}
                onPortDragEnd={handlePortDragEnd}
              />
              <DragOverlay>
                {activeId ? (
                  <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--primary)] shadow-lg">
                    <p className="text-sm font-medium">拖拽中...</p>
                  </div>
                ) : null}
              </DragOverlay>
            </div>
          </div>

          {/* 配置/信息面板 */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* 节点配置 */}
            {selectedNode && (
              <NodeConfigPanel
                node={selectedNode}
                onUpdateConfig={(nodeId, updates) => {
                  if (updates.label !== undefined) {
                    // 更新名称时更新整个节点
                    const node = nodes.find(n => n.id === nodeId);
                    updateNodeConfig(nodeId, { ...node?.config });
                    // 直接更新节点 label
                    store.updateNode(nodeId, { label: updates.label });
                  } else {
                    updateNodeConfig(nodeId, updates.config || {});
                  }
                }}
                onDelete={removeNode}
              />
            )}

            {/* 连线信息 */}
            {selectedEdge && !selectedNode && (
              <EdgeInfoPanel
                edge={selectedEdge}
                nodes={nodes}
                onDelete={removeEdge}
              />
            )}

            {/* 执行结果 */}
            {executionStatus !== 'idle' && (
              <ExecutionResultPanel
                status={executionStatus}
                results={executionResults}
                finalOutput={finalOutput}
              />
            )}
          </div>

          {/* 使用提示 */}
          <Card className="bg-[var(--background)]">
            <CardContent className="py-3">
              <p className="text-sm text-[var(--text-secondary)]">
                💡 使用提示：从左侧拖拽节点到画布 → 点击输出端口并拖拽到另一节点的输入端口创建连接 → 配置节点参数 → 点击执行
              </p>
            </CardContent>
          </Card>
          </div>
        </DndContext>
      )}
    </div>
  );
}