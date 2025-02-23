<script lang="ts">
	import type { DeleteMatchupData } from '$lib/events';
	import type { Event } from '$lib/server/db/schema';
	import BaseEvent from './BaseEvent.svelte';

	let { event, clear }: { event: Event; clear: () => void } = $props();

	let data = event.data as DeleteMatchupData;
</script>

<BaseEvent {clear} {event}>
	{data.fromUsername} deleted the Results 🤷
</BaseEvent>
