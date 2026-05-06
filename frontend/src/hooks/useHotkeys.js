import { useEffect, useCallback } from 'react';

export function useHotkeys(hotkeys, deps = []) {
  const handleKeyDown = useCallback((e) => {
    for (const [key, handler] of Object.entries(hotkeys)) {
      const parts = key.toLowerCase().split('+');
      const keyPart = parts[parts.length - 1];
      const needsCtrl = parts.includes('ctrl') || parts.includes('cmd');
      const needsShift = parts.includes('shift');

      if (e.key.toLowerCase() !== keyPart) continue;
      if (needsCtrl && !(e.ctrlKey || e.metaKey)) continue;
      if (needsShift && !e.shiftKey) continue;
      if (!needsCtrl && (e.ctrlKey || e.metaKey)) continue;
      if (!needsShift && e.shiftKey) continue;

      e.preventDefault();
      handler();
      break;
    }
  }, deps);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
