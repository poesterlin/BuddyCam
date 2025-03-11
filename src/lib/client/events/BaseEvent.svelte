<script lang="ts">
	import type { Event } from '$lib/server/db/schema';
	import type { Snippet } from 'svelte';

	let {
		clear,
		children,
		event,
		link
	}: { link?: string; event: Event; clear: () => void; children: Snippet } = $props();

	const diff = new Date().getTime() - new Date(event.createdAt).getTime();

	const hours = Math.floor(diff / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
	const seconds = Math.floor((diff % (1000 * 60)) / 1000);

	// @ts-expect-error - TS doesn't know about Intl.DurationFormat yet
	const intl = new Intl.DurationFormat('en-US', { style: 'long' });

	const formatted = intl.format({
		hours: hours,
		minutes: minutes,
		seconds: seconds
	});

	function clearEvent(e: MouseEvent) {
		e.stopPropagation();
		clear();
	}
</script>

{#snippet content()}
	<div class="mr-2 h-2 w-2 rounded-full" style="background-color: #F59E0B"></div>
	{@render children()}
{/snippet}

<li
	class="flex items-center justify-between rounded-xl bg-gradient-to-br from-purple-500 to-teal-500 p-4 text-white shadow-sm transition-shadow duration-200 hover:shadow-md"
>
	{#if link}
		<a href={link} class="flex items-center py-3" data-sveltekit-preload-data="tap">
			{@render content()}
		</a>
	{:else}
		<div class="flex items-center py-3">{@render content()}</div>
	{/if}
	<small class="hidden text-xs text-gray-200 sm:block">
		{#if event.createdAt}
			{@const min = 20 * 1000}
			{@const max = 4 * 60 * 60 * 1000}
			{#if diff < min}
				• Just now
			{:else if diff < max}
				• {formatted}
			{:else}
				• {new Date(event.createdAt).toLocaleString()}
			{/if}
		{/if}
	</small>

	<button
		type="button"
		onclick={clearEvent}
		class="text-md text-rose-500 hover:text-gray-100 focus:outline-none"
	>
		Dismiss
	</button>
</li>
