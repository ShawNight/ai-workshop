import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';
import { workflowApi } from '../api';
import { toast } from '../components/ui/Toast';
import { useWorkflowStore } from '../store/workflowStore';
import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor,
  useDroppable,
  useDraggable
} from '@dnd-kit/core';
import { Workflow, Plus, Trash2, Play, Save, GripVertical, ArrowRight } from 'lucide-react';

const nodeTypes = [
  { id: 'input', name: '输入', icon: '📥', color: 'bg-blue-500', description: '用户输入节点' },
  { id: 'llm', name: 'LLM', icon: '🤖', color: 'bg-purple-500', description: '语言模型处理' },
  { id: 'music', name: '音乐', icon: '🎵', color: 'bg-pink-500', description: '音乐生成节点' },
  { id: 'output', name: '输出', icon: '📤', color: 'bg-green-500', description: '结果输出节点' }
];

function DraggableNode({ node }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: { type: 'new', node }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{node.icon}</span>
        <span className="text-sm font-medium">{node.name}</span>
      </div>
    </div>
  );
}

function WorkflowNode({ node, isSelected, onClick }) {
  const nodeType = nodeTypes.find(t => t.id === node.type);

  return (
    <div
      className={`p-4 rounded-lg border-2 min-w-[180px] ${isSelected ? 'border-[var(--primary)] shadow-lg' : 'border-[var(--border)]'} bg-[var(--surface)]`}
      onClick={() => onClick(node)}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded ${nodeType?.color} flex items-center justify-center text-white text-sm`}>
          {nodeType?.icon}
        </div>
        <div>
          <p className="font-medium text-sm">{nodeType?.name}</p>
          <p className="text-xs text-[var(--text-secondary)]">{node.label || '未命名'}</p>
        </div>
      </div>
      <div className="text-xs text-[var(--text-secondary)]">
        {nodeType?.description}
      </div>
    </div>
  );
}

function Canvas({ nodes, edges, selectedNode, onNodeSelect, onDrop, onDragOver }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[500px] bg-[var(--background)] rounded-lg border border-[var(--border)] relative overflow-hidden ${isOver ? 'ring-2 ring-[var(--primary)]' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-[var(--text-secondary)]">
            <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>从左侧拖拽节点到此处</p>
          </div>
        </div>
      )}

      <svg className="absolute inset-0 pointer-events-none w-full h-full">
        {edges.map((edge) => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          return (
            <path
              key={edge.id}
              d={`M ${sourceNode.position.x + 90} ${sourceNode.position.y + 50} 
                  C ${sourceNode.position.x + 150} ${sourceNode.position.y + 50},
                    ${targetNode.position.x - 60} ${targetNode.position.y + 50},
                    ${targetNode.position.x} ${targetNode.position.y + 50}`}
              stroke="var(--primary)"
              strokeWidth="2"
              fill="none"
              className="opacity-50"
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 p-4">
        {nodes.map((node) => (
          <div
            key={node.id}
            className="absolute"
            style={{ 
              left: node.position.x, 
              top: node.position.y 
            }}
          >
            <WorkflowNode
              node={node}
              isSelected={selectedNode?.id === node.id}
              onClick={onNodeSelect}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkflowsPage() {
  const { workflows, currentWorkflow, setWorkflows, setCurrentWorkflow, addWorkflow, updateWorkflow, removeWorkflow } = useWorkflowStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
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
        setNodes([]);
        setEdges([]);
        toast.success('工作流创建成功');
        setIsCreating(false);
        setNewName('');
      }
    } catch (error) {
      toast.error('创建失败');
    }
  };

  const handleSaveWorkflow = async () => {
    if (!currentWorkflow) return;

    try {
      await workflowApi.updateWorkflow(currentWorkflow.id, { nodes, edges });
      toast.success('保存成功');
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const handleExecuteWorkflow = async () => {
    if (!currentWorkflow) return;

    setIsExecuting(true);
    try {
      const response = await workflowApi.executeWorkflow(currentWorkflow.id);
      if (response.data.success) {
        toast.success('工作流执行已启动');
      }
    } catch (error) {
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

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || over.id !== 'canvas') return;

    const activeData = active.data.current;
    if (activeData?.type === 'new') {
      const newNode = {
        id: `${activeData.node.id}-${Date.now()}`,
        type: activeData.node.id,
        label: '',
        position: { x: 100, y: 100 },
        config: {}
      };
      setNodes(prev => [...prev, newNode]);
    }
  };

  const handleDragOver = (event) => {
    // Handle drag over for positioning
  };

  const handleNodeSelect = (node) => {
    setSelectedNode(node);
  };

  const handleNodeDelete = (nodeId) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const handleNodePositionChange = (nodeId, position) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, position } : n));
  };

  const handleConnect = () => {
    if (nodes.length < 2) {
      toast.warning('需要至少两个节点才能连接');
      return;
    }
    // Simple connect mode - connect first two unconnected nodes
    const availableNodes = nodes.filter(n => 
      !edges.some(e => e.source === n.id) || !edges.some(e => e.target === n.id)
    );
    if (availableNodes.length >= 2) {
      const newEdge = {
        id: `edge-${Date.now()}`,
        source: availableNodes[0].id,
        target: availableNodes[1].id
      };
      setEdges(prev => [...prev, newEdge]);
      toast.success('已连接');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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

      {!currentWorkflow ? (
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
                  onClick={() => {
                    setCurrentWorkflow(workflow);
                    setNodes(workflow.nodes || []);
                    setEdges(workflow.edges || []);
                  }}
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
        <div className="space-y-4">
          <Card>
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => setCurrentWorkflow(null)}>
                  返回
                </Button>
                <h2 className="font-semibold">{currentWorkflow.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleConnect}>
                  <ArrowRight className="h-4 w-4" />
                  连接节点
                </Button>
                <Button variant="outline" onClick={handleSaveWorkflow}>
                  <Save className="h-4 w-4" />
                  保存
                </Button>
                <Button onClick={handleExecuteWorkflow} disabled={isExecuting}>
                  <Play className="h-4 w-4" />
                  {isExecuting ? '执行中...' : '执行'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-4 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>节点库</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {nodeTypes.map((nodeType) => (
                  <DraggableNode key={nodeType.id} node={nodeType} />
                ))}
              </CardContent>
            </Card>

            <div className="lg:col-span-3">
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <Canvas
                  nodes={nodes}
                  edges={edges}
                  selectedNode={selectedNode}
                  onNodeSelect={handleNodeSelect}
                  onDragOver={handleDragOver}
                  onDrop={(e) => e.preventDefault()}
                />
                <DragOverlay>
                  {activeId ? (
                    <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--primary)] shadow-lg">
                      <p className="text-sm font-medium">拖拽中...</p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>

          {selectedNode && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>节点配置</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => handleNodeDelete(selectedNode.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>节点名称</Label>
                    <Input
                      value={selectedNode.label || ''}
                      onChange={(e) => {
                        setNodes(prev => prev.map(n => 
                          n.id === selectedNode.id ? { ...n, label: e.target.value } : n
                        ));
                        setSelectedNode(prev => ({ ...prev, label: e.target.value }));
                      }}
                      placeholder="输入节点名称..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>节点类型</Label>
                    <p className="mt-2 text-sm">{nodeTypes.find(t => t.id === selectedNode.type)?.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
