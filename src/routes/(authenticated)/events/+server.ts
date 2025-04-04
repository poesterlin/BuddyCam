import { db, eventStore } from '$lib/server/db';
import { eventsTable } from '$lib/server/db/schema';
import { sendPushNotification } from '$lib/server/push';
import { validateAuth } from '$lib/server/util';
import type { RequestHandler } from '@sveltejs/kit';
import { and, eq, inArray, lte, or } from 'drizzle-orm';
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

	// clear all impersistant events older than 1 hour
	const cutoffDate = new Date();
	cutoffDate.setHours(cutoffDate.getHours() - 1);

	await db
		.delete(eventsTable)
		.where(
			and(
				eq(eventsTable.userId, locals.user.id),
				eq(eventsTable.persistent, false),
				lte(eventsTable.createdAt, cutoffDate)
			)
		);

	// clear all read events
	await db
		.delete(eventsTable)
		.where(and(eq(eventsTable.userId, locals.user.id), eq(eventsTable.read, true)));

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
					// for (const event of events) {
					// 	console.error(
					// 		'Error sending event to user:',
					// 		locals.user.username,
					// 		'sending push instead'
					// 	);
					// const success = await sendPushNotification(locals.user.id, event);
					// 	if (success) {
					// 		eventStore.removeEvent(event.id, locals.user.id);
					// 		await db
					// 			.update(eventsTable)
					// 			.set({ read: true })
					// 			.where(and(eq(eventsTable.userId, locals.user.id), eq(eventsTable.id, event.id)));
					// 	}
					// }

					lock.set(false);
					return;
				}

				console.log('Sent event to user:', locals.user.username, events);

				// only remove the events if they were successfully sent
				eventStore.removeEvents(events);

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
			} catch (error) {}

			await delay(100);
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
