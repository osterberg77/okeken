import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { loadPublishedEvents } from './lib/server/published-events';
import { loadPublishedPages } from './lib/server/published-pages';

// Publicerade events från Firestore (bara `published`-ögonblicksbilden, se docs/datamodell.md).
const events = defineCollection({
  loader: loadPublishedEvents,
  schema: z.object({
    title: z.string(),
    type: z.enum(['training', 'competition', 'meeting', 'info', 'happening']),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    location: z
      .object({
        name: z.string(),
        mapUrl: z.url().optional(),
      })
      .optional(),
    courseSetter: z.string().optional(),
    livelox: z.url().optional(),
    courseFiles: z.array(z.object({ label: z.string(), url: z.url() })).optional(),
    body: z.string(),
  }),
});

// Publicerade infosidor från Firestore (bara `published`-ögonblicksbilden). id = slug.
const pages = defineCollection({
  loader: loadPublishedPages,
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    body: z.string(),
    inMenu: z.boolean(),
    menuOrder: z.number().int(),
    menuLabel: z.string(),
  }),
});

export const collections = { events, pages };
