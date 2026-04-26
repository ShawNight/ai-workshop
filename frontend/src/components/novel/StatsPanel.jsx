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
    { icon: BookOpen, label: '总字数', value: totalWords.toLocaleString(), color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: TrendingUp, label: '完成进度', value: `${progress}%`, color: 'text-green-500', bg: 'bg-green-500/10' },
    { icon: Users, label: '角色数', value: characters.length, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { icon: Clock, label: '完成章节', value: `${completedChapters}/${chapters.length}`, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <h2 className="text-lg font-semibold">写作统计</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`p-4 rounded-xl ${bg}`}>
            <Icon className={`h-5 w-5 ${color} mb-2`} />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-[var(--text-secondary)]">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {targetWords > 0 && (
        <div className="p-4 rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">目标进度</span>
            <span className="text-sm text-[var(--text-secondary)]">
              {totalWords.toLocaleString()} / {targetWords.toLocaleString()} 字
            </span>
          </div>
          <div className="w-full h-3 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
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
              <div key={ch.id || idx} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background)]">
                <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-[var(--border)]'}`} />
                <span className="text-sm flex-1 truncate">{ch.title}</span>
                <span className="text-xs text-[var(--text-secondary)]">{words.toLocaleString()} 字</span>
                <div className="w-24 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-[var(--primary)]/30'}`}
                    style={{ width: `${Math.min(100, (words / (avgWordsPerChapter || 2000)) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project info */}
      <div className="p-4 rounded-xl border border-[var(--border)]">
        <h3 className="text-sm font-medium mb-3">项目信息</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-[var(--text-secondary)]">类型</span>
          <span>{project.genre || '通用'}</span>
          <span className="text-[var(--text-secondary)]">状态</span>
          <span>{statusMap[project.status] || '规划中'}</span>
          <span className="text-[var(--text-secondary)]">风格</span>
          <span>{project.writingStyle || '未设定'}</span>
          <span className="text-[var(--text-secondary)]">创建时间</span>
          <span>{project.createdAt ? new Date(project.createdAt).toLocaleDateString('zh-CN') : '-'}</span>
          <span className="text-[var(--text-secondary)]">平均每章</span>
          <span>{avgWordsPerChapter.toLocaleString()} 字</span>
        </div>
      </div>
    </div>
  );
}

const statusMap = { planning: '规划中', writing: '写作中', completed: '已完成', published: '已发布' };
