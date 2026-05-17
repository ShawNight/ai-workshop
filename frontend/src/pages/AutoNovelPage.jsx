import { useState, useCallback } from 'react';
import { ArrowLeft, Check, Sparkles, RotateCcw, Eye, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { novelApi } from '../api';
import { SeedInput } from '../components/novel/automate/SeedInput';
import { DesignPreview } from '../components/novel/automate/DesignPreview';
import { DesignChat } from '../components/novel/automate/DesignChat';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

const STEPS = [
  { key: 'seed', label: '种子创意', num: 1 },
  { key: 'design', label: '设计蓝图', num: 2 },
  { key: 'writing', label: '逐章创作', num: 3 },
];

export function AutoNovelPage() {
  const [step, setStep] = useState('seed');
  const [design, setDesign] = useState(null);
  const [isGeneratingDesign, setIsGeneratingDesign] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const handleGenerateDesign = useCallback(async ({ genre, style, seed, targetWords, synopsis }) => {
    setIsGeneratingDesign(true);
    try {
      const res = await novelApi.generateDesign({ genre, style, seed, targetWords, synopsis });
      if (res.data.success) {
        setDesign(res.data.design);
        if (res.data.mock) {
          toast.info('使用示例数据（AI 服务暂不可用）');
        } else {
          toast.success('小说蓝图设计完成');
        }
        setStep('design');
      } else {
        toast.error(res.data.error || '生成失败');
      }
    } catch {
      toast.error('网络错误，请重试');
    } finally {
      setIsGeneratingDesign(false);
    }
  }, []);

  const handleDesignUpdate = useCallback((updated) => {
    setDesign(updated);
  }, []);

  const handleStartWriting = () => {
    setStep('writing');
  };

  const handleBack = () => {
    if (step === 'writing') setStep('design');
    else if (step === 'design') setStep('seed');
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* 步骤条 */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center gap-2 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-1.5 shadow-sm">
          {STEPS.map((s, i) => {
            const isActive = step === s.key;
            const isDone = STEPS.findIndex((x) => x.key === step) > i;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    isActive && 'bg-violet-500/10 text-violet-400',
                    isDone && 'text-[var(--text-secondary)]',
                    !isActive && !isDone && 'text-[var(--text-secondary)]'
                  )}
                >
                  <span className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                    isActive && 'bg-violet-400 text-white',
                    isDone && 'bg-emerald-400 text-white',
                    !isActive && !isDone && 'bg-[var(--border)] text-[var(--text-secondary)]'
                  )}>
                    {isDone ? <Check className="h-3 w-3" /> : s.num}
                  </span>
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-8 h-px bg-[var(--border)]" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 主内容 */}
      <div className="flex-1 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">
          {step === 'seed' && (
            <motion.div
              key="seed"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <SeedInput onGenerate={handleGenerateDesign} isGenerating={isGeneratingDesign} />
            </motion.div>
          )}

          {step === 'design' && design && (
            <motion.div
              key="design"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex gap-4 h-full"
            >
              {/* 设计面板 */}
              <div className={cn('flex-1 min-w-0 transition-all', showChat ? 'w-1/2' : 'w-full')}>
                <DesignPreview design={design} className="h-full" />
              </div>

              {/* 对话面板 */}
              <AnimatePresence>
                {showChat && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 380, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="w-[380px] flex-shrink-0 bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden"
                  >
                    <DesignChat
                      design={design}
                      onDesignUpdate={handleDesignUpdate}
                      onClose={() => setShowChat(false)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 底部操作栏 */}
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-4 py-3 shadow-lg z-20">
                <Button variant="outline" size="sm" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                  返回修改
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowChat(!showChat)}>
                  {showChat ? <Eye className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                  {showChat ? '隐藏对话' : '对话修改'}
                </Button>
                <Button variant="primary" size="sm" onClick={handleStartWriting}>
                  <Sparkles className="h-4 w-4" />
                  确认设计，开始写作
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'writing' && design && (
            <motion.div
              key="writing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="h-full flex items-center justify-center"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-violet-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">设计文档已确认</h2>
                <p className="text-[var(--text-secondary)] text-sm mb-6">
                  逐章写作功能即将上线
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  设计文档包含：{design.outline?.length || 0}卷大纲 · {design.characters?.length || 0}个角色 · {design.rules?.length || 0}条规则 · {design.foreshadows?.length || 0}个伏笔
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                  返回设计
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
