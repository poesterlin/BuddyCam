<script lang="ts">
	import type { FriendRequestData } from '$lib/events';
	import type { Event } from '$lib/server/db/schema';
	import BaseEvent from './BaseEvent.svelte';

	let { event, clear }: { event: Event; clear: () => void } = $props();

	let data = event.data as ReadyRequestData;
</script>

<a href="/cam/waiting-room/{data.matchId}">
	<BaseEvent {clear}>
		{data.fromUsername} is ready!
	</BaseEvent>
</a>
