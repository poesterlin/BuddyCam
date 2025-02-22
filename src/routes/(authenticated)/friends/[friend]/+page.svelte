<script lang="ts">
	import { IconDownload, IconShare } from '@tabler/icons-svelte';

	let { data } = $props();

	function download() {
		const a = document.createElement('a');
		a.href = `/friends/${data.friend.id}/video`;
		a.download = `${data.friend.username}_and_${data.user.username}.mp4`;
		a.click();
	}
</script>

<div class="flex flex-col items-center justify-center space-y-24">
	<h1 class="mt-24 text-3xl font-extrabold text-rose-500">
		🌟 {data.friend.username} & {data.user.username} 🌟
	</h1>

	{#if data.matchups > 0}
		<div class="relative overflow-hidden rounded-lg">
			<!-- svelte-ignore a11y_media_has_caption -->
			<!-- svelte-ignore element_invalid_self_closing_tag -->
			<video
				src="/friends/{data.friend.id}/video"
				muted
				autoplay
				loop
				playsinline
				class=" h-full w-full object-cover"
			>
			</video>

			<button onclick={download}>
				<IconDownload class="absolute right-4 bottom-4 h-8 w-8 text-white" />
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
		max-height: 50svh;
		max-width: 95vw;
	}
</style>
