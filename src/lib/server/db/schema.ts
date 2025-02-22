import { boolean, index, json, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

const fullCascade = { onDelete: 'cascade', onUpdate: 'cascade' } as const;

export const usersTable = pgTable('user', {
	id: text('id').primaryKey(),
	email: text('email').unique('user_email_unique', { nulls: 'distinct' }),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
	lastLogin: timestamp('last_login', { withTimezone: true, mode: 'date' }),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull()
});

export type User = typeof usersTable.$inferSelect;

export const sessionTable = pgTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => usersTable.id, fullCascade),
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
});

export type Session = typeof sessionTable.$inferSelect;

export const friendsTable = pgTable(
	'friend',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => usersTable.id, fullCascade),
		friendId: text('friend_id')
			.notNull()
			.references(() => usersTable.id, fullCascade),
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
			.references(() => usersTable.id, fullCascade),
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
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => usersTable.id, fullCascade),
	friendId: text('opponent_id').references(() => usersTable.id, fullCascade)
});

export type Matchup = typeof matchupTable.$inferSelect;

export const filesTable = pgTable('file', {
	id: text('id').primaryKey(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => usersTable.id, fullCascade),
	matchupId: text('matchup_id')
		.notNull()
		.references(() => matchupTable.id, fullCascade)
});

export type File = typeof filesTable.$inferSelect;
