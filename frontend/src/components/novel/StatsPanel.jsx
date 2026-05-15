import { BookOpen, Users, TrendingUp, Calendar, Clock } from 'lucide-react';

export function StatsPanel({ project }) {
  if (!project) return null;

  const chapters = project.chapters || [];
  const characters = project.characters || [];
  const totalWords = chapters.reduce(
    (sum, c) => sum + (c.content || '').replace(/<[^>]+>/g, '').replace(/\s/g, '').length, 0
  );
  const targetWords = project.targetWordCount || 0;
  const progress = targetWords > 0 ? Math.min(100, Math.round((totalWords / targetWords) * 100)) : 0;
  const completedChapters = chapters.filter((c) => c.content && c.content.replace(/<[^>]+>/g, '').replace(/\s/g, '').length > 100).length;
  const avgWordsPerChapter = chapters.length > 0 ? Math.round(totalWords / chapters.length) : 0;

  const stats = [
    { icon: BookOpen, label: '总字数', value: totalWords.toLocaleString(), color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { icon: TrendingUp, label: '完成进度', value: `${progress}%`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { icon: Users, label: '角色数', value: characters.length, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    { icon: Clock, label: '完成章节', value: `${completedChapters}/${chapters.length}`, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <h2 className="text-lg font-semibold">写作统计</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map(({ icon: Icon, label, value, color, bg, border }) => (
          <div key={label} className={`p-5 rounded-2xl ${bg} ${border} border transition-all duration-200 hover:shadow-md`}>
            <Icon className={`h-5 w-5 ${color} mb-3`} />
            <p className="text-3xl font-bold bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-secondary)] bg-clip-text text-transparent">{value}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {targetWords > 0 && (
        <div className="p-5 rounded-2xl bg-[var(--elevated)] border border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">目标进度</span>
            <span className="text-sm text-[var(--text-secondary)]">
              {totalWords.toLocaleString()} / {targetWords.toLocaleString()} 字
            </span>
          </div>
          <div className="w-full h-3 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] rounded-full transition-all duration-500 relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>
      )}

      {/* Chapter details */}
      {chapters.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-secondary)]">章节详情</h3>
          {chapters.map((ch, idx) => {
            const words = (ch.content || '').replace(/<[^>]+>/g, '').replace(/\s/g, '').length;
            const isComplete = words > 100;
            return (
              <div key={ch.id || idx} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--elevated)] border border-[var(--border)] transition-all hover:border-[var(--primary)]/20">
                <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-[var(--border)]'}`} />
                <span className="text-sm flex-1 truncate">{ch.title}</span>
                <span className="text-xs text-[var(--text-secondary)]">{words.toLocaleString()} 字</span>
                <div className="w-20 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-400' : 'bg-[var(--primary)]/30'}`}
                    style={{ width: `${Math.min(100, (words / (avgWordsPerChapter || 2000)) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project info */}
      <div className="p-5 rounded-2xl bg-[var(--elevated)] border border-[var(--border)]">
        <h3 className="text-sm font-medium mb-4">项目信息</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-[var(--text-secondary)] text-xs">类型</span>
            <p className="text-[var(--text-primary)] mt-0.5 font-medium">{project.genre || '通用'}</p>
          </div>
          <div>
            <span className="text-[var(--text-secondary)] text-xs">状态</span>
            <p className="text-[var(--text-primary)] mt-0.5 font-medium">{statusMap[project.status] || '规划中'}</p>
          </div>
          <div>
            <span className="text-[var(--text-secondary)] text-xs">风格</span>
            <p className="text-[var(--text-primary)] mt-0.5 font-medium">{project.writingStyle || '未设定'}</p>
          </div>
          <div>
            <span className="text-[var(--text-secondary)] text-xs">创建时间</span>
            <p className="text-[var(--text-primary)] mt-0.5 font-medium">{project.createdAt ? new Date(project.createdAt).toLocaleDateString('zh-CN') : '-'}</p>
          </div>
          <div className="col-span-2 pt-2 border-t border-[var(--border)]">
            <span className="text-[var(--text-secondary)] text-xs">平均每章</span>
            <p className="text-[var(--text-primary)] mt-0.5 font-medium">{avgWordsPerChapter.toLocaleString()} 字</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const statusMap = { planning: '规划中', writing: '写作中', completed: '已完成', published: '已发布' };
