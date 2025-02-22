import { EventType, type FriendRequestAcceptedData, type FriendRequestData } from '$lib/events';
import { db } from '$lib/server/db';
import { eventsTable, friendsTable, usersTable } from '$lib/server/db/schema';
import { assert, generateId, validateAuth, validateForm } from '$lib/server/util';
import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const locals = validateAuth(event);
	const { url } = event;

	const targetUserID = z.string().parse(url.searchParams.get('id'));

	if (locals.user.id === targetUserID) {
		error(400, 'You are already friends with yourself, silly!');
	}

	const [targetedUser] = await db
		.select({
			id: usersTable.id,
			username: usersTable.username
		})
		.from(usersTable)
		.where(eq(usersTable.id, targetUserID))
		.limit(1);

	// TODO: implement blocking users

	assert(targetedUser, 400, 'User not found');

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
	send: validateForm(
		z.object({
			target: z.string()
		}),
		async (event, form) => {
			const { target } = form;
			const locals = validateAuth(event);

			const [targetedUser] = await db
				.select()
				.from(usersTable)
				.where(eq(usersTable.id, target))
				.limit(1);

			assert(targetedUser, 400, 'User not found');

			// check if they are already friends
			const [existingFriendship] = await db
				.select()
				.from(friendsTable)
				.where(
					and(eq(friendsTable.userId, locals.user.id), eq(friendsTable.friendId, targetedUser.id))
				)
				.limit(1);

			if (existingFriendship) {
				redirect(302, '/friends');
			}

			// check if there is already a friend request in the other direction
			const [existingFriendRequest] = await db
				.select()
				.from(friendsTable)
				.where(
					and(eq(friendsTable.userId, targetedUser.id), eq(friendsTable.friendId, locals.user.id))
				)
				.limit(1);

			// if there is a friend request, connect the users as friends
			if (existingFriendRequest) {
				await db
					.update(friendsTable)
					.set({ accepted: true })
					.where(eq(friendsTable.id, existingFriendRequest.id));

				// insert reverse friendship
				await db.insert(friendsTable).values({
					id: generateId(),
					userId: locals.user.id,
					friendId: targetedUser.id,
					accepted: true,
					createdAt: new Date()
				});

				// notify both users
				await db.insert(eventsTable).values([
					{
						id: generateId(),
						userId: targetedUser.id,
						type: EventType.FRIEND_REQUEST_ACCEPTED,
						data: {
							fromId: locals.user.id,
							fromUsername: locals.user.username
						} satisfies FriendRequestAcceptedData,
						createdAt: new Date(),
						persistent: false,
						isTechnical: false,
						read: false
					} satisfies typeof eventsTable.$inferInsert,
					{
						id: generateId(),
						userId: locals.user.id,
						type: EventType.FRIEND_REQUEST_ACCEPTED,
						data: {
							fromId: targetedUser.id,
							fromUsername: targetedUser.username
						} satisfies FriendRequestAcceptedData,
						createdAt: new Date(),
						persistent: false,
						isTechnical: false,
						read: false
					} satisfies typeof eventsTable.$inferInsert
				]);

				redirect(302, '/friends');
			}

			// add friend request
			await db.insert(friendsTable).values({
				id: generateId(),
				userId: locals.user.id,
				friendId: targetedUser.id,
				accepted: false,
				createdAt: new Date()
			});

			// notify the targeted user
			await db.insert(eventsTable).values({
				id: generateId(),
				userId: targetedUser.id,
				type: EventType.FRIEND_REQUEST,
				data: {
					fromId: locals.user.id,
					fromUsername: locals.user.username
				} satisfies FriendRequestData,
				createdAt: new Date(),
				persistent: true,
				isTechnical: false,
				read: false
			} satisfies typeof eventsTable.$inferInsert);

			redirect(302, '/friends');
		}
	)
};
