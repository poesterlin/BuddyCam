import { db } from '$lib/server/db';
import { eventsTable } from '$lib/server/db/schema';
import { eventHub } from '$lib/server/event-hub';
import { validateAuth } from '$lib/server/util';
import type { RequestHandler } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { produce } from 'sveltekit-sse';
import { z } from 'zod';

export const GET: RequestHandler = (event) => {
	validateAuth(event);
	const stats = eventHub.getStats();

	return new Response(JSON.stringify(stats), {
		headers: {
			'content-type': 'application/json'
		}
	});
};

export const POST: RequestHandler = async (event) => {
	const locals = validateAuth(event);

	return produce(async function start({ emit, lock }) {
		const unsubscribe = eventHub.subscribe(locals.user.id, (event) => {
			const { error } = emit('message', JSON.stringify([event]));
			if (error) {
				lock.set(false);
				return false;
			}
			return true;
		});

		// send all persistent events that have not been read first
		const persistent = await db
			.select()
			.from(eventsTable)
			.where(
				and(
					eq(eventsTable.userId, locals.user.id),
					eq(eventsTable.persistent, true),
					eq(eventsTable.read, false)
				)
			)
			.orderBy(eventsTable.createdAt);

		const { error } = emit('message', JSON.stringify(persistent));
		if (error) {
			unsubscribe();
			lock.set(false);
			return unsubscribe;
		}

		eventHub.markDelivered(persistent);
		return unsubscribe;
	});
};

export const DELETE: RequestHandler = async (event) => {
	const locals = validateAuth(event);
	const { url } = event;

	const all = url.searchParams.has('all');
	if (all) {
		await db.delete(eventsTable).where(eq(eventsTable.userId, locals.user.id));
		return new Response(null, { status: 204 });
	}

	const id = z.string().parse(url.searchParams.get('id'));

	await db
		.delete(eventsTable)
		.where(and(eq(eventsTable.userId, locals.user.id), eq(eventsTable.id, id)));

	return new Response(null, { status: 204 });
};
