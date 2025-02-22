<script lang="ts">
	import type { Event } from '$lib/server/db/schema';
	import BaseEvent from './BaseEvent.svelte';

	let { clear, event }: { event: Event; clear: () => void } = $props();
</script>

<BaseEvent {clear} {event}>Thank you for registering!</BaseEvent>
