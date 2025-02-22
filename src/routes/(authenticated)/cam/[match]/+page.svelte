<script lang="ts">
	import { onMount } from 'svelte';
	import { EventType } from '$lib/events';
	import { events } from '$lib/client/messages.svelte';
	import { invalidateAll } from '$app/navigation';
	import { applyAction, deserialize } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';

	let videoRef: HTMLVideoElement;
	let canvasRef: HTMLCanvasElement;
	let stream: MediaStream | null = null;
	let availableCameras = $state<MediaDeviceInfo[]>([]);
	let currentCameraIndex = 0;

	let isUploading = $state(false);
	$effect(() => {
		const shouldTrigger = events.new.find(({ event }) => event.type === EventType.CAPTURE);
		if (shouldTrigger) {
			captureAndUpload();
			shouldTrigger.clear();
		}
	});

	onMount(async () => {
		availableCameras = await getAvailableCameras();
		await initializeCamera();
	});

	async function getAvailableCameras() {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter((device) => device.kind === 'videoinput');
	}

	async function initializeCamera(deviceId?: string) {
		try {
			if (stream) {
				stream.getTracks().forEach((track) => track.stop());
			}

			stream = await navigator.mediaDevices.getUserMedia({
				video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
			});

			if (videoRef) {
				videoRef.srcObject = stream;
			}
		} catch (err) {
			console.error('Error accessing camera:', err);
		}
	}

	async function switchCamera() {
		currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
		await initializeCamera(availableCameras[currentCameraIndex].deviceId);
	}

	async function captureAndUpload() {
		if (videoRef && canvasRef && !isUploading) {
			try {
				isUploading = true;
				const context = canvasRef.getContext('2d');
				if (context) {
					canvasRef.width = videoRef.videoWidth;
					canvasRef.height = videoRef.videoHeight;
					context.drawImage(videoRef, 0, 0);

					// Convert canvas to blob
					const blob = await new Promise<Blob>((resolve) =>
						canvasRef.toBlob((blob) => resolve(blob!), 'image/jpeg')
					);

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
				}
			} catch (error) {
				console.error('Error uploading photo:', error);
				// Show error feedback here
			} finally {
				isUploading = false;
			}
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-b from-pink-100 to-purple-200 p-6">
	<div class="mx-auto max-w-md">
		<!-- Cute Header -->
		<h1 class="mb-8 text-center font-bold">
			<span
				class="block bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-4xl text-transparent"
			>
				✨ Camera ✨
			</span>
			<span class="mt-2 block text-lg text-pink-400"> 📸 Smile! 🌈 </span>
		</h1>

		<!-- Camera Preview Container -->
		<div class="relative overflow-hidden rounded-3xl border-8 border-white bg-white p-2 shadow-2xl">
			<!-- Video Preview -->
			<video bind:this={videoRef} autoplay playsinline class="w-full rounded-2xl" aria-hidden>
				<track kind="captions" />
			</video>

			<!-- Loading Overlay -->
			{#if isUploading}
				<div class="absolute inset-0 flex items-center justify-center bg-white/80">
					<div class="text-center">
						<div class="animate-bounce text-4xl">📤</div>
						<p class="mt-2 font-bold text-pink-500">Uploading...</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Controls -->
		<div class="mt-8 flex flex-col items-center gap-4">
			<!-- Capture Button -->
			<button
				on:click={captureAndUpload}
				disabled={isUploading}
				class="relative rounded-full bg-gradient-to-r from-rose-400 to-amber-400 px-6 py-3 text-xl font-extrabold text-white shadow-md transition-all duration-300 before:absolute before:inset-0 before:z-[-1] before:rounded-full before:bg-gradient-to-br before:from-purple-500 before:to-teal-500 before:opacity-0 before:transition-opacity before:duration-500 hover:scale-110 hover:rotate-3 hover:brightness-120 hover:before:opacity-100 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isUploading}
					📤 Uploading...
				{:else}
					📸 Capture!
				{/if}
			</button>

			<!-- Switch Camera Button - Only shown if multiple cameras are available -->
			{#if availableCameras.length > 1}
				<button
					on:click={switchCamera}
					disabled={isUploading}
					class="rounded-full bg-white px-4 py-2 font-bold text-pink-500 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
				>
					🔄 Switch Camera
				</button>
			{/if}
		</div>

		<!-- Hidden Canvas for Photo Processing -->
		<canvas bind:this={canvasRef} class="hidden"></canvas>
	</div>

	<!-- Cute Footer -->
	<div class="mt-8 text-center text-sm text-pink-400">
		<p class="animate-pulse">💖 Made with love and sparkles 💖</p>
	</div>
</div>

<style>
	/* Add any additional custom styles here */
	:global(body) {
		overflow-x: hidden;
	}
</style>
