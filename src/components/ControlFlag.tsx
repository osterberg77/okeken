/** Orienteringskontroll (skärm): vit övre vänstra halva, orange nedre högra. */
export default function ControlFlag({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="2" fill="#fff" />
      <path d="M31 1v28a2 2 0 0 1-2 2H1Z" fill="#F26B21" />
      <rect x="1" y="1" width="30" height="30" rx="2" fill="none" stroke="#1c1917" strokeOpacity=".15" strokeWidth="1.5" />
    </svg>
  );
}
