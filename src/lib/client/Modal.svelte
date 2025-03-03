<script lang="ts">
	import { onMount } from 'svelte';
	import { IconX } from '@tabler/icons-svelte';
	import { fly } from 'svelte/transition';
	import { quintIn } from 'svelte/easing';

	let dialogEl: HTMLDialogElement;

	onMount(() => {
		dialogEl.showModal();
	});

	const { close, children, title, icon } = $props();

	function onlySelf(fn: () => void) {
		return (event: MouseEvent) => {
			if (event.target === dialogEl) {
				fn();
			}
		};
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogEl}
	class="m-auto w-lg rounded-2xl bg-white"
	onclick={onlySelf(close)}
	in:fly={{ duration: 350, y: -400, easing: quintIn }}
	out:fly={{ duration: 250, y: -400, easing: quintIn }}
>
	<form method="dialog" onsubmit={close} class="relative overflow-hidden px-6 py-4">
		<h1 class="text-lg font-bold text-rose-600">{title}</h1>

		{#if icon}
			{@render icon()}
		{/if}

		<button
			type="button"
			onclick={close}
			class="absolute top-5 right-4 text-gray-400 hover:text-gray-600 focus:outline-none"
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

	dialog {
		max-width: 95vw;
	}
</style>
