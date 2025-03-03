<script lang="ts">
	import { compileShader, linkProgram, vertices } from '$lib/client/glsl';
	import { events } from '$lib/client/messages.svelte';
	import { toastStore } from '$lib/client/toast.svelte';
	import { assert } from '$lib/client/util';
	import { EventType } from '$lib/events';
	import { IconToggleLeft, IconToggleRightFilled } from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import FragmentShader from './fragment.glsl?raw';
	import VertexShader from './vertex.glsl?raw';

	let videoRef: HTMLVideoElement;
	let canvasRef: HTMLCanvasElement;
	let stream: MediaStream | null = null;
	let gl: WebGLRenderingContext | null = null;

	let { upload, isUploading }: { upload: (blob: Blob) => Promise<void>; isUploading: boolean } =
		$props();

	let availableCameras = $state<MediaDeviceInfo[]>([]);
	let currentCameraIndex = $state(0);
	let useWebGl = $state(false);
	let webglSupported = $state(false);
	let videoSize = $state({ width: 640, height: 480 });

	let stopRendering = false;
	let shouldCapture = false;

	$effect(() => {
		const shouldTrigger = events.new.find(({ event }) => event.type === EventType.CAPTURE);
		if (shouldTrigger) {
			takePicture();
			shouldTrigger.clear();
		}
	});

	onMount(async () => {
		gl = canvasRef.getContext('webgl2');
		webglSupported = !!gl;
		useWebGl = webglSupported;

		availableCameras = await getAvailableCameras();
		await initializeCamera();
	});

	onDestroy(() => {
		if (stream) {
			stream.getTracks().forEach((track) => track.stop());
		}
	});

	async function getAvailableCameras() {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			return devices.filter((device) => device.kind === 'videoinput');
		} catch (e: any) {
			toastStore.show('Error accessing camera' + (e.message ? `: ${e.message}` : ''));
		}

		return [];
	}

	async function initializeCamera(deviceId?: string) {
		try {
			if (stream) {
				stream.getTracks().forEach((track) => track.stop());
			}

			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					deviceId: deviceId ? { exact: deviceId } : undefined,
					facingMode: deviceId ? undefined : 'environment',
					width: { ideal: 1920 },
					height: { ideal: 1080 }
				}
			});

			if (videoRef) {
				// assert(videoRef, 'Video element is null');
				videoRef.srcObject = stream;
			}

			stopRendering = false;
		} catch (err: any) {
			console.error('Error accessing camera:', err);

			toastStore.show('Error accessing camera' + (err.message ? `: ${err.message}` : ''));
		}
	}

	async function switchCamera() {
		if (!availableCameras.length) {
			return;
		}

		stopRendering = true;

		currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
		await initializeCamera(availableCameras[currentCameraIndex].deviceId);

		startRender();
	}

	async function capture() {
		if (!videoRef || !canvasRef || isUploading) {
			return;
		}

		try {
			isUploading = true;
			stopRendering = true;

			let blob: Blob;

			if (useWebGl) {
				// Capture WebGL canvas
				blob = await new Promise<Blob>((resolve) => {
					canvasRef.toBlob((blob) => {
						if (blob) {
							resolve(blob);
						} else {
							toastStore.show('Error capturing photo');
						}
					});
				});
			} else {
				// draw video frame to canvas
				const canvas = new OffscreenCanvas(videoRef.videoWidth, videoRef.videoHeight);
				const ctx = canvas.getContext('2d');
				assert(ctx, 'Canvas context is null');
				ctx.drawImage(videoRef, 0, 0, canvas.width, canvas.height);
				blob = await canvas.convertToBlob();
			}

			// stop video stream
			if (stream) {
				stream.getTracks().forEach((track) => track.stop());
			}

			upload(blob);
		} catch (error) {
			toastStore.show('Error uploading photo');
			console.error(error);
		} finally {
			isUploading = false;
		}
	}

	function initCanvas() {
		// Set canvas size to match video aspect ratio
		videoSize.width = videoRef.videoWidth;
		videoSize.height = videoRef.videoHeight;

		const width = videoRef.videoWidth;
		const height = videoRef.videoHeight;

		console.log('Setting canvas size to match video:', width, 'x', height);

		const dpr = window.devicePixelRatio || 1;

		// Set the canvas dimensions to match the video's intrinsic size
		canvasRef.width = width * dpr;
		canvasRef.height = height * dpr;
	}

	function startRender() {
		try {
			if (!useWebGl) {
				return;
			}

			assert(canvasRef, 'Canvas element is null');
			initCanvas();

			gl = gl || canvasRef.getContext('webgl2');
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

			gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

			stopRendering = false;

			// Render loop: update texture with video frame and redraw.
			render({ texture, startTime: Date.now(), u_time, fps: 0, second: 0 });

			console.info('WebGL initialized');
		} catch (e: any) {
			toastStore.show('Error when applying filter');
			console.error(e);
		}
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
		if (!useWebGl) {
			return;
		}

		assert(videoRef, 'Video element is null');

		const currentSecond = Math.floor(Date.now() / 1000);
		if (currentSecond !== data.second) {
			if (data.fps < 40) {
				console.log('Low FPS detected: ' + data.fps);
			}
			data.fps = 0;
			data.second = currentSecond;
		}
		data.fps++;

		if (stopRendering) {
			requestAnimationFrame(() => render(data));
			return;
		}

		const { texture, startTime, u_time } = data;

		assert(gl, 'WebGL context is null');
		gl.uniform1f(u_time, Date.now() - startTime);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoRef);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		if (shouldCapture) {
			shouldCapture = false;
			capture();
		}
		requestAnimationFrame(() => render(data));
	}

	function takePicture() {
		if (useWebGl) {
			shouldCapture = true;
		} else {
			capture();
		}
	}

	function handleResize() {
		if (stopRendering || !videoRef || !canvasRef) return;

		// Re-initialize canvas size
		initCanvas();

		// Update WebGL viewport
		if (gl) {
			gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		}
	}
</script>

<svelte:window onresize={handleResize} onorientationchange={handleResize} />

<!-- Camera Preview Container -->
<div class="relative overflow-hidden rounded-3xl border-8 border-white bg-white p-2 shadow-2xl">
	{#if webglSupported}
		<button
			class="absolute top-4 right-4 z-10 rounded-full bg-white p-2 shadow-md hover:shadow-lg focus:ring-0 focus:outline-none"
			onclick={() => {
				useWebGl = !useWebGl;
				startRender();
			}}
		>
			{#if useWebGl}
				<IconToggleRightFilled class="text-pink-500"></IconToggleRightFilled>
			{:else}
				<IconToggleLeft class="opacity-60"></IconToggleLeft>
			{/if}
		</button>
	{/if}

	<!-- Video Preview -->
	<video
		bind:this={videoRef}
		autoplay
		playsinline
		class="w-full rounded-2xl"
		class:hidden={useWebGl}
		aria-hidden="true"
		onloadedmetadata={initCanvas}
		onplaying={startRender}
	>
		<track kind="captions" />
	</video>

	<!-- Hidden Canvas for Photo Processing -->
	<canvas
		bind:this={canvasRef}
		class="w-full rounded-2xl"
		width={videoSize.width}
		height={videoSize.height}
		class:hidden={!useWebGl}
	></canvas>

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
		onclick={takePicture}
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
