<script lang="ts">
	import { toastStore } from '$lib/client/toast.svelte';
	import { slide } from 'svelte/transition';
	import CameraPage from '../(authenticated)/cam/[match]/+page.svelte';
</script>

<CameraPage />

{#each toastStore.toasts as toast, i (toast.id)}
	<div
		class="fixed right-4 bottom-4 z-50"
		in:slide={{ duration: 300 }}
		out:slide={{ duration: 300 }}
		style="translate: 0 {i * -4}rem;"
	>
		<div
			class="animate-slide-in rounded-xl border-l-4 border-rose-400 bg-pink-50 p-4 text-gray-700 shadow-lg"
			style="min-width: 300px"
		>
			<p class="text-sm font-semibold">{toast.message}</p>
		</div>
	</div>
{/each}
