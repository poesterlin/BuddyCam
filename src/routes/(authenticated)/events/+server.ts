import { db } from '$lib/server/db';
import { eventsTable } from '$lib/server/db/schema';
import { validateAuth } from '$lib/server/util';
import type { RequestHandler } from '@sveltejs/kit';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { produce } from 'sveltekit-sse';
import { z } from 'zod';

function delay(milliseconds: number) {
	return new Promise(function run(resolve) {
		setTimeout(resolve, milliseconds);
	});
}

export const POST: RequestHandler = (event) => {
	const locals = validateAuth(event);

	return produce(async function start({ emit }) {
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
			// send all new events
			const events = await db
				.select()
				.from(eventsTable)
				.where(and(eq(eventsTable.userId, locals.user.id), isNull(eventsTable.sendAt)))
				.orderBy(eventsTable.createdAt);

			const { error } = emit('message', JSON.stringify(events));

			if (error) {
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

			await delay(1500);
		}
	});
};

export const DELETE: RequestHandler = async (event) => {
	const locals = validateAuth(event);
	const { url } = event;

	const id = z.string().parse(url.searchParams.get('id'));

	await db
		.update(eventsTable)
		.set({ read: true })
		.where(and(eq(eventsTable.userId, locals.user.id), eq(eventsTable.id, id)));

	return new Response(null, { status: 204 });
};
