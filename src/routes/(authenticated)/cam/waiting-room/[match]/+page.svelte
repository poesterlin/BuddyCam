<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import ReadyEvent from '$lib/client/events/ReadyEvent.svelte';
	import { events } from '$lib/client/messages.svelte';
	import { EventType, type ReadyRequestData, type StartData } from '$lib/events';
	import { onMount } from 'svelte';

	let { data } = $props();

	$effect(() => {
		const goNext = events.new.find(({ event }) => event.type === EventType.START);
		if (goNext) {
			const data = goNext.event.data as StartData;
			goto(`/cam/${data.matchId}`);
			goNext.clear();
		}
	});

	onMount(() => {
		// clear ready event from the queue
		events.new
			.filter(({ event }) => event.type === EventType.READY)
			.forEach((e) => {
				const { matchId } = e.event.data as ReadyRequestData;
				if (matchId === data.matchup.id) {
					e.clear();
				}
			});

		const interval = setInterval(() => {
			invalidateAll();
		}, 1000);

		return () => clearInterval(interval);
	});
</script>

<div
	class="flex h-full items-center justify-center overflow-hidden bg-gradient-to-b from-pink-50 to-yellow-50"
>
	<div class="rounded-3xl bg-white p-8 text-center shadow-xl">
		<p class="text-2xl font-semibold text-rose-500">Waiting for a friend to join 💖</p>
		<p>Just a moment...</p>

		<div class="relative flex justify-center">
			<img src="/loading.gif" class="m-auto" alt="" />
			<div
				class="bounce absolute inset-0 m-auto h-8 w-8 translate-y-1 rounded-full bg-pink-200/50"
			></div>
		</div>
	</div>
</div>

<style>
	/* Custom animation for the bouncing loader */
	@keyframes bounce {
		0% {
			transform: translateY(0);
		}
		35% {
			transform: translateY(-0.5rem); /* Adjust bounce height */
		}
		100% {
			transform: translateY(0);
		}
	}

	.bounce {
		animation: bounce 1.5s infinite ease-in-out;
		tranform-origin: center;
	}
</style>
