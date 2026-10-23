import { notifyTooltip } from '../lib/notify';
import Icon from './Icon';

interface Props {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  /** Kort beskrivning av vad som skickas och till vem, t.ex. "Anna får veta att hon är ansvarig." Visas som tooltip. */
  summary: string;
  disabled?: boolean;
}

/**
 * Litet kuvert bredvid en knapp eller ett val (beslut 0019): upplyst = ett automatiskt meddelande skickas när funktionen
 * används, nedtonad och överstruken = inget skickas. Klick växlar. Tooltipen säger vad som skickas. Själva utskicket görs av
 * den som använder komponenten (sendNotices) och får aldrig stoppa funktionen den hör till.
 */
export default function NotifyToggle({ enabled, onChange, summary, disabled }: Props) {
  const tip = notifyTooltip(enabled, summary);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={tip}
      title={tip}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border-[1.5px] disabled:cursor-default disabled:opacity-40 ${
        enabled ? 'border-accent bg-period text-accent' : 'border-ink/15 bg-white text-ink/35 hover:border-ink/30'
      }`}
    >
      <Icon name="mail" className="h-[18px] w-[18px]" />
      {!enabled && <span aria-hidden="true" className="absolute h-[2px] w-6 rotate-[-35deg] rounded bg-ink/35" />}
    </button>
  );
}
