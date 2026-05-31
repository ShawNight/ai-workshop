import { useState, useRef, useEffect } from 'react';
import { Trash2, Edit3, Bookmark, Clock, Sparkles } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export function ProjectCard({ project, onSelect, onDelete, onRename }) {
  const chapters = project.chapters || [];
  const characters = project.characters || [];
  const wordCount = project.currentWordCount || 0;
  const targetWords = project.targetWordCount || 0;
  const progress = targetWords > 0 ? Math.min(100, Math.round((wordCount / targetWords) * 100)) : 0;
  const lastUpdated = project.updatedAt || project.createdAt;
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.title || '');
  const renameRef = useRef(null);

  useEffect(() => {
    if (isRenaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameConfirm = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== project.title) {
      onRename?.(project.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      setRenameValue(project.title || '');
      setIsRenaming(false);
    }
  };

  return (
    <Card className="hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group h-full border border-[var(--border)]">
      <CardContent className="flex flex-col h-full p-5">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center shadow-md"
            style={{ backgroundColor: project.coverColor || '#6366F1' }}
          >
            <Bookmark className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <input
                ref={renameRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameConfirm}
                onKeyDown={handleRenameKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-sm font-semibold bg-[var(--surface)] border border-[var(--primary)]/50 rounded px-1.5 py-0.5 focus:outline-none"
              />
            ) : (
              <h3
                className="font-semibold text-sm group-hover:text-[var(--primary)] transition-colors truncate cursor-text"
                onDoubleClick={(e) => { e.stopPropagation(); setRenameValue(project.title || ''); setIsRenaming(true); }}
                title="双击重命名"
              >
                {project.title}
              </h3>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[var(--text-secondary)]">{project.genre}</span>
              {project.creationMode === 'auto' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  全自动
                </span>
              )}
              {project.status && project.status !== 'planning' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
                  {statusLabel(project.status)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-4 flex-1">
          {project.synopsis || project.premise || '暂无简介'}
        </p>

        {targetWords > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1.5">
              <span>{wordCount.toLocaleString()} 字</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span>{chapters.length} 章</span>
            <span>{characters.length} 角色</span>
            {lastUpdated && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(lastUpdated).toLocaleDateString('zh-CN')}
              </span>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => onSelect(project)}>
            <Edit3 className="h-3.5 w-3.5 mr-1" />
            编辑
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function statusLabel(status) {
  const map = { planning: '规划中', writing: '写作中', completed: '已完成', published: '已发布' };
  return map[status] || status;
}
