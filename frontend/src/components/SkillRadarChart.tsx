import { SKILL_CATEGORY_SHORT_LABELS } from '../lib/skillCategories';

interface SkillRadarChartProps {
  data: { category: string; level: number }[];
}

const SIZE = 260;
const CENTER = SIZE / 2;
const MAX_RADIUS = 85;
const MAX_LEVEL = 5;

function pointAt(index: number, count: number, radius: number): [number, number] {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

function polygonPoints(count: number, radius: number): string {
  return Array.from({ length: count }, (_, i) => pointAt(i, count, radius).join(',')).join(' ');
}

export default function SkillRadarChart({ data }: SkillRadarChartProps) {
  const count = data.length;
  if (count < 3) return null;

  const dataPoints = data.map((d, i) => pointAt(i, count, (Math.min(Math.max(d.level, 0), MAX_LEVEL) / MAX_LEVEL) * MAX_RADIUS));

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-auto max-w-[260px] mx-auto">
      {/* Grid rings, one per level 1-5 */}
      {Array.from({ length: MAX_LEVEL }, (_, k) => (
        <polygon
          key={k}
          points={polygonPoints(count, ((k + 1) / MAX_LEVEL) * MAX_RADIUS)}
          fill="none"
          stroke="#1f2433"
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {data.map((d, i) => {
        const [x, y] = pointAt(i, count, MAX_RADIUS);
        return <line key={d.category} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#1f2433" strokeWidth={1} />;
      })}

      {/* Data polygon */}
      <polygon points={dataPoints.map((p) => p.join(',')).join(' ')} fill="#3b82f6" fillOpacity={0.25} stroke="#3b82f6" strokeWidth={2} />
      {dataPoints.map((p, i) => (
        <circle key={data[i].category} cx={p[0]} cy={p[1]} r={3} fill="#3b82f6" />
      ))}

      {/* Axis labels */}
      {data.map((d, i) => {
        const [x, y] = pointAt(i, count, MAX_RADIUS + 14);
        const anchor = x < CENTER - 4 ? 'end' : x > CENTER + 4 ? 'start' : 'middle';
        return (
          <text key={d.category} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={10} fill="#8b92a8">
            {SKILL_CATEGORY_SHORT_LABELS[d.category] || d.category}
          </text>
        );
      })}
    </svg>
  );
}
