import { useMemo } from 'react';
import * as Diff from 'diff';

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/<br\s*\/?>/gi, '\n');
}

export function VersionDiff({ oldContent, newContent }) {
  const hunks = useMemo(() => {
    const oldText = stripHtml(oldContent);
    const newText = stripHtml(newContent);
    return Diff.diffLines(oldText, newText);
  }, [oldContent, newContent]);

  return (
    <div className="font-mono text-xs whitespace-pre-wrap space-y-0.5 max-h-96 overflow-y-auto">
      {hunks.map((part, i) => {
        const lines = part.value.split('\n');
        return lines.map((line, j) => {
          if (!line && j === lines.length - 1) return null;
          if (part.added) {
            return <div key={`${i}-${j}`} className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2">{line}</div>;
          }
          if (part.removed) {
            return <div key={`${i}-${j}`} className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 line-through">{line}</div>;
          }
          return <div key={`${i}-${j}`} className="px-2">{line}</div>;
        });
      })}
    </div>
  );
}