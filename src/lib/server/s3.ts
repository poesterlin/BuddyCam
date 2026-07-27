import { env } from '$env/dynamic/private';
import sharp from 'sharp';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 20_000_000;

function getStorage() {
	const { MINIO_KEY, MINIO_SECRET, MINIO_URL, MINIO_BUCKET } = env;
	if (!MINIO_KEY || !MINIO_SECRET || !MINIO_URL || !MINIO_BUCKET) {
		throw new Error('MinIO configuration is incomplete');
	}

	const protocol = env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
	const endpoint = new URL(
		MINIO_URL.startsWith('http://') || MINIO_URL.startsWith('https://')
			? MINIO_URL
			: `${protocol}://${MINIO_URL}`
	);

	return {
		client: new Bun.S3Client({
			accessKeyId: MINIO_KEY,
			secretAccessKey: MINIO_SECRET,
			bucket: MINIO_BUCKET,
			endpoint: endpoint.toString(),
			region: env.S3_REGION || 'us-east-1'
		})
	};
}

export async function uploadFile(sha: string, file: File) {
	if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
		throw new Error('Photo must be between 1 byte and 10 MB');
	}
	if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
		throw new Error('Photo must be a JPEG, PNG, or WebP image');
	}

	const input = Buffer.from(await file.arrayBuffer());
	const buffer = await sharp(input, {
		failOn: 'warning',
		limitInputPixels: MAX_INPUT_PIXELS
	})
		.rotate()
		.resize({ width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true })
		.jpeg({ quality: 90, mozjpeg: true })
		.toBuffer();
	const { client } = getStorage();
	await client.write(sha, buffer, { type: 'image/jpeg' });
}

export async function uploadFileFromPath(sha: string, path: string) {
	const { client } = getStorage();
	await client.write(sha, Bun.file(path));
}

export async function downloadFile(sha: string, output: string) {
	const { client } = getStorage();
	await Bun.write(output, client.file(sha));
}

export async function getFileStream(sha: string) {
	const { client } = getStorage();
	return client.file(sha).stream();
}

export async function getFile(sha: string) {
	const { client } = getStorage();
	return Buffer.from(await client.file(sha).arrayBuffer());
}

export async function deleteFile(sha: string) {
	const { client } = getStorage();
	await client.delete(sha);
}

export async function checkStorage() {
	const { client } = getStorage();
	await client.exists(env.S3_HEALTHCHECK_KEY || '.buddycam-healthcheck');
}
