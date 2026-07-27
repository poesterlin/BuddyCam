import { EventType, type CaptureData, type UploadData } from '$lib/events';
import { db } from '$lib/server/db';
import { filesTable, matchupTable } from '$lib/server/db/schema';
import { queueTechnicalEvents } from '$lib/server/event-service';
import { deleteFile, uploadFile } from '$lib/server/s3';
import { assert, generateId, validateAuth, validateForm } from '$lib/server/util';
import { error, redirect } from '@sveltejs/kit';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { consumeRateLimit } from '$lib/server/rate-limit';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);

	const { match } = event.params;
	const [matchup] = await db
		.select()
		.from(matchupTable)
		.where(
			and(
				eq(matchupTable.id, match),
				or(eq(matchupTable.friendId, locals.user.id), eq(matchupTable.userId, locals.user.id))
			)
		)
		.limit(1);

	if (!matchup) {
		redirect(302, '/');
	}

	// if the friend hasn't joined yet, redirect to waiting room
	if (!matchup.friendId) {
		redirect(302, '/cam/waiting-room/' + match);
	}

	const files = await db.select().from(filesTable).where(eq(filesTable.matchupId, match));

	if (files.length >= 2) {
		redirect(302, '/friends/result/' + matchup.id);
	}

	return { matchup, now: Date.now() };
};

export const actions: Actions = {
	capture: validateForm(
		z.object({
			photo: z.instanceof(File)
		}),
		async (event, form) => {
			const { user } = validateAuth(event);
			const { match } = event.params;
			const uploadLimit = consumeRateLimit(`capture:${user.id}`, {
				limit: 10,
				windowMs: 15 * 60_000
			});
			if (!uploadLimit.allowed) {
				event.setHeaders({ 'Retry-After': String(uploadLimit.retryAfterSeconds) });
				error(429, 'Too many upload attempts. Please try again later.');
			}

			assert(match, 400, 'match is required');

			const [matchup] = await db
				.select()
				.from(matchupTable)
				.where(
					and(
						eq(matchupTable.id, match),
						or(eq(matchupTable.friendId, user.id), eq(matchupTable.userId, user.id))
					)
				)
				.limit(1);

			assert(matchup, 404, 'match not found');
			assert(matchup.friendId, 400, 'friend has not joined yet');

			const id = generateId();
			const other = user.id === matchup.userId ? matchup.friendId : matchup.userId;
			await uploadFile(id, form.photo);
			try {
				await db.transaction(async (tx) => {
					await tx.insert(filesTable).values({
						id,
						userId: user.id,
						createdAt: new Date(),
						matchupId: match
					});
				});
			} catch (cause) {
				await deleteFile(id).catch(() => undefined);
				throw cause;
			}

			await queueTechnicalEvents([
				{
					id: generateId(),
					type: EventType.UPLOAD,
					userId: other,
					createdAt: new Date(),
					data: { matchId: match } satisfies UploadData
				},
				{
					id: generateId(),
					type: EventType.UPLOAD,
					userId: user.id,
					createdAt: new Date(),
					data: { matchId: match } satisfies UploadData
				}
			]);

			redirect(302, '/friends/result/' + match);
		}
	),
	schedule: async (event) => {
		const locals = validateAuth(event);
		const { user } = locals;
		const scheduleLimit = consumeRateLimit(`capture-schedule:${user.id}`, {
			limit: 20,
			windowMs: 60_000
		});
		if (!scheduleLimit.allowed) {
			event.setHeaders({ 'Retry-After': String(scheduleLimit.retryAfterSeconds) });
			error(429, 'Too many capture requests.');
		}

		const { match } = event.params;
		const [matchup] = await db
			.select()
			.from(matchupTable)
			.where(
				and(
					eq(matchupTable.id, match),
					or(eq(matchupTable.friendId, user.id), eq(matchupTable.userId, user.id))
				)
			)
			.limit(1);

		assert(matchup, 404, 'match not found');
		assert(matchup.friendId, 400, 'friend has not joined yet');

		const [hasFiles] = await db
			.select()
			.from(filesTable)
			.where(eq(filesTable.matchupId, match))
			.limit(1);

		const delay = hasFiles ? 0 : 1000 * 4; // dont delay if someone has already uploaded
		const timestamp = Date.now() + delay;

		await queueTechnicalEvents([
			{
				id: generateId(),
				type: EventType.CAPTURE,
				userId: matchup.friendId,
				createdAt: new Date(),
				data: {
					matchId: match,
					timestamp
				} satisfies CaptureData
			},
			{
				id: generateId(),
				type: EventType.CAPTURE,
				userId: matchup.userId,
				createdAt: new Date(),
				data: {
					matchId: match,
					timestamp
				} satisfies CaptureData
			}
		]);
	}
};
