import { db, eventStore } from '$lib/server/db';
import { eventsTable } from '$lib/server/db/schema';
import { validateAuth } from '$lib/server/util';
import type { RequestHandler } from '@sveltejs/kit';
import { and, eq, inArray, or } from 'drizzle-orm';
import { produce } from 'sveltekit-sse';
import { z } from 'zod';

function delay(milliseconds: number) {
	return new Promise(function run(resolve) {
		setTimeout(resolve, milliseconds);
	});
}

export const GET: RequestHandler = () => {
	const stats = eventStore.getStats();

	return new Response(JSON.stringify(stats), {
		headers: {
			'content-type': 'application/json'
		}
	});
};

export const POST: RequestHandler = async (event) => {
	const locals = validateAuth(event);
	eventStore.addUser(locals.user);

	// clear all events for the user
	await db
		.delete(eventsTable)
		.where(
			and(
				eq(eventsTable.userId, locals.user.id),
				or(eq(eventsTable.persistent, false), eq(eventsTable.read, true))
			)
		);

	return produce(async function start({ emit, lock }) {

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

		emit('message', JSON.stringify(persistent));

		while (true) {
			try {
				const events = eventStore.getUserEvents(locals.user.id);

				if (events.length === 0) {
					await delay(100);
					continue;
				}

				const { error } = emit('message', JSON.stringify(events));

				if (error) {
					console.error('Error sending event:', error);
					lock.set(false);
					return;
				}

				// update the sendAt field to the current time
				await db
					.update(eventsTable)
					.set({ sendAt: new Date() })
					.where(
						inArray(
							eventsTable.id,
							events.map((event) => event.id)
						)
					);

				await delay(100);
			} catch (error) {
				console.error('Error in event stream:', error);
			}
		}
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
		.update(eventsTable)
		.set({ read: true })
		.where(and(eq(eventsTable.userId, locals.user.id), eq(eventsTable.id, id)));

	return new Response(null, { status: 204 });
};
