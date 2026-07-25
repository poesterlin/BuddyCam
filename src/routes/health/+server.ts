import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { checkStorage } from '$lib/server/s3';

export const GET: RequestHandler = async () => {
	try {
		await Promise.all([db.execute(sql`select 1`), checkStorage()]);
		return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('Readiness check failed', error);
		return Response.json(
			{ status: 'unavailable' },
			{ status: 503, headers: { 'Cache-Control': 'no-store' } }
		);
	}
};
