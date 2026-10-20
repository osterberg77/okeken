import { CATEGORIES, PAST_TAG } from '../lib/categories';
import type { EventType } from '../types/event';

export default function CategoryChip({ type, past = false }: { type: EventType | null; past?: boolean }) {
  const tag = past || !type ? PAST_TAG : CATEGORIES[type];
  return (
    <span
      className="inline-block self-start rounded-full px-3 py-1 text-xs leading-normal font-semibold"
      style={{ color: tag.fg, backgroundColor: tag.bg }}
    >
      {tag.label}
    </span>
  );
}
