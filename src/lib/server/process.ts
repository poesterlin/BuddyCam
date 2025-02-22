import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs/promises';

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export interface ImagePair {
	first: string;
	second: string;
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
	outputDir: string;
	videoOutput: string;
	fps?: number;
	cleanup?: boolean;
}

class ImageVideoProcessor {
	private readonly outputDir: string;
	private readonly videoOutput: string;
	private readonly fps: number;
	private readonly shouldCleanup: boolean;

	constructor({ outputDir, videoOutput, fps = 24, cleanup = false }: ProcessingOptions) {
		this.outputDir = outputDir;
		this.videoOutput = videoOutput;
		this.fps = fps;
		this.shouldCleanup = cleanup;
	}

	private async getImageDimensions(imagePath: string): Promise<ImageDimensions> {
		const metadata = await sharp(imagePath).metadata();

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
		image1Path: string,
		image2Path: string
	): Promise<MergeDirection> {
		const [img1Dims, img2Dims] = await Promise.all([
			this.getImageDimensions(image1Path),
			this.getImageDimensions(image2Path)
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

	private async mergeSideBySide(
		image1Path: string,
		image2Path: string,
		outputPath: string
	): Promise<string> {
		try {
			const [img1Meta, img2Meta] = await Promise.all([
				sharp(image1Path).metadata(),
				sharp(image2Path).metadata()
			]);

			if (!img1Meta.width || !img2Meta.width || !img1Meta.height || !img2Meta.height) {
				throw new ImageProcessingError('Invalid image metadata');
			}

			await sharp({
				create: {
					width: img1Meta.width + img2Meta.width,
					height: Math.max(img1Meta.height, img2Meta.height),
					channels: 4,
					background: { r: 255, g: 255, b: 255, alpha: 1 }
				}
			})
				.composite([
					{ input: image1Path, left: 0, top: 0 },
					{ input: image2Path, left: img1Meta.width, top: 0 }
				])
				.jpeg()
				.toFile(outputPath);

			return outputPath;
		} catch (error) {
			console.error('Error merging images side by side:', error);
			throw error;
		}
	}

	private async mergeTopAndBottom(
		image1Path: string,
		image2Path: string,
		outputPath: string
	): Promise<string> {
		try {
			const [img1Meta, img2Meta] = await Promise.all([
				sharp(image1Path).metadata(),
				sharp(image2Path).metadata()
			]);

			if (!img1Meta.width || !img2Meta.width || !img1Meta.height || !img2Meta.height) {
				throw new ImageProcessingError('Invalid image metadata');
			}

			await sharp({
				create: {
					width: Math.max(img1Meta.width, img2Meta.width),
					height: img1Meta.height + img2Meta.height,
					channels: 4,
					background: { r: 255, g: 255, b: 255, alpha: 1 }
				}
			})
				.composite([
					{ input: image1Path, left: 0, top: 0 },
					{ input: image2Path, left: 0, top: img1Meta.height }
				])
				.jpeg()
				.toFile(outputPath);

			return outputPath;
		} catch (error) {
			console.error('Error merging images top and bottom:', error);
			throw error;
		}
	}

	private async mergeImages(
		image1Path: string,
		image2Path: string,
		outputPath: string
	): Promise<string> {
		const direction = await this.determineMergeDirection(image1Path, image2Path);
		console.log(`Using ${direction} merge strategy for ${path.basename(outputPath)}`);

		switch (direction) {
			case MergeDirection.HORIZONTAL:
				return this.mergeSideBySide(image1Path, image2Path, outputPath);
			case MergeDirection.VERTICAL:
				return this.mergeTopAndBottom(image1Path, image2Path, outputPath);
			default:
				throw new ImageProcessingError(`Invalid merge direction: ${direction}`);
		}
	}

	private createVideoFromImages(inputDir: string): Promise<string> {
		return new Promise((resolve, reject) => {
			ffmpeg()
				.input(`${inputDir}/%d.jpg`) // Assumes images are named 1.jpg, 2.jpg, etc.
				.inputFPS(this.fps)
				.output(this.videoOutput)
				.on('end', () => resolve(this.videoOutput))
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
				this.mergeImages(pair.first, pair.second, path.join(this.outputDir, `${index + 1}.jpg`))
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

export async function process(imagePairs: ImagePair[]) {
	try {
		const processor = new ImageVideoProcessor({
			outputDir: './merged',
			videoOutput: 'output.mp4',
			fps: 24,
			cleanup: true
		});

		const videoPath = await processor.processImagesAndCreateVideo(imagePairs);
		console.log(`Video created successfully at: ${videoPath}`);
	} catch (error) {
		console.error('Error in main process:', error);
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
