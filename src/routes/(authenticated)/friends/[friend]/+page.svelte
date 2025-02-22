<script lang="ts">
	let { data } = $props();
</script>

{#each data.matchups as matchup}
	{matchup.id}
{/each}

<video src="/friends/{data.friend.id}/video">
	<track kind="captions" src="/friends/{data.friend.id}/captions.vtt" srclang="en" label="English">
</video>
