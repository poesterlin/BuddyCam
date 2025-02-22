<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { events, initMessageChannel } from '$lib/client/messages.svelte';
	import Modal from '$lib/client/Modal.svelte';
	import { toastStore } from '$lib/client/toast.svelte';
	import { onMount } from 'svelte';
	import { IconBell } from '@tabler/icons-svelte';
	import DynamicEvent from '$lib/client/events/DynamicEvent.svelte';
	import { slide } from 'svelte/transition';

	onMount(() => initMessageChannel());

	let { children } = $props();

	function showModal() {
		pushState('', { showNotifications: true });
	}
</script>

{#if page.state.showNotifications}
	<Modal title="Notifications" close={() => history.back()}>
		<div class="p-4">
			<ul class="mt-4 space-y-4">
				{#each events.new as { event, clear }}
					<DynamicEvent {event} {clear}></DynamicEvent>
				{:else}
					<p class="text-gray-500">No new notifications</p>
				{/each}
			</ul>
		</div>
	</Modal>
{/if}

<div class="app-grid bg-gradient-to-br from-pink-100 to-purple-100">
	<nav class="bg-white shadow-lg">
		<div class="mx-auto max-w-7xl px-4">
			<div class="flex h-16 justify-between">
				<div class="flex items-center">
					<a href="/" class="text-2xl font-bold text-pink-500">BuddyCam</a>
				</div>
				<div class="flex items-center gap-6">
					{#if !page.data.user}
						<a href="/login" class="btn btn-primary btn-sm">Login</a>
						<a href="/register" class="btn btn-secondary btn-sm">Register</a>
					{:else}
						<button class="btn btn-ghost btn-sm relative" onclick={showModal}>
							<IconBell></IconBell>
							{#if events.count > 0}
								<span class="badge">{events.count}</span>
							{/if}
						</button>

						<a href="/friends" class="btn btn-ghost btn-sm">Friends</a>

						<form action="/logout" method="POST">
							<button type="submit" class="btn btn-outline btn-sm">Logout</button>
						</form>
					{/if}
				</div>
			</div>
		</div>
	</nav>

	<main>
		{@render children()}

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
		height: 100svh;
	}
</style>
