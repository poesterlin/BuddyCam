<script lang="ts">
	import type { ReadyRequestData } from '$lib/events';
	import type { Event } from '$lib/server/db/schema';
	import BaseEvent from './BaseEvent.svelte';

	let { event, clear }: { event: Event<ReadyRequestData>; clear: () => void } = $props();
</script>

<BaseEvent {clear} {event} link="/cam/waiting-room/{event.data.matchId}">
	{event.data.fromUsername} is ready!
</BaseEvent>
