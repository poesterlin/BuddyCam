precision mediump float;

uniform sampler2D u_image;
varying vec2 v_texCoord;
uniform float u_time;

// Helper function for creating light leaks
float lightLeak(vec2 uv, vec2 center, float size) {
    return pow(1.0 - distance(uv, center), size);
}

void main() {
    float u_distortionAmount = 0.5;
    float u_chromaticAmount = 0.4;
    float u_noiseAmount = 0.6;
    float u_vignetteAmount = 0.5;
    float u_lightLeakAmount = 3.5;
    float u_colorGradingAmount = 3.5;
    float u_bloomAmount = 1.3;

    vec2 uv = v_texCoord;
    
    // Lens distortion
    vec2 curved_uv = uv * 2.0 - 1.0;
    curved_uv *= 1.0 + pow(abs(curved_uv.yx), vec2(2.0)) * (0.07 * u_distortionAmount);
    curved_uv = curved_uv * 0.5 + 0.5;
    
    // Base color sampling
    vec4 originalColor = texture2D(u_image, curved_uv);
    vec4 color = originalColor;

    // Chromatic aberration
    float chromatic_strength = 0.003 * u_chromaticAmount;
    vec2 red_offset = vec2(chromatic_strength, 0.001 * u_chromaticAmount);
    vec2 green_offset = vec2(0.000, -0.001 * u_chromaticAmount);
    vec2 blue_offset = vec2(-chromatic_strength, 0.000);
    
    vec4 chromaticColor;
    chromaticColor.r = texture2D(u_image, curved_uv + red_offset).r;
    chromaticColor.g = texture2D(u_image, curved_uv + green_offset).g;
    chromaticColor.b = texture2D(u_image, curved_uv + blue_offset).b;
    chromaticColor.a = 1.0;
    
    color = mix(color, chromaticColor, u_chromaticAmount);
    
    // Film grain noise
    float noise = fract(sin(dot(uv, vec2(12.9898, 78.233)) + u_time * 0.1) * 43758.5453);
    color.rgb += noise * 0.015 * u_noiseAmount;
    
    // Vignette
    float vignette = 1.0 - smoothstep(0.3, 1.8, length(uv - 0.5) * 2.0);
    vignette = pow(vignette, 1.5);
    color.rgb *= 1.0 - ((1.0 - vignette) * u_vignetteAmount);
    
    // Light leaks
    float leak1 = lightLeak(uv, vec2(1.2, 0.2), 3.0) * 0.15;
    float leak2 = lightLeak(uv, vec2(-0.2, 0.8), 4.0) * 0.12;
    vec3 leakColor1 = vec3(1.0, 0.9, 0.8); // Warmer, less brown
    vec3 leakColor2 = vec3(0.8, 0.9, 1.0); // Cool blue
    vec3 leakEffect = (leak1 * leakColor1 + leak2 * leakColor2) * u_lightLeakAmount;
    color.rgb += leakEffect;
    
    // Color grading
    vec3 shadows = vec3(0.95, 0.95, 1.0);    // Slightly cool shadows
    vec3 midtones = vec3(1.0, 1.0, 0.98);    // Nearly neutral midtones
    vec3 highlights = vec3(1.05, 1.02, 0.98); // Slightly warm highlights
    
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 colorGraded = mix(
        mix(shadows, midtones, luminance),
        highlights,
        luminance * luminance
    );
    
    color.rgb = mix(color.rgb, color.rgb * colorGraded, u_colorGradingAmount);
    
    // Bloom effect
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
    vec3 bloomEffect = max(blurred.rgb - color.rgb, 0.0) * 0.3;
    color.rgb += bloomEffect * u_bloomAmount;
    
    // Final adjustments
    color.rgb = mix(color.rgb, color.rgb * (1.0 + noise * 0.1), 0.5 * u_noiseAmount);
    
    // Protect against over-saturation
    gl_FragColor = clamp(color, 0.0, 1.0);
}