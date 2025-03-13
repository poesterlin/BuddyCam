<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { env } from '$env/dynamic/public';
	import { IconBell, IconBellRingingFilled, IconUserCircle } from '@tabler/icons-svelte';

	let { data } = $props();
	let user = data.user;

	const intl = new Intl.DateTimeFormat('en-US', {
		month: 'long',
		day: 'numeric',
		hour: 'numeric'
	});

	function formatDate(d: string | Date) {
		return intl.format(new Date(d));
	}

	async function addNotification() {
		const publicVapidKey = env.PUBLIC_VAPID_KEY;

		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: publicVapidKey
		});

		await fetch('/profile/notification', {
			method: 'POST',
			body: JSON.stringify(subscription.toJSON())
		});

		invalidateAll();
	}
</script>

<div
	class="flex h-full flex-col items-center justify-center bg-gradient-to-br from-pink-100 to-yellow-100"
>
	<div class="card min-w-sm w-max space-y-6 rounded-3xl bg-white p-8 text-center shadow-2xl">
		<IconUserCircle class="mx-auto h-24 w-24 text-rose-500"></IconUserCircle>

		<h1 class="text-4xl font-extrabold text-rose-500 drop-shadow-md">{user.username} 💖</h1>

		<!-- notifications -->
		<button
			class="mx-auto mb-12 flex items-center justify-center gap-4 rounded-full bg-gradient-to-l from-rose-400 to-amber-400 px-6 py-3 font-semibold tracking-wider text-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-rose-200"
			onclick={addNotification}
		>
			<span> Enable Notifications</span>
			{#if data.hasNotifications}
				<IconBellRingingFilled></IconBellRingingFilled>
			{:else}
				<div class="wiggle">
					<IconBell></IconBell>
				</div>
			{/if}
		</button>

		<p class="text-lg text-gray-700">
			Email:
			{#if user.email}
				<span class="font-semibold">{user.email}</span>
			{:else}
				<span class="font-semibold">Not Provided</span>
			{/if}
		</p>
		<p class="text-lg text-gray-700">
			Last Login:
			<span class="font-semibold">{user.lastLogin ? formatDate(user.lastLogin!) : 'Never'}</span>
		</p>
		<p class="mb-12 text-lg text-gray-700">
			Created At: <span class="font-semibold">{formatDate(user.createdAt)}</span>
		</p>

		<div class="flex flex-col space-y-8">
			<form method="POST" action="/logout">
				<button
					class="rounded-full bg-white px-6 py-3 font-semibold tracking-wider text-rose-500 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-rose-200"
					type="submit">Logout ✨</button
				>
			</form>

			<form action="?/delete" method="POST">
				<button
					class="rounded-full bg-red-400 px-4 py-3 font-semibold tracking-wider text-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-rose-200"
					type="submit"
				>
					Delete Account 🥺</button
				>
			</form>
		</div>
	</div>
</div>

<style>
	.card {
		max-width: 95vw;
	}

	button {
		.wiggle {
			@starting-style {
				animation: wiggle 0.5s forwards 2;
			}
		}

		&:hover {
			.wiggle {
				animation: wiggle 0.5s infinite;
			}
		}
	}

	@keyframes wiggle {
		0% {
			transform: rotate(0deg);
		}
		25% {
			transform: rotate(6deg);
		}
		50% {
			transform: rotate(-4deg);
		}
		75% {
			transform: rotate(5deg);
		}
		100% {
			transform: rotate(0deg);
		}
	}
</style>
