import { PERMISSION_COLORS, PERMISSION_LABELS, type Permission } from '../types/user';

export default function PermissionTag({ permission }: { permission: Permission }) {
  const { fg, bg } = PERMISSION_COLORS[permission];
  return (
    <span className="rounded-full px-2.5 py-[3px] text-xs font-semibold" style={{ color: fg, backgroundColor: bg }}>
      {PERMISSION_LABELS[permission]}
    </span>
  );
}
