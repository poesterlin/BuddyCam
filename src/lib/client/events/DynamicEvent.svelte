<script lang="ts">
	import type { Event } from '$lib/server/db/schema';
	import { EventType } from '$lib/events';
	import FriendRequest from './FriendRequest.svelte';
	import FriendRequestAccepted from './FriendRequestAccepted.svelte';
	import ReadyEvent from './ReadyEvent.svelte';
	import Noop from './Noop.svelte';
	import RegisterEvent from './RegisterEvent.svelte';

	let { event, clear }: { clear: () => void; event: Event } = $props();

	let SelectedEvent = $derived(getEvent(event.type));

	export function getEvent(type: string) {
		switch (type) {
			case EventType.REGISTER:
				return RegisterEvent;

			case EventType.FRIEND_REQUEST:
				return FriendRequest;

			case EventType.FRIEND_REQUEST_ACCEPTED:
				return FriendRequestAccepted;

			case EventType.READY:
				return ReadyEvent;

			default:
				return Noop;
		}
	}
</script>

<SelectedEvent {event} {clear}></SelectedEvent>
