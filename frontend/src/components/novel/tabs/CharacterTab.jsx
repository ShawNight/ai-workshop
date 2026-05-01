import { useState } from 'react';
import { Plus, Trash2, Sparkles, User, ChevronRight, ChevronDown, GitBranch, X } from 'lucide-react';
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
  const { currentProject, updateProject, setIsGeneratingCharacter, isGeneratingCharacter, markUnsaved } = useNovelStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingAI, setIsCreatingAI] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('配角');
  const [newDesc, setNewDesc] = useState('');
  const [expanded, setExpanded] = useState({});
  const [viewMode, setViewMode] = useState('list');
  const [showRelationshipEditor, setShowRelationshipEditor] = useState(false);

  // AI 对话状态
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [showChat, setShowChat] = useState(false);

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

  const handleDeleteCharacter = (charId) => {
    updateProject(currentProject.id, {
      characters: characters.filter((c) => c.id !== charId),
      relationships: relationships.filter((r) => r.fromId !== charId && r.toId !== charId),
    });
    markUnsaved();
    toast.success('角色已删除（含关联关系）');
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
      {/* 左侧：角色列表 */}
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
                {characters.map((character) => (
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
                          <span className="font-medium text-sm">{character.name}</span>
                          {character.role && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--secondary)]/10 text-[var(--secondary)]">
                              {character.role}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {character.traits?.map((t, i) => (
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
                          onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(character.id); }}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {expanded[character.id] ? <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" /> : <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />}
                      </div>
                    </div>
                    {expanded[character.id] && (
                      <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-2 bg-[var(--background)]/50">
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
                        {character.traits && (
                          <div className="flex flex-wrap gap-1 mt-2 sm:hidden">
                            {character.traits.map((trait, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-[var(--primary)]/10 text-xs text-[var(--primary)]">{trait}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-[var(--border)] rounded-xl">
                <User className="h-10 w-10 mx-auto mb-3 text-[var(--text-secondary)] opacity-50" />
                <p className="text-sm text-[var(--text-secondary)]">还没有角色</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">点击「添加角色」创建你的故事人物</p>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* 右侧：AI 对话面板 */}
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
