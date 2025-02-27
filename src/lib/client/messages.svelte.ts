import { goto } from '$app/navigation';
import { EventType, type StartData } from '$lib/events';
import type { Event } from '$lib/server/db/schema';
import { source } from 'sveltekit-sse';
import { toastStore } from './toast.svelte';

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
	const connection = source('/events', {
		// reconnect on close
		close({ connect }) {
			connect();
		}
	}).select('message');

	return connection.subscribe((d?: string) => {
		if (!d) {
			return;
		}

		let data: Event[] = [];
		try {
			data = JSON.parse(d) as Event[];
		} catch (error) {
			console.error('Failed to parse event', error);
			return;
		}

		// dedupe
		const set = new Set<string>();
		data = data.filter((event) => {
			if (set.has(event.id)) {
				return false;
			}

			set.add(event.id);
			return true;
		});

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

		if (hydrated.length === 0) {
			return;
		}

		const includesNonTechnical = hydrated.some(({ event }) => !event.isTechnical);
		if (includesNonTechnical) {
			toastStore.show('New Notification Received!');
		}

		events.new.push(...hydrated);
	});
}
