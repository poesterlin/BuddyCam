<script lang="ts">
	import { IconUserCircle } from '@tabler/icons-svelte';

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
</script>

<div
	class="flex h-full flex-col items-center justify-center bg-gradient-to-br from-pink-100 to-yellow-100"
>
	<div class="card w-sm space-y-6 rounded-3xl bg-white p-8 text-center shadow-2xl">
		<IconUserCircle class="mx-auto h-24 w-24 text-rose-500"></IconUserCircle>

		<h1 class="text-4xl font-extrabold text-rose-500 drop-shadow-md">{user.username} 💖</h1>

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
		<p class="text-lg text-gray-700">
			Created At: <span class="font-semibold">{formatDate(user.createdAt)}</span>
		</p>

		<div class="flex flex-col space-y-4">
			<form method="POST" action="/logout">
				<button
					class="rounded-full bg-gradient-to-l from-rose-400 to-amber-400 px-6 py-3 font-semibold tracking-wider text-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl focus:ring-2 focus:ring-rose-200 focus:outline-none"
					type="submit">Logout ✨</button
				>
			</form>

			<form action="?/delete" method="POST">
				<button
					class="rounded-full bg-white px-6 py-3 font-semibold tracking-wider text-rose-500 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl focus:ring-2 focus:ring-rose-200 focus:outline-none"
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
</style>
