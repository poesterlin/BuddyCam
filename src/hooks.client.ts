import { handleErrorWithSentry, replayIntegration } from '@sentry/sveltekit';
import { init } from '@sentry/sveltekit';

init({
	dsn: 'https://6553df36b67b69b498548c602f128991@o4505130185261056.ingest.us.sentry.io/4508938668474368',

	tracesSampleRate: 1.0
});

export const handleError = handleErrorWithSentry();
