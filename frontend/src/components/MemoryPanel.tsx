import { useState } from 'react';
import { Trash2, BrainCircuit } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { removeSkillStatement, type SkillCategoryState } from '../services/agentService';
import { SKILL_CATEGORIES, SKILL_LEVEL_LABELS } from '../lib/skillCategories';
import SkillRadarChart from './SkillRadarChart';

interface MemoryPanelProps {
  projectId: string;
  skills: SkillCategoryState[];
}

export default function MemoryPanel({ projectId, skills }: MemoryPanelProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const refreshProjectState = useProjectStore((s) => s.refreshProjectState);

  // Always render all five fixed categories, even ones the agent hasn't
  // recorded anything for yet — so the radar chart's axes never shift and
  // the empty ones read as "not yet assessed" rather than just missing.
  const byCategory = new Map(skills.map((s) => [s.category, s]));
  const merged = SKILL_CATEGORIES.map((category) => byCategory.get(category) || {
    id: category,
    category,
    level: 0,
    statements: [],
  });

  const handleDelete = async (category: string, statementId: string) => {
    setPendingId(statementId);
    try {
      await removeSkillStatement(projectId, category, statementId);
      await refreshProjectState(projectId);
    } catch {
      // Leave the statement in place if the delete failed — better a stale
      // item than silently losing track of state vs. the server.
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2 text-anvil-muted">
        <BrainCircuit className="w-3.5 h-3.5" />
        <p className="text-xs">What Anvil has picked up about your experience, per project.</p>
      </div>

      <div className="rounded-lg bg-anvil-panelHover border border-anvil-border p-3">
        <SkillRadarChart data={merged.map((m) => ({ category: m.category, level: m.level }))} />
      </div>

      <div className="space-y-3">
        {merged.map((entry) => (
          <div key={entry.category} className="rounded-lg border border-anvil-border bg-anvil-bg/60 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-white">{entry.category}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-anvil-panelHover text-anvil-muted">
                {SKILL_LEVEL_LABELS[entry.level] || SKILL_LEVEL_LABELS[0]}
              </span>
            </div>
            {entry.statements.length === 0 ? (
              <p className="text-[11px] text-anvil-muted italic">Nothing recorded yet.</p>
            ) : (
              <ul className="space-y-1">
                {entry.statements.map((s) => (
                  <li key={s.id} className="flex items-start gap-2 text-[11px] text-anvil-text leading-relaxed">
                    <span className="flex-1">{s.text}</span>
                    <button
                      onClick={() => handleDelete(entry.category, s.id)}
                      disabled={pendingId === s.id}
                      title="Remove this observation"
                      className="text-anvil-muted hover:text-anvil-danger disabled:opacity-40 shrink-0 mt-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
