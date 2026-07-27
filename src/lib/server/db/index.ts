import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/node-postgres';
import { building } from '$app/environment';

if (!building && !env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

export const db = drizzle(env.DATABASE_URL || 'postgres://build:build@localhost/build');
