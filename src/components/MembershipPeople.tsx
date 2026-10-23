import { INPUT } from './admin/AdminUi';
import { FEE_LIMITS, type FeeCategory } from '../types/membership';

export interface PersonRow {
  name: string;
  categoryId: string;
}

/** Raderna "namn + avgiftsklass" för de som ingår i betalningen. Används av medlemsformuläret och kassörens manuella registrering. */
export default function MembershipPeople({
  people,
  categories,
  onChange,
}: {
  people: PersonRow[];
  categories: FeeCategory[];
  onChange: (people: PersonRow[]) => void;
}) {
  const set = (i: number, patch: Partial<PersonRow>) => onChange(people.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="flex flex-col gap-3">
      {people.map((p, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-2xl bg-period p-3 sm:flex-row sm:items-center">
          <input
            className={`${INPUT} sm:flex-1`}
            placeholder={`Namn, person ${i + 1}`}
            aria-label={`Namn, person ${i + 1}`}
            value={p.name}
            maxLength={100}
            onChange={(e) => set(i, { name: e.target.value })}
          />
          <select
            className={`${INPUT} sm:w-auto`}
            aria-label={`Avgiftsklass, person ${i + 1}`}
            value={p.categoryId}
            onChange={(e) => set(i, { categoryId: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}{c.hint ? ` (${c.hint})` : ''} – {c.amount} kr
              </option>
            ))}
          </select>
          {people.length > 1 && (
            <button type="button" onClick={() => onChange(people.filter((_, j) => j !== i))} className="cursor-pointer self-end rounded-full px-3 py-2 text-sm font-semibold text-[#A33A3A] hover:bg-white sm:self-auto">
              Ta bort
            </button>
          )}
        </div>
      ))}
      {people.length < FEE_LIMITS.people && (
        <button
          type="button"
          onClick={() => onChange([...people, { name: '', categoryId: categories[0]?.id ?? '' }])}
          className="cursor-pointer self-start rounded-full border-[1.5px] border-ink/18 bg-white px-5 py-2.5 text-sm font-semibold hover:border-accent hover:text-accent"
        >
          + Lägg till person
        </button>
      )}
    </div>
  );
}
