import { Marked } from 'marked';

// Samma rendering i bygget och i adminpreview. Texten skrivs av publicerare men visas
// för alla besökare, så rå HTML escapas och bara säkra länkprotokoll släpps igenom.

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SAFE_URL = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;

const marked = new Marked({
  async: false,
  gfm: true,
  breaks: true, // en radbrytning i editorn blir en radbrytning på sidan
  renderer: {
    html: ({ text }) => escapeHtml(text),
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      if (!SAFE_URL.test(href)) return text;
      const external = /^https?:/i.test(href);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      const rel = external ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${escapeHtml(href)}"${titleAttr}${rel}>${text}</a>`;
    },
    image({ href, title, text }) {
      if (!/^https:/i.test(href)) return escapeHtml(text);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy">`;
    },
  },
});

export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown) as string;
}

/** Kort klartext för listor och Open Graph */
export function toExcerpt(markdown: string, max = 160): string {
  const firstParagraph = markdown.trim().split(/\n\s*\n/)[0] ?? '';
  const text = firstParagraph
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
