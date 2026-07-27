import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { PassThrough, Readable } from 'node:stream';

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export interface ImagePair {
	first: Buffer;
	second: Buffer;
}

interface ImageDimensions {
	width: number;
	height: number;
	aspectRatio: number;
}

enum MergeDirection {
	HORIZONTAL = 'horizontal',
	VERTICAL = 'vertical'
}

interface ProcessingOptions {
	fps?: number;
	preset?: string;
	crf?: number;
	timeout?: number;
}

export class ImageVideoProcessor {
	private readonly fps: number;
	private readonly preset: string;
	private readonly crf: number;
	private readonly timeout: number;

	constructor({
		fps = 24,
		preset = 'ultrafast',
		crf = 28,
		timeout = 120_000
	}: ProcessingOptions = {}) {
		this.fps = fps;
		this.preset = preset;
		this.crf = crf;
		this.timeout = timeout;
	}

	private async getImageDimensions(image: Buffer): Promise<ImageDimensions> {
		const metadata = await sharp(image).metadata();

		if (!metadata.width || !metadata.height) {
			throw new ImageProcessingError('Invalid image metadata');
		}

		return {
			width: metadata.width,
			height: metadata.height,
			aspectRatio: metadata.width / metadata.height
		};
	}

	private async determineMergeDirection(
		image1Buffer: Buffer,
		image2Buffer: Buffer
	): Promise<MergeDirection> {
		const [img1Dims, img2Dims] = await Promise.all([
			this.getImageDimensions(image1Buffer),
			this.getImageDimensions(image2Buffer)
		]);

		// Calculate aspect ratios for both merge strategies
		const horizontalAspectRatio =
			(img1Dims.width + img2Dims.width) / Math.max(img1Dims.height, img2Dims.height);
		const verticalAspectRatio =
			Math.max(img1Dims.width, img2Dims.width) / (img1Dims.height + img2Dims.height);

		// Calculate how far each aspect ratio is from the "ideal" aspect ratio (16:9 = 1.778)
		const idealAspectRatio = 1 / 1;
		const horizontalDiff = Math.abs(horizontalAspectRatio - idealAspectRatio);
		const verticalDiff = Math.abs(verticalAspectRatio - idealAspectRatio);

		// Choose the direction that results in an aspect ratio closer to 16:9
		return horizontalDiff < verticalDiff ? MergeDirection.HORIZONTAL : MergeDirection.VERTICAL;
	}

	public async mergeSideBySide(image1: Buffer, image2: Buffer): Promise<Buffer> {
		try {
			const [img1Meta, img2Meta] = await Promise.all([
				sharp(image1).metadata(),
				sharp(image2).metadata()
			]);

			if (!img1Meta.width || !img2Meta.width || !img1Meta.height || !img2Meta.height) {
				throw new ImageProcessingError('Invalid image metadata');
			}

			let resizedImage1 = image1;
			let resizedImage2 = image2;
			let newImg1Meta = img1Meta;
			let newImg2Meta = img2Meta;

			if (img1Meta.height !== img2Meta.height) {
				if (img1Meta.height > img2Meta.height) {
					resizedImage1 = await sharp(image1).resize({ height: img2Meta.height }).toBuffer();
					newImg1Meta = await sharp(resizedImage1).metadata();
				} else {
					resizedImage2 = await sharp(image2).resize({ height: img1Meta.height }).toBuffer();
					newImg2Meta = await sharp(resizedImage2).metadata();
				}
			}

			const totalHeight = Math.max(newImg1Meta.height!, newImg2Meta.height!);

			const outputBuffer = await sharp({
				create: {
					width: makeEven(newImg1Meta.width! + newImg2Meta.width!),
					height: makeEven(totalHeight),
					channels: 4,
					background: { r: 245, g: 231, b: 252, alpha: 1 }
				}
			})
				.composite([
					{
						input: resizedImage1,
						left: 0,
						top: Math.floor((totalHeight - newImg1Meta.height!) / 2)
					},
					{
						input: resizedImage2,
						left: newImg1Meta.width,
						top: Math.floor((totalHeight - newImg2Meta.height!) / 2)
					}
				])
				.jpeg()
				.toBuffer();

			return outputBuffer;
		} catch (error) {
			console.error('Error merging images side by side:', error);
			throw error;
		}
	}

