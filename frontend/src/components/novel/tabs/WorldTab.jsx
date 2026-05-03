import { useState } from 'react';
import { Plus, Trash2, MapPin, Globe, Building2, Trees, Mountain, Landmark, X, ChevronRight, ChevronDown, Sparkles, Check } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input, Textarea, Label } from '../../ui/Input';
import { toast } from '../../ui/Toast';
import { useNovelStore } from '../../../store/novelStore';
import { novelApi } from '../../../api';
import { ChatPanel } from '../chat/ChatPanel';

const locationTypes = [
  { value: 'city', label: '城市', icon: Building2 },
  { value: 'village', label: '村镇', icon: Trees },
  { value: 'wilderness', label: '荒野', icon: Mountain },
  { value: 'realm', label: '异界', icon: Globe },
  { value: 'building', label: '建筑', icon: Landmark },
  { value: 'other', label: '其他', icon: MapPin },
];

export function WorldTab() {
  const { currentProject, updateProject, markUnsaved } = useNovelStore();
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [newLocation, setNewLocation] = useState({
    name: '', type: 'city', description: '', significance: '',
  });

  // 编辑态
  const [editingLocId, setEditingLocId] = useState(null);
  const [editValues, setEditValues] = useState({});

  // AI 对话状态
  const [selectedLocId, setSelectedLocId] = useState(null);
  const [showChat, setShowChat] = useState(false);

  // 批量生成状态
  const [pendingLocations, setPendingLocations] = useState([]);
  const [batchCount, setBatchCount] = useState(3);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

  // 单个地点 AI 生成状态
  const [isGeneratingLocAI, setIsGeneratingLocAI] = useState(false);

  // 审阅中的地点编辑
  const [editingPendingId, setEditingPendingId] = useState(null);
  const [editPendingValues, setEditPendingValues] = useState({});

  if (!currentProject) return null;

  const locations = currentProject.locations || [];

  const handleCreate = () => {
    if (!newLocation.name.trim()) {
      toast.error('请输入地点名称');
      return;
    }
    const loc = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      ...newLocation,
      name: newLocation.name.trim(),
      description: newLocation.description.trim(),
      significance: newLocation.significance.trim(),
      createdAt: new Date().toISOString(),
    };
    updateProject(currentProject.id, { locations: [...locations, loc] });
    markUnsaved();
    toast.success('地点已添加');
    setNewLocation({ name: '', type: 'city', description: '', significance: '' });
    setIsCreating(false);
  };

  const handleCreateWithAI = async () => {
    if (!newLocation.name.trim()) {
      toast.error('请输入地点名称');
      return;
    }
    setIsGeneratingLocAI(true);
    try {
      const res = await novelApi.generateLocation({
        name: newLocation.name.trim(),
        type: newLocation.type,
        genre: currentProject.genre || '通用',
        premise: currentProject.premise || '',
      });
      if (res.data.success) {
        const locData = res.data.location;
        setNewLocation({
          ...newLocation,
          description: locData.description || newLocation.description,
          significance: locData.significance || newLocation.significance,
        });
        if (res.data.mock) toast.info(res.data.message || '使用示例描述');
        else toast.success('AI 已生成地点描述');
      } else {
        toast.error(res.data.error || '生成失败');
      }
    } catch {
      toast.error('AI 生成地点描述失败');
    } finally {
      setIsGeneratingLocAI(false);
    }
  };

  const handleDelete = (id, name) => {
    if (!window.confirm(`确定删除地点「${name}」吗？`)) return;
    updateProject(currentProject.id, {
      locations: locations.filter((l) => l.id !== id),
    });
    markUnsaved();
    toast.success('地点已删除');
  };

  const startEdit = (loc) => {
    setEditingLocId(loc.id);
    setEditValues({
      name: loc.name || '',
      type: loc.type || 'city',
      description: loc.description || '',
      significance: loc.significance || '',
    });
  };

  const saveEdit = () => {
    if (!editingLocId) return;
    const updated = locations.map((l) => {
      if (l.id !== editingLocId) return l;
      return {
        ...l,
        name: editValues.name || l.name,
        type: editValues.type || l.type,
        description: editValues.description ?? l.description,
        significance: editValues.significance ?? l.significance,
      };
    });
    updateProject(currentProject.id, { locations: updated });
    markUnsaved();
    setEditingLocId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingLocId(null);
    setEditValues({});
  };

  // 批量生成
  const handleBatchGenerate = async () => {
    setIsGeneratingBatch(true);
    try {
      const res = await novelApi.generateLocations({
        premise: currentProject.premise || '',
        genre: currentProject.genre || '通用',
        synopsis: currentProject.synopsis || '',
        count: batchCount,
        existingLocations: locations.map((l) => ({ name: l.name, type: l.type })),
        characters: currentProject.characters || [],
      });
      if (res.data.success) {
        setPendingLocations(res.data.locations.map((l) => ({
          ...l,
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
          createdAt: new Date().toISOString(),
        })));
        if (res.data.mock) toast.info(res.data.message || '使用示例地点');
        else toast.success(`已生成 ${res.data.locations.length} 个地点，请审阅`);
      } else {
        toast.error(res.data.error || '生成失败');
      }
    } catch {
      toast.error('批量生成地点失败');
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  const acceptPendingLoc = (locId) => {
    const loc = pendingLocations.find((l) => l.id === locId);
    if (!loc) return;
    updateProject(currentProject.id, {
      locations: [...locations, loc],
    });
    markUnsaved();
    setPendingLocations((prev) => prev.filter((l) => l.id !== locId));
    toast.success(`地点「${loc.name}」已采纳`);
  };

  const rejectPendingLoc = (locId) => {
    const loc = pendingLocations.find((l) => l.id === locId);
    setPendingLocations((prev) => prev.filter((l) => l.id !== locId));
    if (loc) toast.info(`地点「${loc.name}」已丢弃`);
  };

  const acceptAllPending = () => {
    updateProject(currentProject.id, {
      locations: [...locations, ...pendingLocations],
    });
    markUnsaved();
    toast.success(`已采纳全部 ${pendingLocations.length} 个地点`);
    setPendingLocations([]);
  };

  const rejectAllPending = () => {
    toast.info(`已丢弃全部 ${pendingLocations.length} 个地点`);
    setPendingLocations([]);
  };

  const startEditPending = (loc) => {
    setEditingPendingId(loc.id);
    setEditPendingValues({
      name: loc.name || '',
      type: loc.type || 'city',
      description: loc.description || '',
      significance: loc.significance || '',
    });
  };

  const saveEditPending = () => {
    if (!editingPendingId) return;
    setPendingLocations((prev) => prev.map((l) => {
      if (l.id !== editingPendingId) return l;
      return { ...l, ...editPendingValues };
    }));
    setEditingPendingId(null);
    setEditPendingValues({});
  };

  const cancelEditPending = () => {
    setEditingPendingId(null);
    setEditPendingValues({});
  };

  // AI 建议采纳处理
  const handleApplySuggestion = (suggestion) => {
    const projectLocations = currentProject.locations || [];

    switch (suggestion.type) {
      case 'update_location': {
        const updated = projectLocations.map(l =>
          l.id === suggestion.targetId
            ? { ...l, [suggestion.field]: suggestion.value }
            : l
        );
        updateProject(currentProject.id, { locations: updated });
        toast.success('地点设定已更新');
        break;
      }
      case 'add_location_detail': {
        const updated = projectLocations.map(l =>
          l.id === suggestion.targetId
            ? { ...l, [suggestion.field]: (l[suggestion.field] || '') + suggestion.value }
            : l
        );
        updateProject(currentProject.id, { locations: updated });
        toast.success('细节已补充');
        break;
      }
      case 'create_location': {
        const newLoc = {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
          ...suggestion.value,
        };
        updateProject(currentProject.id, { locations: [...projectLocations, newLoc] });
        toast.success(`已创建地点「${suggestion.value.name}」`);
        break;
      }
      default:
        toast.info('此建议类型暂不支持自动采纳');
    }
    markUnsaved();
  };

  const openChat = (locId) => {
    setSelectedLocId(locId);
    setShowChat(true);
  };

  const typeInfo = (type) => locationTypes.find((t) => t.value === type) || locationTypes[5];

  return (
    <div className="flex-1 overflow-hidden flex">
      <div className={`flex-1 overflow-y-auto p-6 transition-all ${showChat ? 'max-w-[55%]' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">世界观 · 地点 ({locations.length})</h2>
        <Button size="sm" onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4" />
          添加地点
        </Button>
      </div>

      {isCreating && (
        <div className="p-4 rounded-xl border-2 border-[var(--primary)]/30 bg-[var(--background)] mb-6 space-y-3">
          <h3 className="font-medium text-sm">新建地点</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>名称 *</Label>
              <Input
                placeholder="如：长安城"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>类型</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {locationTypes.map((lt) => {
                  const Icon = lt.icon;
                  return (
                    <button
                      key={lt.value}
                      onClick={() => setNewLocation({ ...newLocation, type: lt.value })}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        newLocation.type === lt.value ? 'bg-[var(--primary)] text-white' : 'bg-[var(--border)]/50 hover:bg-[var(--border)]'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {lt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div>
            <Label>描述</Label>
            <Textarea
              placeholder="描述这个地方的特征、氛围、历史..."
              value={newLocation.description}
              onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
              className="mt-1 min-h-[60px]"
            />
          </div>
          <div>
            <Label>剧情意义</Label>
            <Input
              placeholder="这个地方在故事中的作用..."
              value={newLocation.significance}
              onChange={(e) => setNewLocation({ ...newLocation, significance: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!newLocation.name.trim()}>创建</Button>
            <Button size="sm" onClick={handleCreateWithAI} loading={isGeneratingLocAI} disabled={isGeneratingLocAI || !newLocation.name.trim()}>
              <Sparkles className="h-4 w-4" />
              AI 生成描述
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsCreating(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* 批量生成审阅区 */}
      {pendingLocations.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              待审阅的地点 ({pendingLocations.length})
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={acceptAllPending}>
                <Check className="h-3.5 w-3.5" />
                全部采纳
              </Button>
              <Button size="sm" variant="outline" onClick={rejectAllPending}>
                <Trash2 className="h-3.5 w-3.5" />
                全部丢弃
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {pendingLocations.map((loc) => {
              const TypeIcon = typeInfo(loc.type).icon;
              return (
                <div key={loc.id} className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TypeIcon className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingPendingId === loc.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={editPendingValues.name}
                            onChange={(e) => setEditPendingValues((v) => ({ ...v, name: e.target.value }))}
                            placeholder="地点名"
                          />
                          <div className="flex flex-wrap gap-1">
                            {locationTypes.map((lt) => {
                              const Icon = lt.icon;
                              return (
                                <button
                                  key={lt.value}
                                  onClick={() => setEditPendingValues((v) => ({ ...v, type: lt.value }))}
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                    editPendingValues.type === lt.value ? 'bg-[var(--primary)] text-white' : 'bg-[var(--border)]/50 hover:bg-[var(--border)]'
                                  }`}
                                >
                                  <Icon className="h-3 w-3" />
                                  {lt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <Textarea
                          value={editPendingValues.description}
                          onChange={(e) => setEditPendingValues((v) => ({ ...v, description: e.target.value }))}
                          placeholder="描述"
                          className="min-h-[40px]"
                        />
                        <Input
                          value={editPendingValues.significance}
                          onChange={(e) => setEditPendingValues((v) => ({ ...v, significance: e.target.value }))}
                          placeholder="剧情意义"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEditPending}>确认</Button>
                          <Button size="sm" variant="outline" onClick={cancelEditPending}>取消</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{loc.name}</span>
                          <span className="text-xs text-[var(--text-secondary)]">{typeInfo(loc.type).label}</span>
                        </div>
                        {loc.description && (
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{loc.description}</p>
                        )}
                        {loc.significance && (
                          <p className="text-xs mt-0.5"><span className="text-[var(--primary)]">●</span> {loc.significance}</p>
                        )}
                      </>
                    )}
                  </div>
                  {editingPendingId !== loc.id && (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => acceptPendingLoc(loc.id)} className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600" title="采纳">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => startEditPending(loc)} className="p-1.5 rounded hover:bg-[var(--primary)]/10 text-[var(--primary)]" title="编辑">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                      <button onClick={() => rejectPendingLoc(loc.id)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500" title="丢弃">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {locations.length > 0 ? (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            {locations.map((loc) => {
              const TypeIcon = typeInfo(loc.type).icon;
              const isExpanded = expandedId === loc.id;
              const isEditing = editingLocId === loc.id;
              return (
                <div key={loc.id} className="border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--primary)]/30 transition-colors">
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => {
                      if (editingLocId && editingLocId !== loc.id) saveEdit();
                      setExpandedId(isExpanded ? null : loc.id);
                    }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
                      <TypeIcon className="h-4 w-4 text-[var(--primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{isEditing ? editValues.name : loc.name}</span>
                      <span className="text-xs text-[var(--text-secondary)] ml-2">{typeInfo(isEditing ? editValues.type : loc.type).label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); openChat(loc.id); }}
                        className="p-1 rounded hover:bg-[var(--primary)]/10 text-[var(--primary)]"
                        title="AI 深入探讨此地点"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(loc.id, loc.name); }}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" /> : <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-3 bg-[var(--background)]/50">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>名称</Label>
                              <Input
                                value={editValues.name}
                                onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>类型</Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {locationTypes.map((lt) => {
                                  const Icon = lt.icon;
                                  return (
                                    <button
                                      key={lt.value}
                                      onClick={() => setEditValues((v) => ({ ...v, type: lt.value }))}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                        editValues.type === lt.value ? 'bg-[var(--primary)] text-white' : 'bg-[var(--border)]/50 hover:bg-[var(--border)]'
                                      }`}
                                    >
                                      <Icon className="h-3 w-3" />
                                      {lt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <div>
                            <Label>描述</Label>
                            <Textarea
                              value={editValues.description}
                              onChange={(e) => setEditValues((v) => ({ ...v, description: e.target.value }))}
                              className="mt-1 min-h-[60px]"
                            />
                          </div>
                          <div>
                            <Label>剧情意义</Label>
                            <Input
                              value={editValues.significance}
                              onChange={(e) => setEditValues((v) => ({ ...v, significance: e.target.value }))}
                              className="mt-1"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit}>保存</Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>取消</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {loc.description && (
                            <p className="text-sm text-[var(--text-secondary)]">{loc.description}</p>
                          )}
                          {loc.significance && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-[var(--primary)] mt-0.5 flex-shrink-0" />
                              <p className="text-sm">{loc.significance}</p>
                            </div>
                          )}
                          {(!loc.description && !loc.significance) && (
                            <p className="text-sm text-[var(--text-secondary)] italic">暂无详细信息</p>
                          )}
                          <button
                            onClick={() => startEdit(loc)}
                            className="text-xs text-[var(--primary)] hover:underline"
                          >
                            编辑地点
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 批量生成按钮 */}
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchGenerate}
              loading={isGeneratingBatch}
              disabled={isGeneratingBatch}
              className="w-full"
            >
              <Sparkles className="h-4 w-4" />
              {isGeneratingBatch ? '生成中...' : 'AI 批量生成更多地点'}
            </Button>
            {!isGeneratingBatch && (
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xs text-[var(--text-secondary)]">数量</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={batchCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1 && v <= 6) setBatchCount(v);
                  }}
                  className="w-12 h-6 text-xs text-center border border-[var(--border)] rounded bg-[var(--surface)]"
                />
              </div>
            )}
          </div>
        </>
      ) : pendingLocations.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[var(--border)] rounded-xl">
          <Globe className="h-10 w-10 mx-auto mb-3 text-[var(--text-secondary)] opacity-50" />
          <p className="text-sm text-[var(--text-secondary)] mb-1">还没有世界观地点</p>
          <p className="text-xs text-[var(--text-secondary)] mb-4">根据你的故事背景，AI 可以帮你快速生成世界观设定</p>
          <div className="flex flex-col gap-2 items-center">
            <Button onClick={handleBatchGenerate} loading={isGeneratingBatch} disabled={isGeneratingBatch}>
              <Sparkles className="h-4 w-4" />
              AI 批量生成地点
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">数量</span>
              <input
                type="number"
                min={1}
                max={6}
                value={batchCount}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 6) setBatchCount(v);
                }}
                className="w-12 h-6 text-xs text-center border border-[var(--border)] rounded bg-[var(--surface)]"
              />
            </div>
            <span className="text-xs text-[var(--text-secondary)] mt-1">或</span>
            <Button variant="outline" onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4" />
              手动添加地点
            </Button>
          </div>
        </div>
      ) : null}
      </div>

      {showChat && selectedLocId && (
        <div className="flex-1 border-l border-[var(--border)] min-w-0">
          <ChatPanel
            mode="world"
            entityId={selectedLocId}
            onApplySuggestion={handleApplySuggestion}
            onClose={() => { setShowChat(false); setSelectedLocId(null); }}
          />
        </div>
      )}
    </div>
  );
}