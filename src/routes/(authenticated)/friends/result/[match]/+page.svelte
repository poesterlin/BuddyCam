<script lang="ts">
	import { events } from '$lib/client/messages.svelte';
	import { EventType } from '$lib/events';
	import { invalidateAll } from '$app/navigation';
	import { IconCameraPlus, IconCancel } from '@tabler/icons-svelte';

	let { data } = $props();
	let { files, matchup } = data;

	let randomId = $state(Math.random());

	const myId = data.user.id;
	const other = myId === matchup.friendId ? matchup.userId : matchup.friendId;

	$effect(() => {
		const upload = events.new.find(({ event }) => event.type === EventType.UPLOAD);
		if (upload) {
			invalidateAll();
			upload.clear();
		}

		const deleteEvent = events.new.find(({ event }) => event.type === EventType.DELETE_MATCHUP);
		if (deleteEvent) {
			invalidateAll();
		}
	});
</script>

<div class="mt-4 flex items-center justify-center">
	{#if files === 2}
		<div class="overflow-hidden rounded-2xl shadow-md">
			<img
				src="/friends/result/{matchup.id}/img?{randomId}"
				alt="Matchup Result"
				class="h-auto w-full object-cover"
			/>
		</div>
	{:else if files === 1}
		<div class="flex space-x-4">
			<div class="overflow-hidden rounded-2xl shadow-md">
				<img
					src="/friends/result/{matchup.id}/img?{randomId}"
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
<div class="mx-auto my-2 flex w-[80vw] max-w-md items-center justify-evenly gap-3">
	<a
		href="/friends/{other}"
		class="flex inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-200 to-amber-200 px-4 py-2 font-semibold text-rose-500 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md focus:ring-2 focus:ring-rose-100 focus:outline-none"
	>
		Save
		<IconCameraPlus class="h-5 w-5" />
	</a>

	<form action="?/del" method="POST">
		<button
			class="inline-flex items-center rounded-full bg-white px-4 py-2 font-semibold text-rose-500 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md focus:ring-2 focus:ring-rose-100 focus:outline-none"
		>
			<IconCancel class="h-5 w-5" />
		</button>
	</form>
</div>
