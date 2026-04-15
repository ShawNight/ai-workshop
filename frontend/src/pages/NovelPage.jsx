import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Label } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { novelApi } from '../api';
import { toast } from '../components/ui/Toast';
import { useNovelStore } from '../store/novelStore';
import { BookOpen, Plus, Trash2, Sparkles, Users, FileText, Save, Play } from 'lucide-react';

const genres = ['玄幻', '都市', '科幻', '悬疑', '言情', '武侠', '奇幻', '历史'];

export function NovelPage() {
  const { projects, currentProject, setProjects, setCurrentProject, addProject, updateProject, removeProject } = useNovelStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState('玄幻');
  const [newPremise, setNewPremise] = useState('');
  const [editingChapter, setEditingChapter] = useState(null);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingChapter, setIsGeneratingChapter] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await novelApi.getProjects();
      if (response.data.success) {
        setProjects(response.data.projects);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleCreateProject = async () => {
    if (!newTitle.trim()) {
      toast.error('请输入小说标题');
      return;
    }

    try {
      const response = await novelApi.createProject({
        title: newTitle,
        genre: newGenre,
        premise: newPremise
      });

      if (response.data.success) {
        addProject(response.data.project);
        setCurrentProject(response.data.project);
        toast.success('项目创建成功');
        setIsCreating(false);
        setNewTitle('');
        setNewPremise('');
      }
    } catch (error) {
      toast.error('项目创建失败');
    }
  };

  const handleGenerateOutline = async () => {
    if (!currentProject) return;

    setIsGeneratingOutline(true);
    try {
      const response = await novelApi.generateOutline({
        premise: currentProject.premise || '一个关于成长和冒险的故事',
        genre: currentProject.genre
      });

      if (response.data.success) {
        updateProject(currentProject.id, { outline: response.data.outline });
        toast.success('大纲生成成功');
      }
    } catch (error) {
      toast.error('大纲生成失败');
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleGenerateChapter = async (chapterIndex) => {
    if (!currentProject) return;

    const chapter = currentProject.chapters[chapterIndex];
    setIsGeneratingChapter(true);
    try {
      const response = await novelApi.generateChapter({
        chapterTitle: chapter?.title || `第${chapterIndex + 1}章`,
        previousContent: chapterIndex > 0 ? currentProject.chapters[chapterIndex - 1]?.content : '',
        premise: currentProject.premise
      });

      if (response.data.success) {
        const updatedChapters = [...currentProject.chapters];
        if (!updatedChapters[chapterIndex]) {
          updatedChapters[chapterIndex] = { id: Date.now().toString(), title: `第${chapterIndex + 1}章`, content: '' };
        }
        updatedChapters[chapterIndex].content = response.data.content;
        updateProject(currentProject.id, { chapters: updatedChapters });
        toast.success('章节内容生成成功');
      }
    } catch (error) {
      toast.error('章节生成失败');
    } finally {
      setIsGeneratingChapter(false);
    }
  };

  const handleAddChapter = () => {
    if (!currentProject) return;
    const newChapter = {
      id: Date.now().toString(),
      title: `第${currentProject.chapters.length + 1}章`,
      content: '',
      order: currentProject.chapters.length
    };
    updateProject(currentProject.id, {
      chapters: [...currentProject.chapters, newChapter]
    });
  };

  const handleDeleteChapter = (chapterId) => {
    if (!currentProject) return;
    updateProject(currentProject.id, {
      chapters: currentProject.chapters.filter(c => c.id !== chapterId)
    });
  };

  const handleUpdateChapter = (chapterId, content) => {
    if (!currentProject) return;
    updateProject(currentProject.id, {
      chapters: currentProject.chapters.map(c =>
        c.id === chapterId ? { ...c, content } : c
      )
    });
  };

  const handleDeleteProject = async (id) => {
    try {
      await novelApi.deleteProject(id);
      removeProject(id);
      toast.success('项目已删除');
    } catch (error) {
      toast.error('删除失败');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-[var(--secondary)]" />
            AI 小说写作
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">智能故事生成，章节创作，角色设定</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4" />
          新建项目
        </Button>
      </div>

      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>创建新小说项目</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>小说标题</Label>
              <Input
                placeholder="输入小说标题..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>类型</Label>
              <Select value={newGenre} onChange={(e) => setNewGenre(e.target.value)} className="mt-1">
                {genres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>故事背景/前提</Label>
              <Textarea
                placeholder="描述故事的世界观、背景设定..."
                value={newPremise}
                onChange={(e) => setNewPremise(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateProject}>
                <Save className="h-4 w-4" />
                创建
              </Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!currentProject ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold group-hover:text-[var(--primary)] transition-colors">
                      {project.title}
                    </h3>
                    <span className="text-xs text-[var(--text-secondary)]">{project.genre}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
                  {project.premise || '暂无描述'}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">
                    {project.chapters?.length || 0} 章 · {project.characters?.length || 0} 角色
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCurrentProject(project)}
                  >
                    编辑
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full text-center py-12 text-[var(--text-secondary)]">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>还没有小说项目</p>
              <p className="text-sm">点击右上角按钮创建第一个项目</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{currentProject.title}</CardTitle>
                <p className="text-sm text-[var(--text-secondary)]">{currentProject.genre}</p>
              </div>
              <Button variant="outline" onClick={() => setCurrentProject(null)}>
                返回列表
              </Button>
            </CardHeader>
          </Card>

          <div className="grid lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[var(--primary)]" />
                  故事大纲
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={currentProject.premise || ''}
                  onChange={(e) => updateProject(currentProject.id, { premise: e.target.value })}
                  placeholder="故事背景设定..."
                  className="min-h-[100px]"
                />
                <Button
                  onClick={handleGenerateOutline}
                  disabled={isGeneratingOutline}
                  loading={isGeneratingOutline}
                  variant="secondary"
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4" />
                  生成大纲
                </Button>
                {currentProject.outline?.length > 0 && (
                  <div className="space-y-2">
                    {currentProject.outline.map((chapter, index) => (
                      <div key={index} className="p-3 rounded bg-[var(--background)] text-sm">
                        <p className="font-medium">{chapter.title}</p>
                        <p className="text-[var(--text-secondary)] text-xs mt-1">{chapter.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[var(--secondary)]" />
                  章节
                </CardTitle>
                <Button size="sm" onClick={handleAddChapter}>
                  <Plus className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentProject.chapters?.map((chapter, index) => (
                    <div key={chapter.id} className="p-3 rounded border border-[var(--border)]">
                      <div className="flex items-center justify-between mb-2">
                        <Input
                          value={chapter.title}
                          onChange={(e) => {
                            const updated = [...currentProject.chapters];
                            updated[index].title = e.target.value;
                            updateProject(currentProject.id, { chapters: updated });
                          }}
                          className="text-sm font-medium"
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleGenerateChapter(index)}
                            disabled={isGeneratingChapter}
                          >
                            <Sparkles className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteChapter(chapter.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={chapter.content || ''}
                        onChange={(e) => handleUpdateChapter(chapter.id, e.target.value)}
                        placeholder="章节内容..."
                        className="min-h-[150px] text-sm"
                      />
                    </div>
                  ))}
                  {(!currentProject.chapters || currentProject.chapters.length === 0) && (
                    <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                      点击上方 + 按钮添加章节
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[var(--accent)]" />
                  角色
                </CardTitle>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentProject.characters?.map((character) => (
                    <div key={character.id} className="p-3 rounded border border-[var(--border)]">
                      <h4 className="font-medium">{character.name}</h4>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">{character.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {character.traits?.map((trait, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-[var(--primary)]/10 text-xs text-[var(--primary)]">
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(!currentProject.characters || currentProject.characters.length === 0) && (
                    <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                      暂无角色设定
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
