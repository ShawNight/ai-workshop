import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useHarnessSSE — 共享的 Harness SSE 连接 hook
 *
 * 监听 /api/harness/stream/<projectId>，把推送的事件传给 onEvent。
 * 自动处理连接断开与重连。
 */
export function useHarnessSSE(projectId, { enabled = true, onEvent } = {}) {
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  const connect = useCallback(() => {
    if (!projectId || !enabled) return;
    if (sourceRef.current) {
      try { sourceRef.current.close(); } catch (_) { /* ignore */ }
      sourceRef.current = null;
    }

    const source = new EventSource(`/api/harness/stream/${projectId}`);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);
    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (onEventRef.current) onEventRef.current(event);
      } catch (err) {
        console.error('[SSE] parse error:', err);
      }
    };
    source.onerror = () => {
      setConnected(false);
    };
  }, [projectId, enabled]);

  const disconnect = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.close(); } catch (_) { /* ignore */ }
      sourceRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.close(); } catch (_) { /* ignore */ }
        sourceRef.current = null;
      }
    };
  }, [connect]);

  return { connected, reconnect: connect, disconnect };
}
