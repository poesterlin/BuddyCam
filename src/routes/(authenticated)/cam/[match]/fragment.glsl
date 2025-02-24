precision mediump float;

uniform sampler2D u_image;
varying vec2 v_texCoord;
uniform float u_time;

// Helper function for creating light leaks
float lightLeak(vec2 uv, vec2 center, float size) {
    return pow(1.0 - distance(uv, center), size);
}

void main() {
    vec2 uv = v_texCoord;
    
    // Subtle lens distortion
    vec2 curved_uv = uv * 2.0 - 1.0;
    curved_uv *= 1.0 + pow(abs(curved_uv.yx), vec2(2.0)) * 0.07;
    curved_uv = curved_uv * 0.5 + 0.5;
    
    // Sample colors with dreamy chromatic aberration
    vec2 red_offset = vec2(0.0015, 0.001);
    vec2 green_offset = vec2(0.000, -0.001);
    vec2 blue_offset = vec2(-0.0015, 0.000);
    
    vec4 color;
    color.r = texture2D(u_image, curved_uv + red_offset).r;
    color.g = texture2D(u_image, curved_uv + green_offset).g;
    color.b = texture2D(u_image, curved_uv + blue_offset).b;
    color.a = 1.0;
    
    // Soft, organic noise
    float noise = fract(sin(dot(uv, vec2(12.9898, 78.233)) + u_time * 0.1) * 43758.5453);
    color.rgb += noise * 0.015;
    
    // Enhanced vignette with softer falloff
    float vignette = 1.0 - smoothstep(0.3, 1.8, length(uv - 0.5) * 2.0);
    vignette = pow(vignette, 1.5);
    color.rgb *= vignette;
    
    // Light leaks
    float leak1 = lightLeak(uv, vec2(1.2, 0.2), 3.0) * 0.15;
    float leak2 = lightLeak(uv, vec2(-0.2, 0.8), 4.0) * 0.12;
    vec3 leakColor1 = vec3(1.0, 0.8, 0.6); // Warm leak
    vec3 leakColor2 = vec3(0.6, 0.8, 1.0); // Cool leak
    color.rgb += leak1 * leakColor1 + leak2 * leakColor2;
    
    // Vintage color grading
    vec3 shadows = vec3(0.9, 0.7, 0.6);
    vec3 midtones = vec3(1.0, 0.95, 0.8);
    vec3 highlights = vec3(1.1, 1.0, 0.85);
    
    // Apply color grading based on luminance
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 colorGraded = mix(
        mix(shadows, midtones, luminance),
        highlights,
        luminance * luminance
    );
    color.rgb *= colorGraded;
    
    // Soften contrast in shadows while preserving highlights
    color.rgb = pow(color.rgb, vec3(0.85));
    
    // Subtle bloom effect
    vec4 blurred = vec4(0.0);
    float totalWeight = 0.0;
    for(float i = -2.0; i <= 2.0; i++) {
        for(float j = -2.0; j <= 2.0; j++) {
            vec2 offset = vec2(i, j) * 0.004;
            float weight = 1.0 - length(offset) * 50.0;
            if(weight > 0.0) {
                blurred += texture2D(u_image, curved_uv + offset) * weight;
                totalWeight += weight;
            }
        }
    }
    blurred /= totalWeight;
    color.rgb += max(blurred.rgb - color.rgb, 0.0) * 0.3;
    
    // Final adjustments
    color.rgb = mix(color.rgb, color.rgb * (1.0 + noise * 0.1), 0.5); // Film grain
    color.rgb *= vec3(1.1, 1.05, 0.95); // Slight warm cast
    
    // Protect against over-saturation
    gl_FragColor = clamp(color, 0.0, 1.0);
}
