import { mergeAttributes } from '@tiptap/core';
import { Image } from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import { Mention } from '@tiptap/extension-mention';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useMemo, useRef, useState } from 'react';
import { bankImageSrc, isBankImageUrl } from '../../lib/markdown';
import type { LinkTarget } from '../../lib/firebase/link-targets';
import { formatMention } from '../../lib/protocol';
import type { ImageBankItem } from '../../types/image';
import ImagePicker from './ImagePicker';
import LinkPicker from './LinkPicker';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  targets: LinkTarget[] | null;
  rows: number;
  allowImages: boolean;
  /** Personer som kan omnämnas med @ (styrelsens protokoll). Utan prop finns ingen @-funktion. */
  mentionCandidates?: MentionCandidate[];
}

export interface MentionCandidate {
  uid: string;
  name: string;
}

// Samma regel som renderaren (src/lib/markdown.ts): bara dessa länkar släpps igenom.
const SAFE_URL = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;

// Bilder bara från bildbanken; visas via bankImageSrc (Storage-emulatorn i emulatorläge).
const BankImage = Image.extend({
  parseHTML() {
    return [{ tag: 'img[src]', getAttrs: (el) => (isBankImageUrl((el as HTMLElement).getAttribute('src') ?? '') ? null : false) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { src: bankImageSrc(String(HTMLAttributes.src ?? '')) })];
  },
});

const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    // Stöds inte av Markdown-flödet eller renderaren
    underline: false,
    strike: false,
    code: false,
    codeBlock: false,
    link: {
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      protocols: ['mailto', 'tel'],
      isAllowedUri: (url) => SAFE_URL.test(url.trim()),
      HTMLAttributes: { target: null, rel: null },
    },
  }),
  BankImage,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  Markdown,
];

// ---- Omnämnanden (@) --------------------------------------------------------------------
// Lagras som @[Namn](mention:uid) i Markdown (src/lib/protocol.ts) och visas som en tagg i editorn.

const MENTION_AT_START = /^@\[([^[\]\r\n]{1,200})\]\(mention:([A-Za-z0-9_-]{1,128})\)/;

interface MentionPopup {
  onStart(props: SuggestionLike): void;
  onUpdate(props: SuggestionLike): void;
  onKeyDown(props: { event: KeyboardEvent }): boolean;
  onExit(): void;
}
interface SuggestionLike {
  items: MentionCandidate[];
  command: (item: { id: string; label: string }) => void;
  clientRect?: (() => DOMRect | null) | null;
}

