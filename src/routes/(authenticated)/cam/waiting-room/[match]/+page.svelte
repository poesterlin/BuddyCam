<div
	class="flex h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-pink-50 to-yellow-50"
>
	<div class="rounded-3xl bg-white p-8 text-center shadow-xl">
		<p class="text-2xl font-semibold text-rose-500">Waiting for a friend to join 💖</p>
		<p>Just a moment...</p>

		<div class="relative flex justify-center">
			<img src="/loading.gif" class="m-auto" />
			<div
				class="bounce absolute inset-0 m-auto h-8 w-8 translate-y-1 rounded-full bg-pink-200/50"
			></div>
		</div>
	</div>
</div>

<style>
	/* Custom animation for the bouncing loader */
	@keyframes bounce {
		0% {
			transform: translateY(0);
		}
		35% {
			transform: translateY(-0.5rem); /* Adjust bounce height */
		}
		100% {
			transform: translateY(0);
		}
	}

	.bounce {
		animation: bounce 1.5s infinite ease-in-out;
		tranform-origin: center;
	}
</style>
