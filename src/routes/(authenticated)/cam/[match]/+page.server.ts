import { assert, generateId, validateAuth, validateForm } from '$lib/server/util';
import { z } from 'zod';
import type { Actions } from './$types';
import { uploadFile } from '$lib/server/s3';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { eventsTable, filesTable, matchupTable, usersTable } from '$lib/server/db/schema';
import { and, eq, or } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import { EventType, type CaptureData, type UploadData } from '$lib/events';

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

	return { matchup };
};

export const actions: Actions = {
	capture: validateForm(
		z.object({
			photo: z.instanceof(File)
		}),
		async (event, form) => {
			const { user } = validateAuth(event);
			const { match } = event.params;

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

			const files = await db.select().from(filesTable).where(eq(filesTable.matchupId, match));

			const other = user.id === matchup.userId ? matchup.friendId : matchup.userId;

			if (files.length === 0) {
				// add capture event
				await db.insert(eventsTable).values({
					id: generateId(),
					type: EventType.CAPTURE,
					userId: other,
					createdAt: new Date(),
					isTechnical: true,
					data: {
						matchId: match
					} satisfies CaptureData
				});
			}

			const id = generateId();
			await db.insert(filesTable).values({
				id,
				userId: user.id,
				createdAt: new Date(),
				matchupId: match
			});

			await uploadFile(id, form.photo);

			// add upload event
			await db.insert(eventsTable).values([
				{
					id: generateId(),
					type: EventType.UPLOAD,
					userId: other,
					createdAt: new Date(),
					isTechnical: true,
					data: {
						matchId: match
					} satisfies UploadData
				},
				{
					id: generateId(),
					type: EventType.UPLOAD,
					userId: user.id,
					createdAt: new Date(),
					isTechnical: true,
					data: {
						matchId: match
					} satisfies UploadData
				}
			]);

			redirect(302, '/friends/result/' + match);
		}
	)
};
