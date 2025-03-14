/// <reference types="@sveltejs/kit" />
/// <reference lib="WebWorker" />
declare const self: ServiceWorkerGlobalScope;

import type { Event as DbEvent } from './lib/server/db/schema';
import { EventType } from './lib/events';
import { build, files, version } from '$service-worker';

const ASSETS = `cache${version}`;
const enabled = false;

// `build` is an array of all the files generated by the bundler,
// `files` is an array of everything in the `static` directory
const to_cache = build.concat(files);
const staticAssets = new Set(to_cache);

self.addEventListener('install', async (event) => {
	async function cacheAssets(files: string[]) {
		const cache = await caches.open(ASSETS);
		await cache.addAll(files);
		await self.skipWaiting();
	}

	if (enabled) {
		event.waitUntil(cacheAssets(to_cache));
	}
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			// delete old caches
			for (const key of keys) {
				if (key !== ASSETS) await caches.delete(key);
			}

			self.clients.claim();
		})
	);
});

function buildEvent(event: DbEvent) {
	switch (event.type) {
		case EventType.READY:
			return {
				title: 'Ready!',
				body: `${event.data.fromUsername} is ready!`,
				// actions: [
				// { action: 'accept', title: 'Open', openUrl: `/cam/waiting-room/${event.data?.matchId}` }
				// ],
			};

		case EventType.FRIEND_REQUEST:
			return {
				title: 'Friend Request',
				body: `${event.data.fromUsername} wants to be your friend!`,
				// actions: [{ action: 'accept', title: 'Open', openUrl: `/friends` }],
			};

		case EventType.SUBSCRIPTION:
			return {
				title: 'Subscription',
				body: 'You have enabled notifications!'
			};
	}
}

self.addEventListener('push', (ev) => {
	const data: DbEvent = ev.data?.json();
	console.log(data);

	const event = buildEvent(data);
	if (!event) return;

	self.registration.showNotification(event.title, event);
});

self.addEventListener('notificationclick', function (event) {
	if (!event.action) {
		return;
	}

	const data = event.notification.data;
	if (!data || !data.actions || !Array.isArray(data.actions)) {
		return;
	}

	const clickedAction = data.actions.find((action) => action.action === event.action);
	event.waitUntil(openUrl(clickedAction.openUrl));
});

async function openUrl(url: string) {
	const urlToOpen = new URL(url, self.location.origin).href;

	const windowClients = await self.clients.matchAll({
		type: 'window',
		includeUncontrolled: true
	});

	let matchingClient: WindowClient | null = null;

	for (const element of windowClients) {
		const windowClient = element;
		if (windowClient.url === urlToOpen) {
			matchingClient = windowClient;
			break;
		}
	}

	if (matchingClient) {
		return matchingClient.focus();
	} else {
		return self.clients.openWindow(urlToOpen);
	}
}

/**
 * Fetch the asset from the network and store it in the cache.
 * Fall back to the cache if the user is offline.
 */
async function fetchAndCache(request) {
	const cache = await caches.open(`offline${version}`);

	try {
		const response = await fetch(request);
		cache.put(request, response.clone());
		return response;
	} catch (err) {
		const response = await cache.match(request);
		if (response) return response;

		throw err;
	}
}

self.addEventListener('fetch', (event) => {
	if (!enabled) {
		return;
	}

	if (event.request.method !== 'GET') {
		return;
	}

	const url = new URL(event.request.url);

	// don't try to handle e.g. data: URIs
	const isHttp = url.protocol.startsWith('http');
	const isDevServerRequest =
		url.hostname === self.location.hostname && url.port !== self.location.port;
	const isStaticAsset = url.host === self.location.host && staticAssets.has(url.pathname);
	const skipBecauseUncached = event.request.cache === 'only-if-cached' && !isStaticAsset;

	if (isHttp && !isDevServerRequest && !skipBecauseUncached) {
		event.respondWith(
			(async () => {
				// always serve static files and bundler-generated assets from cache.
				// if your application has other URLs with data that will never change,
				// set this variable to true for them and they will only be fetched once.
				const cachedAsset = isStaticAsset && (await caches.match(event.request));

				return cachedAsset || fetchAndCache(event.request);
			})()
		);
	}
});
