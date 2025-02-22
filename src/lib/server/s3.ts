import { env } from '$env/dynamic/private';
import { Client } from 'minio';

const { MINIO_KEY, MINIO_SECRET, MINIO_URL, MINIO_BUCKET, MINIO_PORT } = env;

const client = new Client({
	endPoint: MINIO_URL,
	port: parseInt(MINIO_PORT),
	accessKey: MINIO_KEY,
	secretKey: MINIO_SECRET,
	useSSL: false
});

export async function uploadFile(sha: string, file: File) {
	const buffer = Buffer.from(await file.arrayBuffer());
	const metaData = { 'content-type': file.type };
	await client.putObject(MINIO_BUCKET, sha, buffer, undefined, metaData);
}

export async function uploadFileFromPath(sha: string, path: string) {
	await client.fPutObject(MINIO_BUCKET, sha, path);
}

export async function downloadFile(sha: string, output: string) {
	await client.fGetObject(MINIO_BUCKET, sha, output);
}

export async function getFile(sha: string) {
	const stream = await client.getObject(MINIO_BUCKET, sha);
	return readStreamToBuffer(stream);
}

export function readStreamToBuffer(readable: any) {
	return new Promise<Buffer>((resolve, reject) => {
		const chunks: Buffer[] = [];
		readable.on('data', (chunk: Buffer) => {
			chunks.push(chunk);
		});
		readable.on('end', () => {
			resolve(Buffer.concat(chunks));
		});
		readable.on('error', reject);
	});
}
