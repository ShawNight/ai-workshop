import { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Check, Copy, Sparkles } from 'lucide-react';

const SECTION_MARKERS = ['[Verse]', '[Chorus]', '[Bridge]', '[Intro]', '[Outro]', '[Pre-Chorus]'];

export function LyricsEditor({ lyrics, onChange, onImprove, onApprove, isApproved, loading }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(lyrics);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [lyrics]);

  const insertSectionMarker = useCallback((marker) => {
    const textarea = document.getElementById('lyrics-editor');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = lyrics.substring(0, start) + '\n' + marker + '\n' + lyrics.substring(end);
    onChange(newText);
  }, [lyrics, onChange]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">歌词编辑器</h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {SECTION_MARKERS.slice(0, 4).map((marker) => (
              <button
                key={marker}
                type="button"
                onClick={() => insertSectionMarker(marker)}
                className="px-2 py-0.5 text-xs rounded border border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
              >
                {marker.slice(1, -1)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="复制歌词"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[300px]">
        <textarea
          id="lyrics-editor"
          value={lyrics}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'absolute inset-0 w-full h-full p-4 rounded-lg resize-none font-mono text-sm',
            'border border-[var(--border)] bg-[var(--surface)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2',
            isApproved && 'bg-green-50 dark:bg-green-900/20 border-green-500'
          )}
          placeholder="在这里编写或编辑歌词...

使用标签标记歌曲结构：
[Verse] - 主歌
[Chorus] - 副歌
[Bridge] - 桥段
[Intro] - 前奏
[Outro] - 尾奏"
        />
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onImprove}
            disabled={!lyrics || loading}
            loading={loading}
          >
            <Sparkles className="h-4 w-4" />
            AI 优化
          </Button>
        </div>
        
        {isApproved ? (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Check className="h-5 w-5" />
            <span className="text-sm font-medium">歌词已确认</span>
          </div>
        ) : (
          <Button
            variant="primary"
            onClick={onApprove}
            disabled={!lyrics}
          >
            <Check className="h-4 w-4" />
            确认歌词
          </Button>
        )}
      </div>
    </div>
  );
}