import { useEffect, useRef, useState } from 'react';
import { rememberedSignIn } from '../lib/firebase/flags';
import { MAX_MESSAGE_LENGTH, type ConversationSummary } from '../lib/messages';
import { TZ } from '../lib/time';
import type { Message, Person } from '../lib/firebase/messages';
import type { Session } from '../types/user';
import Avatar from './Avatar';

type Api = typeof import('../lib/firebase/messages');

const dateFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const when = (d: Date | null) => (d ? dateFmt.format(d) : '');
const nameOf = (p: Person | null | undefined) => p?.displayName || 'Okänd';

/** Meddelanden (beslut 0019): lista över konversationer, en tråd i taget och "Nytt meddelande". Bara text och emojis. */
export default function MessagesPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [api, setApi] = useState<Api | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [people, setPeople] = useState<Record<string, Person | null>>({});
  const [selected, setSelected] = useState<string | null>(() => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('med')));
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!rememberedSignIn()) {
      location.replace('/logga-in?next=/meddelanden');
      return;
    }
    let stop = () => {};
    let cancelled = false;
    Promise.all([import('../lib/firebase/session'), import('../lib/firebase/messages')]).then(([{ watchSession }, m]) => {
      if (cancelled) return;
      setApi(m);
      stop = watchSession((s) => {
        if (s === null) location.replace('/logga-in?next=/meddelanden');
        setSession(s);
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  const uid = session?.uid;
  useEffect(() => {
    if (!api || !uid) return;
    return api.watchConversations(uid, setConversations);
  }, [api, uid]);

  // Namn och bild för dem man har konversation med (och den man just valt)
  useEffect(() => {
    if (!api) return;
    const wanted = [...(conversations ?? []).map((c) => c.otherUid), ...(selected ? [selected] : [])];
    for (const other of wanted) {
      if (!other || other in people) continue;
      setPeople((p) => ({ ...p, [other]: null }));
      api.loadPerson(other).then((person) => setPeople((p) => ({ ...p, [other]: person })));
    }
  }, [api, conversations, selected, people]);

  function open(other: string | null) {
    setSelected(other);
    setPicking(false);
    const url = other ? `/meddelanden?med=${encodeURIComponent(other)}` : '/meddelanden';
    history.replaceState(null, '', url);
  }

  if (!session || !api) return <p className="text-muted">Laddar…</p>;
  const canSeeHidden = session.permissions.some((p) => ['course_setter', 'publisher', 'board', 'superadmin'].includes(p));

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <h1 className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">Meddelanden</h1>
      {selected ? (
        <Thread api={api} me={session} other={selected} person={people[selected]} unread={conversations?.find((c) => c.otherUid === selected)?.unread === true} onBack={() => open(null)} />
      ) : picking ? (
        <Picker api={api} me={session.uid} includeHidden={canSeeHidden} onPick={open} onCancel={() => setPicking(false)} />
      ) : (
        <List conversations={conversations} people={people} onOpen={open} onNew={() => setPicking(true)} />
      )}
    </div>
  );
}

function PersonRow({ person, children }: { person: Person | null | undefined; children?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={nameOf(person)} color={person?.avatarColor} photoUrl={person?.photoUrl} size={40} className="flex-none" />
      <span className="min-w-0">{children ?? <span className="font-semibold">{nameOf(person)}</span>}</span>
    </span>
  );
}

function List({ conversations, people, onOpen, onNew }: { conversations: ConversationSummary[] | null; people: Record<string, Person | null>; onOpen: (uid: string) => void; onNew: () => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-[28px] bg-white p-4 shadow-card sm:p-6">
      <div>
        <button type="button" onClick={onNew} className="cursor-pointer rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_#8A4B9E] hover:brightness-110">
          Nytt meddelande
        </button>
      </div>
      {conversations === null ? (
        <p className="m-0 text-muted">Laddar…</p>
      ) : conversations.length === 0 ? (
        <p className="m-0 text-muted">Du har inga meddelanden än.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {conversations.map((c) => (
            <li key={c.id} className="border-b border-ink/8 last:border-b-0">
              <button type="button" onClick={() => onOpen(c.otherUid)} className="flex w-full cursor-pointer items-center justify-between gap-3 py-3 text-left">
                <PersonRow person={people[c.otherUid]}>
                  <span className={`block truncate ${c.unread ? 'font-bold' : 'font-semibold'}`}>{nameOf(people[c.otherUid])}</span>
                  <span className={`block truncate text-sm ${c.unread ? 'text-ink' : 'text-muted'}`}>{c.lastText}</span>
                </PersonRow>
                <span className="flex flex-none flex-col items-end gap-1 text-xs text-subtle">
                  {when(c.lastMessageAt)}
                  {c.unread && <span aria-label="Oläst" className="h-2.5 w-2.5 rounded-full bg-[#D6322E]" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Picker({ api, me, includeHidden, onPick, onCancel }: { api: Api; me: string; includeHidden: boolean; onPick: (uid: string) => void; onCancel: () => void }) {
  const [directory, setDirectory] = useState<Person[] | null>(null);
  const [filter, setFilter] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api.loadDirectory(me, includeHidden).then(setDirectory, () => setFailed(true));
  }, [api, me, includeHidden]);
  const shown = (directory ?? []).filter((p) => p.displayName.toLocaleLowerCase('sv').includes(filter.trim().toLocaleLowerCase('sv')));
  return (
    <section className="flex flex-col gap-3 rounded-[28px] bg-white p-4 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 font-display text-xl font-bold">Skriv till</h2>
        <button type="button" onClick={onCancel} className="cursor-pointer text-sm font-semibold text-accent">Avbryt</button>
      </div>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Sök på namn"
        aria-label="Sök på namn"
        className="w-full rounded-2xl border-[1.5px] border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-accent"
      />
      {failed ? (
        <p className="m-0 text-muted">Du kan inte starta nya meddelanden just nu. Det kräver att du är godkänd medlem.</p>
      ) : directory === null ? (
        <p className="m-0 text-muted">Laddar…</p>
      ) : shown.length === 0 ? (
        <p className="m-0 text-muted">Ingen hittades.</p>
      ) : (
        <ul className="m-0 flex max-h-[420px] list-none flex-col overflow-y-auto p-0">
          {shown.map((p) => (
            <li key={p.uid} className="border-b border-ink/8 last:border-b-0">
              <button type="button" onClick={() => onPick(p.uid)} className="flex w-full cursor-pointer items-center gap-3 py-2.5 text-left">
                <PersonRow person={p}>
                  <span className="font-semibold">{p.displayName}</span>
                  {p.hidden && <span className="ml-2 text-xs text-muted">(dold för andra)</span>}
                </PersonRow>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Thread({ api, me, other, person, unread, onBack }: { api: Api; me: Session; other: string; person: Person | null | undefined; unread: boolean; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => api.watchMessages(me.uid, other, setMessages), [api, me.uid, other]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);
  // Öppnad tråd med olästa meddelanden markeras som läst (även när nya kommer medan den är öppen)
  useEffect(() => {
    if (unread) api.markRead(me.uid, other).catch(() => {});
  }, [api, me.uid, other, unread]);

  async function send() {
    if (busy || !text.trim()) return;
    setBusy(true);
    setError(false);
    try {
      await api.sendMessage(me.uid, other, text);
      setText('');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-[28px] bg-white p-4 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <PersonRow person={person} />
        <button type="button" onClick={onBack} className="cursor-pointer text-sm font-semibold text-accent">Alla meddelanden</button>
      </div>
      <div className="flex max-h-[55vh] min-h-[160px] flex-col gap-2 overflow-y-auto rounded-2xl bg-period/40 p-3">
        {messages.length === 0 && <p className="m-0 text-sm text-muted">Inga meddelanden än. Skriv det första nedan.</p>}
        {messages.map((m) => {
          const mine = m.senderUid === me.uid;
          return (
            <div key={m.id} className={`flex max-w-[85%] flex-col gap-0.5 ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
              <div className={`rounded-2xl px-3.5 py-2 text-[15px] whitespace-pre-wrap break-words ${mine ? 'bg-accent text-white' : 'bg-white text-ink'}`}>{m.text}</div>
              {m.kind === 'notice' && (
                <span className="text-xs text-muted">
                  Automatiskt meddelande
                  {m.link && (
                    <>
                      {' · '}
                      <a href={m.link} className="font-semibold text-accent">Öppna</a>
                    </>
                  )}
                </span>
              )}
              <span className="text-[11px] text-subtle">{when(m.createdAt)}</span>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
        }}
        maxLength={MAX_MESSAGE_LENGTH}
        rows={3}
        placeholder="Skriv ett meddelande"
        aria-label="Meddelande"
        className="w-full resize-none rounded-2xl border-[1.5px] border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-accent"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-subtle">{error ? 'Kunde inte skicka. Försök igen.' : `${text.length}/${MAX_MESSAGE_LENGTH}`}</span>
        <button type="button" onClick={send} disabled={busy || !text.trim()} className="cursor-pointer rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-default disabled:opacity-45">
          {busy ? 'Skickar…' : 'Skicka'}
        </button>
      </div>
    </section>
  );
}
