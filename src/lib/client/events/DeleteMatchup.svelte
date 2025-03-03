<script lang="ts">
	import type { DeleteMatchupData } from '$lib/events';
	import type { Event } from '$lib/server/db/schema';
	import BaseEvent from './BaseEvent.svelte';

	let { event, clear }: { event: Event<DeleteMatchupData>; clear: () => void } = $props();
</script>

<BaseEvent {clear} {event}>
	{event.data.fromUsername} deleted the Results 🤷
</BaseEvent>
