import { EventType } from '$lib/events';
import { db } from '$lib/server/db';
import { subscriptionsTable } from '$lib/server/db/schema';
import '$lib/server/push';
import { validateAuth, generateId } from '$lib/server/util';
import type { RequestHandler } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import webpush from 'web-push';

export const POST: RequestHandler = async (event) => {
	const locals = validateAuth(event);
	const { request } = event;

	const json = await request.json();
	const schema = z.object({
		endpoint: z.string(),
		expirationTime: z.string().nullable(),
		keys: z.object({
			p256dh: z.string(),
			auth: z.string()
		})
	});

	const { endpoint, keys, expirationTime } = schema.parse(json);

	if (expirationTime && new Date(expirationTime) < new Date()) {
		return new Response('Expiration time must be in the future', { status: 400 });
	}

	// delete any existing subscription
	await db
		.delete(subscriptionsTable)
		.where(
			and(eq(subscriptionsTable.userId, locals.user.id), eq(subscriptionsTable.endpoint, endpoint))
		);

	// insert the new subscription
	await db.insert(subscriptionsTable).values({
		id: generateId(),
		userId: locals.user.id,
		endpoint,
		keys,
		expirationTime: expirationTime ? new Date(expirationTime) : undefined
	});

	const result = await webpush.sendNotification(
		{
			endpoint,
			expirationTime: expirationTime ? new Date(expirationTime).getTime() : undefined,
			keys: keys as any
		},
		JSON.stringify({
			type: EventType.SUBSCRIPTION,
		})
	);

	if (result.statusCode !== 201 && result.statusCode !== 200) {
		return new Response('Failed to send notification', { status: 500 });
	}

	return new Response(null, { status: 204 });
};
