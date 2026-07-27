import { db } from '$lib/server/db';
import { matchupTable } from '$lib/server/db/schema';
import { publishTransientEvents } from '$lib/server/event-service';
import { assert, generateId, validateAuth } from '$lib/server/util';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { EventType, type WebRtcData } from '$lib/events';
import { env } from '$env/dynamic/private';
import { consumeRateLimit } from '$lib/server/rate-limit';

export const GET: RequestHandler = async (event) => {
	const locals = validateAuth(event);

	if (event.url.searchParams.has('credentials')) {
		const rateLimit = consumeRateLimit(`turn:${locals.user.id}`, {
			limit: 10,
			windowMs: 60 * 60_000
		});
		if (!rateLimit.allowed) {
			return new Response('Too many credential requests', {
				status: 429,
				headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) }
			});
		}
		const { match } = event.params;
		const [matchup] = await db
			.select()
			.from(matchupTable)
			.limit(1)
			.where(eq(matchupTable.id, match));
		if (!matchup) return new Response('Match not found', { status: 404 });
		if (matchup.userId !== locals.user.id && matchup.friendId !== locals.user.id) {
			return new Response('Not authorized', { status: 403 });
		}
		if (!env.CLOUDFLARE_TURN_TOKEN_ID || !env.CLOUDFLARE_TURN_API_TOKEN) {
			return new Response('TURN is not configured', { status: 503 });
		}

		const response = await fetch(
			`https://rtc.live.cloudflare.com/v1/turn/keys/${env.CLOUDFLARE_TURN_TOKEN_ID}/credentials/generate-ice-servers`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.CLOUDFLARE_TURN_API_TOKEN}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ ttl: 3600 }),
				signal: AbortSignal.timeout(5000)
			}
		);
		if (!response.ok) {
			console.error('Cloudflare TURN credential request failed:', response.status);
			return new Response('TURN credentials unavailable', { status: 502 });
		}
		return Response.json(await response.json(), {
			headers: { 'Cache-Control': 'private, no-store' }
		});
	}

	return Response.json({ now: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
};

// Schema for RTCSessionDescriptionInit
const rtcSessionDescriptionInitSchema = z.object({
	type: z.enum(['offer', 'pranswer', 'answer', 'rollback']),
	sdp: z.string().max(100_000)
});

// Schema for RTCIceCandidateInit
// Note: According to MDN/spec, sdpMid and sdpMLineIndex can be null.
// `usernameFragment` is also technically part of the dictionary but less common
// in the init object itself passed to addIceCandidate.
const rtcIceCandidateInitSchema = z.object({
	candidate: z.string().max(4096).optional(), // Can be null or empty string for end-of-candidates
	sdpMid: z.string().max(256).nullable().optional(),
	sdpMLineIndex: z.number().nullable().optional(),
	usernameFragment: z.string().nullable().optional() // Less common but part of spec
});

// Combined schema using z.union
// This schema will validate successfully if the input matches *either*
// rtcSessionDescriptionInitSchema *or* rtcIceCandidateInitSchema
const webRtcSignalSchema = z.union([rtcSessionDescriptionInitSchema, rtcIceCandidateInitSchema]);

export const POST: RequestHandler = async (event) => {
	const locals = validateAuth(event);
	const { match } = event.params;
	const rateLimit = consumeRateLimit(`webrtc:${locals.user.id}:${match}`, {
		limit: 300,
		windowMs: 60_000
	});
	if (!rateLimit.allowed) {
		return new Response('Too many signaling requests', {
			status: 429,
			headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) }
		});
	}

	const [matchup] = await db.select().from(matchupTable).limit(1).where(eq(matchupTable.id, match));

	if (!matchup) {
		return new Response('Match not found', { status: 404 });
	}

	const isOwner = matchup.userId === locals.user.id;
	const isFriend = matchup.friendId === locals.user.id;
	if (!isOwner && !isFriend) {
		return new Response('Not authorized', { status: 403 });
	}

	const body = await event.request.json();

	const parsedBody = webRtcSignalSchema.safeParse(body);
	if (!parsedBody.success) {
		return new Response(
			JSON.stringify({
				error: 'Invalid request body',
				details: parsedBody.error.issues
			}),
			{ status: 400 }
		);
	}

	console.log('Parsed body:', body, locals.user.username, { matchup });

	const other = isOwner ? matchup.friendId : matchup.userId;
	assert(other, 'Other user not found');
	publishTransientEvents({
		id: generateId(),
		userId: other,
		type: EventType.WEBRTC,
		createdAt: new Date(),
		data: {
			matchId: match,
			payload: body
		} satisfies WebRtcData
	});

	return new Response('ok', { status: 200 });
};
