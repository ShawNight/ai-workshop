import { useState } from 'react';
import { Sparkles, BookOpen, ChevronRight } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Textarea, Label } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { motion } from 'framer-motion';

const genres = ['玄幻', '都市', '科幻', '悬疑', '言情', '武侠', '奇幻', '历史', '游戏', '轻小说'];
const styles = [
  { value: '热血升级流', label: '热血升级流', desc: '主角一路成长变强' },
  { value: '轻松日常流', label: '轻松日常流', desc: '慢节奏，注重生活描写' },
  { value: '悬疑推理', label: '悬疑推理', desc: '谜团驱动的故事' },
  { value: '无敌爽文', label: '无敌爽文', desc: '主角开局即巅峰，花式碾压' },
  { value: '虐主成长', label: '虐主成长', desc: '主角经历重重磨难方得成长' },
  { value: '系统流', label: '系统流', desc: '带有游戏化系统的设定' },
  { value: '重生流', label: '重生流', desc: '主角带着记忆回到过去' },
  { value: '种田流', label: '种田流', desc: '主角逐步建设经营' },
];

const examples = {
  玄幻: '一个废物少年在家族破灭后，意外获得一枚神秘戒指，里面住着一个受伤的强大灵魂，从此踏上逆袭之路，最终成为大陆最强者。',
  都市: '一个被辞退的普通青年，意外获得了一个能预知未来的手机APP，从此扭转人生，驰骋商场、情场。',
  科幻: '人类进入星际殖民时代，一个底层矿工在废弃星球上发现了一艘远古文明留下的飞船，改变了一切。',
  悬疑: '一个失忆男子在醒来后发现自己被指控谋杀，他必须在警方追捕下找到真相。',
  言情: '一个普通女大学生与校草意外同居，两个性格迥异的人在相处中逐渐磨合，最终相爱。',
};

export function SeedInput({ onGenerate, isGenerating }) {
  const [genre, setGenre] = useState('玄幻');
  const [style, setStyle] = useState('热血升级流');
  const [seed, setSeed] = useState('');
  const [targetWords, setTargetWords] = useState(1000000);
  const [synopsis, setSynopsis] = useState('');

  const handleSubmit = () => {
    if (!seed.trim()) return;
    onGenerate({
      genre,
      style,
      seed: seed.trim(),
      targetWords: parseInt(targetWords) || 1000000,
      synopsis: synopsis.trim(),
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 text-violet-400 text-sm font-medium mb-6 border border-violet-500/20">
          <Sparkles className="h-4 w-4" />
          全自动小说创作
        </div>
        <h1 className="text-3xl font-bold mb-2">告诉我你的故事创意</h1>
        <p className="text-[var(--text-secondary)]">
          AI 将根据你的创意自动设计完整的小说蓝图，然后逐章生成内容。
        </p>
      </motion.div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>故事类型</Label>
          <Select value={genre} onChange={(e) => setGenre(e.target.value)} className="mt-1">
            {genres.map((g) => (<option key={g} value={g}>{g}</option>))}
          </Select>
        </div>
        <div>
          <Label>写作风格</Label>
          <Select value={style} onChange={(e) => setStyle(e.target.value)} className="mt-1">
            {styles.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </Select>
        </div>
        <div>
          <Label>目标字数</Label>
          <Select
            value={targetWords.toString()}
            onChange={(e) => setTargetWords(parseInt(e.target.value))}
            className="mt-1"
          >
            <option value="500000">50万字</option>
            <option value="1000000">100万字</option>
            <option value="2000000">200万字</option>
            <option value="3000000">300万字</option>
            <option value="5000000">500万字</option>
          </Select>
        </div>
      </div>

      <div>
        <Label>种子创意 *</Label>
        <Textarea
          placeholder={examples[genre] || '描述你的故事核心创意...'}
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          className="mt-1 min-h-[120px] text-sm"
          autoFocus
        />
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          你不需要写大纲或设计角色，只需要一个想法。AI 会帮你完成剩下的所有工作。
        </p>
      </div>

      <div>
        <Label>一句话简介（可选）</Label>
        <input
          className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all duration-200 mt-1"
          placeholder="用一句话概括你的故事核心..."
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
        />
      </div>

      <div className="flex justify-center pt-4">
        <Button
          onClick={handleSubmit}
          disabled={!seed.trim() || isGenerating}
          loading={isGenerating}
          size="lg"
          className="min-w-[240px]"
        >
          <BookOpen className="h-5 w-5" />
          {isGenerating ? 'AI 正在设计小说蓝图...' : '开始自动创作'}
          {!isGenerating && <ChevronRight className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}
