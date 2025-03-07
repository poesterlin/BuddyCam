<script lang="ts">
	import type { FriendRequestData } from '$lib/events';
	import type { Event } from '$lib/server/db/schema';
	import BaseEvent from './BaseEvent.svelte';

	let { event, clear }: { event: Event<FriendRequestData>; clear: () => void } = $props();
</script>

<BaseEvent {clear} {event} link="/friends/review/{event.data.fromId}">
	{event.data.fromUsername} wants to be your friend
</BaseEvent>
