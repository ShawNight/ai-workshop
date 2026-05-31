import { useState, useEffect } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { novelApi } from '../api';
import { harnessApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { ProjectCard } from '../components/novel/ProjectCard';
import { CreateProjectModal } from '../components/novel/CreateProjectModal';
import { useNavigate } from 'react-router-dom';

export function NovelListPage() {
  const { projects, setProjects, addProject, setCurrentProject } = useNovelStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await novelApi.getProjects();
      if (res.data.success) {
        setProjects(res.data.projects);
      }
    } catch {
      console.error('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (data) => {
    try {
      const res = await novelApi.createProject(data);
      if (res.data.success) {
        addProject(res.data.project);
        setCurrentProject(res.data.project);
        toast.success('项目创建成功');
        setIsCreating(false);
        navigate(`/novel/${res.data.project.id}`);
      }
    } catch {
      toast.error('项目创建失败');
    }
  };

  const handleStartHarness = async (seed, genre, style, title, coverColor, synopsis, targetWords) => {
    try {
      const res = await harnessApi.start({
        seed, genre, style, title, coverColor, synopsis, targetWords,
      });
      if (res.data.success) {
        addProject(res.data.project);
        setCurrentProject(res.data.project);
        toast.success('项目创建成功！');
        navigate(`/novel/${res.data.project.id}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || '启动失败');
    }
  };

  const handleSelect = (project) => {
    setCurrentProject(project);
    navigate(`/novel/${project.id}`);
  };

  const handleDelete = async (id) => {
    try {
      await novelApi.deleteProject(id);
      useNovelStore.getState().removeProject(id);
      toast.success('项目已删除');
    } catch {
      toast.error('删除失败');
    }
  };

  const handleRename = async (id, newTitle) => {
    try {
      await novelApi.updateProject(id, { title: newTitle });
      useNovelStore.getState().updateProject(id, { title: newTitle });
      toast.success('已重命名');
    } catch {
      toast.error('重命名失败');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-violet-400" />
            AI 小说工坊
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">多 Agent 协作，从创意到完稿</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4" />
          新建创作
        </Button>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : projects.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="开始你的第一部小说"
          description="只需输入一个创意，AI Agent 团队将协作完成从策划到写作的全部工作"
          action={
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4" />
              新建创作
            </Button>
          }
        />
      )}

      <CreateProjectModal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onCreate={handleCreate}
        onStartHarness={handleStartHarness}
      />
    </div>
  );
}
