// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		type ValidatedSessionResult = import('$lib/server/auth').SessionValidationResult;

		interface Locals {
			user: ValidatedSessionResult['user'];
			session: ValidatedSessionResult['session'];
		}

		interface PageState {
			showNotifications: boolean;
		}
	}
}

export {};
