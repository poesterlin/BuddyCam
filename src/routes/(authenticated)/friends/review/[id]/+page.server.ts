import { assert, generateId, validateAuth, validateForm } from '$lib/server/util';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { eventsTable, friendsTable } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { EventType, type FriendRequestAcceptedData } from '$lib/events';
import { sql } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);
	const { params } = event;

	const targetUserID = z.string().parse(params.id);

	const [targetedUser] = await db
		.select()
		.from(friendsTable)
		.where(
			and(
				eq(friendsTable.userId, targetUserID),
				eq(friendsTable.accepted, false),
				eq(friendsTable.friendId, locals.user.id)
			)
		)
		.limit(1);

	// TODO: implement blocking users
	assert(targetedUser, 400, 'Friend request not found');

	// check if they are already friends
	const [existingFriendship] = await db
		.select()
		.from(friendsTable)
		.where(and(eq(friendsTable.userId, locals.user.id), eq(friendsTable.friendId, targetedUser.id)))
		.limit(1);

	if (existingFriendship) {
		redirect(302, '/friends');
	}

	return { targetedUser };
};

export const actions: Actions = {
	accept: async (event) => {
		const locals = validateAuth(event);
		const { id } = event.params;
		assert(id, 400, 'Friend request ID is required');

		// check if the friend request exists
		const [request] = await db
			.select()
			.from(friendsTable)
			.where(and(eq(friendsTable.userId, id), eq(friendsTable.friendId, locals.user.id)))
			.limit(1);

		assert(request, 400, 'Friend request not found');

		// accept the friend request
		await db.update(friendsTable).set({ accepted: true }).where(eq(friendsTable.id, request.id));

		// insert reverse friendship
		await db.insert(friendsTable).values({
			id: generateId(),
			userId: locals.user.id,
			friendId: id,
			accepted: true,
			createdAt: new Date()
		});

		// insert event for the user who sent the request
		await db.insert(eventsTable).values({
			id: generateId(),
			userId: id,
			type: EventType.FRIEND_REQUEST_ACCEPTED,
			isTechnical: false,
			data: {
				fromId: locals.user.id,
				fromUsername: locals.user.username
			} satisfies FriendRequestAcceptedData,
			createdAt: new Date()
		});

		// delete the friend request event
		await deleteFriendRequestEvent(id, locals);

		redirect(302, '/friends');
	},
	dismiss: async (event) => {
		const locals = validateAuth(event);
		const { id } = event.params;
		assert(id, 400, 'Friend request ID is required');

		await db
			.delete(friendsTable)
			.where(and(eq(friendsTable.userId, id), eq(friendsTable.friendId, locals.user.id)));

		await deleteFriendRequestEvent(id, locals);

		redirect(302, '/friends');
	},
	block: async (event) => {
		const locals = validateAuth(event);
		const { id } = event.params;

		await deleteFriendRequestEvent(id, locals);

		// TODO: implement blocking users
		redirect(302, '/friends');
	}
};

async function deleteFriendRequestEvent(id: string, locals: App.Locals) {
	await db
		.delete(eventsTable)
		.where(
			and(
				eq(eventsTable.userId, id),
				eq(eventsTable.type, EventType.FRIEND_REQUEST),
				sql`data->>'userId' = ${locals.user!.id}`
			)
		);
}
