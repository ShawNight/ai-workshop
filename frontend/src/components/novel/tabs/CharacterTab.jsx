import { useState } from 'react';
import { Plus, Trash2, Sparkles, User, ChevronRight, ChevronDown, GitBranch, X, Check, Loader2 } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input, Textarea, Label } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { toast } from '../../ui/Toast';
import { novelApi } from '../../../api';
import { useNovelStore } from '../../../store/novelStore';
import { RelationshipGraph } from '../RelationshipGraph';
import { RelationshipEditor } from '../RelationshipEditor';
import { ChatPanel } from '../chat/ChatPanel';

const characterRoles = ['主角', '配角', '反派', '导师', '盟友', '恋人', '路人'];

export function CharacterTab() {
  const { currentProject, updateProject, markUnsaved } = useNovelStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingAI, setIsCreatingAI] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('配角');
  const [newDesc, setNewDesc] = useState('');
  const [expanded, setExpanded] = useState({});
  const [viewMode, setViewMode] = useState('list');
  const [showRelationshipEditor, setShowRelationshipEditor] = useState(false);

  // 编辑态
  const [editingCharId, setEditingCharId] = useState(null);
  const [editValues, setEditValues] = useState({});

  // AI 对话状态
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [showChat, setShowChat] = useState(false);

  // 批量生成状态
  const [pendingCharacters, setPendingCharacters] = useState([]);
  const [batchCount, setBatchCount] = useState(4);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

  // 审阅中的角色编辑
  const [editingPendingId, setEditingPendingId] = useState(null);
  const [editPendingValues, setEditPendingValues] = useState({});

  if (!currentProject) return null;

  const characters = currentProject.characters || [];
  const relationships = currentProject.relationships || [];

  const handleCreateCharacter = async () => {
    if (!newName.trim() || !newDesc.trim()) {
      toast.error('请填写角色名称和描述');
      return;
    }
    setIsCreatingAI(true);
    try {
      const res = await novelApi.createCharacter({
        name: newName.trim(),
        role: newRole,
        description: newDesc.trim(),
        genre: currentProject.genre,
      });
      if (res.data.success) {
        updateProject(currentProject.id, {
          characters: [...characters, res.data.character],
        });
        markUnsaved();
        if (res.data.mock) toast.info('已创建角色（使用示例性格特征）');
        else toast.success('角色创建成功');
        setNewName('');
        setNewDesc('');
        setNewRole('配角');
        setIsCreating(false);
      } else {
        toast.error(res.data.error || '创建失败');
      }
    } catch {
      toast.error('创建角色失败');
    } finally {
      setIsCreatingAI(false);
    }
  };

  const handleDeleteCharacter = (charId, charName) => {
    const relCount = relationships.filter((r) => r.fromId === charId || r.toId === charId).length;
    const msg = relCount > 0
      ? `确定删除角色「${charName}」吗？将同时删除 ${relCount} 条关联关系。`
      : `确定删除角色「${charName}」吗？`;
    if (!window.confirm(msg)) return;
    updateProject(currentProject.id, {
      characters: characters.filter((c) => c.id !== charId),
      relationships: relationships.filter((r) => r.fromId !== charId && r.toId !== charId),
    });
    markUnsaved();
    toast.success('角色已删除');
  };

  const startEdit = (char) => {
    setEditingCharId(char.id);
    setEditValues({
      name: char.name || '',
      role: char.role || '',
      description: char.description || '',
      appearance: char.appearance || '',
      backstory: char.backstory || '',
      traits: [...(char.traits || [])],
    });
  };

  const saveEdit = () => {
    if (!editingCharId) return;
    const updated = characters.map((c) => {
      if (c.id !== editingCharId) return c;
      return {
        ...c,
        name: editValues.name || c.name,
        role: editValues.role || c.role,
        description: editValues.description ?? c.description,
        appearance: editValues.appearance ?? c.appearance,
        backstory: editValues.backstory ?? c.backstory,
        traits: editValues.traits ?? c.traits,
      };
    });
    updateProject(currentProject.id, { characters: updated });
    markUnsaved();
    setEditingCharId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingCharId(null);
    setEditValues({});
  };

  const handleAddTrait = () => {
    setEditValues((prev) => ({
      ...prev,
      traits: [...(prev.traits || []), ''],
    }));
  };

  const handleRemoveTrait = (index) => {
    setEditValues((prev) => ({
      ...prev,
      traits: (prev.traits || []).filter((_, i) => i !== index),
    }));
  };

  const handleTraitChange = (index, value) => {
    setEditValues((prev) => ({
      ...prev,
      traits: (prev.traits || []).map((t, i) => (i === index ? value : t)),
    }));
  };

  // 批量生成
  const handleBatchGenerate = async () => {
    setIsGeneratingBatch(true);
    try {
      const res = await novelApi.generateCharacters({
        premise: currentProject.premise || '',
        genre: currentProject.genre || '通用',
        synopsis: currentProject.synopsis || '',
        count: batchCount,
        existingCharacters: characters.map((c) => ({ name: c.name, role: c.role })),
      });
      if (res.data.success) {
        setPendingCharacters(res.data.characters.map((c) => ({
          ...c,
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
        })));
        if (res.data.mock) toast.info(res.data.message || '使用示例角色');
        else toast.success(`已生成 ${res.data.characters.length} 个角色，请审阅`);
      } else {
        toast.error(res.data.error || '生成失败');
      }
    } catch {
      toast.error('批量生成角色失败');
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  const acceptPendingChar = (charId) => {
    const char = pendingCharacters.find((c) => c.id === charId);
    if (!char) return;
    updateProject(currentProject.id, {
      characters: [...characters, char],
    });
    markUnsaved();
    setPendingCharacters((prev) => prev.filter((c) => c.id !== charId));
    toast.success(`角色「${char.name}」已采纳`);
  };

  const rejectPendingChar = (charId) => {
    const char = pendingCharacters.find((c) => c.id === charId);
    setPendingCharacters((prev) => prev.filter((c) => c.id !== charId));
    if (char) toast.info(`角色「${char.name}」已丢弃`);
  };

  const acceptAllPending = () => {
    updateProject(currentProject.id, {
      characters: [...characters, ...pendingCharacters],
    });
    markUnsaved();
    toast.success(`已采纳全部 ${pendingCharacters.length} 个角色`);
    setPendingCharacters([]);
  };

  const rejectAllPending = () => {
    toast.info(`已丢弃全部 ${pendingCharacters.length} 个角色`);
    setPendingCharacters([]);
  };

  const startEditPending = (char) => {
    setEditingPendingId(char.id);
    setEditPendingValues({
      name: char.name || '',
      role: char.role || '',
      description: char.description || '',
      appearance: char.appearance || '',
      backstory: char.backstory || '',
      traits: [...(char.traits || [])],
    });
  };

  const saveEditPending = () => {
    if (!editingPendingId) return;
    setPendingCharacters((prev) => prev.map((c) => {
      if (c.id !== editingPendingId) return c;
      return { ...c, ...editPendingValues };
    }));
    setEditingPendingId(null);
    setEditPendingValues({});
  };

  const cancelEditPending = () => {
    setEditingPendingId(null);
    setEditPendingValues({});
  };

  const handleAddRelationship = (rel) => {
    updateProject(currentProject.id, {
      relationships: [...relationships, rel],
    });
    markUnsaved();
    toast.success('关系已添加');
    setShowRelationshipEditor(false);
  };

  const handleDeleteRelationship = (relId) => {
    updateProject(currentProject.id, {
      relationships: relationships.filter((r) => r.id !== relId),
    });
    markUnsaved();
  };

  const toggleExpand = (charId) => {
    if (editingCharId && editingCharId !== charId) {
      saveEdit();
    }
    setExpanded((prev) => ({ ...prev, [charId]: !prev[charId] }));
  };

  // AI 建议采纳处理
  const handleApplySuggestion = (suggestion) => {
    const projectCharacters = currentProject.characters || [];
    const projectRelationships = currentProject.relationships || [];

    switch (suggestion.type) {
      case 'update_character': {
        const updated = projectCharacters.map(c =>
          c.id === suggestion.targetId
            ? { ...c, [suggestion.field]: suggestion.value }
            : c
        );
        updateProject(currentProject.id, { characters: updated });
        toast.success('角色设定已更新');
        break;
      }
      case 'add_trait': {
        const updated = projectCharacters.map(c =>
          c.id === suggestion.targetId
            ? { ...c, traits: [...(c.traits || []), suggestion.value] }
            : c
        );
        updateProject(currentProject.id, { characters: updated });
        toast.success(`已添加特征「${suggestion.value}」`);
        break;
      }
      case 'create_relationship': {
        const newRel = {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
          ...suggestion.value,
        };
        updateProject(currentProject.id, { relationships: [...projectRelationships, newRel] });
        toast.success('关系已建立');
        break;
      }
      case 'create_character': {
        const newChar = {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
          ...suggestion.value,
          traits: suggestion.value.traits || [],
        };
        updateProject(currentProject.id, { characters: [...projectCharacters, newChar] });
        toast.success(`已创建角色「${suggestion.value.name}」`);
        break;
      }
      default:
        toast.info('此建议类型暂不支持自动采纳');
    }
    markUnsaved();
  };

  const openChat = (charId) => {
    setSelectedCharId(charId);
    setShowChat(true);
  };

  return (
    <div className="flex-1 overflow-hidden flex">
      <div className={`flex-1 overflow-y-auto overflow-x-hidden transition-all ${showChat ? 'max-w-[55%]' : ''}`}>
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-lg font-semibold">角色管理 ({characters.length})</h2>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs ${viewMode === 'list' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--text-secondary)]'}`}
              >
                列表
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`px-3 py-1.5 text-xs ${viewMode === 'graph' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--text-secondary)]'}`}
              >
                <GitBranch className="h-3 w-3 inline mr-0.5" />
                关系图
              </button>
            </div>
            <Button size="sm" onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4" />
              添加角色
            </Button>
          </div>
        </div>

        {isCreating && (
        <div className="mx-6 mt-4 p-4 rounded-xl border-2 border-[var(--primary)]/30 bg-[var(--background)]">
          <h3 className="font-medium mb-3">新建角色</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>角色名称 *</Label>
                <Input
                  placeholder="角色名..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>角色定位</Label>
                <Select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="mt-1">
                  {characterRoles.map((r) => (<option key={r} value={r}>{r}</option>))}
                </Select>
              </div>
            </div>
            <div>
              <Label>角色描述 *</Label>
              <Textarea
                placeholder="描述角色的性格、背景、动机..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="mt-1 min-h-[80px]"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateCharacter} loading={isCreatingAI} disabled={isCreatingAI}>
                <Sparkles className="h-4 w-4" />
                AI 生成性格特征
              </Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>取消</Button>
            </div>
          </div>
        </div>
      )}

      {/* 批量生成区域 */}
      {pendingCharacters.length > 0 && (
        <div className="mx-6 mt-4 p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              待审阅的角色 ({pendingCharacters.length})
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
            {pendingCharacters.map((char) => (
              <div key={char.id} className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingPendingId === char.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={editPendingValues.name}
                          onChange={(e) => setEditPendingValues((v) => ({ ...v, name: e.target.value }))}
                          placeholder="角色名"
                        />
                        <Select
                          value={editPendingValues.role}
                          onChange={(e) => setEditPendingValues((v) => ({ ...v, role: e.target.value }))}
                        >
                          {characterRoles.map((r) => (<option key={r} value={r}>{r}</option>))}
                        </Select>
                      </div>
                      <Textarea
                        value={editPendingValues.description}
                        onChange={(e) => setEditPendingValues((v) => ({ ...v, description: e.target.value }))}
                        placeholder="描述"
                        className="min-h-[40px]"
                      />
                      <div className="flex flex-wrap gap-1">
                        {editPendingValues.traits?.map((t, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--primary)]/10 text-xs text-[var(--primary)]">
                            <input
                              value={t}
                              onChange={(e) => {
                                const newTraits = [...editPendingValues.traits];
                                newTraits[i] = e.target.value;
                                setEditPendingValues((v) => ({ ...v, traits: newTraits }));
                              }}
                              className="bg-transparent w-10 text-xs outline-none text-[var(--primary)]"
                            />
                            <button onClick={() => {
                              setEditPendingValues((v) => ({ ...v, traits: v.traits.filter((_, j) => j !== i) }));
                            }}><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                        <button
                          onClick={() => setEditPendingValues((v) => ({ ...v, traits: [...(v.traits || []), ''] }))}
                          className="px-2 py-0.5 rounded bg-[var(--border)]/50 text-xs hover:bg-[var(--border)]"
                        >+ 特征</button>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Button size="sm" onClick={saveEditPending}>确认</Button>
                        <Button size="sm" variant="outline" onClick={cancelEditPending}>取消</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{char.name}</span>
                        {char.role && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--secondary)]/10 text-[var(--secondary)]">{char.role}</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{char.description}</p>
                      {char.traits?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {char.traits.map((t, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-xs text-[var(--primary)]">{t}</span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {editingPendingId !== char.id && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => acceptPendingChar(char.id)} className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600" title="采纳">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => startEditPending(char)} className="p-1.5 rounded hover:bg-[var(--primary)]/10 text-[var(--primary)]" title="编辑">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button onClick={() => rejectPendingChar(char.id)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500" title="丢弃">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={viewMode === 'graph' ? 'p-4' : ''}>
        {viewMode === 'graph' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">
                {relationships.length} 个关系 · 点击连线可删除 · 悬停查看详情
              </span>
              <Button size="sm" variant="secondary" onClick={() => setShowRelationshipEditor(!showRelationshipEditor)}>
                <Plus className="h-3.5 w-3.5" />
                {showRelationshipEditor ? '收起' : '添加关系'}
              </Button>
            </div>

            {showRelationshipEditor && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]">
                <RelationshipEditor
                  characters={characters}
                  relationships={relationships}
                  onSave={handleAddRelationship}
                  onClose={() => setShowRelationshipEditor(false)}
                />
              </div>
            )}

            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden min-h-[400px]">
              <RelationshipGraph
                characters={characters}
                relationships={relationships}
                onDelete={handleDeleteRelationship}
              />
            </div>
          </div>
        ) : (
          <div className="p-6 pt-4">
            {characters.length > 0 ? (
              <div className="space-y-2">
                {characters.map((character) => {
                  const isEditing = editingCharId === character.id;
                  return (
                    <div key={character.id} className="border border-[var(--border)] rounded-xl overflow-hidden group">
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--background)] transition-colors"
                        onClick={() => toggleExpand(character.id)}
                      >
                        <div className="w-9 h-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-[var(--primary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{isEditing ? editValues.name : character.name}</span>
                            {character.role && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--secondary)]/10 text-[var(--secondary)]">
                                {isEditing ? editValues.role : character.role}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {character.traits?.slice(0, 3).map((t, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-[var(--primary)]/10 text-xs text-[var(--primary)] hidden sm:inline">
                              {t}
                            </span>
                          ))}
                          <button
                            onClick={(e) => { e.stopPropagation(); openChat(character.id); }}
                            className="p-1 rounded hover:bg-[var(--primary)]/10 text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="AI 深入探讨此角色"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(character.id, character.name); }}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          {expanded[character.id] ? <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" /> : <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />}
                        </div>
                      </div>
                      {expanded[character.id] && (
                        <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-3 bg-[var(--background)]/50">
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label>角色名称</Label>
                                  <Input
                                    value={editValues.name}
                                    onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label>角色定位</Label>
                                  <Select
                                    value={editValues.role}
                                    onChange={(e) => setEditValues((v) => ({ ...v, role: e.target.value }))}
                                    className="mt-1"
                                  >
                                    {characterRoles.map((r) => (<option key={r} value={r}>{r}</option>))}
                                  </Select>
                                </div>
                              </div>
                              <div>
                                <Label>角色描述</Label>
                                <Textarea
                                  value={editValues.description}
                                  onChange={(e) => setEditValues((v) => ({ ...v, description: e.target.value }))}
                                  className="mt-1 min-h-[60px]"
                                />
                              </div>
                              <div>
                                <Label>外貌描述</Label>
                                <Input
                                  value={editValues.appearance}
                                  onChange={(e) => setEditValues((v) => ({ ...v, appearance: e.target.value }))}
                                  className="mt-1"
                                  placeholder="描述角色的外貌特征..."
                                />
                              </div>
                              <div>
                                <Label>背景故事</Label>
                                <Textarea
                                  value={editValues.backstory}
                                  onChange={(e) => setEditValues((v) => ({ ...v, backstory: e.target.value }))}
                                  className="mt-1 min-h-[60px]"
                                />
                              </div>
                              <div>
                                <Label>性格特征</Label>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {editValues.traits.map((trait, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--primary)]/10 text-xs">
                                      <input
                                        value={trait}
                                        onChange={(e) => handleTraitChange(idx, e.target.value)}
                                        className="bg-transparent w-12 text-xs outline-none text-[var(--primary)]"
                                      />
                                      <button
                                        onClick={() => handleRemoveTrait(idx)}
                                        className="text-[var(--text-secondary)] hover:text-red-500"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                  <button
                                    onClick={handleAddTrait}
                                    className="px-2 py-0.5 rounded bg-[var(--border)]/50 text-xs hover:bg-[var(--border)] text-[var(--text-secondary)]"
                                  >
                                    + 添加
                                  </button>
                                </div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" onClick={saveEdit}>保存</Button>
                                <Button size="sm" variant="outline" onClick={cancelEdit}>取消</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-[var(--text-secondary)]">{character.description}</p>
                              {character.appearance && (
                                <div>
                                  <span className="text-xs font-medium text-[var(--text-secondary)]">外貌：</span>
                                  <span className="text-sm">{character.appearance}</span>
                                </div>
                              )}
                              {character.backstory && (
                                <div>
                                  <span className="text-xs font-medium text-[var(--text-secondary)]">背景：</span>
                                  <span className="text-sm">{character.backstory}</span>
                                </div>
                              )}
                              {character.traits && character.traits.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {character.traits.map((trait, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded bg-[var(--primary)]/10 text-xs text-[var(--primary)]">{trait}</span>
                                  ))}
                                </div>
                              )}
                              <button
                                onClick={() => startEdit(character)}
                                className="text-xs text-[var(--primary)] hover:underline mt-1"
                              >
                                编辑角色
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 批量生成按钮 */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBatchGenerate}
                    loading={isGeneratingBatch}
                    disabled={isGeneratingBatch}
                    className="w-full"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGeneratingBatch ? '生成中...' : 'AI 批量生成更多角色'}
                  </Button>
                  {!isGeneratingBatch && (
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-xs text-[var(--text-secondary)]">数量</span>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={batchCount}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v) && v >= 1 && v <= 8) setBatchCount(v);
                        }}
                        className="w-12 h-6 text-xs text-center border border-[var(--border)] rounded bg-[var(--surface)]"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-[var(--border)] rounded-xl">
                <User className="h-10 w-10 mx-auto mb-3 text-[var(--text-secondary)] opacity-50" />
                <p className="text-sm text-[var(--text-secondary)] mb-1">还没有角色</p>
                <p className="text-xs text-[var(--text-secondary)] mb-4">根据你的故事设定，AI 可以帮你快速创建角色</p>
                <div className="flex flex-col gap-2 items-center">
                  <Button onClick={handleBatchGenerate} loading={isGeneratingBatch} disabled={isGeneratingBatch}>
                    <Sparkles className="h-4 w-4" />
                    AI 批量生成角色
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">数量</span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={batchCount}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1 && v <= 8) setBatchCount(v);
                      }}
                      className="w-12 h-6 text-xs text-center border border-[var(--border)] rounded bg-[var(--surface)]"
                    />
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] mt-1">或</span>
                  <Button variant="outline" onClick={() => setIsCreating(true)}>
                    <Plus className="h-4 w-4" />
                    手动添加角色
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {showChat && selectedCharId && (
        <div className="flex-1 border-l border-[var(--border)] min-w-0">
          <ChatPanel
            mode="character"
            entityId={selectedCharId}
            onApplySuggestion={handleApplySuggestion}
            onClose={() => { setShowChat(false); setSelectedCharId(null); }}
          />
        </div>
      )}
    </div>
  );
}