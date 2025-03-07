import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { and, eq, lte } from 'drizzle-orm';
import webpush from 'web-push';
import { db } from './db';
import { subscriptionsTable, type Event } from './db/schema';

const publicVapidKey = env.VITE_VAPID_PUBLIC;
const privateVapidKey = env.VAPID_PRIVATE;

if (!building) {    
    if (!publicVapidKey || !privateVapidKey) {
        throw new Error('VAPID keys not set');
    }

    webpush.setVapidDetails('https://' + env.HOST_DOMAIN, publicVapidKey, privateVapidKey);
}


export async function sendPushNotification(userId: string, event: Event) {
    const subscriptions = await db.select().from(subscriptionsTable).where(and(
        eq(subscriptionsTable.userId, userId),
        lte(subscriptionsTable.expirationTime, new Date())
    ));

    const payload = JSON.stringify({ event });
    let success = false;

    for (const subscription of subscriptions) {
        const result = await webpush.sendNotification({
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime?.getTime(),
            keys: subscription.keys as any
        }, payload);

        success ||= result.statusCode === 201 || result.statusCode === 200;
    }

    return success;
}