/** Liten lista under markören, utan beroende. Upp/ned väljer, Enter/Tab infogar, Esc stänger. */
function createMentionPopup(): MentionPopup {
  let el: HTMLDivElement | null = null;
  let current: SuggestionLike | null = null;
  let selected = 0;

  const listId = `mention-list-${Math.random().toString(36).slice(2, 8)}`;

  function render() {
    if (!el || !current) return;
    el.replaceChildren();
    if (!current.items.length) {
      const empty = document.createElement('div');
      empty.textContent = 'Ingen träff';
      empty.className = 'px-3 py-2 text-sm text-muted';
      el.append(empty);
    }
    current.items.forEach((item, i) => {
      const opt = document.createElement('div');
      opt.id = `${listId}-${i}`;
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-selected', String(i === selected));
      opt.textContent = item.name;
      opt.className = `cursor-pointer rounded-xl px-3 py-2 text-sm ${i === selected ? 'bg-ink text-white' : 'text-ink hover:bg-period'}`;
      opt.addEventListener('mousedown', (e) => {
        e.preventDefault();
        choose(i);
      });
      el!.append(opt);
    });
    const rect = current.clientRect?.();
    if (rect) {
      el.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 248))}px`;
      el.style.top = `${rect.bottom + 6}px`;
    }
  }

  function choose(i: number) {
    const item = current?.items[i];
    if (item) current!.command({ id: item.uid, label: item.name });
  }

  return {
    onStart(props) {
      current = props;
      selected = 0;
      el = document.createElement('div');
      el.id = listId;
      el.setAttribute('role', 'listbox');
      el.setAttribute('aria-label', 'Välj person att omnämna');
      el.className = 'fixed z-[60] flex max-h-60 w-60 flex-col gap-0.5 overflow-auto rounded-2xl bg-white p-1.5 shadow-[0_24px_48px_-20px_rgba(43,40,56,.45),0_2px_8px_rgba(43,40,56,.12)] ring-1 ring-ink/10';
      document.body.append(el);
      render();
    },
    onUpdate(props) {
      current = props;
      selected = Math.min(selected, Math.max(0, props.items.length - 1));
      render();
    },
    onKeyDown({ event }) {
      if (!current) return false;
      const n = current.items.length;
      if (event.key === 'Escape') {
        el?.remove();
        el = null;
        current = null;
        return true;
      }
      if (!n) return false;
      if (event.key === 'ArrowDown') selected = (selected + 1) % n;
      else if (event.key === 'ArrowUp') selected = (selected - 1 + n) % n;
      else if (event.key === 'Enter' || event.key === 'Tab') {
        choose(selected);
        return true;
      } else return false;
      render();
      el?.children[selected]?.scrollIntoView({ block: 'nearest' });
      return true;
    },
    onExit() {
      el?.remove();
      el = null;
      current = null;
    },
  };
}

function mentionExtension(getCandidates: () => MentionCandidate[]) {
  return Mention.extend({
    markdownTokenName: 'mention',
    markdownTokenizer: {
      name: 'mention',
      level: 'inline',
      start: (src: string) => src.indexOf('@['),
      tokenize: (src: string) => {
        const m = MENTION_AT_START.exec(src);
        return m ? { type: 'mention', raw: m[0], uid: m[2], label: m[1] } : undefined;
      },
    },
    parseMarkdown(token, helpers) {
      return helpers.createNode('mention', { id: token.uid, label: token.label });
    },
    renderMarkdown(node) {
      const { id, label } = node.attrs ?? {};
      return id ? formatMention(String(label ?? ''), String(id)) : '';
    },
  }).configure({
    HTMLAttributes: { class: 'mention-chip' },
    renderText: ({ node }) => `@${node.attrs.label}`,
    renderHTML: ({ options, node }) => [
      'span',
      { ...options.HTMLAttributes, 'data-type': 'mention', 'data-id': node.attrs.id },
      `@${node.attrs.label}`,
    ],
    deleteTriggerWithBackspace: false,
    suggestion: {
      char: '@',
      items: ({ query }: { query: string }) => {
        const q = query.trim().toLocaleLowerCase('sv');
        return getCandidates().filter((c) => c.name.toLocaleLowerCase('sv').includes(q)).slice(0, 8);
      },
      render: createMentionPopup,
    },
  });
}

export default function MarkdownEditor({ id, value, onChange, targets, rows, allowImages, mentionCandidates }: Props) {
  const candidatesRef = useRef<MentionCandidate[]>(mentionCandidates ?? []);
  candidatesRef.current = mentionCandidates ?? [];
  const useMentions = mentionCandidates !== undefined;
  // Skapas en gång per editor; listan läses från ref så att den kan uppdateras
  const editorExtensions = useMemo(
    () => (useMentions ? [...extensions.slice(0, -1), mentionExtension(() => candidatesRef.current), Markdown] : extensions),
    [useMentions],
  );
  const lastEmitted = useRef(value);
  const [picker, setPicker] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [imagePicker, setImagePicker] = useState(false);

  const editor = useEditor({
    extensions: editorExtensions,
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: { id, class: 'prose-eken min-h-[var(--editor-min)] outline-none', 'aria-label': 'Text', role: 'textbox', 'aria-multiline': 'true' },
    },
    onUpdate: ({ editor }) => {
      const md = editor.getMarkdown().trimEnd();
      lastEmitted.current = md;
      onChange(md);
    },
  });

  // Extern ändring (t.ex. annan sida laddas): sätt innehållet bara om det inte är vårt eget senaste värde.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      h2: editor?.isActive('heading', { level: 2 }) ?? false,
      h3: editor?.isActive('heading', { level: 3 }) ?? false,
      bold: editor?.isActive('bold') ?? false,
      italic: editor?.isActive('italic') ?? false,
      bullet: editor?.isActive('bulletList') ?? false,
      ordered: editor?.isActive('orderedList') ?? false,
      quote: editor?.isActive('blockquote') ?? false,
      link: editor?.isActive('link') ?? false,
    }),
  });

  if (!editor) return null;

  function openLinkPicker() {
    if (picker) return setPicker(false);
    const { from, to } = editor!.state.selection;
    setLinkText(editor!.state.doc.textBetween(from, to, ' '));
    setImagePicker(false);
    setPicker(true);
  }

  function insertLink(title: string, href: string) {
    const chain = editor!.chain().focus();
    if (linkText) chain.extendMarkRange('link').setLink({ href }).run();
    else chain.insertContent({ type: 'text', text: title, marks: [{ type: 'link', attrs: { href } }] }).run();
    setPicker(false);
  }

  function removeLink() {
    editor!.chain().focus().extendMarkRange('link').unsetLink().run();
    setPicker(false);
  }

  function insertImage(image: ImageBankItem) {
    const alt = (image.description || image.name).replace(/[[\]\n\r]+/g, ' ').trim();
    editor!.chain().focus().setImage({ src: image.webUrl, alt }).run();
    setImagePicker(false);
  }

  const run = () => editor.chain().focus();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Formatering">
        <ToolButton label="Rubrik" active={state.h2} onClick={() => run().toggleHeading({ level: 2 }).run()}>Rubrik</ToolButton>
        <ToolButton label="Underrubrik" active={state.h3} onClick={() => run().toggleHeading({ level: 3 }).run()}>Underrubrik</ToolButton>
        <ToolButton label="Fet" active={state.bold} onClick={() => run().toggleBold().run()}><b>B</b></ToolButton>
        <ToolButton label="Kursiv" active={state.italic} onClick={() => run().toggleItalic().run()}><i>I</i></ToolButton>
        <ToolButton label="Punktlista" active={state.bullet} onClick={() => run().toggleBulletList().run()}>Punktlista</ToolButton>
        <ToolButton label="Numrerad lista" active={state.ordered} onClick={() => run().toggleOrderedList().run()}>Numrerad lista</ToolButton>
        <ToolButton label="Citat" active={state.quote} onClick={() => run().toggleBlockquote().run()}>Citat</ToolButton>
        <ToolButton label="Infoga länk" active={picker || state.link} onClick={openLinkPicker}>Länk</ToolButton>
        {useMentions && (
          <ToolButton
            label="Omnämn person"
            onClick={() => {
              const before = editor.state.doc.textBetween(Math.max(0, editor.state.selection.from - 1), editor.state.selection.from);
              run().insertContent(before && !/\s/.test(before) ? ' @' : '@').run();
            }}
          >
            @ Person
          </ToolButton>
        )}
        {allowImages && (
          <ToolButton label="Infoga bild" active={imagePicker} onClick={() => { setPicker(false); setImagePicker(true); }}>Bild</ToolButton>
        )}
      </div>

      {imagePicker && <ImagePicker onPick={insertImage} onClose={() => setImagePicker(false)} />}

      {picker && (
        <LinkPicker
          targets={targets}
          selected={() => linkText}
          onPick={insertLink}
          onClose={() => setPicker(false)}
          onRemove={state.link ? removeLink : undefined}
        />
      )}

      <div
        className="rounded-2xl border-[1.5px] border-ink/15 bg-white px-4 py-3 focus-within:border-accent [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_hr]:my-6 [&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:p-2 [&_th]:text-left [&_.selectedCell]:bg-period"
        style={{ ['--editor-min' as string]: `${Math.max(280, rows * 20)}px` }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolButton({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={!!active}
      // Behåll markeringen i texten när man klickar på knappen
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold ${active ? 'bg-ink text-white' : 'bg-period text-accent hover:bg-pastel'}`}
    >
      {children}
    </button>
  );
}
