<script lang="ts">
	import type { Event } from '$lib/server/db/schema';
	import BaseEvent from './BaseEvent.svelte';

	let { clear }: { event: Event; clear: () => void } = $props();
</script>

<BaseEvent {clear}>Thank you for registering!</BaseEvent>
