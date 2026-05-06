import { useState } from 'react';
import { X, Plus, Trash2, StickyNote } from 'lucide-react';
import { Button } from '../ui/Button';
import { generateId } from '../../utils/formatContent';

export function NotesDrawer({ isOpen, onClose, notes = [], onNotesChange }) {
  const [newNote, setNewNote] = useState('');

  if (!isOpen) return null;

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const updated = [...notes, { id: generateId(), type: 'idea', content: newNote.trim(), createdAt: Date.now() }];
    onNotesChange(updated);
    setNewNote('');
  };

  const handleDeleteNote = (id) => {
    onNotesChange(notes.filter((n) => n.id !== id));
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-[var(--surface)] border-l border-[var(--border)] shadow-lg z-40 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          灵感笔记
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--background)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {notes.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)] text-center py-8">暂无笔记，开始记录灵感吧</p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="p-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm group">
            <div className="flex items-start justify-between gap-2">
              <p className="flex-1 whitespace-pre-wrap break-words">{note.content}</p>
              <button
                onClick={() => handleDeleteNote(note.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded flex-shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <span className="text-xs text-[var(--text-secondary)] mt-1 block">
              {new Date(note.createdAt).toLocaleDateString('zh-CN')} {note.type === 'brainstorm' ? '🧠' : '💡'}
            </span>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex gap-2">
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
            placeholder="记录灵感..."
            className="flex-1 text-sm px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:border-[var(--primary)]/50"
          />
          <Button size="sm" onClick={handleAddNote}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
