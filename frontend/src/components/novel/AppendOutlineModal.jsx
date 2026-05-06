import { useState } from 'react';
import { X, Sparkles, ChevronRight, Pencil, Check, RotateCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea, Input, Label } from '../ui/Input';
import { toast } from '../ui/Toast';
import { novelApi } from '../../api';
import { useNovelStore } from '../../store/novelStore';

export function AppendOutlineModal({ isOpen, onClose, onGenerate, chapterCount: defaultChapterCount, hasExisting }) {
  const { currentProject } = useNovelStore();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState('');
  const [chapterCount, setChapterCount] = useState(defaultChapterCount || 4);
  const [isLoading, setIsLoading] = useState(false);
  const [directions, setDirections] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValues, setEditValues] = useState({});

  if (!isOpen || !currentProject) return null;

  const handleClose = () => {
    setStep(1);
    setDirection('');
    setDirections([]);
    setEditingIdx(null);
    setEditValues({});
    onClose();
  };

  const handleGenerateDirections = async () => {
    if (hasExisting && !direction.trim()) {
      toast.error('请输入剧情走向描述');
      return;
    }
    setIsLoading(true);
    try {
      const existingChapters = (currentProject.chapters || []).map((c) => ({
        title: c.title,
        description: c.description || '',
      }));
      const res = await novelApi.generateOutlineDirections({
        premise: currentProject.premise || '一个关于成长和冒险的故事',
        genre: currentProject.genre,
        synopsis: currentProject.synopsis || '',
        direction: direction.trim(),
        chapterCount,
        existingChapters,
        characters: currentProject.characters || [],
        relationships: currentProject.relationships || [],
        locations: currentProject.locations || [],
      });
      if (res.data.success) {
        setDirections(res.data.directions || []);
        setStep(2);
      } else {
        toast.error(res.data.error || '生成方案失败');
      }
    } catch {
      toast.error('生成方向方案失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (idx) => {
    const d = directions[idx];
    setEditingIdx(idx);
    setEditValues({
      title: d.title || '',
      description: d.description || '',
      keyPoints: Array.isArray(d.keyPoints) ? [...d.keyPoints] : [],
    });
  };

  const handleSaveEdit = () => {
    if (editingIdx === null) return;
    setDirections((prev) => prev.map((d, i) =>
      i === editingIdx ? { ...d, ...editValues } : d
    ));
    setEditingIdx(null);
    setEditValues({});
  };

  const handleCancelEdit = () => {
    setEditingIdx(null);
    setEditValues({});
  };

  const handleAddKeyPoint = () => {
    setEditValues((prev) => ({
      ...prev,
      keyPoints: [...(prev.keyPoints || []), ''],
    }));
  };

  const handleRemoveKeyPoint = (idx) => {
    setEditValues((prev) => ({
      ...prev,
      keyPoints: (prev.keyPoints || []).filter((_, i) => i !== idx),
    }));
  };

  const handleKeyPointChange = (idx, value) => {
    setEditValues((prev) => ({
      ...prev,
      keyPoints: (prev.keyPoints || []).map((kp, i) => (i === idx ? value : kp)),
    }));
  };

  const handleSelectDirection = (d) => {
    const finalDirection = d.title
      ? `${d.title}：${d.description}${d.keyPoints?.length ? '。关键转折：' + d.keyPoints.filter(Boolean).join('、') : ''}`
      : d.description;
    onGenerate({
      direction: finalDirection,
      chapterCount,
    });
    handleClose();
  };

  const getTitle = () => hasExisting ? 'AI 追加章节' : 'AI 生成大纲';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--primary)]" />
            {getTitle()}
          </h2>
          <button onClick={handleClose} className="p-1 rounded hover:bg-[var(--background)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 1 && (
            <>
              <div>
                <Label>
                  {hasExisting ? '剧情走向' : '剧情走向（可选）'}
                </Label>
                <p className="text-xs text-[var(--text-secondary)] mb-2">
                  {hasExisting
                    ? '描述你希望的剧情发展方向，AI 会基于此生成几种详细方案供你选择'
                    : '简要描述你希望的剧情方向，或留空让 AI 自由发挥'}
                </p>
                <Textarea
                  placeholder={hasExisting
                    ? '例如：主角发现幕后黑手是身边最信任的人，经历背叛后决定独自反击...'
                    : '例如：从校园生活开始，逐步卷入更大的阴谋...'}
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <div>
                <Label>章节数</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={chapterCount}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 1 && v <= 20) setChapterCount(v);
                    }}
                    className="w-20"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">个章节</span>
                </div>
              </div>

              <Button
                onClick={handleGenerateDirections}
                loading={isLoading}
                disabled={isLoading || (hasExisting && !direction.trim())}
                className="w-full"
              >
                <Sparkles className="h-4 w-4" />
                生成方案
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--text-secondary)]">
                  选择一个方向方案，可编辑后确认生成章节
                </p>
                <button
                  onClick={() => { setStep(1); setDirections([]); }}
                  className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
                >
                  <RotateCw className="h-3 w-3" />
                  重新描述
                </button>
              </div>

              <div className="space-y-3">
                {directions.map((d, idx) => (
                  <div key={idx} className="rounded-lg border border-[var(--border)] hover:border-[var(--primary)]/30 transition-colors overflow-hidden">
                    {editingIdx === idx ? (
                      <div className="p-3 space-y-2 bg-[var(--background)]">
                        <div>
                          <Label>方案标题</Label>
                          <Input
                            value={editValues.title}
                            onChange={(e) => setEditValues((v) => ({ ...v, title: e.target.value }))}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>详细描述</Label>
                          <Textarea
                            value={editValues.description}
                            onChange={(e) => setEditValues((v) => ({ ...v, description: e.target.value }))}
                            className="mt-1 min-h-[80px]"
                          />
                        </div>
                        <div>
                          <Label>关键转折点</Label>
                          <div className="space-y-1 mt-1">
                            {(editValues.keyPoints || []).map((kp, kpi) => (
                              <div key={kpi} className="flex items-center gap-1">
                                <Input
                                  value={kp}
                                  onChange={(e) => handleKeyPointChange(kpi, e.target.value)}
                                  className="flex-1"
                                />
                                <button
                                  onClick={() => handleRemoveKeyPoint(kpi)}
                                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={handleAddKeyPoint}
                              className="text-xs text-[var(--primary)] hover:underline"
                            >
                              + 添加转折点
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit}>
                            <Check className="h-3.5 w-3.5" />
                            确认修改
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm">{d.title || `方案 ${idx + 1}`}</h4>
                              <p className="text-sm text-[var(--text-secondary)] mt-1">{d.description}</p>
                              {d.keyPoints?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {d.keyPoints.filter(Boolean).map((kp, kpi) => (
                                    <span key={kpi} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--primary)]/10 text-xs text-[var(--primary)]">
                                      <ChevronRight className="h-3 w-3" />
                                      {kp}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex border-t border-[var(--border)]">
                          <button
                            onClick={() => handleStartEdit(idx)}
                            className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--background)] transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            编辑
                          </button>
                          <button
                            onClick={() => handleSelectDirection(d)}
                            className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors border-l border-[var(--border)]"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            选中并生成
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={handleGenerateDirections}
                  loading={isLoading}
                  disabled={isLoading}
                  className="w-full"
                >
                  <RotateCw className="h-4 w-4" />
                  重新生成方案
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}