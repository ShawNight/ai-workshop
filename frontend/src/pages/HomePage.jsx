import { Link } from 'react-router-dom';
import { Music, BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useMusicStore } from '../store/musicStore';
import { useNovelStore } from '../store/novelStore';

const features = [
  {
    icon: Music,
    title: 'AI 音乐创作',
    description: '歌词优先的音乐创作流程，多轮对话打磨歌词，AI 生成专业音乐',
    link: '/music',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    iconBg: 'from-blue-500 to-cyan-400',
    borderColor: 'border-cyan-500/20',
    hoverText: 'group-hover:text-cyan-400',
  },
  {
    icon: BookOpen,
    title: 'AI 小说写作',
    description: '智能生成故事大纲、章节内容、角色设定，让创作更高效',
    link: '/novel',
    gradient: 'from-violet-500/20 to-purple-500/20',
    iconBg: 'from-violet-500 to-purple-400',
    borderColor: 'border-violet-500/20',
    hoverText: 'group-hover:text-violet-400',
  }
];

function RecentActivity() {
  const { musicHistory } = useMusicStore();
  const { projects } = useNovelStore();

  const recentMusic = [...musicHistory]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);
  const recentNovels = [...projects]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 3);

  const hasActivity = recentMusic.length > 0 || recentNovels.length > 0;
  if (!hasActivity) return null;

  return (
    <section className="py-12 border-t border-[var(--border)]">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">最近活动</h2>
        <p className="text-[var(--text-secondary)]">继续你未完成的创作</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {recentNovels.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-400" />
              小说项目
            </h3>
            {recentNovels.map((project) => (
              <Link
                key={project.id}
                to={`/novel/${project.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-violet-500/30 hover:shadow-lg transition-all duration-200 group"
              >
                <div
                  className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: project.coverColor || '#6366F1' }}
                >
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-violet-400 transition-colors">{project.title}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{project.genre} · {(project.chapters || []).length} 章</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--text-secondary)] group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        )}
        {recentMusic.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
              <Music className="h-4 w-4 text-cyan-400" />
              音乐创作
            </h3>
            {recentMusic.map((item) => (
              <Link
                key={item.id}
                to="/music"
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-cyan-500/30 hover:shadow-lg transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-400">
                  <Music className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-cyan-400 transition-colors">{item.title}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{item.userDescription?.slice(0, 30)}...</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--text-secondary)] group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <div className="max-w-5xl mx-auto">
      <section className="text-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-sm font-medium mb-8 border border-[var(--primary)]/20"
        >
          <Sparkles className="h-4 w-4" />
          释放创意潜能
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-[var(--primary)] via-[var(--secondary)] to-[var(--accent)] bg-clip-text text-transparent tracking-tight"
        >
          AI 个人工作坊
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-12 leading-relaxed"
        >
          探索人工智能在创意领域的无限可能。从歌词到旋律，从故事大纲到完整章节 — 一切尽在指尖。
        </motion.p>
      </section>

      <section className="grid md:grid-cols-2 gap-6 pb-8">
        {features.map((feature, idx) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
          >
            <Link to={feature.link}>
              <div className={cn(
                'h-full rounded-2xl bg-gradient-to-br p-8 border transition-all duration-300 group cursor-pointer',
                feature.gradient,
                feature.borderColor,
                'hover:shadow-[var(--shadow-hover)] hover:-translate-y-1'
              )}>
                <div className={cn('w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300', feature.iconBg)}>
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-3">{feature.title}</h2>
                <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">{feature.description}</p>
                <div className="flex items-center text-sm font-medium group-hover:text-[var(--text-primary)] transition-colors">
                  开始使用
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </section>

      <RecentActivity />

      <section className="py-12 border-t border-[var(--border)]">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">快速开始</h2>
          <p className="text-[var(--text-secondary)]">选择你想要的创作方式，三步即可完成</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div className="p-6 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <div className="text-3xl font-bold text-[var(--primary)] mb-2">1</div>
            <p className="text-sm text-[var(--text-secondary)]">选择创作模式</p>
          </div>
          <div className="p-6 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <div className="text-3xl font-bold text-[var(--secondary)] mb-2">2</div>
            <p className="text-sm text-[var(--text-secondary)]">输入你的想法</p>
          </div>
          <div className="p-6 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <div className="text-3xl font-bold text-[var(--accent)] mb-2">3</div>
            <p className="text-sm text-[var(--text-secondary)]">AI 帮你完成</p>
          </div>
        </div>
      </section>
    </div>
  );
}
