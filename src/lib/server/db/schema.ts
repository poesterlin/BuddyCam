import { read } from '$app/server';
import {
	boolean,
	index,
	integer,
	json,
	pgTable,
	text,
	timestamp,
	unique
} from 'drizzle-orm/pg-core';

export const usersTable = pgTable('user', {
	id: text('id').primaryKey(),
	age: integer('age'),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull()
});

export type User = typeof usersTable.$inferSelect;

export const sessionTable = pgTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => usersTable.id),
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
});

export type Session = typeof sessionTable.$inferSelect;

export const friendsTable = pgTable(
	'friend',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => usersTable.id),
		friendId: text('friend_id')
			.notNull()
			.references(() => usersTable.id),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
		accepted: boolean('accepted').notNull().default(false)
	},
	(t) => [unique().on(t.userId, t.friendId)]
);

export type Friend = typeof friendsTable.$inferSelect;

export const eventsTable = pgTable(
	'event',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => usersTable.id),
		type: text('type').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
		sendAt: timestamp('send_at', { withTimezone: true, mode: 'date' }),
		data: json('data'),
		persistent: boolean('persistent').notNull().default(false),
		read: boolean('read').notNull().default(false),
		isTechnical: boolean('is_technical').notNull()
	},
	(t) => [index().on(t.userId, t.sendAt)]
);

export type Event = typeof eventsTable.$inferSelect;

export const matchupTable = pgTable('matchup', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => usersTable.id),
	friendId: text('opponent_id').references(() => usersTable.id),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
});

export type Matchup = typeof matchupTable.$inferSelect;

export const filesTable = pgTable('file', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => usersTable.id),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
	matchupId: text('matchup_id')
		.notNull()
		.references(() => matchupTable.id)
});

export type File = typeof filesTable.$inferSelect;
