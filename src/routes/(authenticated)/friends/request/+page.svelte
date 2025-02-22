<script lang="ts">
	let { data } = $props();
</script>

<div
	class="flex h-screen flex-col items-center justify-center bg-gradient-to-br from-pink-50 to-yellow-50"
>
	<div class="mb-24 max-w-md space-y-6 rounded-3xl bg-white p-8 text-center shadow-xl">
		<h1 class="text-2xl font-bold text-rose-500">
			Send a friend request to {data.targetedUser.username}
		</h1>

		<p class="text-lg text-gray-700">Are you sure you want to connect with this awesome person?</p>

		<div class="flex justify-center space-x-4">
			<form action="?/send" method="POST">
				<input type="hidden" name="target" value={data.targetedUser.id} />
				<button
					class="rounded-full bg-gradient-to-r from-rose-400 to-amber-400 px-6 py-2 font-semibold text-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Yes, let's be friends! ✨
				</button>
			</form>

			<a
				href="/friends"
				class="rounded-full px-6 py-2 font-semibold text-rose-500 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-rose-200"
			>
				Maybe later... 🥺
			</a>
		</div>
	</div>
</div>
