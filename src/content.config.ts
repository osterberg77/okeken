import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Tills vidare läses events från seed/. I steg 4 byts loadern mot en som hämtar
// publicerade events (published-snapshoten) från Firestore; sidorna påverkas inte.
const events = defineCollection({
  loader: glob({ pattern: '*.md', base: './seed/events' }),
  schema: z.object({
    title: z.string(),
    type: z.enum(['training', 'competition', 'meeting', 'info', 'happening']),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    location: z
      .object({
        name: z.string(),
        mapUrl: z.url().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .optional(),
    courseSetter: z.string().optional(),
    livelox: z.url().optional(),
    oldUrl: z.url().optional(),
  }),
});

export const collections = { events };
