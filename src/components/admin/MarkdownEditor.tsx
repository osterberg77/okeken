import { mergeAttributes } from '@tiptap/core';
import { Image } from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useRef, useState } from 'react';
import { bankImageSrc, isBankImageUrl } from '../../lib/markdown';
import type { LinkTarget } from '../../lib/firebase/link-targets';
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

export default function MarkdownEditor({ id, value, onChange, targets, rows, allowImages }: Props) {
  const lastEmitted = useRef(value);
  const [picker, setPicker] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [imagePicker, setImagePicker] = useState(false);

  const editor = useEditor({
    extensions,
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: { id, class: 'prose-eken min-h-[var(--editor-min)] outline-none', 'aria-label': 'Text', role: 'textbox', 'aria-multiline': 'true' },
    },
    onUpdate: ({ editor }) => {
      const md = editor.getMarkdown();
      lastEmitted.current = md;
      onChange(md);
    },
  });

  // Extern ändring (t.ex. annan sida laddas): sätt innehållet bara om det inte är vårt eget senaste värde.
  if (editor && value !== lastEmitted.current) {
    lastEmitted.current = value;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }

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
