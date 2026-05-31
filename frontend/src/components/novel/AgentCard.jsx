import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

const STATUS_STYLES = {
  idle: 'opacity-40',
  running: 'ring-2 ring-violet-400',
  done: 'ring-1 ring-green-400/30',
  error: 'ring-1 ring-red-400/30',
};

const STATUS_BADGES = {
  idle: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: '待机' },
  running: { bg: 'bg-violet-500/10', text: 'text-violet-400', label: '工作中' },
  done: { bg: 'bg-green-500/10', text: 'text-green-400', label: '已完成' },
  error: { bg: 'bg-red-500/10', text: 'text-red-400', label: '异常' },
};

function ElapsedTimer({ running }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      setElapsed(0);
      const timer = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [running]);

  if (!running) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isSlow = elapsed > 30;
  const isStuck = elapsed > 60;

  return (
    <div className="space-y-0.5">
      <div className={cn(
        'text-[10px] text-center font-mono',
        isStuck ? 'text-red-400' : isSlow ? 'text-amber-400' : 'text-[var(--text-secondary)]'
      )}>
        {mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`}
        {isStuck ? ' ⚠️' : isSlow ? ' ⚠' : ''}
      </div>
      {isStuck && (
        <div className="text-[9px] text-red-400/70 text-center">
          可能卡住
        </div>
      )}
    </div>
  );
}

export function AgentCard({ agent, info, state, isActive }) {
  const status = state?.status || 'idle';
  const badge = STATUS_BADGES[status] || STATUS_BADGES.idle;
  const isRunning = status === 'running';

  return (
    <div className={cn(
      'flex-1 flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--elevated)] border border-[var(--border)] transition-all duration-300',
      STATUS_STYLES[status] || '',
      isActive && 'border-violet-500/30 bg-violet-500/5',
    )}>
      <div className={cn('text-2xl transition-all', isRunning && 'animate-bounce')}>
        {info.icon}
      </div>
      <div className="text-xs font-semibold text-[var(--text-primary)]">{info.label}</div>
      <div className={cn(
        'text-[10px] px-2 py-0.5 rounded-full font-medium',
        badge.bg,
        badge.text,
        isRunning && 'animate-pulse',
      )}>
        {badge.label}
      </div>
      <ElapsedTimer running={isRunning} />
      {isRunning && (
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
          <div className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
          <div className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
        </div>
      )}
      <div className="text-[10px] text-[var(--text-secondary)] text-center leading-tight">
        {isRunning ? info.description : ''}
      </div>
    </div>
  );
}
