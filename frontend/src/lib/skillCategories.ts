// Mirrors backend/adapters/state/adapter.py's SKILL_CATEGORIES and
// _skill_slug exactly — a fixed set so the Memory tab's radar chart axes
// stay stable across projects instead of growing unbounded.
export const SKILL_CATEGORIES = [
  'CAD & Mechanical Design',
  'Electronics & Circuits',
  'Firmware & Embedded Coding',
  'Software & Web Development',
  '3D Printing & Manufacturing',
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

// Short axis labels for the radar chart — full names are too long to fit
// next to a chart point; the per-category list below the chart uses the
// full name instead.
export const SKILL_CATEGORY_SHORT_LABELS: Record<string, string> = {
  'CAD & Mechanical Design': 'CAD',
  'Electronics & Circuits': 'Electronics',
  'Firmware & Embedded Coding': 'Firmware',
  'Software & Web Development': 'Software',
  '3D Printing & Manufacturing': '3D Printing',
};

export function skillCategorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const SKILL_LEVEL_LABELS: Record<number, string> = {
  0: 'Unassessed',
  1: 'Novice',
  2: 'Beginner',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};
