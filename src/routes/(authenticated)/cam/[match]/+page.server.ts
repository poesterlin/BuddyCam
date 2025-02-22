import { generateId, validateAuth, validateForm } from '$lib/server/util';
import { z } from 'zod';
import type { Actions } from '../$types';
import { uploadFile } from '$lib/server/s3';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { matchupTable } from '$lib/server/db/schema';
import { and, eq, or } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';

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

	return { matchup };
};

export const actions: Actions = {
	capture: validateForm(
		z.object({
			photo: z.instanceof(File)
		}),
		async (event, form) => {
			const { photo } = form;

			const id = generateId();

			await uploadFile(id, photo);
		}
	)
};
