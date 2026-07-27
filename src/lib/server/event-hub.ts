import type { Event } from './db/schema';
import { sendPushNotification } from './push';

type Subscriber = (event: Event) => boolean;

const PUSH_DELAY_MS = 10_000;
const MAX_PUSH_ATTEMPTS = 3;

class EventHub {
	private readonly subscribers = new Map<string, Set<Subscriber>>();
	private readonly pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly pushAttempts = new Map<string, number>();

	subscribe(userId: string, subscriber: Subscriber): () => void {
		const subscribers = this.subscribers.get(userId) ?? new Set();
		subscribers.add(subscriber);
		this.subscribers.set(userId, subscribers);

		return () => {
			subscribers.delete(subscriber);
			if (subscribers.size === 0) {
				this.subscribers.delete(userId);
			}
		};
	}

	publish(event: Event): boolean {
		let delivered = false;

		for (const subscriber of this.subscribers.get(event.userId) ?? []) {
			try {
				delivered = subscriber(event) || delivered;
			} catch (error) {
				console.error(`Failed to deliver event ${event.id} to a subscriber`, error);
			}
		}

		if (event.isTechnical || delivered) {
			this.markDelivered([event]);
		} else {
			this.schedulePush(event);
		}

		return delivered;
	}

	publishAll(events: Event[]): void {
		for (const event of events) {
			this.publish(event);
		}
	}

	markDelivered(events: Event[]): void {
		for (const event of events) {
			const timer = this.pushTimers.get(event.id);
			if (timer) {
				clearTimeout(timer);
				this.pushTimers.delete(event.id);
			}
			this.pushAttempts.delete(event.id);
		}
	}

	getStats() {
		let subscriberCount = 0;
		for (const subscribers of this.subscribers.values()) {
			subscriberCount += subscribers.size;
		}

		return {
			subscriberCount,
			subscribedUserCount: this.subscribers.size,
			pushFallbackCount: this.pushTimers.size
		};
	}

	cleanup(): void {
		for (const timer of this.pushTimers.values()) {
			clearTimeout(timer);
		}
		this.pushTimers.clear();
		this.pushAttempts.clear();
		this.subscribers.clear();
	}

	private schedulePush(event: Event): void {
		if (this.pushTimers.has(event.id)) {
			return;
		}

		const attempt = this.pushAttempts.get(event.id) ?? 0;
		if (attempt >= MAX_PUSH_ATTEMPTS) {
			console.error(`Push fallback exhausted for event ${event.id}`);
			this.pushAttempts.delete(event.id);
			return;
		}

		const delay = PUSH_DELAY_MS * 2 ** attempt;
		const timer = setTimeout(async () => {
			this.pushTimers.delete(event.id);
			this.pushAttempts.set(event.id, attempt + 1);

			try {
				if (await sendPushNotification(event.userId, event)) {
					this.pushAttempts.delete(event.id);
					return;
				}
			} catch (error) {
				console.error(`Push fallback failed for event ${event.id}`, error);
			}

			this.schedulePush(event);
		}, delay);

		this.pushTimers.set(event.id, timer);
	}
}

export const eventHub = new EventHub();
