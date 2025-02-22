<script lang="ts">
	import { events } from '$lib/client/messages.svelte';
	import { EventType } from '$lib/events';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let { files, matchup } = data;

	$effect(() => {
		const upload = events.new.find(({event}) => event.type === EventType.UPLOAD);
		if (upload) {
			invalidateAll();
			upload.clear();
		}
	});
</script>

{#if files === 2}
	<div>
		<img src="/friends/result/{matchup.id}/img" alt="" />
	</div>
{:else if files === 1}
	<div class="flex">
		<img src="/friends/result/{matchup.id}/img" alt="" />
		<!-- placeholder -->
		<img src="/loading.gif" alt="loading" />
	</div>
{:else}
	<div>
		<img src="/loading.gif" alt="loading" />
	</div>
{/if}
