import { validateAuth } from '$lib/server/util';
import type { RequestHandler } from '@sveltejs/kit';
import QRCode from 'qrcode';

export const GET: RequestHandler = async (events) => {
	const locals = validateAuth(events);
	const { request } = events;

	const host = request.headers.get('host');
	const url = `https://${host}/friends/request?id=${locals.user.id}`;

	// generate QR code
	const buffer = await new Promise<Buffer>((resolve, reject) => {
		QRCode.toBuffer(
			url,
			{
				scale: 4,
				errorCorrectionLevel: 'H',
				type: 'png',
				color: {
					dark: '#ca70dd',
					light: '#fff'
				}
			},
			(err, buffer) => {
				if (err) reject(err);
				else resolve(buffer);
			}
		);
	});

	return new Response(buffer, {
		headers: {
			'Content-Type': 'image/png'
		}
	});
};
