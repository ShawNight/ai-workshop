import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Textarea, Label } from '../ui/Input';
import { Select } from '../ui/Select';

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

export function CreateProjectModal({ isOpen, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('玄幻');
  const [premise, setPremise] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [targetWords, setTargetWords] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [coverColor, setCoverColor] = useState('#6366F1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        genre,
        premise: premise.trim(),
        synopsis: synopsis.trim(),
        targetWordCount: parseInt(targetWords) || 0,
        writingStyle: writingStyle.trim(),
        coverColor,
      });
      reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setTitle('');
    setGenre('玄幻');
    setPremise('');
    setSynopsis('');
    setTargetWords('');
    setWritingStyle('');
    setCoverColor('#6366F1');
    setIsSubmitting(false);
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">创建新小说项目</h2>
          <button onClick={handleClose} className="p-1 rounded hover:bg-[var(--background)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <Label>小说标题 *</Label>
            <Input
              placeholder="给你的小说起个名字..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>类型</Label>
              <Select value={genre} onChange={(e) => setGenre(e.target.value)} className="mt-1">
                {genres.map((g) => (<option key={g} value={g}>{g}</option>))}
              </Select>
            </div>
            <div>
              <Label>目标字数</Label>
              <Input
                type="number"
                placeholder="如 100000"
                value={targetWords}
                onChange={(e) => setTargetWords(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>故事梗概（一句话简介）</Label>
            <Input
              placeholder="用一句话概括你的故事核心..."
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>故事背景 / 世界观设定</Label>
            <Textarea
              placeholder="详细描述你的故事背景、世界观、时代设定..."
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div>
            <Label>写作风格</Label>
            <Input
              placeholder="如：轻松幽默、沉重写实、诗意优美..."
              value={writingStyle}
              onChange={(e) => setWritingStyle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>封面颜色</Label>
            <div className="flex gap-2 mt-1">
              {coverColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCoverColor(c.value)}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    coverColor === c.value ? 'ring-2 ring-offset-2 ring-[var(--primary)] scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-5 border-t border-[var(--border)]">
          <Button onClick={handleSubmit} disabled={!title.trim() || isSubmitting} loading={isSubmitting} className="flex-1">
            <Save className="h-4 w-4" />
            创建项目
          </Button>
          <Button variant="outline" onClick={handleClose} className="flex-1">
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}
