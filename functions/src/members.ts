// Medlemslistan `members/{uid}` (beslut 0015): en avskalad kopia av users som banläggare och publicerare får söka i
// (resultat, "publicerat av"). Innehåller inte e-post eller behörigheter. Hålls i synk av `onUserMemberWritten`.

export interface MemberDoc {
  displayName: string;
  /** Kontots profilbild och färg (bara för att visa en liten bild bredvid namnet) */
  photoUrl?: string;
  avatarColor?: string;
  /**
   * Får namn och bild visas på den publika sajten (t.ex. "Publicerat av")? Kräver att personen godkänt policyn och inte
   * valt att dölja sitt namn. Interna listor visar alla medlemmar ändå.
   */
  publicName: boolean;
  /** Har personen valt "Dölj mig" (beslut 0018)? Dolda utelämnas i publika och medlemsvyer; bara behöriga ser dem. */
  hidden: boolean;
}

/** Medlemsposten för ett användardokument, eller null om personen inte (längre) är medlem eller saknar namn */
export function memberDoc(user: FirebaseFirestore.DocumentData | undefined): MemberDoc | null {
  if (!user) return null;
  const permissions: unknown = user.permissions;
  if (!Array.isArray(permissions) || permissions.length === 0) return null;
  const name = typeof user.displayName === 'string' ? user.displayName.trim() : '';
  if (!name) return null;
  const out: MemberDoc = {
    displayName: name.slice(0, 100),
    publicName: typeof user.consent?.version === 'string' && user.hidden !== true,
    hidden: user.hidden === true,
  };
  if (typeof user.photoUrl === 'string' && user.photoUrl.startsWith('https://')) out.photoUrl = user.photoUrl;
  if (typeof user.avatarColor === 'string') out.avatarColor = user.avatarColor;
  return out;
}
