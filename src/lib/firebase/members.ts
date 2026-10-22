import { collection, getDocs } from 'firebase/firestore';
import type { PublicPublisher } from '../../types/event';
import { db } from './client';

// Medlemslistan members/{uid} (beslut 0015): läsbar för banläggare, publicerare, styrelse och superadmin.

export interface Member {
  uid: string;
  displayName: string;
  photoUrl?: string;
  avatarColor?: string;
  /** Får namn och bild visas på den publika sajten */
  publicName: boolean;
}

export async function loadMembers(): Promise<Member[]> {
  const snap = await getDocs(collection(db, 'members'));
  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        uid: d.id,
        displayName: String(x.displayName ?? ''),
        photoUrl: typeof x.photoUrl === 'string' ? x.photoUrl : undefined,
        avatarColor: typeof x.avatarColor === 'string' ? x.avatarColor : undefined,
        publicName: x.publicName === true,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'sv'));
}

/** Medlemmen i publik form (som bygget visar den), eller undefined om den inte får visas */
export function toPublisher(members: Member[] | null, uid: string | null): PublicPublisher | undefined {
  const m = uid ? members?.find((x) => x.uid === uid) : undefined;
  return m?.publicName ? { name: m.displayName, photoUrl: m.photoUrl, color: m.avatarColor } : undefined;
}
