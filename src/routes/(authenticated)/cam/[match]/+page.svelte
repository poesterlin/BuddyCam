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

	$inspect(events.new);
	$effect(() => {
		const offerEvent = events.new.find(({ event }: { event: Event<WebRtcData> }) => {
			if (event.type !== EventType.WEBRTC) {
				return false;
			}

			const d: WebRtcData = event.data;
			if (d.payload && 'type' in d.payload) {
				return d.matchId === data.matchup.id && d.payload.type;
			}
			return false;
		});

		if (offerEvent) {
			const { payload }: { payload: RTCSessionDescriptionInit } = offerEvent.event.data;

			if (payload.type === 'offer') {
				console.log('Received WebRTC offer:', payload);
				createWebRtcAnswer(payload);
			} else if (payload.type === 'answer') {
				console.log('Received WebRTC answer:', payload);
				receiveWebRtcAnswer(payload);
			}
			offerEvent.clear();
		}

		const candidateEvent = events.new.find(({ event }: { event: Event<WebRtcData> }) => {
			if (event.type !== EventType.WEBRTC) {
				return false;
			}

			const d: WebRtcData = event.data;
			if (d.payload && 'candidate' in d.payload) {
				return d.matchId === data.matchup.id;
			}
			return false;
		});

		if (candidateEvent) {
			const { data } = candidateEvent.event.data;
			console.log('Received WebRTC candidate:', data);
			connectWebRtc(data);
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

	async function createWebRtcOffer() {
		peerConnection = makeConnection();
		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);

		peerConnection.onicecandidate = async (event) => {
			if (event.candidate) {
				console.log('Sending ICE candidate:', event.candidate);
				// Send the candidate to the server for the other peer
				const response = await fetch(`/cam/${data.matchup.id}/webrtc`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					// Send the candidate object directly
					body: JSON.stringify({ candidate: event.candidate })
				});
				if (!response.ok) {
					console.error('Error sending ICE candidate:', response.statusText);
				}
			} else {
				// End of candidates
				console.log('All local ICE candidates sent');
			}
		};

		// Send the offer to the server
		const response = await fetch(`/cam/${data.matchup.id}/webrtc`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(offer)
		});

		if (!response.ok) {
			console.error('Error sending WebRTC offer:', response.statusText);
		}

		// setup data channel
		dataChannel = peerConnection.createDataChannel('chat');
	}

	async function createWebRtcAnswer(offer: RTCSessionDescriptionInit) {
		if (!peerConnection) {
			peerConnection = makeConnection();
		}

		peerConnection.onicecandidate = async (event) => {
			if (event.candidate) {
				console.log('[Answerer] Sending ICE candidate:', event.candidate);
				const response = await fetch(`/cam/${data.matchup.id}/webrtc`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ candidate: event.candidate })
				});
				if (!response.ok) {
					console.error('[Answerer] Error sending ICE candidate:', response.statusText);
				}
			} else {
				console.log('[Answerer] All local ICE candidates sent');
			}
		};

		// It's good practice to re-assign oniceconnectionstatechange here
		// if makeConnection doesn't handle potential re-creation scenarios perfectly
		peerConnection.oniceconnectionstatechange = () => {
			if (peerConnection) {
				console.log('[Answerer] ICE connection state changed:', peerConnection.iceConnectionState);
			}
		};

		await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
		const answer = await peerConnection.createAnswer();
		await peerConnection.setLocalDescription(answer);

		// Send the answer back to the server
		const response = await fetch(`/cam/${data.matchup.id}/webrtc`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(answer)
		});

		if (!response.ok) {
			console.error('Error sending WebRTC answer:', response.statusText);
		}
	}

	async function receiveWebRtcAnswer(answer: RTCSessionDescriptionInit) {
		if (!peerConnection) {
			throw new Error('Peer connection is not initialized');
		}

		await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
	}

	async function connectWebRtc(candidate: RTCIceCandidateInit) {
		if (!peerConnection) {
			throw new Error('Peer connection is not initialized');
		}

		await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));

		dataChannel?.send('Hello from the other side!');
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
			console.log('ICE connection state changed:', connection.iceConnectionState);
			if (connection.iceConnectionState === 'disconnected') {
				console.log('Peer disconnected');
			}
		};

		connection.ondatachannel = (event) => {
			console.log('ondatachannel event received');
			dataChannel = event.channel;
			setupDataChannelEventHandlers();
		};

		return connection;
	}

	function setupDataChannelEventHandlers() {
		if (!dataChannel) return;
		dataChannel.onopen = () => {
			console.log('Data channel is open');
			dataChannel?.send('Hello from the receiver!');
		};
		dataChannel.onmessage = (event) => {
			console.log('Received message:', event.data);
		};
		dataChannel.onclose = () => {
			console.log('Data channel is closed');
		};
		dataChannel.onerror = (error) => {
			console.error('Data channel error:', error);
		};
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

		<Camera {upload} {isUploading} {timeDiff}></Camera>
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
