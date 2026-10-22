import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { loadSelectedEventorEvents } from './lib/server/eventor-events';
import { loadPublishedEvents } from './lib/server/published-events';
import { loadPublishedPages } from './lib/server/published-pages';
import { loadPublishedMenu } from './lib/server/published-menu';

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
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .optional(),
    courseSetter: z.string().optional(),
    livelox: z.url().optional(),
    courseFiles: z.array(z.object({ label: z.string(), url: z.url() })).optional(),
    image: z.object({ url: z.url(), alt: z.string() }).optional(),
    results: z.array(z.object({ name: z.string(), course: z.string(), seconds: z.number().nullable() })).optional(),
    publisher: z.object({ name: z.string(), photoUrl: z.url().optional(), color: z.string().optional() }).optional(),
    body: z.string(),
  }),
});

// Publicerade infosidor från Firestore (bara `published`-ögonblicksbilden). id = slug.
const pages = defineCollection({
  loader: loadPublishedPages,
  schema: z.object({
    pageId: z.string(),
    slug: z.string(),
    title: z.string(),
    body: z.string(),
  }),
});

// Publicerad huvudmeny (menu/main.published, beslut 0008): en post med id 'main', eller ingen om menyn
// aldrig publicerats. Sidorna slås upp i src/lib/menu.ts.
const menu = defineCollection({
  loader: loadPublishedMenu,
  schema: z.object({
    items: z.array(
      z.object({
        label: z.string(),
        pageId: z.string().nullable(),
        children: z.array(z.string()),
      }),
    ),
  }),
});

// Valda tävlingar ur Eventor-spegeln. Visas bara i kalendern och länkar till Eventor (ingen egen sida).
const eventorEvents = defineCollection({
  loader: loadSelectedEventorEvents,
  schema: z.object({
    name: z.string(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    allDay: z.boolean(),
    organiserName: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    url: z.url(),
  }),
});

export const collections = { events, pages, menu, eventorEvents };
