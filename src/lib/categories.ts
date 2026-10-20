import type { EventType } from '../types/event';
import type { IconName } from '../components/Icon';

export interface Category {
  label: string;
  /** Huvudfärg; ljus bakgrund tas fram med alfa (`${color}1a`). */
  color: string;
  icon: IconName;
}

// Färgerna får inte krocka med statusfärgerna för opublicerat (svart/gul, se StatusBadge).
export const CATEGORIES: Record<EventType, Category> = {
  training: { label: 'Träning', color: '#21712F', icon: 'compass' },
  competition: { label: 'Tävling', color: '#9C397B', icon: 'flag' },
  meeting: { label: 'Möte', color: '#0A6FA8', icon: 'users' },
  info: { label: 'Information', color: '#7A6610', icon: 'info' },
  happening: { label: 'Händelse', color: '#C2410C', icon: 'star' },
};
