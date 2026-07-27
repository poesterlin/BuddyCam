<script lang="ts">
	import { applyAction, deserialize } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import Camera from './camera.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { EventType, type RecordedData, type WebRtcData } from '$lib/events';
	import { events } from '$lib/client/messages.svelte';
	import type { Event } from '$lib/server/db/schema';
	import {
		deleteCapture,
		getCapture,
		saveCapture,
		type StoredCapture
	} from '$lib/client/capture-storage';

	let { data } = $props();
	let isUploading = $state(false);
	let peerConnection: RTCPeerConnection | null = null;
	let dataChannel: RTCDataChannel | null = null;
	let isOfferer = false;
	let captureRequest = $state<{ id: string; targetMono: number } | null>(null);
	let serverToMonoOffset = $state<number | null>(null);
	let clockSamples: { rtt: number; offset: number }[] = [];
	let pendingIceCandidates: RTCIceCandidateInit[] = [];
	let clockSyncInterval: ReturnType<typeof setInterval> | undefined;
	let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
	let captureAckTimer: ReturnType<typeof setTimeout> | undefined;
	let pendingCapture:
		{ message: Extract<PeerMessage, { type: 'capture' }>; localTarget: number } | undefined;
	let destroyed = false;
	let activeAttemptId = $state<string | null>(null);
	let localBlob = $state<Blob | null>(null);
	let peerRecordedAttempt = $state<string | null>(null);
	let capturePhase = $state<
		'ready' | 'scheduled' | 'waiting' | 'timed-out' | 'uploading' | 'error'
	>('ready');
	let confirmationTimer: ReturnType<typeof setTimeout> | undefined;

	type PeerMessage =
		| { type: 'clock-ping'; id: string; t0: number }
		| { type: 'clock-pong'; id: string; t0: number; t1: number; t2: number }
		| { type: 'capture'; id: string; targetMono: number; leadMs: number }
		| { type: 'capture-ack'; id: string; targetMono: number }
		| { type: 'recorded'; attemptId: string };

	$effect(() => {
		const offerEvent = events.new.find(({ event }: { event: Event<WebRtcData> }) => {
			if (event.type !== EventType.WEBRTC) return false;
			const d: WebRtcData = event.data;
			if (d.payload && 'type' in d.payload) {
				return d.matchId === data.matchup.id && d.payload.type;
			}
			return false;
		});

		if (offerEvent) {
			const { payload }: { payload: RTCSessionDescriptionInit } = offerEvent.event.data;
			if (payload.type === 'offer') {
				console.log('Received WebRTC offer');
				createWebRtcAnswer(payload);
			} else if (payload.type === 'answer') {
				console.log('Received WebRTC answer');
				receiveWebRtcAnswer(payload);
			}
			offerEvent.clear();
		}

		const candidateEvent = events.new.find(({ event }: { event: Event<WebRtcData> }) => {
			if (event.type !== EventType.WEBRTC) return false;
			const d: WebRtcData = event.data;
			if (d.payload && 'candidate' in d.payload) {
				return d.matchId === data.matchup.id;
			}
			return false;
		});

		if (candidateEvent) {
			const { payload } = candidateEvent.event.data;
			console.log('Received WebRTC ICE candidate');
			connectWebRtc(payload as RTCIceCandidateInit);
			candidateEvent.clear();
		}

		const recordedEvent = events.new.find(({ event }: { event: Event<RecordedData> }) => {
			return (
				event.type === EventType.RECORDED &&
				event.data.matchId === data.matchup.id &&
				typeof event.data.attemptId === 'string'
			);
		});
		if (recordedEvent) {
			confirmPeerRecorded(recordedEvent.event.data.attemptId);
			recordedEvent.clear();
		}
	});

	onMount(() => {
		calibrateServerClock();
		restoreCapture();

		if (data.matchup.userId === data.user.id) {
			console.log('Creating WebRTC offer');
			isOfferer = true;
			createWebRtcOffer();
		}
	});

	onDestroy(() => {
		destroyed = true;
		clearInterval(clockSyncInterval);
		clearTimeout(reconnectTimer);
		clearTimeout(captureAckTimer);
		clearTimeout(confirmationTimer);
		console.log('Closing WebRTC connection');
		dataChannel?.close();
		peerConnection?.close();
		dataChannel = null;
		peerConnection = null;
	});

	async function upload(blob: Blob, attemptId: string) {
		try {
			isUploading = true;

			const formData = new FormData();
			formData.append('photo', blob, `photo-${Date.now()}.jpg`);
			formData.append('attemptId', attemptId);

			const response = await fetch('?/capture', {
				method: 'POST',
				body: formData
			});

			const result: ActionResult = deserialize(await response.text());

			if (result.type === 'error') {
				capturePhase = 'error';
				return;
			}

			await deleteCapture(data.matchup.id).catch(() => undefined);
			applyAction(result);
		} catch (error) {
			console.error('Error uploading photo:', error);
			capturePhase = 'error';
		} finally {
			isUploading = false;
		}
	}

	async function onRecorded(blob: Blob, attemptId: string) {
		activeAttemptId = attemptId;
		localBlob = blob;
		const peerRecorded = peerRecordedAttempt === attemptId;
		capturePhase = 'waiting';
		await saveCapture({
			matchId: data.matchup.id,
			attemptId,
			blob,
			peerRecorded,
			createdAt: Date.now()
		}).catch((error) => console.warn('Could not persist capture locally:', error));

		sendPeerMessage({ type: 'recorded', attemptId });
		startConfirmationTimer();
		reportRecorded(attemptId);
		await uploadWhenBothRecorded();
	}

	async function reportRecorded(attemptId: string) {
		const formData = new FormData();
		formData.append('attemptId', attemptId);
		try {
			const response = await fetch('?/recorded', {
				method: 'POST',
				body: formData,
				signal: AbortSignal.timeout(5000)
			});
			if (!response.ok) console.error('Failed to report recorded photo');
		} catch (error) {
			console.warn('Recorded confirmation could not reach the server:', error);
		}
	}

	function confirmPeerRecorded(attemptId: string) {
		if (activeAttemptId && activeAttemptId !== attemptId) return;
		peerRecordedAttempt = attemptId;
		if (activeAttemptId !== attemptId) return;
		clearTimeout(confirmationTimer);
		const stored: StoredCapture | null = localBlob
			? {
					matchId: data.matchup.id,
					attemptId,
					blob: localBlob,
					peerRecorded: true,
					createdAt: Date.now()
				}
			: null;
		if (stored) saveCapture(stored).catch(() => undefined);
		uploadWhenBothRecorded();
	}

	async function uploadWhenBothRecorded() {
		if (
			!localBlob ||
			!activeAttemptId ||
			peerRecordedAttempt !== activeAttemptId ||
			capturePhase === 'uploading'
		) {
			return;
		}
		capturePhase = 'uploading';
		clearTimeout(confirmationTimer);
		await upload(localBlob, activeAttemptId);
	}

	function startConfirmationTimer() {
		clearTimeout(confirmationTimer);
		confirmationTimer = setTimeout(() => {
			if (capturePhase === 'waiting') capturePhase = 'timed-out';
		}, 12_000);
	}

	function keepWaiting() {
		capturePhase = 'waiting';
		startConfirmationTimer();
	}

	async function restoreCapture() {
		try {
			const stored = await getCapture(data.matchup.id);
			if (!stored) return;
			activeAttemptId = stored.attemptId;
			localBlob = stored.blob;
			if (stored.peerRecorded) peerRecordedAttempt = stored.attemptId;
			capturePhase = stored.peerRecorded ? 'uploading' : 'waiting';
			sendPeerMessage({ type: 'recorded', attemptId: stored.attemptId });
			reportRecorded(stored.attemptId);
			if (stored.peerRecorded) {
				capturePhase = 'waiting';
				await uploadWhenBothRecorded();
			} else {
				startConfirmationTimer();
			}
		} catch (error) {
			console.warn('Could not restore local capture:', error);
		}
	}

	function beginAttempt(attemptId: string) {
		if (activeAttemptId === attemptId && capturePhase !== 'ready') return;
		const peerAlreadyRecorded = peerRecordedAttempt === attemptId;
		activeAttemptId = attemptId;
		localBlob = null;
		peerRecordedAttempt = peerAlreadyRecorded ? attemptId : null;
		capturePhase = 'scheduled';
		clearTimeout(confirmationTimer);
		deleteCapture(data.matchup.id).catch(() => undefined);
	}

	async function retakeTogether() {
		activeAttemptId = null;
		localBlob = null;
		peerRecordedAttempt = null;
		capturePhase = 'ready';
		await deleteCapture(data.matchup.id).catch(() => undefined);
		await scheduleCapture();
	}

	async function scheduleCapture() {
		if (dataChannel?.readyState === 'open') {
			const delay = adaptiveCaptureLead();
			const id = crypto.randomUUID();
			const localTarget = performance.now() + delay;
			const targetMono = localTarget + peerClockOffset();
			const message = { type: 'capture', id, targetMono, leadMs: delay } as const;
			console.log('Scheduling capture via P2P data channel');
			beginAttempt(id);
			pendingCapture = { message, localTarget };
			sendCaptureUntilAcknowledged();
			captureRequest = { id, targetMono: localTarget };
		} else {
			console.log('P2P not ready, falling back to server-mediated capture');
			capturePhase = 'scheduled';
			const res = await fetch('?/schedule', { method: 'POST', body: new FormData() });
			if (!res.ok) {
				console.error('Failed to schedule capture via server');
				capturePhase = 'ready';
			}
		}
	}

	async function createWebRtcOffer() {
		if (!isOfferer) return;
		peerConnection = await makeConnection();

		peerConnection.onicecandidate = async (event) => {
			if (event.candidate) {
				await sendWebRtcPayload(event.candidate.toJSON());
			} else {
				console.log('[Offerer] All ICE candidates sent');
			}
		};

		dataChannel = peerConnection.createDataChannel('cam');
		setupDataChannelEventHandlers();

		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		await sendWebRtcPayload(offer);
	}

	async function createWebRtcAnswer(offer: RTCSessionDescriptionInit) {
		if (isOfferer) return;

		peerConnection = await makeConnection();

		peerConnection.onicecandidate = async (event) => {
			if (event.candidate) {
				await sendWebRtcPayload(event.candidate.toJSON());
			} else {
				console.log('[Answerer] All ICE candidates sent');
			}
		};

		await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
		await flushIceCandidates();
		const answer = await peerConnection.createAnswer();
		await peerConnection.setLocalDescription(answer);
		await sendWebRtcPayload(answer);
	}

	async function receiveWebRtcAnswer(answer: RTCSessionDescriptionInit) {
		if (!peerConnection || !isOfferer) return;
		await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
		await flushIceCandidates();
	}

	async function connectWebRtc(candidate: RTCIceCandidateInit) {
		if (!peerConnection || !peerConnection.remoteDescription) {
			pendingIceCandidates.push(candidate);
			return;
		}
		try {
			await peerConnection.addIceCandidate(candidate);
		} catch (error) {
			console.error('Failed to add ICE candidate:', error);
		}
	}

	async function makeConnection() {
		const iceServers: RTCIceServer[] = [
			{ urls: 'stun:stun.l.google.com:19302' },
			{ urls: 'stun:stun1.l.google.com:19302' }
		];
		try {
			const response = await fetch(`/cam/${data.matchup.id}/webrtc?credentials=1`, {
				cache: 'no-store'
			});
			if (response.ok) {
				const cloudflare = (await response.json()) as { iceServers?: RTCIceServer[] };
				if (cloudflare.iceServers?.length) iceServers.push(...cloudflare.iceServers);
			} else {
				console.warn('TURN credentials unavailable:', response.status);
			}
		} catch (error) {
			console.warn('TURN credential request failed; continuing with STUN:', error);
		}

		const connection = new RTCPeerConnection({ iceServers });

		connection.oniceconnectionstatechange = () => {
			console.log('ICE connection state:', connection.iceConnectionState);
			if (connection.iceConnectionState === 'failed' && isOfferer) {
				restartIce();
			}
		};

		if (!isOfferer) {
			connection.ondatachannel = (event) => {
				console.log('Data channel received by answerer');
				dataChannel = event.channel;
				setupDataChannelEventHandlers();
			};
		}

		return connection;
	}

	function setupDataChannelEventHandlers() {
		if (!dataChannel) return;
		dataChannel.onopen = () => {
			console.log('Data channel open');
			clockSamples = [];
			for (let i = 0; i < 8; i++) setTimeout(sendClockPing, i * 150);
			clearInterval(clockSyncInterval);
			clockSyncInterval = setInterval(sendClockPing, 5000);
		};
		dataChannel.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data) as PeerMessage;
				handlePeerMessage(msg);
			} catch {
				console.error('Failed to parse data channel message:', event.data);
			}
		};
		dataChannel.onclose = () => {
			console.log('Data channel closed');
			clearInterval(clockSyncInterval);
		};
		dataChannel.onerror = (error) => {
			console.error('Data channel error:', error);
		};
	}

	function sendPeerMessage(message: PeerMessage) {
		if (dataChannel?.readyState === 'open') dataChannel.send(JSON.stringify(message));
	}

	function sendClockPing() {
		sendPeerMessage({ type: 'clock-ping', id: crypto.randomUUID(), t0: performance.now() });
	}

	function handlePeerMessage(msg: PeerMessage) {
		if (msg.type === 'clock-ping') {
			const t1 = performance.now();
			sendPeerMessage({ type: 'clock-pong', id: msg.id, t0: msg.t0, t1, t2: performance.now() });
			return;
		}
		if (msg.type === 'clock-pong') {
			const t3 = performance.now();
			const rtt = Math.max(0, t3 - msg.t0 - (msg.t2 - msg.t1));
			const offset = (msg.t1 - msg.t0 + (msg.t2 - t3)) / 2;
			clockSamples = [...clockSamples, { rtt, offset }].sort((a, b) => a.rtt - b.rtt).slice(0, 12);
			return;
		}
		if (msg.type === 'capture') {
			const remaining = msg.targetMono - performance.now();
			if (remaining < 150) {
				console.warn('Ignoring capture request that arrived after its safe deadline');
				return;
			}
			beginAttempt(msg.id);
			captureRequest = { id: msg.id, targetMono: msg.targetMono };
			sendPeerMessage({ type: 'capture-ack', id: msg.id, targetMono: msg.targetMono });
			return;
		}
		if (msg.type === 'capture-ack') {
			console.log('Peer armed capture', msg.id);
			if (pendingCapture?.message.id === msg.id) {
				pendingCapture = undefined;
				clearTimeout(captureAckTimer);
			}
			return;
		}
		if (msg.type === 'recorded') {
			confirmPeerRecorded(msg.attemptId);
		}
	}

	function sendCaptureUntilAcknowledged() {
		if (!pendingCapture) return;
		const remaining = pendingCapture.localTarget - performance.now();
		if (remaining < 500) {
			console.warn('Peer did not acknowledge capture before the deadline');
			pendingCapture = undefined;
			return;
		}
		sendPeerMessage(pendingCapture.message);
		clearTimeout(captureAckTimer);
		captureAckTimer = setTimeout(sendCaptureUntilAcknowledged, Math.min(500, remaining / 4));
	}

	function peerClockOffset() {
		if (!clockSamples.length) return 0;
		const best = clockSamples.slice(0, Math.min(5, clockSamples.length));
		return best.reduce((sum, sample) => sum + sample.offset, 0) / best.length;
	}

	function adaptiveCaptureLead() {
		const bestRtt = clockSamples[0]?.rtt ?? 750;
		const offsets = clockSamples.slice(0, 5).map((sample) => sample.offset);
		const uncertainty = offsets.length ? Math.max(...offsets) - Math.min(...offsets) : 500;
		return Math.min(12000, Math.max(4000, bestRtt * 8 + uncertainty * 4 + 1000));
	}

	async function calibrateServerClock() {
		const samples: { rtt: number; offset: number }[] = [];
		for (let i = 0; i < 5; i++) {
			const start = performance.now();
			try {
				const response = await fetch(`/cam/${data.matchup.id}/webrtc?clock=1`, {
					cache: 'no-store'
				});
				const { now } = await response.json();
				const end = performance.now();
				samples.push({ rtt: end - start, offset: now - (start + end) / 2 });
			} catch (error) {
				console.warn('Server clock calibration failed:', error);
			}
		}
		const best = samples.sort((a, b) => a.rtt - b.rtt)[0];
		if (best) serverToMonoOffset = best.offset;
	}

	async function flushIceCandidates() {
		const candidates = pendingIceCandidates;
		pendingIceCandidates = [];
		for (const candidate of candidates) await connectWebRtc(candidate);
	}

	async function restartIce() {
		if (!peerConnection || destroyed) return;
		clearTimeout(reconnectTimer);
		reconnectTimer = setTimeout(async () => {
			if (!peerConnection || destroyed) return;
			try {
				peerConnection.restartIce();
				const offer = await peerConnection.createOffer({ iceRestart: true });
				await peerConnection.setLocalDescription(offer);
				await sendWebRtcPayload(offer);
			} catch (error) {
				console.error('ICE restart failed:', error);
			}
		}, 1000);
	}

	async function sendWebRtcPayload(payload: WebRtcData['payload']) {
		const res = await fetch(`/cam/${data.matchup.id}/webrtc`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!res.ok) {
			console.error('Error sending WebRTC payload:', res.statusText);
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

		<Camera
			onrecorded={onRecorded}
			bind:isUploading
			{serverToMonoOffset}
			{captureRequest}
			canSchedule={capturePhase === 'ready'}
			onschedule={scheduleCapture}
		></Camera>

		{#if capturePhase === 'scheduled'}
			<p class="mt-4 text-center font-semibold text-purple-600">Both cameras are preparing…</p>
		{:else if capturePhase === 'waiting'}
			<p class="mt-4 text-center font-semibold text-purple-600">
				Your photo is safe. Waiting for the other camera…
			</p>
		{:else if capturePhase === 'uploading'}
			<p class="mt-4 text-center font-semibold text-purple-600">Both photos recorded. Uploading…</p>
		{:else if capturePhase === 'timed-out' || capturePhase === 'error'}
			<div class="mt-4 rounded-2xl bg-white/80 p-4 text-center shadow">
				<p class="font-semibold text-rose-600">
					{capturePhase === 'timed-out'
						? 'The other camera did not confirm this photo.'
						: 'The upload failed. Your photo is still saved on this device.'}
				</p>
				<div class="mt-3 flex justify-center gap-3">
					<button
						onclick={retakeTogether}
						class="rounded-full bg-rose-400 px-4 py-2 font-bold text-white"
					>
						Retake together
					</button>
					{#if capturePhase === 'timed-out'}
						<button
							onclick={keepWaiting}
							class="rounded-full bg-purple-200 px-4 py-2 font-bold text-purple-700"
						>
							Keep waiting
						</button>
					{:else if localBlob && activeAttemptId}
						<button
							onclick={() => uploadWhenBothRecorded()}
							class="rounded-full bg-purple-200 px-4 py-2 font-bold text-purple-700"
						>
							Retry upload
						</button>
					{/if}
				</div>
			</div>
		{/if}
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
