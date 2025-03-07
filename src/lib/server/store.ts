import { assert } from '$lib/client/util';
import type { Event, User } from './db/schema';
import { sendPushNotification } from './push';

export class EventStore {
	// Map of user ID to their events
	private userEvents: Map<string, Map<string, Event>> = new Map();

	// Map of timeout IDs for cleanup
	private timeouts: Map<string, NodeJS.Timeout> = new Map();

	// Users info cache
	private users: Set<string> = new Set();

	/**
	 * Add a user to the store
	 */
	public addUser(user: Pick<User, 'id'>): void {
		this.users.add(user.id);
	}

	/**
	 * Record an event for a user with a timeout
	 */
	public recordEvent(event: Event): string {
		// Create user map if it doesn't exist
		if (!this.userEvents.has(event.userId)) {
			this.userEvents.set(event.userId, new Map());
		}

		const userEventMap = this.userEvents.get(event.userId)!;
		userEventMap.set(event.id, event);

		// Set timeout to send notification
		const timeoutId = setTimeout(() => {
			this.processEvent(event.id, event.userId);
		}, 10_000); // 10 seconds

		// Store timeout ID for cleanup
		this.timeouts.set(event.id, timeoutId);

		return event.id;
	}

	/**
	 * Process an event - send notification and remove from store
	 */
	private async processEvent(eventId: string, userId: string): Promise<void> {
		const userEventMap = this.userEvents.get(userId);
		if (!userEventMap) {
			return;
		}

		const event = userEventMap.get(eventId);
		if (!event) {
			return;
		}

		const user = this.users.has(userId);
		if (!user) {
			return;
		}

		try {
			// Send push notification
			const success = await sendPushNotification(userId, event);

			if (!success) {
				console.error(`Failed to send push notification for event ${eventId} to user ${userId}`);
				// retry
				this.recordEvent(event);
				return;
			}

			// Remove the event
			this.removeEvent(eventId, userId);
			console.log(`Processed event ${eventId} for user ${userId}`);
		} catch (error) {
			console.error(`Failed to process event ${eventId} for user ${userId}:`, error);
		}
	}

	/**
	 * Remove an event from the store and clear its timeout
	 */
	public removeEvent(eventId: string, userId: string): void {
		// Clear timeout
		const timeoutId = this.timeouts.get(eventId);
		if (timeoutId) {
			clearTimeout(timeoutId);
			this.timeouts.delete(eventId);
		}

		// Remove event
		const userEventMap = this.userEvents.get(userId);
		if (userEventMap) {
			userEventMap.delete(eventId);

			// Clean up empty maps to prevent memory leaks
			if (userEventMap.size === 0) {
				this.userEvents.delete(userId);
			}
		}
	}

	/**
	 * Get all events for a specific user
	 */
	public getUserEvents(userId: string): Event[] {
		const userEventMap = this.userEvents.get(userId);
		if (!userEventMap) return [];

		const events = Array.from(userEventMap.values());

		return events;
	}

	public removeEvents(events: Event[]): void {
		for (const event of events) {
			this.removeEvent(event.id, event.userId);
		}
	}

	/**
	 * Get an event by ID for a specific user
	 */
	public getEvent(eventId: string, userId: string): Event | undefined {
		return this.userEvents.get(userId)?.get(eventId);
	}

	/**
	 * Clean up all timeouts - important for server shutdown
	 */
	public cleanup(): void {
		for (const timeoutId of this.timeouts.values()) {
			clearTimeout(timeoutId);
		}

		this.timeouts.clear();
		this.userEvents.clear();
		this.users.clear();
	}

	/**
	 * Get stats about the store - useful for monitoring
	 */
	public getStats(): {
		userCount: number;
		eventCount: number;
		timeoutCount: number;
	} {
		let totalEvents = 0;
		for (const userEventMap of this.userEvents.values()) {
			totalEvents += userEventMap.size;
		}

		return {
			userCount: this.users.size,
			eventCount: totalEvents,
			timeoutCount: this.timeouts.size
		};
	}
}
