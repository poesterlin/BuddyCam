import { goto } from '$app/navigation';
import { EventType, type StartData } from '$lib/events';
import type { Event } from '$lib/server/db/schema';
import { source } from 'sveltekit-sse';

// state rune to store new events
const newEvents = $state<{ event: Event; clear: () => void }[]>([]);
const count = $derived(newEvents.reduce((acc, { event }) => acc + (event.isTechnical ? 0 : 1), 0));

export const events = {
	new: newEvents,
	clear: (id: string) => {
		const index = newEvents.findIndex((e) => e.event.id === id);
		newEvents.splice(index, 1);

		fetch(`/events?id=${id}`, { method: 'DELETE' }).then(() => {
			console.log('event cleared');
		});
	},
	get count() {
		return count;
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

			const startEvents = hydrated.filter((e) => e.event.type === EventType.START);
			if (startEvents.length > 0) {
				const last = startEvents.at(-1);
				if (!last) {
					return;
				}

				const data = last.event.data as StartData;
				goto(`/cam/${data.matchId}`);
				startEvents.forEach((e) => e.clear());
			}

			events.new.push(...hydrated);
		} catch (error) {
			console.error(error);
		}
	});
}
