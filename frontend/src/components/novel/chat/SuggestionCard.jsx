import { Check, Plus, Link2, Sparkles, HelpCircle } from 'lucide-react';
import { Button } from '../../ui/Button';

const typeIcons = {
  update_character: Check,
  add_trait: Plus,
  create_relationship: Link2,
  create_character: Sparkles,
  update_location: Check,
  add_location_detail: Plus,
  create_location: Sparkles,
  ask_question: HelpCircle,
};

const typeLabels = {
  update_character: '更新设定',
  add_trait: '添加特征',
  create_relationship: '建立关系',
  create_character: '创建角色',
  update_location: '更新地点',
  add_location_detail: '补充细节',
  create_location: '创建地点',
  ask_question: '继续探讨',
};

export function SuggestionCard({ suggestion, onApply, applied }) {
  const Icon = typeIcons[suggestion.type] || Sparkles;
  const label = suggestion.label || typeLabels[suggestion.type] || '应用建议';

  if (suggestion.type === 'ask_question') {
    return (
      <button
        onClick={() => onApply(suggestion)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)]/5
                   hover:bg-[var(--primary)]/10 text-sm transition-colors w-full text-left"
      >
        <HelpCircle className="h-3.5 w-3.5 text-[var(--primary)] flex-shrink-0" />
        <span>{suggestion.value || suggestion.label}</span>
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
      applied
        ? 'border-green-500/30 bg-green-500/5'
        : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]/30'
    }`}>
      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${applied ? 'text-green-500' : 'text-[var(--primary)]'}`} />
      <span className="text-sm flex-1">{label}</span>
      {applied ? (
        <span className="text-xs text-green-500">已采纳</span>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => onApply(suggestion)} className="text-xs">
          采纳
        </Button>
      )}
    </div>
  );
}
