<script lang="ts">
	import { onMount } from 'svelte';
	import { IconX } from '@tabler/icons-svelte';
	import { fade } from 'svelte/transition';

	let dialogEl: HTMLDialogElement;

	onMount(() => {
		dialogEl.showModal();
	});

	const { close, children, title } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogEl}
	class="min-w-lg m-auto rounded-2xl bg-white"
	onclick={close}
	out:fade={{ duration: 300 }}
>
	<form method="dialog" onsubmit={close} class="relative overflow-hidden px-6 py-4">
		<h1 class="text-lg font-bold text-rose-600">{title}</h1>
		<button
			type="button"
			onclick={close}
			class="absolute right-4 top-5 text-gray-400 hover:text-gray-600 focus:outline-none"
			aria-label="Close"
		>
			<IconX class="text-purple-800" />
		</button>
	</form>

	<div class="px-2 py-4">
		{@render children()}
	</div>
</dialog>

<style>
	dialog::backdrop {
		background-color: hsla(351, 40%, 86%, 0.4);
		backdrop-filter: blur(2px);
		pointer-events: all;
	}

	dialog[open] {
		animation: fadeIn 0.3s ease-out forwards;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-50px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
