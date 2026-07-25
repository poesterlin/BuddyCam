<script lang="ts">
	import { IconDownload } from '@tabler/icons-svelte';

	let { data } = $props();

	function download() {
		const a = document.createElement('a');
		a.href = `/friends/${data.friend.id}/video`;
		a.download = `${data.friend.username}_and_${data.user.username}.mp4`;
		a.click();
	}
</script>

<div class="flex flex-col items-center justify-center">
	<h1 class="mt-4 text-3xl font-extrabold text-rose-500">
		🌟 {data.friend.username} & Du 🌟
	</h1>

	{#if data.matchups > 0}
		<div class="relative overflow-hidden rounded-lg">
			<video
				src="/friends/{data.friend.id}/video"
				muted
				autoplay
				loop
				playsinline
				class="h-full w-full overflow-hidden rounded-lg object-cover"
			>
			</video>

			<button
				onclick={download}
				class="absolute right-4 bottom-4 rounded-lg bg-gradient-to-r from-rose-400 to-amber-400 p-2 shadow-md"
			>
				<IconDownload class="text-white" />
			</button>
		</div>
	{:else}
		<div class="rounded-2xl bg-yellow-50 p-4 text-center shadow-sm">
			<p class="text-gray-600 italic">
				No matchups found yet... But we're sure you'll make some amazing memories soon! 💖
			</p>
		</div>
	{/if}
</div>

<style>
	video {
		max-height: 75svh;
		max-width: 95vw;
	}
</style>
