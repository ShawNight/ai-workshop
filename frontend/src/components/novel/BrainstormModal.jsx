import { useState } from 'react';
import { X, Lightbulb, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { toast } from '../ui/Toast';
import { novelApi } from '../../api';
import { useNovelStore } from '../../store/novelStore';

export function BrainstormModal({ isOpen, onClose, onApplyIdea }) {
  const { currentProject } = useNovelStore();
  const [idea, setIdea] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleBrainstorm = async () => {
    if (!idea.trim()) {
      toast.error('请输入你的想法');
      return;
    }
    setIsLoading(true);
    try {
      const res = await novelApi.brainstorm({
        idea: idea.trim(),
        genre: currentProject?.genre || '通用',
        premise: currentProject?.premise || '',
        characters: currentProject?.characters || [],
        relationships: currentProject?.relationships || [],
      });
      if (res.data.success) {
        setResults(res.data.ideas || []);
        if (res.data.mock) toast.info(res.data.message);
      } else {
        toast.error(res.data.error || '头脑风暴失败');
      }
    } catch {
      toast.error('请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            灵感头脑风暴
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--background)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <Textarea
              placeholder="输入你的想法，AI 会帮你探索不同的创作方向...&#10;例如：主角在废弃工厂发现了一个神秘装置"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <Button onClick={handleBrainstorm} loading={isLoading} disabled={isLoading} className="w-full">
            <Sparkles className="h-4 w-4" />
            生成创作方向
          </Button>

          {results.length > 0 && (
            <div className="space-y-3 pt-2">
              {results.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-[var(--border)] hover:border-[var(--primary)]/30 transition-colors group">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-sm">{item.title}</h4>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">{item.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onApplyIdea?.(item);
                        onClose();
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                      采用
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
