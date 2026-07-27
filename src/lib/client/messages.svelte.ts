import type { Event } from '$lib/server/db/schema';
import { source } from 'sveltekit-sse';
import { toastStore } from './toast.svelte';

// state rune to store new events
const newEvents = $state<{ event: Event<any>; clear: () => void }[]>([]);
const count = $derived(newEvents.reduce((acc, { event }) => acc + (event.isTechnical ? 0 : 1), 0));
const pendingDeleteIds = new Set<string>();
let deleteTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleEventDeletion(id: string) {
	pendingDeleteIds.add(id);
	clearTimeout(deleteTimer);
	deleteTimer = setTimeout(flushEventDeletions, 100);
}

async function flushEventDeletions() {
	const ids = [...pendingDeleteIds];
	if (ids.length === 0) return;
	ids.forEach((id) => pendingDeleteIds.delete(id));

	try {
		const response = await fetch('/events', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids })
		});
		if (!response.ok) throw new Error(`Event acknowledgement failed: ${response.status}`);
	} catch (error) {
		console.error(error);
		ids.forEach((id) => pendingDeleteIds.add(id));
		deleteTimer = setTimeout(flushEventDeletions, 1000);
	}
}

export const events = {
	new: newEvents,
	clear: (id: string) => {
		const index = newEvents.findIndex((e) => e.event.id === id);
		if (index >= 0) {
			newEvents.splice(index, 1);
		}

		scheduleEventDeletion(id);
	},
	clearAll: () => {
		newEvents.splice(0, newEvents.length);
		pendingDeleteIds.clear();
		clearTimeout(deleteTimer);
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
		onclose({ connect, isLocal }) {
			console.warn('Event stream closed');
			if (!isLocal) {
				setTimeout(connect, 1000);
			}
		},
		onerror(event) {
			console.error('Event stream error:', event);
		},
		onopen() {
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

		let data: Event[];
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
