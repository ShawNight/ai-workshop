import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input, Label } from '../ui/Input';
import { musicApi } from '../../api';
import { toast } from '../ui/Toast';
import { Sparkles, X, Check } from 'lucide-react';

export function LyricsEditor({
  lyrics,
  onChange,
  className
}) {
  const textareaRef = useRef(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [showModifyBox, setShowModifyBox] = useState(false);
  const [modifySuggestion, setModifySuggestion] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [modifyBoxPosition, setModifyBoxPosition] = useState({ top: 0, left: 0 });

  // 监听选区变化
  const handleSelect = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value.substring(start, end);

    if (text.length > 0 && text.trim()) {
      setSelectedText(text);
      setSelectionStart(start);
      setSelectionEnd(end);

      // 计算修改框位置（在选区附近）
      const rect = textarea.getBoundingClientRect();
      const lineHeight = 24; // 估算行高

      // 获取选区所在行的大致位置
      const linesBefore = textarea.value.substring(0, start).split('\n').length;
      const topPosition = linesBefore * lineHeight + 50;

      setModifyBoxPosition({
        top: Math.min(topPosition, rect.height - 150),
        left: 50
      });

      setShowModifyBox(true);
    } else {
      setShowModifyBox(false);
      setSelectedText('');
    }
  }, []);

  // 处理修改请求
  const handleModify = async () => {
    if (!modifySuggestion.trim()) {
      toast.error('请输入修改建议');
      return;
    }

    setIsModifying(true);
    try {
      const response = await musicApi.modifyLyrics({
        fullLyrics: lyrics,
        selectedText,
        suggestion: modifySuggestion
      });

      if (response.data.success) {
        onChange(response.data.fullLyrics);
        toast.success('歌词已修改');
        setShowModifyBox(false);
        setSelectedText('');
        setModifySuggestion('');
      } else {
        toast.error(response.data.error || '修改失败');
      }
    } catch (error) {
      toast.error('修改请求失败');
    } finally {
      setIsModifying(false);
    }
  };

  // 关闭修改框
  const handleCloseModifyBox = () => {
    setShowModifyBox(false);
    setSelectedText('');
    setModifySuggestion('');
  };

  // 点击文本区域时隐藏修改框（如果没有选中内容）
  const handleClick = () => {
    // 稍后检查选区，避免和 select 事件冲突
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart === textarea.selectionEnd) {
        setShowModifyBox(false);
      }
    }, 10);
  };

  return (
    <div className={cn('relative', className)}>
      {/* 歌词编辑框 */}
      <textarea
        ref={textareaRef}
        value={lyrics}
        onChange={(e) => onChange(e.target.value)}
        onSelect={handleSelect}
        onClick={handleClick}
        className={cn(
          'w-full h-full min-h-[300px] p-4 rounded-lg',
          'bg-[var(--bg-secondary)] border border-[var(--border)]',
          'font-mono text-sm leading-relaxed',
          'focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]',
          'resize-none'
        )}
        placeholder="在此编辑歌词内容，或点击左侧生成歌词..."
        spellCheck="false"
      />

      {/* 选区提示 */}
      {showModifyBox && selectedText && (
        <div
          className={cn(
            'absolute z-10 p-4 rounded-lg shadow-lg',
            'bg-[var(--surface)] border border-[var(--border)]',
            'min-w-[280px] max-w-[400px]'
          )}
          style={{
            top: modifyBoxPosition.top,
            left: modifyBoxPosition.left,
          }}
        >
          {/* 选区内容预览 */}
          <div className="mb-3">
            <Label className="text-xs text-[var(--text-secondary)]">
              已选中歌词：
            </Label>
            <div className="mt-1 p-2 bg-[var(--bg-tertiary)] rounded text-sm font-mono max-h-[80px] overflow-y-auto">
              {selectedText.length > 100
                ? selectedText.substring(0, 100) + '...'
                : selectedText}
            </div>
          </div>

          {/* 修改建议输入 */}
          <div className="mb-3">
            <Label className="text-xs text-[var(--text-secondary)]">
              修改建议：
            </Label>
            <Input
              value={modifySuggestion}
              onChange={(e) => setModifySuggestion(e.target.value)}
              placeholder="例如：改成更神秘的风格..."
              className="mt-1"
              autoFocus
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleModify}
              disabled={isModifying || !modifySuggestion.trim()}
              loading={isModifying}
              variant="primary"
            >
              <Sparkles className="h-3 w-3" />
              AI修改
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCloseModifyBox}
            >
              <X className="h-3 w-3" />
              取消
            </Button>
          </div>
        </div>
      )}

      {/* 使用提示 */}
      <div className="absolute bottom-4 right-4 text-xs text-[var(--text-secondary)] opacity-50 pointer-events-none">
        选中歌词可使用AI修改
      </div>
    </div>
  );
}