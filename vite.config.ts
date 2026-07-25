import { sentrySvelteKit } from '@sentry/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	return {
		plugins: [
			...(env.SENTRY_AUTH_TOKEN ? [sentrySvelteKit({ authToken: env.SENTRY_AUTH_TOKEN })] : []),
			sveltekit(),
			tailwindcss()
		]
	};
});
