<script lang="ts">
	import type { FriendRequestAcceptedData } from '$lib/events';
	import type { Event } from '$lib/server/db/schema';
	import BaseEvent from './BaseEvent.svelte';

	let { event, clear }: { event: Event<FriendRequestAcceptedData>; clear: () => void } = $props();
</script>

<BaseEvent {clear} {event} link="/friends">
	{event.data.fromUsername} accepted your friend request
</BaseEvent>
