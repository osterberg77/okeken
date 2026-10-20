import type { EventType } from '../types/event';

export interface Category {
  label: string;
  /** Text i taggen */
  fg: string;
  /** Bakgrund i taggen */
  bg: string;
}

// Begränsad palett enligt designspec: grön (träning), lila (tävling), gul (övrigt).
// Får inte krocka med statusfärgerna för opublicerat (se StatusBadge).
const OTHER = { fg: '#6A5A12', bg: '#F6F0D2' };

export const CATEGORIES: Record<EventType, Category> = {
  training: { label: 'Träning', fg: '#3F6B3A', bg: '#E3F0DC' },
  competition: { label: 'Tävling', fg: '#6E3A82', bg: '#EFE3F5' },
  meeting: { label: 'Möte', ...OTHER },
  info: { label: 'Information', ...OTHER },
  happening: { label: 'Händelse', ...OTHER },
};

export const PAST_TAG = { label: 'Avslutad', fg: '#5F5A72', bg: '#ECE8F2' };
