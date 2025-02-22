import type { Event } from '$lib/server/db/schema';
import { source } from 'sveltekit-sse';

// state rune to store new events
const newEvents = $state<{ event: Event; clear: () => void }[]>([]);

export const events = {
	new: newEvents,
	clear: (id: string) => {
		const index = newEvents.findIndex((e) => e.event.id === id);
		newEvents.splice(index, 1);
	}
};

/**
 * Initialize the connection to the server-sent events endpoint.
 * @returns
 */
export function initMessageChannel() {
	const connection = source('/events').select('message');

	return connection.subscribe((d?: string) => {
		if (!d) {
			return;
		}

		try {
			const data = JSON.parse(d) as Event[];

			const hydrated = data.map((event) => ({
				event,
				clear: () => events.clear(event.id)
			}));

			events.new.push(...hydrated);
		} catch (error) {
			console.error(error);
		}
	});
}
