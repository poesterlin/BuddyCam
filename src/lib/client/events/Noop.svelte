<script lang="ts">
	import type { Event } from '$lib/server/db/schema';

	let p: { event: Event; clear: () => void } = $props();

	console.log(p);
</script>

<div>
	DEBUG: <pre>{JSON.stringify(p.event, null, 2)}</pre>
</div>
