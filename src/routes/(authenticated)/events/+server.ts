import { db } from '$lib/server/db';
import { eventsTable } from '$lib/server/db/schema';
import { validateAuth } from '$lib/server/util';
import type { RequestHandler } from '@sveltejs/kit';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { produce } from 'sveltekit-sse';

function delay(milliseconds: number) {
	return new Promise(function run(resolve) {
		setTimeout(resolve, milliseconds);
	});
}

export const POST: RequestHandler = (event) => {
	const locals = validateAuth(event);

	return produce(async function start({ emit }) {
		while (true) {
			const events = await db
				.select()
				.from(eventsTable)
				.where(and(eq(eventsTable.userId, locals.user.id), isNull(eventsTable.sendAt)));

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
