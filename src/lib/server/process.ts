import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { env } from '$env/dynamic/private';
import { assert } from './util';

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
	videoOutput: string;
	fps?: number;
	cleanup?: boolean;
}

export class ImageVideoProcessor {
	private readonly outputDir = env.OUTPUT_DIR!;
	private readonly videoOutput?: string;
	private readonly fps: number;
	private readonly shouldCleanup: boolean;

	constructor({ videoOutput, fps = 24, cleanup = false }: Partial<ProcessingOptions> = {}) {
		this.videoOutput = videoOutput;
		this.fps = fps;
		this.shouldCleanup = cleanup;
	}

	private async getImageDimensions(imageBuffer: Buffer): Promise<ImageDimensions> {
		const metadata = await sharp(imageBuffer).metadata();

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
		const idealAspectRatio = 16 / 9;
		const horizontalDiff = Math.abs(horizontalAspectRatio - idealAspectRatio);
		const verticalDiff = Math.abs(verticalAspectRatio - idealAspectRatio);

		// Choose the direction that results in an aspect ratio closer to 16:9
		return horizontalDiff < verticalDiff ? MergeDirection.HORIZONTAL : MergeDirection.VERTICAL;
	}

	public async mergeSideBySide(image1Buffer: Buffer, image2Buffer: Buffer): Promise<Buffer> {
		try {
			const [img1Meta, img2Meta] = await Promise.all([
				sharp(image1Buffer).metadata(),
				sharp(image2Buffer).metadata()
			]);

			if (!img1Meta.width || !img2Meta.width || !img1Meta.height || !img2Meta.height) {
				throw new ImageProcessingError('Invalid image metadata');
			}

			const outputBuffer = await sharp({
				create: {
					width: img1Meta.width + img2Meta.width,
					height: Math.max(img1Meta.height, img2Meta.height),
					channels: 4,
					background: { r: 255, g: 255, b: 255, alpha: 1 }
				}
			})
				.composite([
					{ input: image1Buffer, left: 0, top: 0 },
					{ input: image2Buffer, left: img1Meta.width, top: 0 }
				])
				.jpeg()
				.toBuffer();

			return outputBuffer;
		} catch (error) {
			console.error('Error merging images side by side:', error);
			throw error;
		}
	}

	private async mergeTopAndBottom(image1Buffer: Buffer, image2Buffer: Buffer): Promise<Buffer> {
		try {
			const [img1Meta, img2Meta] = await Promise.all([
				sharp(image1Buffer).metadata(),
				sharp(image2Buffer).metadata()
			]);

			if (!img1Meta.width || !img2Meta.width || !img1Meta.height || !img2Meta.height) {
				throw new ImageProcessingError('Invalid image metadata');
			}

			const outputBuffer = await sharp({
				create: {
					width: Math.max(img1Meta.width, img2Meta.width),
					height: img1Meta.height + img2Meta.height,
					channels: 4,
					background: { r: 255, g: 255, b: 255, alpha: 1 }
				}
			})
				.composite([
					{ input: image1Buffer, left: 0, top: 0 },
					{ input: image2Buffer, left: 0, top: img1Meta.height }
				])
				.jpeg()
				.toBuffer();

			return outputBuffer;
		} catch (error) {
			console.error('Error merging images top and bottom:', error);
			throw error;
		}
	}

	private async mergeImages(image1Buffer: Buffer, image2Buffer: Buffer): Promise<Buffer> {
		const direction = await this.determineMergeDirection(image1Buffer, image2Buffer);
		console.log(`Using ${direction} merge strategy`);

		switch (direction) {
			case MergeDirection.HORIZONTAL:
				return this.mergeSideBySide(image1Buffer, image2Buffer);
			case MergeDirection.VERTICAL:
				return this.mergeTopAndBottom(image1Buffer, image2Buffer);
			default:
				throw new ImageProcessingError(`Invalid merge direction: ${direction}`);
		}
	}

	private createVideoFromImages(inputDir: string): Promise<string> {
		const output = this.videoOutput;
		assert(output, 'Video output path is required');

		return new Promise((resolve, reject) => {
			ffmpeg()
				.input(`${inputDir}/%d.jpg`) // Assumes images are named 1.jpg, 2.jpg, etc.
				.inputFPS(this.fps)
				.output(output)
				.on('end', () => resolve(output))
				.on('error', (err) => reject(err))
				.run();
		});
	}

	private async cleanup(): Promise<void> {
		try {
			const files = await fs.readdir(this.outputDir);
			await Promise.all(files.map((file) => fs.unlink(path.join(this.outputDir, file))));
			await fs.rmdir(this.outputDir);
		} catch (error) {
			console.error('Error during cleanup:', error);
			throw error;
		}
	}

	public async processImagesAndCreateVideo(imagePairs: ImagePair[]): Promise<string> {
		try {
			// Create output directory if it doesn't exist
			await fs.mkdir(this.outputDir, { recursive: true });

			const mergePromises = imagePairs.map((pair, index) =>
				this.mergeImages(pair.first, pair.second).then((buffer) => {
					const outputPath = path.join(this.outputDir, `${index + 1}.jpg`);
					return fs.writeFile(outputPath, buffer);
				})
			);

			await Promise.all(mergePromises);

			// Create video from merged images
			const videoPath = await this.createVideoFromImages(this.outputDir);

			// Cleanup if enabled
			if (this.shouldCleanup) {
				await this.cleanup();
			}

			return videoPath;
		} catch (error) {
			console.error('Error in processing:', error);
			throw error;
		}
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
