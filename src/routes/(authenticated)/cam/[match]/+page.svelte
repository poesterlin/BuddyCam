<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { applyAction, deserialize } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import Camera from './camera.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { EventType, type WebRtcData } from '$lib/events';
	import { events } from '$lib/client/messages.svelte';
	import type { Event } from '$lib/server/db/schema';

	let { data } = $props();
	let isUploading = $state(false);
	let timeDiff = $state(0);
	let peerConnection: RTCPeerConnection | null = null;
	let dataChannel: RTCDataChannel | null = null;
	let isOfferer = false;
	let captureAt = $state(0);

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
	});

	onMount(() => {
		const now = new Date();
		const serverNow = new Date(data?.now ?? now);
		timeDiff = now.getTime() - serverNow.getTime();

		if (timeDiff < 0) {
			console.log('Server time is ahead of client time by', -timeDiff, 'ms');
		} else {
			console.log('Client time is ahead of server time by', timeDiff, 'ms');
		}

		if (data.matchup.userId === data.user.id) {
			console.log('Creating WebRTC offer');
			isOfferer = true;
			createWebRtcOffer();
		}
	});

	onDestroy(() => {
		console.log('Closing WebRTC connection');
		dataChannel?.close();
		peerConnection?.close();
		dataChannel = null;
		peerConnection = null;
	});

	async function upload(blob: Blob) {
		try {
			isUploading = true;

			const formData = new FormData();
			formData.append('photo', blob, `photo-${Date.now()}.jpg`);

			const response = await fetch('?/capture', {
				method: 'POST',
				body: formData
			});

			const result: ActionResult = deserialize(await response.text());

			if (result.type === 'success') {
				await invalidateAll();
			}

			if (result.type === 'error') {
				return;
			}

			applyAction(result);
		} catch (error) {
			console.error('Error uploading photo:', error);
		} finally {
			isUploading = false;
		}
	}

	async function scheduleCapture() {
		const delay = 4000;
		const timestamp = Date.now() + delay;

		if (dataChannel?.readyState === 'open') {
			console.log('Scheduling capture via P2P data channel');
			dataChannel.send(JSON.stringify({ type: 'capture', timestamp }));
			captureAt = timestamp;
		} else {
			console.log('P2P not ready, falling back to server-mediated capture');
			const res = await fetch('?/schedule', { method: 'POST', body: new FormData() });
			if (!res.ok) {
				console.error('Failed to schedule capture via server');
			}
		}
	}

	async function createWebRtcOffer() {
		if (!isOfferer) return;
		peerConnection = makeConnection();

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

		peerConnection = makeConnection();

		peerConnection.onicecandidate = async (event) => {
			if (event.candidate) {
				await sendWebRtcPayload(event.candidate.toJSON());
			} else {
				console.log('[Answerer] All ICE candidates sent');
			}
		};

		await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
		const answer = await peerConnection.createAnswer();
		await peerConnection.setLocalDescription(answer);
		await sendWebRtcPayload(answer);
	}

	async function receiveWebRtcAnswer(answer: RTCSessionDescriptionInit) {
		if (!peerConnection || !isOfferer) return;
		await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
	}

	async function connectWebRtc(candidate: RTCIceCandidateInit) {
		if (!peerConnection) return;
		await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
	}

	function makeConnection() {
		const configuration = {
			iceServers: [
				{ urls: 'stun:stun.l.google.com:19302' },
				{ urls: 'stun:stun1.l.google.com:19302' }
			]
		};

		const connection = new RTCPeerConnection(configuration);

		connection.oniceconnectionstatechange = () => {
			console.log('ICE connection state:', connection.iceConnectionState);
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
		};
		dataChannel.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data);
				if (msg.type === 'capture' && typeof msg.timestamp === 'number') {
					console.log('Received P2P capture trigger, timestamp:', msg.timestamp);
					captureAt = msg.timestamp;
				}
			} catch {
				console.error('Failed to parse data channel message:', event.data);
			}
		};
		dataChannel.onclose = () => {
			console.log('Data channel closed');
		};
		dataChannel.onerror = (error) => {
			console.error('Data channel error:', error);
		};
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

		<Camera {upload} bind:isUploading {timeDiff} {captureAt} onschedule={scheduleCapture}
		></Camera>
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
