<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { events, initMessageChannel } from '$lib/client/messages.svelte';
	import Modal from '$lib/client/Modal.svelte';
	import { toastStore } from '$lib/client/toast.svelte';
	import { onMount } from 'svelte';
	import { IconBell, IconUserCircle } from '@tabler/icons-svelte';
	import DynamicEvent from '$lib/client/events/DynamicEvent.svelte';
	import { slide } from 'svelte/transition';

	onMount(() => initMessageChannel());

	let { children } = $props();

	function showModal() {
		pushState('', { showNotifications: true });
	}

	function closeModal() {
		history.back();
	}
</script>

{#if page.state.showNotifications}
	<Modal title="Notifications" close={closeModal}>
		<ul class="m-4 flex flex-col gap-4">
			{#each events.new as { event, clear }}
				<DynamicEvent {event} {clear}></DynamicEvent>
			{:else}
				<p class="text-amber-400">No new notifications</p>
			{/each}
		</ul>
	</Modal>
{/if}

<div class="app-grid bg-gradient-to-br from-pink-100 to-purple-100">
	<nav class="bg-white shadow-lg">
		<div class="mx-auto max-w-7xl px-4">
			<div class="flex h-18 justify-between">
				<div class="flex items-center">
					<a
						href="/"
						class="text-2xl font-bold text-pink-500"
						aria-current={page.url.pathname === '/'}>BuddyCam</a
					>
				</div>
				<div class="flex items-center gap-6">
					<button class="btn btn-ghost btn-sm relative" onclick={showModal}>
						<IconBell class="text-amber-400"></IconBell>
						{#if events.count > 0}
							<span class="badge">{events.count}</span>
						{/if}
					</button>

					<a
						href="/friends"
						class="btn btn-ghost btn-sm text-lg text-amber-500"
						aria-current={page.url.pathname === '/friends'}>Friends</a
					>

					<a href="/profile" aria-current={page.url.pathname === '/profile'} class="text-rose-500">
						<IconUserCircle class="m-auto h-8 w-8 -translate-y-0.5"></IconUserCircle>
					</a>
				</div>
			</div>
		</div>
	</nav>

	<main class="overflow-y-auto">
		<div class="px-4">
			{@render children()}
		</div>

		{#each toastStore.toasts as toast, i (toast.id)}
			<div
				class="fixed right-4 bottom-4 z-50"
				in:slide={{ duration: 300 }}
				out:slide={{ duration: 300 }}
				style="translate: 0 {i * -4}rem;"
			>
				<div
					class="animate-slide-in rounded-xl border-l-4 border-rose-400 bg-pink-50 p-4 text-gray-700 shadow-lg"
					style="min-width: 300px"
				>
					<p class="text-sm font-semibold">{toast.message}</p>
				</div>
			</div>
		{/each}
	</main>
</div>

<style>
	nav {
		view-transition-name: header;
	}

	.badge {
		position: absolute;
		top: -0.6rem;
		right: -0.45rem;
		background-color: #f87171;
		color: white;
		font-size: 0.6rem;
		width: 1.2rem;
		height: 1.2rem;
		line-height: 1.2rem;
		text-align: center;
		border-radius: 50%;
	}

	.app-grid {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 99.6svh;
	}

	a {
		position: relative;
		min-width: 3rem;
	}

	a[aria-current='true']::after {
		position: absolute;
		content: '✨';
		--col: currentColor;
		background: linear-gradient(
			90deg,
			var(--col) 0%,
			var(--col) calc(100% - 1.5rem),
			transparent calc(100% - 1rem),
			transparent 100%
		);
		bottom: -0.3rem;
		left: calc(70% - 0.5rem);
		display: flex;
		transform: translateX(-50%);
		width: 100%;
		direction: rtl;
		line-height: 0.3rem;
		height: 0.2rem;
		font-size: 0.7rem;
		border-radius: 0.25rem;
		view-transition-name: active-link;
	}
</style>
