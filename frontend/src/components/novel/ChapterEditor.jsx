import { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Bold, Italic, Heading, Undo, Redo, Sparkles, Wand2, Lightbulb } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';

export function ChapterEditor({ chapter, onContentChange, onGenerate, onContinue, onBrainstorm, isGenerating, activeAction }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: '开始写作... 选中文字后可用 AI 改写',
      }),
      CharacterCount.configure({
        limit: null, // no hard limit
      }),
    ],
    content: chapter?.content || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      onContentChange?.({ html, text });
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none p-6',
      },
    },
  }, []);

  // Sync external content changes into editor
  useEffect(() => {
    if (editor && chapter?.content !== undefined) {
      const currentHTML = editor.getHTML();
      const isHTMLContent = chapter.content?.startsWith('<');
      // Only update if content changed externally and editor is not focused
      if (!editor.isFocused) {
        if (isHTMLContent && chapter.content !== currentHTML) {
          editor.commands.setContent(chapter.content);
        } else if (!isHTMLContent && chapter.content !== editor.getText() && !currentHTML.includes(chapter.content)) {
          editor.commands.setContent(chapter.content);
        }
      }
    }
  }, [chapter?.content]);

  const wordCount = editor?.storage?.characterCount?.characters({ mode: 'textSize' }) ?? 0;

  const handleSelectionAction = useCallback((action) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    if (from !== to && selectedText.trim()) {
      action?.({
        text: selectedText,
        from,
        to,
        contextBefore: editor.state.doc.textBetween(Math.max(0, from - 100), from),
        contextAfter: editor.state.doc.textBetween(to, Math.min(editor.state.doc.content.size, to + 100)),
      });
    } else {
      toast.warning('请先选中要改写的文字');
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--background)]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-[var(--surface)] ${editor.isActive('bold') ? 'bg-[var(--surface)] text-[var(--primary)]' : ''}`}
            title="加粗"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-[var(--surface)] ${editor.isActive('italic') ? 'bg-[var(--surface)] text-[var(--primary)]' : ''}`}
            title="斜体"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-[var(--surface)] ${editor.isActive('heading') ? 'bg-[var(--surface)] text-[var(--primary)]' : ''}`}
            title="标题"
          >
            <Heading className="h-4 w-4" />
          </button>
          <span className="w-px h-5 bg-[var(--border)] mx-1" />
          <button
            onClick={() => editor.chain().focus().undo().run()}
            className="p-1.5 rounded hover:bg-[var(--surface)]"
            title="撤销"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            className="p-1.5 rounded hover:bg-[var(--surface)]"
            title="重做"
          >
            <Redo className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--text-secondary)]">
            {wordCount.toLocaleString()} 字
          </span>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onBrainstorm?.()}
            title="头脑风暴"
            disabled={!!activeAction || isGenerating}
            loading={activeAction === 'brainstorm'}
          >
            <Lightbulb className="h-3.5 w-3.5 mr-1" />
            灵感
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleSelectionAction(onContinue)}
            title="改写选中文字"
            disabled={!!activeAction || isGenerating}
            loading={activeAction === 'rewrite'}
          >
            <Wand2 className="h-3.5 w-3.5 mr-1" />
            改写
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onContinue?.()}
            title="续写"
            disabled={!!activeAction || isGenerating}
            loading={activeAction === 'continue'}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            续写
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={onGenerate}
            disabled={isGenerating}
            loading={isGenerating}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            AI 生成
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
