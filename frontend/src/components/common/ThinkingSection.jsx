import { Brain } from 'lucide-react';

/**
 * ThinkingSection — 通用 schema-driven 思考模式配置渲染器
 *
 * Props:
 *   schema: { type, label, description, fields: [...] } | null | undefined
 *   enabled: bool — 主开关（顶部 toggle）
 *   values: object — 各字段值（key → value）
 *   onToggle: (newEnabled: bool) => void
 *   onChange: (key: string, value: any) => void
 *   inputClass, selectClass — 样式 class
 */
export function ThinkingSection({ schema, enabled, values, onToggle, onChange,
                                  inputClass = '', selectClass = '' }) {
  // 协议不支持思考模式 — 不渲染
  if (!schema || !schema.fields || schema.fields.length === 0) return null;

  // 协议支持但用户没开 — 只渲染 toggle
  if (!enabled) {
    return (
      <section>
        <ToggleRow enabled={false} onToggle={() => onToggle(true)} label={schema.label || '思考模式'} />
      </section>
    );
  }

  // 已开启 — 渲染 toggle + 所有字段
  return (
    <section>
      <ToggleRow enabled={true} onToggle={() => onToggle(false)} label={schema.label || '思考模式'} />

      <div className="mt-3 pl-4 border-l-2 border-[var(--primary)]/20 space-y-3">
        {schema.description && (
          <p className="text-[11px] text-[var(--text-secondary)]">{schema.description}</p>
        )}
        {schema.fields.map(field => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={values?.[field.key] ?? field.default}
            onChange={(v) => onChange(field.key, v)}
            inputClass={inputClass}
            selectClass={selectClass}
          />
        ))}
      </div>
    </section>
  );
}

function ToggleRow({ enabled, onToggle, label }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-3 w-full"
    >
      <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-[var(--primary)]' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-4' : ''}`} />
      </div>
      <div className="flex items-center gap-2">
        <Brain className="h-3.5 w-3.5 text-[var(--primary)]" />
        <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">{label}</span>
      </div>
    </button>
  );
}

function FieldRenderer({ field, value, onChange, inputClass, selectClass }) {
  const { key, control, label, options, min, max, step, description, placeholder } = field;
  const fieldId = `thinking-field-${key}`;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
        {label || key}
      </label>

      {control === 'select' && (
        <select
          id={fieldId}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
        >
          {(options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {control === 'number' && (
        <input
          id={fieldId}
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
          step={step || 1}
          placeholder={placeholder}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className={inputClass}
        />
      )}

      {control === 'text' && (
        <input
          id={fieldId}
          type="text"
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {control === 'toggle' && (
        <div className="flex items-center gap-2">
          <button
            id={fieldId}
            type="button"
            onClick={() => onChange(!value)}
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-[var(--primary)]' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${value ? 'translate-x-4' : ''}`} />
          </button>
          <span className="text-xs text-[var(--text-secondary)]">{value ? '已开启' : '已关闭'}</span>
        </div>
      )}

      {description && (
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">{description}</p>
      )}
    </div>
  );
}
