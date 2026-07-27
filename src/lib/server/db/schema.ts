import { boolean, index, json, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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

export const sessionTable = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => usersTable.id, fullCascade),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
	},
	(t) => [index().on(t.userId), index().on(t.expiresAt)]
);

export type Session = typeof sessionTable.$inferSelect;

export const subscriptionsTable = pgTable('subscription', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => usersTable.id, fullCascade),
	endpoint: text('endpoint').notNull(),
	expirationTime: timestamp('expiration_time', { withTimezone: true, mode: 'date' }),
	keys: json('keys').notNull()
});

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

export const blocksTable = pgTable(
	'block',
	{
		id: text('id').primaryKey(),
		blockerId: text('blocker_id')
			.notNull()
			.references(() => usersTable.id, fullCascade),
		blockedId: text('blocked_id')
			.notNull()
			.references(() => usersTable.id, fullCascade),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
	},
	(t) => [unique().on(t.blockerId, t.blockedId), index().on(t.blockedId)]
);

export const eventsTable = pgTable(
	'event',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => usersTable.id, fullCascade),
		type: text('type').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
		data: json('data'),
		persistent: boolean('persistent').notNull().default(false),
		read: boolean('read').notNull().default(false),
		isTechnical: boolean('is_technical').notNull()
	},
	(t) => [
		index('event_unread_persistent_idx')
			.on(t.userId, t.createdAt)
			.where(sql`${t.persistent} = true AND ${t.read} = false`)
	]
);

export type Event<T = unknown> = Omit<typeof eventsTable.$inferSelect, 'data'> & {
	data: T;
};

export const matchupTable = pgTable(
	'matchup',
	{
		id: text('id').primaryKey(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => usersTable.id, fullCascade),
		friendId: text('opponent_id').references(() => usersTable.id, fullCascade)
	},
	(t) => [index().on(t.userId, t.createdAt), index().on(t.friendId, t.createdAt)]
);

export type Matchup = typeof matchupTable.$inferSelect;

export const filesTable = pgTable(
	'file',
	{
		id: text('id').primaryKey(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => usersTable.id, fullCascade),
		matchupId: text('matchup_id')
			.notNull()
			.references(() => matchupTable.id, fullCascade)
	},
	(t) => [unique().on(t.matchupId, t.userId), index().on(t.matchupId, t.createdAt)]
);

export type File = typeof filesTable.$inferSelect;
