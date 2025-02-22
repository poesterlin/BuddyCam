<script lang="ts">
	import type { PageServerData } from './$types';
	import { enhance } from '$app/forms';

	let { data }: { data: PageServerData } = $props();
</script>

<div class="h-full bg-gradient-to-br from-pink-100 to-yellow-100 px-4 py-8">
	<h1 class="text-center text-3xl font-semibold text-rose-500">Hi, {data!.user.username}!</h1>

	<form method="POST" action="?/ready" use:enhance class="flex h-full items-center justify-center">
		<button
			type="submit"
			class="hover:brightness-120 relative mb-24 rounded-full bg-gradient-to-r from-rose-400 to-amber-400 px-6 py-3 text-xl font-extrabold text-white shadow-md transition-all duration-300 before:absolute before:inset-0 before:z-[-1] before:rounded-full before:bg-gradient-to-br before:from-purple-500 before:to-teal-500 before:opacity-0 before:transition-opacity before:duration-500 hover:rotate-3 hover:scale-110 hover:before:opacity-100 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
		>
			I'm Ready! ✨
		</button>
	</form>
</div>

<style>
	button {
		letter-spacing: 1px;
	}
</style>
