import { Button } from '../../ui/Button';
import { Input, Textarea, Label } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { toast } from '../../ui/Toast';
import { useNovelStore } from '../../../store/novelStore';
import { useSave } from '../../../hooks/useSave';
import { Save, BookOpen } from 'lucide-react';

const genres = ['玄幻', '都市', '科幻', '悬疑', '言情', '武侠', '奇幻', '历史', '游戏', '轻小说'];
const coverColors = [
  { value: '#6366F1', label: '靛蓝' },
  { value: '#EC4899', label: '玫红' },
  { value: '#14B8A6', label: '青绿' },
  { value: '#F59E0B', label: '琥珀' },
  { value: '#8B5CF6', label: '紫罗兰' },
  { value: '#EF4444', label: '赤红' },
  { value: '#3B82F6', label: '蔚蓝' },
  { value: '#10B981', label: '翠绿' },
];

export function SettingsTab() {
  const { currentProject, updateProject, markUnsaved } = useNovelStore();
  const { save } = useSave();

  if (!currentProject) return null;

  const handleUpdate = (field, value) => {
    updateProject(currentProject.id, { [field]: value });
    markUnsaved();
  };

  const handleSave = async () => {
    const ok = await save();
    if (ok) toast.success('设定已保存');
    else toast.error('保存失败');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">项目设置</h2>
        <Button size="sm" variant="outline" onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" />
          保存
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <Label>小说标题</Label>
          <Input
            value={currentProject.title || ''}
            onChange={(e) => handleUpdate('title', e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>类型</Label>
            <Select
              value={currentProject.genre || '通用'}
              onChange={(e) => handleUpdate('genre', e.target.value)}
              className="mt-1"
            >
              {genres.map((g) => (<option key={g} value={g}>{g}</option>))}
            </Select>
          </div>
          <div>
            <Label>状态</Label>
            <Select
              value={currentProject.status || 'planning'}
              onChange={(e) => handleUpdate('status', e.target.value)}
              className="mt-1"
            >
              <option value="planning">规划中</option>
              <option value="writing">写作中</option>
              <option value="completed">已完成</option>
              <option value="published">已发布</option>
            </Select>
          </div>
        </div>

        <div>
          <Label>目标总字数</Label>
          <Input
            type="number"
            value={currentProject.targetWordCount || ''}
            onChange={(e) => handleUpdate('targetWordCount', parseInt(e.target.value) || 0)}
            className="mt-1"
            placeholder="如 100000"
          />
        </div>

        <div>
          <Label>一句话简介</Label>
          <Input
            value={currentProject.synopsis || ''}
            onChange={(e) => handleUpdate('synopsis', e.target.value)}
            className="mt-1"
            placeholder="用一句话概括你的故事..."
          />
        </div>

        <div>
          <Label>写作风格</Label>
          <Input
            value={currentProject.writingStyle || ''}
            onChange={(e) => handleUpdate('writingStyle', e.target.value)}
            className="mt-1"
            placeholder="如：轻松幽默、沉重写实..."
          />
        </div>

        <div>
          <Label>故事背景 / 世界观</Label>
          <Textarea
            value={currentProject.premise || ''}
            onChange={(e) => handleUpdate('premise', e.target.value)}
            className="mt-1 min-h-[120px]"
            placeholder="详细描述故事的世界观、时代背景..."
          />
        </div>

        <div>
          <Label>封面颜色</Label>
          <div className="flex gap-3 mt-1 items-center">
            {coverColors.map((c) => (
              <button
                key={c.value}
                onClick={() => handleUpdate('coverColor', c.value)}
                className={`w-9 h-9 rounded-lg transition-all ${
                  (currentProject.coverColor || '#6366F1') === c.value
                    ? 'ring-2 ring-offset-2 ring-[var(--primary)] scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--background)] border border-[var(--border)]">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="text-sm font-medium">项目统计</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[var(--text-secondary)]">章节数：</span>
              <span>{(currentProject.chapters || []).length}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">角色数：</span>
              <span>{(currentProject.characters || []).length}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">当前字数：</span>
              <span>{((currentProject.chapters || []).reduce((sum, c) => sum + (c.content || '').replace(/\s/g, '').length, 0)).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">目标字数：</span>
              <span>{(currentProject.targetWordCount || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
