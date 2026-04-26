import { Trash2, Edit3, BookOpen, Bookmark } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

export function ProjectCard({ project, onSelect, onDelete }) {
  const chapters = project.chapters || [];
  const characters = project.characters || [];
  const wordCount = project.currentWordCount || 0;
  const targetWords = project.targetWordCount || 0;
  const progress = targetWords > 0 ? Math.min(100, Math.round((wordCount / targetWords) * 100)) : 0;

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer group h-full">
      <CardContent className="flex flex-col h-full">
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ backgroundColor: project.coverColor || '#6366F1' }}
          >
            <Bookmark className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm group-hover:text-[var(--primary)] transition-colors truncate">
              {project.title}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-[var(--text-secondary)]">{project.genre}</span>
              {project.status && project.status !== 'planning' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">
                  {statusLabel(project.status)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3 flex-1">
          {project.synopsis || project.premise || '暂无简介'}
        </p>

        {targetWords > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
              <span>{wordCount.toLocaleString()} 字</span>
              <span>{targetWords.toLocaleString()} 字</span>
            </div>
            <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-secondary)]">
            {chapters.length} 章 · {characters.length} 角色
            {wordCount > 0 && !targetWords && ` · ${wordCount.toLocaleString()} 字`}
          </span>
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
