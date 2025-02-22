<script lang="ts">
	let { data } = $props();
</script>

<div
	class="flex h-screen flex-col items-center justify-center bg-gradient-to-br from-pink-50 to-yellow-50"
>
	<div class="mb-24 max-w-md space-y-6 rounded-3xl bg-white p-8 text-center shadow-xl">
		<h1 class="text-2xl font-bold text-rose-500">
			Accept Friendship Request from
			{data.targetedUser.username}
		</h1>

		<p class="text-lg text-gray-700">Are you sure you want to connect with this awesome person?</p>

		<div class="flex justify-center space-x-4">
			<form action="?/accept" method="POST">
				<button
					class="rounded-full bg-gradient-to-r from-rose-400 to-amber-400 px-6 py-2 font-semibold text-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl focus:ring-2 focus:ring-rose-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					Yes, let's be friends! ✨
				</button>
			</form>

			<form action="?/dismiss" method="POST">
				<button
					class="rounded-full px-6 py-2 font-semibold text-rose-500 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl focus:ring-2 focus:ring-rose-200 focus:outline-none"
				>
					Maybe later... 🥺
				</button>
			</form>
		</div>

		<form action="?/block" method="POST">
			<button class="text-xs text-gray-500 hover:text-gray-700 focus:outline-none">
				Block this user and never see them again
			</button>
		</form>
	</div>
</div>
