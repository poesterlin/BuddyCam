import type { LayoutServerLoad } from './$types';
import { validateAuth } from '$lib/server/util';

export const load: LayoutServerLoad = async (event) => {
	const locals = validateAuth(event);

	return { user: locals.user };
};
