import { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Bold, Italic, Heading, Undo, Redo, Sparkles, Wand2, Lightbulb, AlignJustify } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const reformatContent = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;

  const blocks = [];

  const walk = (container) => {
    for (const node of Array.from(container.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text.trim()) {
          text.trim().split(/\n\n+/).forEach((p) => {
            const t = p.trim();
            if (t) blocks.push({ type: 'paragraph', content: t });
          });
        }
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = node.tagName.toLowerCase();

      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        const text = (node.textContent || '').trim();
        if (text) blocks.push({ type: tag, content: text });
      } else if (tag === 'p') {
        const text = (node.textContent || '').trim();
        if (!text) continue;
        const innerHTML = node.innerHTML;
        const hasDoubleBr = /<br\s*\/?>\s*<br\s*\/?>/i.test(innerHTML);
        if (hasDoubleBr) {
          innerHTML.split(/<br\s*\/?>\s*<br\s*\/?>/i).forEach((part) => {
            const t = part.replace(/<[^>]+>/g, '').trim();
            if (t) blocks.push({ type: 'paragraph', content: t });
          });
        } else {
          blocks.push({ type: 'paragraph', content: text });
        }
      } else if (tag === 'ul' || tag === 'ol') {
        for (const li of node.querySelectorAll('li')) {
          const text = (li.textContent || '').trim();
          if (text) blocks.push({ type: 'paragraph', content: text });
        }
      } else if (tag === 'blockquote') {
        const text = (node.textContent || '').trim();
        if (text) {
          text.split(/\n\n+/).forEach((p) => {
            const t = p.trim();
            if (t) blocks.push({ type: 'paragraph', content: t });
          });
        }
      } else {
        walk(node);
      }
    }
  };

  walk(div);

  if (blocks.length === 0) {
    const text = (div.innerText || '').trim();
    if (!text) return html;
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const result =
      paragraphs.length <= 1 && text.includes('\n')
        ? text.split(/\n/).map((p) => p.trim()).filter((p) => p.length > 0)
        : paragraphs;
    if (result.length === 0) return html;
    return result.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }

  return blocks
    .map((block) => {
      const content = block.content.replace(/\n/g, '<br>');
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(block.type)) {
        return `<${block.type}>${content}</${block.type}>`;
      }
      return `<p>${content}</p>`;
    })
    .join('');
};

export function ChapterEditor({ chapter, onContentChange, onGenerate, onContinue, onBrainstorm, isGenerating, activeAction }) {
  const [confirmAction, setConfirmAction] = useState(null);
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

  const handleReformat = useCallback(() => {
    if (!editor) return;
    setConfirmAction({
      message: '重新排版将清除加粗、斜体等格式，统一为标准小说排版。是否继续？',
      onConfirm: () => {
        const html = editor.getHTML();
        const reformatted = reformatContent(html);
        if (reformatted === html) {
          toast.info('内容已是标准格式，无需排版');
          return;
        }
        editor.commands.setContent(reformatted);
        onContentChange?.({ html: reformatted, text: editor.getText() });
        toast.success('排版完成');
      },
    });
  }, [editor, onContentChange]);

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-1">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded-lg hover:bg-[var(--elevated)] transition-all duration-200 ${editor.isActive('bold') ? 'bg-[var(--elevated)] text-[var(--primary)]' : 'text-[var(--text-secondary)]'}`}
            title="加粗"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded-lg hover:bg-[var(--elevated)] transition-all duration-200 ${editor.isActive('italic') ? 'bg-[var(--elevated)] text-[var(--primary)]' : 'text-[var(--text-secondary)]'}`}
            title="斜体"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-2 rounded-lg hover:bg-[var(--elevated)] transition-all duration-200 ${editor.isActive('heading') ? 'bg-[var(--elevated)] text-[var(--primary)]' : 'text-[var(--text-secondary)]'}`}
            title="标题"
          >
            <Heading className="h-4 w-4" />
          </button>
          <span className="w-px h-5 bg-[var(--border)] mx-1" />
          <button
            onClick={() => editor.chain().focus().undo().run()}
            className="p-2 rounded-lg hover:bg-[var(--elevated)] text-[var(--text-secondary)] transition-all duration-200"
            title="撤销"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            className="p-2 rounded-lg hover:bg-[var(--elevated)] text-[var(--text-secondary)] transition-all duration-200"
            title="重做"
          >
            <Redo className="h-4 w-4" />
          </button>
          <span className="w-px h-5 bg-[var(--border)] mx-1" />
          <button
            onClick={handleReformat}
            className="p-2 rounded-lg hover:bg-[var(--elevated)] text-[var(--text-secondary)] transition-all duration-200"
            title="重新排版"
          >
            <AlignJustify className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--text-secondary)] font-medium bg-[var(--elevated)] px-2 py-1 rounded-lg">
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
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => { confirmAction?.onConfirm(); setConfirmAction(null); }}
        title="确认操作"
        message={confirmAction?.message || ''}
      />
    </div>
  );
}
