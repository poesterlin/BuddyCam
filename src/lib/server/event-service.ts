import { db } from './db';
import { eventsTable, type Event } from './db/schema';
import { eventHub } from './event-hub';

type EventInsert = typeof eventsTable.$inferInsert;
type DurableEventInsert = Omit<EventInsert, 'isTechnical' | 'persistent' | 'read'>;
type TransientEventInsert = Omit<EventInsert, 'isTechnical' | 'persistent' | 'read'>;

function asArray<T>(value: T | T[]): T[] {
	return Array.isArray(value) ? value : [value];
}

export async function createDurableEvents(
	values: DurableEventInsert | DurableEventInsert[]
): Promise<Event[]> {
	const created = await db
		.insert(eventsTable)
		.values(
			asArray(values).map((value) => ({
				...value,
				isTechnical: false,
				persistent: true,
				read: false
			}))
		)
		.returning();

	publishPersistedEvents(created);
	return created;
}

export function publishPersistedEvents(events: Event | Event[]): void {
	eventHub.publishAll(asArray(events));
}

export function publishTransientEvents(
	values: TransientEventInsert | TransientEventInsert[]
): Event[] {
	const events = asArray(values).map(
		(value) =>
			({
				...value,
				data: value.data ?? null,
				isTechnical: true,
				persistent: false,
				read: false
			}) as Event
	);

	eventHub.publishAll(events);
	return events;
}
