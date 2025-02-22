<script lang="ts">
	import type { Event } from '$lib/server/db/schema';

	let { event, clear }: { event: Event; clear: () => void } = $props();
</script>

<li
	class="flex items-center justify-between rounded-xl bg-yellow-50 p-4 shadow-sm transition-shadow duration-200 hover:shadow-md"
>
	<div class="flex items-center">
		<div class="mr-2 h-2 w-2 rounded-full" style="background-color: #F59E0B"></div>
		<p class="text-sm text-gray-700">{event.type}</p>
	</div>

	<button
		type="button"
		onclick={clear}
		class="text-xs text-gray-500 hover:text-gray-700 focus:outline-none"
	>
		Dismiss
	</button>
</li>