	private async mergeTopAndBottom(image1: Buffer, image2: Buffer): Promise<Buffer> {
		try {
			const [img1Meta, img2Meta] = await Promise.all([
				sharp(image1).metadata(),
				sharp(image2).metadata()
			]);

			if (!img1Meta.width || !img2Meta.width || !img1Meta.height || !img2Meta.height) {
				throw new ImageProcessingError('Invalid image metadata');
			}

			let resizedImage1 = image1;
			let resizedImage2 = image2;
			let newImg1Meta = img1Meta;
			let newImg2Meta = img2Meta;

			if (img1Meta.width !== img2Meta.width) {
				if (img1Meta.width > img2Meta.width) {
					resizedImage1 = await sharp(image1).resize({ width: img2Meta.width }).toBuffer();
					newImg1Meta = await sharp(resizedImage1).metadata();
				} else {
					resizedImage2 = await sharp(image2).resize({ width: img1Meta.width }).toBuffer();
					newImg2Meta = await sharp(resizedImage2).metadata();
				}
			}

			const totalWidth = Math.max(newImg1Meta.width!, newImg2Meta.width!);

			const outputBuffer = await sharp({
				create: {
					width: makeEven(totalWidth),
					height: makeEven(newImg1Meta.height! + newImg2Meta.height!),
					channels: 4,
					background: { r: 245, g: 231, b: 252, alpha: 1 }
				}
			})
				.composite([
					{
						input: resizedImage1,
						left: Math.floor((totalWidth - newImg1Meta.width!) / 2),
						top: 0
					},
					{
						input: resizedImage2,
						left: Math.floor((totalWidth - newImg2Meta.width!) / 2),
						top: newImg1Meta.height
					}
				])
				.jpeg()
				.toBuffer();

			return outputBuffer;
		} catch (error) {
			console.error('Error merging images top and bottom:', error);
			throw error;
		}
	}

	private async mergeImages(image1: Buffer, image2: Buffer): Promise<Buffer> {
		const direction = await this.determineMergeDirection(image1, image2);
		console.log(`Using ${direction} merge strategy`);

		switch (direction) {
			case MergeDirection.HORIZONTAL:
				return this.mergeSideBySide(image1, image2);
			case MergeDirection.VERTICAL:
				return this.mergeTopAndBottom(image1, image2);
			default:
				throw new ImageProcessingError(`Invalid merge direction: ${direction}`);
		}
	}

	private createVideoFromStream(frameStream: Readable): Promise<PassThrough> {
		return new Promise((resolve, reject) => {
			const passThrough = new PassThrough();
			let started = false;

			const command = ffmpeg()
				.input(frameStream)
				.inputFormat('image2pipe')
				.inputFPS(this.fps)
				.format('mp4')
				.videoCodec('libx264')
				.outputOptions([
					'-movflags frag_keyframe+empty_moov',
					`-preset ${this.preset}`,
					'-tune stillimage',
					`-crf ${this.crf}`,
					'-pix_fmt yuv420p'
				])
				.on('start', (commandLine) => {
					console.log('Spawned FFmpeg with command:', commandLine);
					started = true;
					resolve(passThrough);
				})
				.on('error', (err, stdout, stderr) => {
					console.error('FFmpeg error:', err.message);
					console.error('stdout:', stdout);
					console.error('stderr:', stderr);
					if (!started) {
						reject(err);
					}
					passThrough.destroy(err);
				})
				.on('end', () => {
					console.log('FFmpeg processing finished');
				});
			command.pipe(passThrough, { end: true });

			const timer = setTimeout(() => {
				console.warn('FFmpeg timeout reached, killing process');
				command.kill('SIGTERM');
			}, this.timeout);
			command.on('end', () => clearTimeout(timer));
			command.on('error', () => clearTimeout(timer));
		});
	}

	private async *generateFrames(imagePairs: ImagePair[]): AsyncGenerator<Buffer> {
		const BATCH_SIZE = 8;
		for (let i = 0; i < imagePairs.length; i += BATCH_SIZE) {
			const batch = imagePairs.slice(i, i + BATCH_SIZE);
			const buffers = await Promise.all(
				batch.map((pair) => this.mergeImages(pair.first, pair.second))
			);
			for (const buffer of buffers) {
				yield buffer;
			}
		}
	}

	public async processImagesAndCreateVideo(
		imagePairs: ImagePair[]
	): Promise<NodeJS.ReadableStream> {
		const frameStream = Readable.from(this.generateFrames(imagePairs));
		return this.createVideoFromStream(frameStream);
	}
}

// Custom error class for image processing
class ImageProcessingError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
		public readonly path?: string
	) {
		super(message);
		this.name = 'ImageProcessingError';
	}
}

function makeEven(value: number): number {
	return value % 2 === 0 ? value : value + 1;
}
