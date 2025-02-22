<script lang="ts">
	import { toastStore } from '$lib/client/toast.svelte';
	import { IconCancel, IconCopy, IconUserCircle } from '@tabler/icons-svelte';
	import type { PageServerData } from './$types';
	import { enhance } from '$app/forms';
	import { events } from '$lib/client/messages.svelte';
	import { EventType } from '$lib/events';
	import { invalidate } from '$app/navigation';

	let { data }: { data: PageServerData } = $props();

	$effect(() => {
		const matching: string[] = [EventType.FRIEND_REQUEST_ACCEPTED, EventType.FRIEND_REQUEST];
		const e = events.new.find(({ event }) => matching.includes(event.type));
		if (e) {
			invalidate(({ pathname }) => pathname === '/friends');
			e.clear();
		}
	});

	function copyFriendLink() {
		const url = window.location.origin + '/friends/request?id=' + data.user.id;
		navigator.clipboard.writeText(url.toString());

		toastStore.show('Copied friend link to clipboard!');
	}
</script>

<div class="relative m-auto mt-12 w-max rounded-lg bg-white p-3 shadow-md">
	<img src="/qrcode" alt="Friend Link QR-Code" />

	<button
		onclick={copyFriendLink}
		class="absolute right-4 bottom-4 rounded-lg bg-white p-2 shadow-md"
	>
		<IconCopy class="text-purple-900"></IconCopy>
	</button>
</div>
<h2 class="mt-4 text-center text-lg text-rose-600">Share this link with your friends!</h2>

{#if data.friends.length > 0}
	<h1 class="mt-12 text-center text-3xl font-semibold text-rose-500">Your Friends</h1>
{/if}

<ul class="m-auto mt-8 max-w-xl space-y-3">
	{#each data.friends as friend}
		<a
			href="/friends/{friend.id}"
			class="flex items-center rounded-xl bg-yellow-50 px-3 py-2 shadow-sm transition-shadow duration-200 hover:shadow-md"
		>
			<IconUserCircle class="mr-2 h-8 w-8 text-amber-300"></IconUserCircle>

			<span class="flex-grow font-bold text-amber-600">
				{friend.user}
			</span>

			<span class="flex items-center text-sm text-green-600">
				<span class="mr-1">Friends!</span>
				<span aria-label="Heart Eyes" role="img">🥰</span>
			</span>
		</a>
	{/each}
</ul>

{#if data.myRequest.length > 0}
	<h3 class="mt-12 text-center text-3xl font-semibold text-rose-500">Your Open Request</h3>
{/if}
<ul class="m-auto mt-8 max-w-xl space-y-3">
	{#each data.myRequest as request}
		<li
			class="flex items-center justify-between rounded-xl bg-yellow-50 px-3 py-2 shadow-sm transition-shadow duration-200 hover:shadow-md"
		>
			<p>{request.user}</p>

			<span class="flex items-center text-sm text-gray-500 italic">
				<span class="mr-1">Waiting...</span>
				<span aria-label="Pleading Face" role="img">🥺</span>
			</span>

			<form action="?/del" method="POST" use:enhance>
				<input type="hidden" name="id" value={request.id} />
				<button type="submit" class="rounded-full bg-white p-2 shadow-md">
					<IconCancel class="text-red-500"></IconCancel>
				</button>
			</form>
		</li>
	{/each}
</ul>
