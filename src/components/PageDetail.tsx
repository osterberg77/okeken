import type { PublicPage } from '../types/page';

interface Props {
  page: Pick<PublicPage, 'title' | 'bodyHtml'>;
  /** h1 på sidan, h2 om den visas i något annat sammanhang */
  as?: 'h1' | 'h2';
}

// Delas av den publika infosidan (statisk HTML) och adminpreview. Samma kortstil som EventDetail.
export default function PageDetail({ page, as: Heading = 'h1' }: Props) {
  return (
    <article className="flex min-w-0 flex-col gap-[18px] overflow-hidden rounded-[28px] bg-white px-6 pt-7 pb-8 shadow-card sm:px-[38px] sm:pt-[34px] sm:pb-[38px]">
      <Heading className="m-0 font-display text-[28px] leading-[1.1] font-bold tracking-[-.02em] sm:text-[36px]">{page.title}</Heading>
      <div className="prose-eken" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
    </article>
  );
}
