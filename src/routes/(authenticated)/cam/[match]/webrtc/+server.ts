import { db } from '$lib/server/db';
import { eventsTable, matchupTable } from '$lib/server/db/schema';
import { assert, generateId, validateAuth } from '$lib/server/util';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { EventType, type WebRtcData } from '$lib/events';

// Schema for RTCSessionDescriptionInit
const rtcSessionDescriptionInitSchema = z.object({
	type: z.enum(['offer', 'pranswer', 'answer', 'rollback']),
	sdp: z.string()
});

// Schema for RTCIceCandidateInit
// Note: According to MDN/spec, sdpMid and sdpMLineIndex can be null.
// `usernameFragment` is also technically part of the dictionary but less common
// in the init object itself passed to addIceCandidate.
const rtcIceCandidateInitSchema = z.object({
	candidate: z.string().optional(), // Can be null or empty string for end-of-candidates
	sdpMid: z.string().nullable().optional(),
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
				details: parsedBody.error.errors
			}),
			{ status: 400 }
		);
	}

	console.log('Parsed body:', body, locals.user.username, { matchup });

	const other = isOwner ? matchup.friendId : matchup.userId;
	assert(other, 'Other user not found');
	await db.insert(eventsTable).values({
		id: generateId(),
		userId: other,
		type: EventType.WEBRTC,
		createdAt: new Date(),
		isTechnical: true,
		persistent: false,
		data: {
			matchId: match,
			payload: body
		} satisfies WebRtcData
	} satisfies typeof eventsTable.$inferInsert);

	return new Response('ok', { status: 200 });
};
