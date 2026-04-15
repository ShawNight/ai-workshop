import { Link } from 'react-router-dom';
import { Card, CardTitle, CardContent } from '../components/ui/Card';
import { Music, BookOpen, Workflow, Sparkles, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Music,
    title: 'AI 音乐创作',
    description: '歌词优先的音乐创作流程，多轮对话打磨歌词，MiniMax API 生成专业音乐',
    link: '/music',
    color: 'from-pink-500 to-rose-500'
  },
  {
    icon: BookOpen,
    title: 'AI 小说写作',
    description: '智能生成故事大纲、章节内容、角色设定，让创作更高效',
    link: '/novel',
    color: 'from-violet-500 to-purple-500'
  },
  {
    icon: Workflow,
    title: '工作流编排',
    description: '拖拽式工作流构建器，连接不同 AI 工具，构建自动化创作 pipeline',
    link: '/workflows',
    color: 'from-cyan-500 to-blue-500'
  }
];

export function HomePage() {
  return (
    <div className="max-w-6xl mx-auto">
      <section className="text-center py-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-sm font-medium mb-6">
          <Sparkles className="h-4 w-4" />
          释放创意潜能
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[var(--primary)] via-[var(--secondary)] to-[var(--accent)] bg-clip-text text-transparent">
          AI 个人工作坊
        </h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-8">
          探索人工智能在创意领域的无限可能。从歌词到旋律，从故事大纲到完整章节，
          从工作流设计到自动化执行 — 一切尽在指尖。
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-6 pb-16">
        {features.map((feature) => (
          <Link key={feature.title} to={feature.link}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent>
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="mb-2 group-hover:text-[var(--primary)] transition-colors">
                  {feature.title}
                </CardTitle>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  {feature.description}
                </p>
                <div className="flex items-center text-[var(--primary)] text-sm font-medium">
                  开始使用 <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="py-12 border-t border-[var(--border)]">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">快速开始</h2>
          <p className="text-[var(--text-secondary)]">选择你想要的创作方式，三步即可完成</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div className="p-6">
            <div className="text-3xl font-bold text-[var(--primary)] mb-2">1</div>
            <p className="text-sm text-[var(--text-secondary)]">选择创作模式</p>
          </div>
          <div className="p-6">
            <div className="text-3xl font-bold text-[var(--secondary)] mb-2">2</div>
            <p className="text-sm text-[var(--text-secondary)]">输入你的想法</p>
          </div>
          <div className="p-6">
            <div className="text-3xl font-bold text-[var(--accent)] mb-2">3</div>
            <p className="text-sm text-[var(--text-secondary)]">AI 帮你完成</p>
          </div>
        </div>
      </section>
    </div>
  );
}
