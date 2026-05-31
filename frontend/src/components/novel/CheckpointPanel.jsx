import { useState } from 'react';
import { CheckCircle, Edit3, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';

/**
 * CheckpointPanel — 检查点审批 UI
 *
 * 当工作流暂停等待用户审批时显示：
 * - 策划完成后：展示大纲/角色/世界观概要，可编辑后批准
 * - 评论家低分时：展示问题和建议，可选择接受/修改/跳过
 */
export function CheckpointPanel({ state, onApprove, onStateUpdate }) {
  const [editing, setEditing] = useState(false);
  const [editDesign, setEditDesign] = useState(null);
  const [approving, setApproving] = useState(false);

  if (!state?.waitingForUser) return null;

  const checkpoint = state.pendingCheckpoint || '';
  const design = editDesign || state.design || {};

  const handleApprove = async () => {
    setApproving(true);
    try {
      const updates = {};
      if (editDesign) {
        updates.design = editDesign;
      }
      await onApprove(updates);
      setEditing(false);
      setEditDesign(null);
    } catch (e) {
      toast.error('审批失败');
    } finally {
      setApproving(false);
    }
  };

  const handleEditToggle = () => {
    if (editing) {
      setEditing(false);
      setEditDesign(null);
    } else {
      setEditing(true);
      setEditDesign(JSON.parse(JSON.stringify(design)));
    }
  };

  // 策划阶段检查点
  if (checkpoint.startsWith('planning')) {
    return (
      <div className="bg-[var(--surface)] rounded-xl border-2 border-amber-500/40 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">策划方案待审批</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              AI 已完成故事策划，请审核后批准继续写作
            </p>
          </div>
        </div>

        {/* 策划概要 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 大纲概要 */}
          <div className="bg-[var(--elevated)] rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-semibold text-violet-400">📜 大纲</h4>
            {(design.outline || []).map((vol, i) => (
              <div key={i} className="text-xs text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-primary)]">
                  第{vol.volume}卷《{vol.title}》
                </span>
                <span className="ml-1">({vol.chapters || (vol.chapters_detail || []).length}章)</span>
                <div className="text-[10px] mt-0.5">{vol.goal}</div>
              </div>
            ))}
          </div>

          {/* 角色概要 */}
          <div className="bg-[var(--elevated)] rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-semibold text-emerald-400">👤 角色 ({(design.characters || []).length}个)</h4>
            {(design.characters || []).slice(0, 5).map((c, i) => (
              <div key={i} className="text-xs">
                <span className="font-medium text-[var(--text-primary)]">{c.name}</span>
                <span className="text-[var(--text-secondary)] ml-1">({c.role})</span>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  {c.traits?.join('、') || ''}
                </div>
              </div>
            ))}
          </div>

          {/* 世界观概要 */}
          <div className="bg-[var(--elevated)] rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-semibold text-blue-400">🌍 世界观</h4>
            {(design.world_rules || []).slice(0, 4).map((r, i) => (
              <div key={i} className="text-xs text-[var(--text-secondary)]">
                <span className={`text-[10px] ${r.type === 'hard' ? 'text-red-400' : 'text-blue-400'}`}>
                  [{r.type === 'hard' ? '强制' : '参考'}]
                </span>{' '}
                {r.rule}
              </div>
            ))}
            {(design.foreshadows || []).length > 0 && (
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                🔮 {design.foreshadows.length} 个伏笔
              </div>
            )}
          </div>
        </div>

        {/* 编辑提示 */}
        {editing && (
          <div className="bg-amber-500/5 rounded-lg p-3 border border-amber-500/20">
            <p className="text-xs text-amber-300">
              💡 编辑模式：点击下方"确认并继续"保存修改。你也可以先去设置面板详细编辑角色和世界观。
            </p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleApprove} disabled={approving} className="flex-1">
            <CheckCircle className="h-4 w-4" />
            {approving ? '审批中...' : '确认并继续创作'}
          </Button>
          <Button variant="outline" onClick={handleEditToggle}>
            <Edit3 className="h-4 w-4" />
            {editing ? '取消编辑' : '编辑策划'}
          </Button>
        </div>
      </div>
    );
  }

  // 章节低分检查点
  if (checkpoint.includes('low_score')) {
    const chapterIdx = state.currentChapterIndex;
    const chapter = state.chapters?.[chapterIdx];
    const chapterNum = chapterIdx + 1;

    // 获取评论家的审查结果
    let criticSummary = '';
    let criticScore = '';
    let suggestions = [];
    try {
      const lastOutput = state.agentStates?.critic?.last_output;
      if (lastOutput) {
        const parsed = JSON.parse(lastOutput);
        criticSummary = parsed.summary || '';
        criticScore = parsed.score;
        suggestions = parsed.suggestions || [];
      }
    } catch {}

    return (
      <div className="bg-[var(--surface)] rounded-xl border-2 border-red-500/40 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <span className="text-xl">⚠️</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              第{chapterNum}章质量评分过低
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              评论家评分 {criticScore}/10 — {criticSummary}
            </p>
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="bg-red-500/5 rounded-lg p-3 space-y-1">
            <h4 className="text-xs font-semibold text-red-400">修改建议</h4>
            {suggestions.map((s, i) => (
              <p key={i} className="text-xs text-[var(--text-secondary)]">• {s}</p>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleApprove} disabled={approving} className="flex-1">
            <CheckCircle className="h-4 w-4" />
            {approving ? '处理中...' : '接受并继续修改'}
          </Button>
        </div>
      </div>
    );
  }

  // 通用检查点
  return (
    <div className="bg-[var(--surface)] rounded-xl border-2 border-amber-500/40 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-amber-400" />
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">等待审批</h3>
          <p className="text-sm text-[var(--text-secondary)]">工作流已暂停，请审批后继续</p>
        </div>
      </div>
      <Button onClick={handleApprove} disabled={approving}>
        <CheckCircle className="h-4 w-4" />
        {approving ? '审批中...' : '确认继续'}
      </Button>
    </div>
  );
}
