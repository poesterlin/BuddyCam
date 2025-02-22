import { db } from '$lib/server/db';
import { filesTable, matchupTable } from '$lib/server/db/schema';
import { ImageVideoProcessor, type ImagePair } from '$lib/server/process';
import { validateAuth } from '$lib/server/util';
import { and, eq, or } from 'drizzle-orm';
import { getFile } from '$lib/server/s3';
import { createReadStream, readFile } from 'fs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const locals = validateAuth(event);
	const { friend } = event.params;

	const matchups = await db
		.select()
		.from(matchupTable)
		.where(
			or(
				and(eq(matchupTable.userId, locals.user.id), eq(matchupTable.friendId, friend)),
				and(eq(matchupTable.friendId, locals.user.id), eq(matchupTable.userId, friend))
			)
		)
		.orderBy(matchupTable.createdAt);

	if (!matchups.length) {
		console.log('No matchups found');
		return new Response(null, { status: 404 });
	}

	const pairs: ImagePair[] = [];
	for (const matchup of matchups) {
		const [fistFile, secondFile] = await db
			.select()
			.from(filesTable)
			.where(eq(filesTable.matchupId, matchup.id))
			.orderBy(filesTable.createdAt)
			.limit(2);

		if (!fistFile || !secondFile) {
			continue;
		}

		const [first, second] = await Promise.all([getFile(fistFile.id), getFile(secondFile.id)]);
		pairs.push({ first, second });
	}

	const processor = new ImageVideoProcessor({ folder: friend, fps: 2 });
	const videoPath = await processor.processImagesAndCreateVideo(pairs);

	const stream = await createReadStream(videoPath);

	// @ts-expect-error - Stream is not a valid ResponseInit but it works
	return new Response(stream, {
		headers: {
			'Content-Type': 'video/mp4'
			// 'Cache-Control': 'public, max-age=3600' // 1 hour
		}
	});
};
