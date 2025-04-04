import type { Event } from '$lib/server/db/schema';
import { source } from 'sveltekit-sse';
import { toastStore } from './toast.svelte';

// state rune to store new events
const newEvents = $state<{ event: Event<any>; clear: () => void }[]>([]);
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
	clearAll: () => {
		newEvents.splice(0, newEvents.length);
		fetch('/events?all', { method: 'DELETE' }).then(() => {
			console.log('all events cleared');
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
		close({ connect }) {
			// reconnect after 1 second
			setTimeout(() => {
				connect();
			}, 1000);
		},
		error({ error }) {
			console.error('Event stream error:', error);
		},
		open() {
			console.log('Event stream connected');
		},
		cache: false
	}).select('message');

	return connection.subscribe((payload?: string) => {
		if (!payload) {
			return;
		}

		const set = new Set<string>();
		for (const { event } of newEvents) {
			set.add(event.id);
		}

		let data: Event[] = [];
		try {
			data = JSON.parse(payload) as Event[];
		} catch (error) {
			console.error('Failed to parse event', error);
			return;
		}

		// dedupe
		data = data.filter((event) => {
			if (set.has(event.id)) {
				return false;
			}

			set.add(event.id);
			return true;
		});

		const hydrated = data
			.map((event) => ({
				event: {
					...event,
					createdAt: new Date(event.createdAt)
				},
				clear: () => events.clear(event.id)
			}))
			.sort((a, b) => a.event.createdAt.getTime() - b.event.createdAt.getTime());

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
