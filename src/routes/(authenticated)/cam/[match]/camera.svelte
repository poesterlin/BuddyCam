<script lang="ts">
	import { compileShader, linkProgram, vertices } from '$lib/client/glsl';
	import { events } from '$lib/client/messages.svelte';
	import { toastStore } from '$lib/client/toast.svelte';
	import { assert } from '$lib/client/util';
	import { EventType, type CaptureData } from '$lib/events';
	import { IconLoader3, IconToggleLeft, IconToggleRightFilled } from '@tabler/icons-svelte';
	import { onDestroy, onMount } from 'svelte';
	import FragmentShader from './fragment.glsl?raw';
	import VertexShader from './vertex.glsl?raw';
	import { enhance } from '$app/forms';

	let videoRef = $state<HTMLVideoElement>(undefined as any);
	let canvasRef = $state<HTMLCanvasElement>(undefined as any);
	let stream: MediaStream | null = null;
	let gl: WebGLRenderingContext | null = null;

	let { upload, isUploading }: { upload: (blob: Blob) => Promise<void>; isUploading: boolean } =
		$props();

	let availableCameras = $state<MediaDeviceInfo[]>([]);
	let currentCameraIndex = $state(0);
	let useWebGl = $state(false);
	let webglSupported = $state(false);
	let videoSize = $state({ width: 640, height: 480 });
	let timestamp = $state(0);
	let now = $state(0);

	let stopRendering = false;
	let shouldCapture = false;

	$effect(() => {
		const shouldTrigger = events.new.find(({ event }) => event.type === EventType.CAPTURE);
		if (shouldTrigger) {
			// set timestamp to trigger image capture
			const data = shouldTrigger.event.data as CaptureData;
			timestamp = data.timestamp;

			const timeRemaining = Math.max(timestamp - now, 300);
			setTimeout(() => {
				takePicture();
			}, timeRemaining);

			shouldTrigger.clear();
		}
	});

	onMount(() => {
		gl = canvasRef.getContext('webgl2');
		webglSupported = !!gl;
		useWebGl = webglSupported;

		const initCams = async () => {
			availableCameras = await getAvailableCameras();
			await initializeCamera();
		};

		initCams();

		return startTimeUpdateLoop();
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
			console.warn('Cannot capture photo');
			return;
		}

		try {
			isUploading = true;
			stopRendering = true;

			const canvas = new OffscreenCanvas(videoRef.videoWidth, videoRef.videoHeight);
			const ctx = canvas.getContext('2d');
			assert(ctx, 'Canvas context is null');
			ctx.drawImage(useWebGl ? canvasRef : videoRef, 0, 0, canvas.width, canvas.height);
			const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });

			// stop video stream
			if (stream) {
				stream.getTracks().forEach((track) => track.stop());
			}

			if (location.href.endsWith('/debug')) {
				const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB';
				console.log('Recorded blob of size:', toMB(blob.size));
				const url = URL.createObjectURL(blob);
				window.open(url, '_blank');
				return;
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
		if (!useWebGl || !videoRef) {
			return;
		}

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

	function startTimeUpdateLoop() {
		now = Date.now();

		// Update time every second
		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => clearInterval(interval);
	}

	function debug(event: KeyboardEvent) {
		if (event.key === 'd') {
			takePicture();
		}
	}
</script>

<svelte:window onresize={handleResize} onorientationchange={handleResize} onkeyup={debug} />

<!-- Camera Preview Container -->
<div class="relative overflow-hidden rounded-3xl border-8 border-white bg-white p-2 shadow-2xl">
	{#if webglSupported}
		<button
			class="absolute right-4 top-4 z-10 rounded-full bg-white p-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-0"
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

	<!-- Countdown Overlay -->
	{#if timestamp && timestamp - now > 0}
		<div class="absolute inset-0 flex items-center justify-center bg-white/10">
			<span class="animate-bounce text-4xl">
				{Math.ceil((timestamp - now) / 1000)}
			</span>
		</div>
	{/if}
</div>

<!-- Controls -->
<div class="mt-8 flex flex-col items-center gap-4">
	<!-- Capture Button -->
	{#if isUploading}
		<button
			disabled
			class="rounded-full bg-gradient-to-r from-rose-400 to-amber-400 px-6 py-3 text-xl font-extrabold text-white shadow-md transition-all duration-300"
		>
			📸 Uploading...

			<div class="h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-rose-500">
				<IconLoader3></IconLoader3>
			</div>
		</button>
	{:else}
		<form action="?/schedule" method="POST" use:enhance>
			<input type="hidden" name="type" value="capture" />
			<button
				disabled={isUploading || !videoRef || !canvasRef || timestamp !== 0}
				type="submit"
				class="hover:brightness-120 relative rounded-full bg-gradient-to-r from-rose-400 to-amber-400 px-6 py-3 text-xl font-extrabold text-white shadow-md transition-all duration-300 before:absolute before:inset-0 before:z-[-1] before:rounded-full before:bg-gradient-to-br before:from-purple-500 before:to-teal-500 before:opacity-0 before:transition-opacity before:duration-500 hover:rotate-3 hover:scale-110 hover:before:opacity-100 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
			>
				📸 Smile!
			</button>
		</form>
	{/if}

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
