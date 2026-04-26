import { useState } from 'react';
import { Plus, Trash2, MapPin, Globe, Building2, Trees, Mountain, Landmark, X, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input, Textarea, Label } from '../../ui/Input';
import { toast } from '../../ui/Toast';
import { useNovelStore } from '../../../store/novelStore';

const locationTypes = [
  { value: 'city', label: '城市', icon: Building2 },
  { value: 'village', label: '村镇', icon: Trees },
  { value: 'wilderness', label: '荒野', icon: Mountain },
  { value: 'realm', label: '异界', icon: Globe },
  { value: 'building', label: '建筑', icon: Landmark },
  { value: 'other', label: '其他', icon: MapPin },
];

export function WorldTab() {
  const { currentProject, updateProject } = useNovelStore();
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [newLocation, setNewLocation] = useState({
    name: '', type: 'city', description: '', significance: '',
  });

  if (!currentProject) return null;

  const locations = currentProject.locations || [];

  const handleCreate = () => {
    if (!newLocation.name.trim()) {
      toast.error('请输入地点名称');
      return;
    }
    const loc = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      ...newLocation,
      name: newLocation.name.trim(),
      description: newLocation.description.trim(),
      significance: newLocation.significance.trim(),
      createdAt: new Date().toISOString(),
    };
    updateProject(currentProject.id, { locations: [...locations, loc] });
    toast.success('地点已添加');
    setNewLocation({ name: '', type: 'city', description: '', significance: '' });
    setIsCreating(false);
  };

  const handleDelete = (id) => {
    updateProject(currentProject.id, {
      locations: locations.filter((l) => l.id !== id),
    });
    toast.success('地点已删除');
  };

  const typeInfo = (type) => locationTypes.find((t) => t.value === type) || locationTypes[5];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">世界观 · 地点 ({locations.length})</h2>
        <Button size="sm" onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4" />
          添加地点
        </Button>
      </div>

      {isCreating && (
        <div className="p-4 rounded-xl border-2 border-[var(--primary)]/30 bg-[var(--background)] mb-6 space-y-3">
          <h3 className="font-medium text-sm">新建地点</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>名称 *</Label>
              <Input
                placeholder="如：长安城"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>类型</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {locationTypes.map((lt) => {
                  const Icon = lt.icon;
                  return (
                    <button
                      key={lt.value}
                      onClick={() => setNewLocation({ ...newLocation, type: lt.value })}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        newLocation.type === lt.value ? 'bg-[var(--primary)] text-white' : 'bg-[var(--border)]/50 hover:bg-[var(--border)]'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {lt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div>
            <Label>描述</Label>
            <Textarea
              placeholder="描述这个地方的特征、氛围、历史..."
              value={newLocation.description}
              onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
              className="mt-1 min-h-[60px]"
            />
          </div>
          <div>
            <Label>剧情意义</Label>
            <Input
              placeholder="这个地方在故事中的作用..."
              value={newLocation.significance}
              onChange={(e) => setNewLocation({ ...newLocation, significance: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>创建</Button>
            <Button size="sm" variant="outline" onClick={() => setIsCreating(false)}>取消</Button>
          </div>
        </div>
      )}

      {locations.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-3">
          {locations.map((loc) => {
            const TypeIcon = typeInfo(loc.type).icon;
            const isExpanded = expandedId === loc.id;
            return (
              <div key={loc.id} className="border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--primary)]/30 transition-colors">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : loc.id)}
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
                    <TypeIcon className="h-4 w-4 text-[var(--primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{loc.name}</span>
                    <span className="text-xs text-[var(--text-secondary)] ml-2">{typeInfo(loc.type).label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(loc.id); }}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" /> : <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-2 bg-[var(--background)]/50">
                    {loc.description && (
                      <p className="text-sm text-[var(--text-secondary)]">{loc.description}</p>
                    )}
                    {loc.significance && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-[var(--primary)] mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{loc.significance}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-[var(--border)] rounded-xl">
          <Globe className="h-10 w-10 mx-auto mb-3 text-[var(--text-secondary)] opacity-50" />
          <p className="text-sm text-[var(--text-secondary)]">还没有世界观地点</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">添加故事中的重要地点</p>
        </div>
      )}
    </div>
  );
}
