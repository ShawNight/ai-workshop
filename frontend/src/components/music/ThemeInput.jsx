import { cn } from '../../lib/utils';
import { Label } from '../ui/Input';

const moods = [
  { value: 'happy', label: '快乐' },
  { value: 'sad', label: '悲伤' },
  { value: 'romantic', label: '浪漫' },
  { value: 'energetic', label: '充满活力' },
  { value: 'melancholic', label: '忧郁' },
  { value: 'peaceful', label: '平静' },
  { value: 'nostalgic', label: '怀旧' },
  { value: 'dreamy', label: '梦幻' }
];

const genres = [
  { value: 'pop', label: '流行' },
  { value: 'rock', label: '摇滚' },
  { value: 'ballad', label: '民谣' },
  { value: 'electronic', label: '电子' },
  { value: 'rnb', label: 'R&B' },
  { value: 'hiphop', label: '嘻哈' },
  { value: 'jazz', label: '爵士' },
  { value: 'classical', label: '古典' },
  { value: 'country', label: '乡村' },
  { value: 'folk', label: '民歌' }
];

export function ThemeInput({ theme, setTheme, mood, setMood, genre, setGenre, onSubmit, loading }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="theme">歌曲主题</Label>
        <input
          id="theme"
          type="text"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="例如：关于青春、梦想、爱情..."
          className={cn(
            'flex h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm',
            'placeholder:text-[var(--text-secondary)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2'
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>情绪</Label>
        <div className="flex flex-wrap gap-2">
          {moods.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(m.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm transition-colors border',
                mood === m.value
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'border-[var(--border)] hover:border-[var(--primary)]'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>风格</Label>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGenre(g.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm transition-colors border',
                genre === g.value
                  ? 'bg-[var(--secondary)] text-white border-[var(--secondary)]'
                  : 'border-[var(--border)] hover:border-[var(--secondary)]'
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!theme || !mood || !genre || loading}
        className={cn(
          'w-full h-10 rounded-md font-medium transition-colors',
          'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {loading ? '生成中...' : '开始创作歌词'}
      </button>
    </div>
  );
}