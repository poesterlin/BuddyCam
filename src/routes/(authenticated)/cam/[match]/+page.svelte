<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { applyAction, deserialize } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import Camera from './camera.svelte';

	let isUploading = $state(false);

	async function upload(blob: Blob) {
		try {
			isUploading = true;

			// Create FormData and append the blob
			const formData = new FormData();
			formData.append('photo', blob, `photo-${Date.now()}.jpg`);

			// Upload to server
			const response = await fetch('?/capture', {
				method: 'POST',
				body: formData
			});

			const result: ActionResult = deserialize(await response.text());

			if (result.type === 'success') {
				await invalidateAll();
			}

			applyAction(result);
		} catch (error) {
			console.error('Error uploading photo:', error);
			// Show error feedback here
		} finally {
			isUploading = false;
		}
	}
</script>

<div class="min-h-full bg-gradient-to-b from-pink-100 to-purple-200 p-6">
	<div class="main-content mx-auto">
		<!-- Cute Header -->
		<h1 class="mb-8 text-center font-bold">
			<span
				class="block bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-4xl text-transparent"
			>
				✨ Camera ✨
			</span>
			<span class="mt-2 block text-lg text-pink-400"> 📸 Smile! 🌈 </span>
		</h1>

		<Camera {upload} {isUploading}></Camera>
	</div>

	<!-- Cute Footer -->
	<div class="mt-8 text-center text-sm text-pink-400">
		<p class="animate-pulse">💖 Made with love and sparkles 💖</p>
	</div>
</div>

<style>
	.main-content {
		max-width: 90vw;
	}
</style>
