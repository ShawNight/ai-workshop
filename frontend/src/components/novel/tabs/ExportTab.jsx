import { useState } from 'react';
import { Download, FileText, FileJson, ToggleLeft, ToggleRight, Eye, Copy } from 'lucide-react';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { useNovelStore } from '../../../store/novelStore';

export function ExportTab() {
  const { currentProject } = useNovelStore();
  const [format, setFormat] = useState('txt');
  const [options, setOptions] = useState({
    includeTOC: true,
    includeOutline: true,
    includeCharacters: false,
    includeLocations: false,
    includeWordCount: false,
  });
  const [showPreview, setShowPreview] = useState(false);

  if (!currentProject) return null;

  const chapters = currentProject.chapters || [];
  const characters = currentProject.characters || [];
  const locations = currentProject.locations || [];
  const outline = currentProject.outline || [];
  const relationships = currentProject.relationships || [];

  const toggleOption = (key) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const buildContent = (fmt) => {
    const lines = [];

    if (fmt === 'txt') {
      lines.push(currentProject.title);
      lines.push('');
      if (currentProject.synopsis) {
        lines.push(`简介：${currentProject.synopsis}`);
        lines.push('');
      }
      lines.push('═'.repeat(50));
      lines.push('');

      if (options.includeTOC) {
        lines.push('【目 录】');
        lines.push('');
        chapters.forEach((ch, i) => {
          lines.push(`  ${ch.title}`);
        });
        lines.push('');
        lines.push('═'.repeat(50));
        lines.push('');
      }

      if (options.includeOutline) {
        const chaptersWithDesc = chapters.filter((ch) => (ch.description || '').trim());
        if (chaptersWithDesc.length > 0) {
          lines.push('【故事大纲】');
          lines.push('');
          chaptersWithDesc.forEach((ch) => {
            lines.push(`  ${ch.title}`);
            lines.push(`  ${ch.description}`);
            lines.push('');
          });
        }
        lines.push('═'.repeat(50));
        lines.push('');
      }

      chapters.forEach((ch) => {
        const content = (ch.content || '').replace(/<[^>]+>/g, '');
        lines.push(ch.title);
        lines.push('');
        lines.push(content || '（暂无内容）');
        lines.push('');
        lines.push('─'.repeat(40));
        lines.push('');
      });

      if (options.includeCharacters && characters.length > 0) {
        lines.push('【角色设定】');
        lines.push('');
        characters.forEach((c) => {
          lines.push(`${c.name}${c.role ? ` (${c.role})` : ''}`);
          if (c.description) lines.push(`  描述：${c.description}`);
          if (c.traits?.length) lines.push(`  性格：${c.traits.join('、')}`);
          if (c.appearance) lines.push(`  外貌：${c.appearance}`);
          lines.push('');
        });
      }

      if (options.includeLocations && locations.length > 0) {
        lines.push('【地点设定】');
        lines.push('');
        locations.forEach((loc) => {
          lines.push(`${loc.name} [${loc.type}]`);
          if (loc.description) lines.push(`  ${loc.description}`);
          lines.push('');
        });
      }

      return lines.join('\n');
    }

    // Markdown format
    if (fmt === 'md') {
      lines.push(`# ${currentProject.title}`);
      lines.push('');
      if (currentProject.synopsis) {
        lines.push(`> ${currentProject.synopsis}`);
        lines.push('');
      }

      if (currentProject.premise) {
        lines.push('## 故事背景');
        lines.push('');
        lines.push(currentProject.premise);
        lines.push('');
      }

      if (options.includeTOC) {
        lines.push('## 目录');
        lines.push('');
        chapters.forEach((ch, i) => {
          lines.push(`${i + 1}. [${ch.title}](#${ch.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '')})`);
        });
        lines.push('');
      }

      if (options.includeOutline) {
        const chaptersWithDesc = chapters.filter((ch) => (ch.description || '').trim());
        if (chaptersWithDesc.length > 0) {
          lines.push('## 故事大纲');
          lines.push('');
          chaptersWithDesc.forEach((ch) => {
            lines.push(`### ${ch.title}`);
            lines.push('');
            lines.push(ch.description);
            lines.push('');
          });
        }
      }

      chapters.forEach((ch) => {
        const content = (ch.content || '').replace(/<[^>]+>/g, '');
        lines.push(`## ${ch.title}`);
        lines.push('');
        if (options.includeWordCount) {
          lines.push(`*${content.replace(/\s/g, '').length} 字*`);
          lines.push('');
        }
        lines.push(content || '（暂无内容）');
        lines.push('');
        lines.push('---');
        lines.push('');
      });

      if (options.includeCharacters && characters.length > 0) {
        lines.push('## 角色设定');
        lines.push('');
        lines.push('| 姓名 | 定位 | 性格 | 外貌 |');
        lines.push('|------|------|------|------|');
        characters.forEach((c) => {
          lines.push(`| ${c.name} | ${c.role || '-'} | ${(c.traits || []).join('、') || '-'} | ${c.appearance || '-'} |`);
        });
        lines.push('');
      }

      return lines.join('\n');
    }

    return '';
  };

  const handleExport = () => {
    const content = buildContent(format);
    const ext = format === 'md' ? 'md' : 'txt';
    const mime = format === 'md' ? 'text/markdown' : 'text/plain';
    const blob = new Blob(['\uFEFF' + content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.title}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${format.toUpperCase()} 导出成功`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildContent(format));
    toast.success('已复制到剪贴板');
  };

  const chapters2 = currentProject.chapters || [];
  const totalWords = chapters2.reduce((sum, c) => sum + (c.content || '').replace(/<[^>]+>/g, '').replace(/\s/g, '').length, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <h2 className="text-lg font-semibold">导出小说</h2>

      {/* Stats */}
      <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)]">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-[var(--text-secondary)]">章节</span>
            <p className="font-medium">{chapters2.length}</p>
          </div>
          <div>
            <span className="text-[var(--text-secondary)]">总字数</span>
            <p className="font-medium">{totalWords.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-[var(--text-secondary)]">角色</span>
            <p className="font-medium">{characters.length}</p>
          </div>
        </div>
      </div>

      {/* Format Selection */}
      <div>
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">导出格式</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setFormat('txt')}
            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-colors ${
              format === 'txt' ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] hover:border-[var(--primary)]/30'
            }`}
          >
            <FileText className={`h-5 w-5 ${format === 'txt' ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'}`} />
            <div className="text-left">
              <p className="text-sm font-medium">TXT</p>
              <p className="text-xs text-[var(--text-secondary)]">纯文本</p>
            </div>
          </button>
          <button
            onClick={() => setFormat('md')}
            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-colors ${
              format === 'md' ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] hover:border-[var(--primary)]/30'
            }`}
          >
            <FileJson className={`h-5 w-5 ${format === 'md' ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'}`} />
            <div className="text-left">
              <p className="text-sm font-medium">Markdown</p>
              <p className="text-xs text-[var(--text-secondary)]">带排版</p>
            </div>
          </button>
        </div>
      </div>

      {/* Options */}
      <div>
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">导出选项</h3>
        <div className="space-y-2">
          {[
            { key: 'includeTOC', label: '包含目录' },
            { key: 'includeOutline', label: '包含故事大纲' },
            { key: 'includeCharacters', label: '包含角色设定' },
            { key: 'includeLocations', label: '包含地点设定' },
            { key: 'includeWordCount', label: '显示字数统计' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleOption(key)}
              className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--background)]"
            >
              <span className="text-sm">{label}</span>
              {options[key]
                ? <ToggleRight className="h-5 w-5 text-[var(--primary)]" />
                : <ToggleLeft className="h-5 w-5 text-[var(--text-secondary)] opacity-50" />
              }
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--primary)]"
        >
          <Eye className="h-4 w-4" />
          {showPreview ? '收起预览' : '预览导出内容'}
        </button>
        {showPreview && (
          <pre className="mt-2 p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap text-[var(--text-secondary)]">
            {buildContent(format).slice(0, 2000)}
            {buildContent(format).length > 2000 && '\n\n... (预览截断，完整内容请导出)'}
          </pre>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={handleExport}
          disabled={chapters2.length === 0}
          className="flex-1"
        >
          <Download className="h-4 w-4" />
          导出 {format.toUpperCase()}
        </Button>
        <Button
          variant="outline"
          onClick={handleCopy}
          disabled={chapters2.length === 0}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
