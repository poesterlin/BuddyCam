precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_time;

// Function to pixelate coordinates: 
vec2 pixelate(vec2 uv, float pixelCount) {
    return floor(uv * pixelCount) / pixelCount;
}

void main() {
    // Pixelation step:
    vec2 pixelatedUV = pixelate(v_texCoord, 200.0);
    vec4 color = texture2D(u_image, pixelatedUV);

    // Retro scanline effect:
    float scanline = sin(v_texCoord.y * 800.0) * 0.1;
    color.rgb -= scanline;
    
    // Simple bloom / blur effect
    vec4 blur = vec4(0.0);
    float total = 0.0;
    for (float i = -1.0; i <= 1.0; i++) {
    for (float j = -1.0; j <= 1.0; j++) {
        vec2 offset = vec2(i, j) * 0.002;
        blur += texture2D(u_image, v_texCoord + offset);
        total += 1.0;
    }
    }
    blur /= total;
    color = mix(color, blur, 0.2);
    
    gl_FragColor = color;
}