import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Notification } from 'pg';
import { z } from 'zod';
import type { eventsTable } from './schema';
import { EventStore } from '../store';
import { building } from '$app/environment';

if (!env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

export const db = drizzle(env.DATABASE_URL);

// Create a global event store
export const eventStore = new EventStore();

// Create a dedicated client for listening (not a pool, because we need a persistent connection)
export const notificationClient = new postgres.Client({
	connectionString: env.DATABASE_URL
});

if (!building) {
	setupNotificationListener();
}

async function setupNotificationListener() {
	try {
		await notificationClient.connect();

		console.log('Connected to database for notifications');

		// Listen for notifications
		await notificationClient.query('LISTEN new_notification');

		const schema = z.object({
			id: z.string(),
			user_id: z.string(),
			type: z.string(),
			created_at: z.string(),
			send_at: z.string().nullable(),
			data: z.any(),
			persistent: z.boolean(),
			read: z.boolean(),
			is_technical: z.boolean()
		});

		// Set up the notification handler
		notificationClient.on('notification', (event: Notification) => {
			try {
				if (!event.payload) {
					return;
				}

				const notification = JSON.parse(event.payload);
				const parsed = schema.parse(notification);

				const data = {
					id: parsed.id,
					type: parsed.type,
					persistent: parsed.persistent,
					read: parsed.read,
					data: parsed.data,
					createdAt: new Date(parsed.created_at),
					sendAt: parsed.send_at ? new Date(parsed.send_at) : null,
					isTechnical: parsed.is_technical,
					userId: parsed.user_id
				} satisfies typeof eventsTable.$inferSelect;

				// store in a global store
				eventStore.recordEvent(data);
			} catch (error) {
				console.error('Error processing notification:', JSON.stringify(error, null, 4));
			}
		});
	} catch (error) {
		console.error('Error setting up notification listener:', error);
		throw error;
	}
}
