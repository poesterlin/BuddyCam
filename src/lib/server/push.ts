import { building } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { and, eq, lte } from 'drizzle-orm';
import webpush from 'web-push';
import { db } from './db';
import { subscriptionsTable, type Event } from './db/schema';

const publicVapidKey = publicEnv.PUBLIC_VAPID_KEY;
const privateVapidKey = privateEnv.VAPID_PRIVATE;

if (!building) {
	if (!publicVapidKey || !privateVapidKey) {
		throw new Error('VAPID keys not set');
	}

	webpush.setVapidDetails('https://' + privateEnv.HOST_DOMAIN, publicVapidKey, privateVapidKey);
}

export async function sendPushNotification(userId: string, event: Event) {
	const subscriptions = await db
		.select()
		.from(subscriptionsTable)
		.where(
			and(eq(subscriptionsTable.userId, userId), lte(subscriptionsTable.expirationTime, new Date()))
		);

	if (!subscriptions.length) {
		console.log('No subscriptions found for user', userId);
		return true;
	}

	const payload = JSON.stringify({ event });

	let success = false;
	for (const subscription of subscriptions) {
		try {
			const result = await webpush.sendNotification(
				{
					endpoint: subscription.endpoint,
					expirationTime: subscription.expirationTime?.getTime(),
					keys: subscription.keys as any
				},
				payload
			);

			console.log('Push notification result:', result);

			success ||= result.statusCode === 201 || result.statusCode === 200;
		} catch (error) {
			console.error('Failed to send push notification', error);
		}
	}

	return success;
}
