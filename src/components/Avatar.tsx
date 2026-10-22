import { avatarGradient, avatarShadow } from '../lib/avatar';

interface Props {
  name: string;
  color?: string;
  photoUrl?: string;
  /** Sidlängd i px */
  size: number;
  className?: string;
}

/** Profilcirkel: egen bild om den finns, annars initialen på vald färg. */
export default function Avatar({ name, color, photoUrl, size, className = '' }: Props) {
  const style = { width: size, height: size, boxShadow: avatarShadow(color) };
  if (photoUrl) {
    return <img src={photoUrl} alt="" width={size} height={size} style={style} className={`block rounded-full object-cover ${className}`} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, background: avatarGradient(color), fontSize: size * 0.4 }}
      className={`inline-flex items-center justify-center rounded-full font-display font-bold text-white ${className}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
