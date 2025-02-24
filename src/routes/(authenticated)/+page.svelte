<script lang="ts">
	import type { PageServerData } from './$types';
	import { enhance } from '$app/forms';

	let { data }: { data: PageServerData } = $props();
</script>

<div class="flex h-full flex-col bg-gradient-to-br from-pink-100 to-yellow-100 px-4 py-8">
	<h1 class="mb-8 text-center text-3xl font-extrabold text-pink-500">
		Hi, {data!.user.username}! <span class="text-xl">✨💖</span>
	</h1>

	<form
		method="POST"
		action="?/ready"
		use:enhance
		class="flex flex-1 flex-col items-center justify-center"
	>
		<button
			type="submit"
			class="relative rounded-full bg-gradient-to-r from-rose-400 to-amber-400 px-6 py-3 pl-10 text-xl font-extrabold text-white shadow-md transition-all duration-300 before:absolute before:inset-0 before:z-[-1] before:rounded-full before:bg-gradient-to-br before:from-purple-500 before:to-teal-500 before:opacity-0 before:transition-opacity before:duration-500 hover:scale-110 hover:rotate-3 hover:pl-6 hover:brightness-120 hover:before:opacity-100 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
		>
			I'm Ready! &nbsp; 📷
		</button>
		<p class="mt-4 mb-24 text-center text-gray-600">Let's go have some fun! 🌈</p>
	</form>
</div>

<style>
	button {
		letter-spacing: 1px;
	}
</style>
