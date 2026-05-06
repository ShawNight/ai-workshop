import { useState } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { Button } from '../ui/Button';

export function SummarySuggestion({ suggestion, onAccept, onDismiss }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(suggestion.title || '');
  const [editDesc, setEditDesc] = useState(suggestion.description || '');

  if (!suggestion) return null;

  const handleAccept = () => {
    onAccept({
      title: isEditing ? editTitle : suggestion.title,
      description: isEditing ? editDesc : suggestion.description,
    });
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-blue-800 dark:text-blue-300 text-sm">
          📝 AI 建议更新章节概要
        </h4>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={16} />
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-2 mb-3">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 dark:border-gray-600"
            placeholder="章节标题"
          />
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 dark:border-gray-600 resize-none"
            rows={2}
            placeholder="章节概要"
          />
        </div>
      ) : (
        <div className="mb-3 space-y-1">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {suggestion.title}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {suggestion.description}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={handleAccept}>
          <Check size={14} className="mr-1" /> 采纳更新
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsEditing(!isEditing)}>
          <Pencil size={14} className="mr-1" /> {isEditing ? '取消编辑' : '编辑'}
        </Button>
      </div>
    </div>
  );
}