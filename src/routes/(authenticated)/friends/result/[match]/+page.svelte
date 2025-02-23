<script lang="ts">
	import { events } from '$lib/client/messages.svelte';
	import { EventType } from '$lib/events';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let { files, matchup } = data;

	$effect(() => {
		const upload = events.new.find(({ event }) => event.type === EventType.UPLOAD);
		if (upload) {
			invalidateAll();
			upload.clear();
		}
	});
</script>

<div class="flex items-center justify-center">
	{#if files === 2}
		<div class="overflow-hidden rounded-2xl shadow-md">
			<img
				src="/friends/result/{matchup.id}/img"
				alt="Matchup Result"
				class="h-auto w-full object-cover"
			/>
		</div>
	{:else if files === 1}
		<div class="flex space-x-4">
			<div class="overflow-hidden rounded-2xl shadow-md">
				<img
					src="/friends/result/{matchup.id}/img"
					alt="Matchup Result"
					class="h-auto w-full object-cover"
				/>
			</div>
			<div class="overflow-hidden rounded-2xl shadow-md">
				<img src="/loading.gif" alt="Loading..." class="h-auto w-full animate-pulse object-cover" />
			</div>
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl shadow-md">
			<img src="/loading.gif" alt="Loading..." class="h-auto w-full animate-pulse object-cover" />
		</div>
	{/if}
</div>
