precision highp float;  // Changed to highp for better mobile compatibility

uniform sampler2D u_image;
varying vec2 v_texCoord;
uniform float u_time;


void main() {
    float u_distortionAmount = 0.5;
    float u_chromaticAmount = 0.4;
    float u_vignetteAmount = 0.5;
    float u_lightLeakAmount = 3.5;
    float u_colorGradingAmount = 3.5;
    float u_bloomAmount = 1.3;

    vec2 uv = v_texCoord;
    
    // Simplified lens distortion
    vec2 curved_uv = uv;
    if (u_distortionAmount > 0.0) {
        curved_uv = uv * 2.0 - 1.0;
        curved_uv *= 1.0 + pow(abs(curved_uv.yx), vec2(2.0)) * (0.07 * u_distortionAmount);
        curved_uv = curved_uv * 0.5 + 0.5;
    }
    
    // Base color
    vec4 color = texture2D(u_image, curved_uv);

    // Optimized chromatic aberration
    if (u_chromaticAmount > 0.0) {
        float chromatic_strength = 0.003 * u_chromaticAmount;
        color.r = texture2D(u_image, curved_uv + vec2(chromatic_strength, 0.0)).r;
        color.b = texture2D(u_image, curved_uv - vec2(chromatic_strength, 0.0)).b;
    }
    
    // Simplified vignette
    if (u_vignetteAmount > 0.0) {
        float vignette = 1.0 - smoothstep(0.25, 1.8, length(uv - 0.5) * 2.0);
        color.rgb *= 1.0 - ((1.0 - vignette) * u_vignetteAmount);
    }
    
    // Optimized light leak
    if (u_lightLeakAmount > 0.0) {
        vec2 leakCenter = vec2(1.2, 0.2);
        float leak = pow(1.0 - distance(uv, leakCenter), 3.0) * 0.15;
        color.rgb += leak * vec3(1.0, 0.9, 0.8) * u_lightLeakAmount;
    }
    
    // Simplified color grading
    if (u_colorGradingAmount > 0.0) {
        float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        vec3 graded = mix(
            vec3(0.95, 0.95, 1.0),  // shadows
            vec3(1.05, 1.02, 0.98), // highlights
            luminance
        );
        color.rgb = mix(color.rgb, color.rgb * graded, u_colorGradingAmount);
    }
    
    gl_FragColor = clamp(color, 0.0, 1.0);
}
