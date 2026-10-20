import { CATEGORIES } from '../lib/categories';
import type { EventType } from '../types/event';
import Icon from './Icon';

export default function CategoryChip({ type, size = 'md' }: { type: EventType; size?: 'sm' | 'md' }) {
  const cat = CATEGORIES[type];
  const sizing = size === 'sm' ? 'gap-1 px-2 py-0.5 text-[11px]' : 'gap-1.5 px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wide ${sizing}`}
      style={{ color: cat.color, backgroundColor: `${cat.color}1a` }}
    >
      <Icon name={cat.icon} className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {cat.label}
    </span>
  );
}
