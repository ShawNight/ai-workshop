import { useState } from 'react';
import { UserPlus, MapPin, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/Button';
import { generateId } from '../../utils/formatContent';

export function EntityExtractor({ entities, onAccept, onDismiss }) {
  const [selectedChars, setSelectedChars] = useState(
    (entities.characters || []).map((c) => ({ ...c, _id: generateId(), checked: true }))
  );
  const [selectedLocs, setSelectedLocs] = useState(
    (entities.locations || []).map((l) => ({ ...l, _id: generateId(), checked: true }))
  );
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  if (!entities || ((!entities.characters || entities.characters.length === 0) && (!entities.locations || entities.locations.length === 0))) {
    return null;
  }

  const toggleChar = (id) => {
    setSelectedChars((prev) =>
      prev.map((c) => (c._id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const toggleLoc = (id) => {
    setSelectedLocs((prev) =>
      prev.map((l) => (l._id === id ? { ...l, checked: !l.checked } : l))
    );
  };

  const updateChar = (id, field, value) => {
    setSelectedChars((prev) =>
      prev.map((c) => (c._id === id ? { ...c, [field]: value } : c))
    );
  };

  const updateLoc = (id, field, value) => {
    setSelectedLocs((prev) =>
      prev.map((l) => (l._id === id ? { ...l, [field]: value } : l))
    );
  };

  const handleAcceptAll = () => {
    const chars = selectedChars.filter((c) => c.checked).map(({ _id, checked, ...rest }) => ({ id: generateId(), ...rest }));
    const locs = selectedLocs.filter((l) => l.checked).map(({ _id, checked, ...rest }) => ({ id: generateId(), ...rest }));
    onAccept({ characters: chars, locations: locs });
  };

  const charCount = (entities.characters || []).length;
  const locCount = (entities.locations || []).length;

  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-green-800 dark:text-green-300 text-sm">
          {charCount > 0 && <><UserPlus size={14} className="inline mr-1" />发现 {charCount} 个新角色</>}
          {charCount > 0 && locCount > 0 && ' · '}
          {locCount > 0 && <><MapPin size={14} className="inline mr-1" />发现 {locCount} 个新地点</>}
        </h4>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={16} />
        </button>
      </div>

      {selectedChars.length > 0 && (
        <div className="space-y-2 mb-3">
          {selectedChars.map((char) => (
            <div key={char._id} className="bg-white dark:bg-gray-800 rounded border p-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={char.checked}
                  onChange={() => toggleChar(char._id)}
                  className="rounded"
                />
                <span className="text-sm font-medium">{char.name}</span>
                <span className="text-xs text-gray-500">({char.role})</span>
                <span className="text-xs text-gray-400 ml-1">— {char.description}</span>
                <button
                  onClick={() => { setExpandedId(expandedId === char._id ? null : char._id); setEditingId(null); }}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                >
                  {expandedId === char._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
              {expandedId === char._id && (
                <div className="mt-2 space-y-1 pl-6 text-xs text-gray-600 dark:text-gray-400">
                  {editingId === char._id ? (
                    <>
                      <div><label className="text-gray-500">定位：</label><input value={char.role} onChange={(e) => updateChar(char._id, 'role', e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-700 dark:border-gray-600" /></div>
                      <div><label className="text-gray-500">描述：</label><input value={char.description} onChange={(e) => updateChar(char._id, 'description', e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-700 dark:border-gray-600" /></div>
                      <div><label className="text-gray-500">外貌：</label><input value={char.appearance || ''} onChange={(e) => updateChar(char._id, 'appearance', e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-700 dark:border-gray-600" /></div>
                      <div><label className="text-gray-500">背景：</label><input value={char.backstory || ''} onChange={(e) => updateChar(char._id, 'backstory', e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-700 dark:border-gray-600" /></div>
                      <div><label className="text-gray-500">性格：</label><input value={(char.traits || []).join('、')} onChange={(e) => updateChar(char._id, 'traits', e.target.value.split(/[、,]/).map(s => s.trim()).filter(Boolean))} className="w-full px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-700 dark:border-gray-600" /></div>
                    </>
                  ) : (
                    <>
                      {char.appearance && <div>外貌：{char.appearance}</div>}
                      {char.backstory && <div>背景：{char.backstory}</div>}
                      {char.traits && char.traits.length > 0 && <div>性格：{char.traits.join('、')}</div>}
                      <button onClick={() => setEditingId(char._id)} className="text-blue-500 hover:underline mt-1">编辑</button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedLocs.length > 0 && (
        <div className="space-y-2 mb-3">
          {selectedLocs.map((loc) => (
            <div key={loc._id} className="bg-white dark:bg-gray-800 rounded border p-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={loc.checked}
                  onChange={() => toggleLoc(loc._id)}
                  className="rounded"
                />
                <span className="text-sm font-medium">{loc.name}</span>
                <span className="text-xs text-gray-500">({loc.type})</span>
                <span className="text-xs text-gray-400 ml-1">— {loc.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={handleAcceptAll}>
          <Check size={14} className="mr-1" /> 全部采纳
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          忽略
        </Button>
      </div>
    </div>
  );
}