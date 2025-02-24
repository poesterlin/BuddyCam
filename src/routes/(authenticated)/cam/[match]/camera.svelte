<script lang="ts">
	import { assert } from '$lib/client/util';
	import { onMount } from 'svelte';
	import { events } from '$lib/client/messages.svelte';
	import { EventType } from '$lib/events';
	import FragmentShader from './fragment.glsl?raw';
	import VertexShader from './vertex.glsl?raw';
	import { compileShader, linkProgram, vertices } from '$lib/client/glsl';

	let videoRef: HTMLVideoElement;
	let canvasRef: HTMLCanvasElement;
	let stream: MediaStream | null = null;
	let gl: WebGLRenderingContext | null = null;

	let availableCameras = $state<MediaDeviceInfo[]>([]);
	let currentCameraIndex = $state(0);
	let stopRendering = $state(false);

	let { upload, isUploading }: { upload: (blob: Blob) => Promise<void>; isUploading: boolean } =
		$props();

	$effect(() => {
		const shouldTrigger = events.new.find(({ event }) => event.type === EventType.CAPTURE);
		if (shouldTrigger) {
			capture();
			shouldTrigger.clear();
		}

		console.log(currentCameraIndex);
		console.log(stopRendering ? 'rendering stopped' : 'rendering allowed');
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

			stopRendering = false;
		} catch (err) {
			console.error('Error accessing camera:', err);
		}
	}

	async function switchCamera() {
		if (!availableCameras.length) {
			return;
		}

		stopRendering = true;

		currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
		await initializeCamera(availableCameras[currentCameraIndex].deviceId);
	}

	async function capture() {
		if (!videoRef || !canvasRef || isUploading) {
			return;
		}

		try {
			isUploading = true;
			assert(gl, 'Canvas context is null');

			stopRendering = true;

			// Convert canvas to blob
			const blob = await new Promise<Blob>((resolve) =>
				canvasRef.toBlob((blob) => resolve(blob!), 'image/jpeg')
			);

			upload(blob);
		} catch (error) {
			console.error('Error uploading photo:', error);
			// Show error feedback here
		} finally {
			isUploading = false;
		}
	}

	function initCanvas() {
		// Set canvas size to match video aspect ratio
		canvasRef.width = videoRef.videoWidth;
		canvasRef.height = videoRef.videoHeight;
	}

	function startRender() {
		assert(canvasRef, 'Canvas element is null');

		gl = canvasRef.getContext('webgl');
		assert(gl, 'WebGL context is null');

		const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VertexShader);
		const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FragmentShader);
		const program = linkProgram(gl, vertexShader, fragmentShader);
		gl.useProgram(program);

		const vertexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
		const FSIZE = vertices.BYTES_PER_ELEMENT;

		// Get attribute locations.
		const a_position = gl.getAttribLocation(program, 'a_position');
		gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, FSIZE * 4, 0);
		gl.enableVertexAttribArray(a_position);
		const a_texCoord = gl.getAttribLocation(program, 'a_texCoord');
		gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, FSIZE * 4, FSIZE * 2);
		gl.enableVertexAttribArray(a_texCoord);

		// Create and configure texture.
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		// Set which texture unit to render with.
		const u_image = gl.getUniformLocation(program, 'u_image');
		gl.uniform1i(u_image, 0);

		// Get the time uniform for animation.
		const u_time = gl.getUniformLocation(program, 'u_time');

		initCanvas();

		stopRendering = false;

		// Render loop: update texture with video frame and redraw.
		render({ texture, startTime: Date.now(), u_time, fps: 0, second: 0 });
	}

	/**
	 * Render loop for WebGL
	 * @param data
	 */
	function render(data: {
		texture: WebGLTexture;
		startTime: number;
		u_time: WebGLUniformLocation | null;
		fps: number;
		second: number;
	}) {
		if (stopRendering) {
			return;
		}

		const currentSecond = Math.floor(Date.now() / 1000);
		if (currentSecond !== data.second) {
			if (data.fps < 60) {
				console.info('FPS dropped:', data.fps);
			}
			data.fps = 0;
			data.second = currentSecond;
		}
		data.fps++;

		const { texture, startTime, u_time } = data;

		assert(gl, 'WebGL context is null');
		gl.uniform1f(u_time, Date.now() - startTime);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoRef);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		requestAnimationFrame(() => render(data));
	}
</script>

<!-- Camera Preview Container -->
<div class="relative overflow-hidden rounded-3xl border-8 border-white bg-white p-2 shadow-2xl">
	<!-- Video Preview -->
	<video
		bind:this={videoRef}
		autoplay
		playsinline
		class="hidden"
		aria-hidden="true"
		onloadedmetadata={initCanvas}
		onplaying={startRender}
	>
		<track kind="captions" />
	</video>

	<!-- Hidden Canvas for Photo Processing -->
	<canvas bind:this={canvasRef} class="w-full rounded-2xl"></canvas>

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
		onclick={capture}
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
			onclick={switchCamera}
			disabled={isUploading}
			class="rounded-full bg-white px-4 py-2 font-bold text-pink-500 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
		>
			🔄 Switch Camera
		</button>
	{/if}
</div>
