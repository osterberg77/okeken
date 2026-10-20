import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { loadPublishedEvents } from './lib/server/published-events';

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
    body: z.string(),
  }),
});

export const collections = { events };
