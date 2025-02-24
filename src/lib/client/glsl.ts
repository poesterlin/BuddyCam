import { assert } from './util';

export function compileShader(
	gl: WebGLRenderingContext,
	type: number,
	source: string
): WebGLShader {
	const shader = gl.createShader(type);
	assert(shader, 'Failed to create shader');

	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		throw new Error('Failed to compile shader');
	}

	return shader;
}

export function linkProgram(
	gl: WebGLRenderingContext,
	vertexShader: WebGLShader,
	fragmentShader: WebGLShader
): WebGLProgram {
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error('Error linking program:', gl.getProgramInfoLog(program));
		throw new Error('Failed to link program');
	}

	return program;
}

/**
 * Full screen quad vertices
 */
export const vertices = new Float32Array([
	// x,   y,   u,   v
	-1.0, -1.0, 0.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0, -1.0, 1.0,
	0.0, 0.0, 1.0, -1.0, 1.0, 1.0
]);
