<script lang="ts">
	import type { ReadyRequestData } from '$lib/events';
	import type { Event } from '$lib/server/db/schema';
	import BaseEvent from './BaseEvent.svelte';

	let { event, clear }: { event: Event<ReadyRequestData>; clear: () => void } = $props();

	$effect(() => {
		console.log('ReadyEvent', event);
	});
</script>

<a href="/cam/waiting-room/{event.data.matchId}">
	<BaseEvent {clear} {event}>
		{event.data.fromUsername} is ready!
	</BaseEvent>
</a>
