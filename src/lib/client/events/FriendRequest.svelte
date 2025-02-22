<script lang="ts">
	import type { FriendRequestData } from '$lib/events';
	import type { Event } from '$lib/server/db/schema';
	import BaseEvent from './BaseEvent.svelte';

	let { event, clear }: { event: Event; clear: () => void } = $props();

	let data = event.data as FriendRequestData;
</script>

<a href="/friends/review/{data.fromId}">
	<BaseEvent {clear}>
		{data.fromUsername} wants to be your friend
	</BaseEvent>
</a>
