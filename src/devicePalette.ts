import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';

export class ShadyDevicePalette extends MaterialPluginBase {
  constructor(material: PBRMaterial) {
    super(material, 'ShadyDevicePalette', 200, undefined, true, true);
  }

  override getClassName() {
    return 'ShadyDevicePalette';
  }

  override getCustomCode(shaderType: string) {
    if (shaderType !== 'fragment') return null;

    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
        float deviceAtlasRegion(vec2 uv, vec2 minimum, vec2 maximum, float feather) {
          vec2 enter = smoothstep(minimum, minimum + feather, uv);
          vec2 leave = 1.0 - smoothstep(maximum - feather, maximum, uv);
          return enter.x * enter.y * leave.x * leave.y;
        }

        float deviceBands(vec2 uv) {
          // The three broad neutral wrap islands. The key faces and ribbon stay outside these UV bounds.
          float fold = deviceAtlasRegion(uv, vec2(0.551, 0.071), vec2(0.622, 0.394), 0.004);
          float longBand = deviceAtlasRegion(uv, vec2(0.742, 0.135), vec2(0.827, 1.002), 0.004);
          float shortBand = deviceAtlasRegion(uv, vec2(0.821, 0.134), vec2(0.888, 0.655), 0.004);
          return max(fold, max(longBand, shortBand));
        }

        float devicePrintedPatches(vec2 uv) {
          float left = deviceAtlasRegion(uv, vec2(0.011, 0.579), vec2(0.111, 0.752), 0.010);
          float upper = deviceAtlasRegion(uv, vec2(0.296, 0.455), vec2(0.421, 0.554), 0.010);
          float center = deviceAtlasRegion(uv, vec2(0.327, 0.631), vec2(0.430, 0.748), 0.010);
          return max(left, max(upper, center));
        }

        float deviceCanvas(vec3 color, float value) {
          return smoothstep(0.034, 0.095, color.r - color.b)
            * (1.0 - smoothstep(0.10, 0.18, color.r - color.g))
            * (1.0 - smoothstep(0.125, 0.25, color.g - color.b))
            * smoothstep(0.19, 0.37, value) * (1.0 - smoothstep(0.69, 0.94, value));
        }

        vec3 shadyDeviceColor(vec3 linearColor, vec2 uv) {
          vec3 color = toGammaSpace(clamp(linearColor, 0.0, 1.0));
          float value = dot(color, vec3(0.2126, 0.7152, 0.0722));
          float peak = max(color.r, max(color.g, color.b));
          float low = min(color.r, min(color.g, color.b));
          float neutral = 1.0 - smoothstep(0.026, 0.09, peak - low);

          // Shady's weathered olive shell, slate wings, and subdued ochre markings.
          vec3 olive = vec3(0.385, 0.414, 0.337);
          vec3 graphite = vec3(0.235, 0.258, 0.270);
          vec3 housing = vec3(0.137, 0.159, 0.168);
          vec3 slateGreen = vec3(0.268, 0.332, 0.302);
          vec3 ochre = vec3(0.628, 0.473, 0.244);
          vec3 burntOrange = vec3(0.607, 0.322, 0.196);
          vec3 ivory = vec3(0.867, 0.831, 0.747);

          float canvas = deviceCanvas(color, value);
          float green = smoothstep(0.018, 0.075, color.g - color.r)
            * smoothstep(0.014, 0.077, color.g - color.b);
          float red = smoothstep(0.10, 0.24, color.r - color.g)
            * smoothstep(0.085, 0.22, color.r - color.b);
          float yellow = smoothstep(0.12, 0.23, color.g - color.b)
            * (1.0 - smoothstep(0.08, 0.15, color.r - color.g));
          float dark = neutral * smoothstep(0.06, 0.15, peak) * (1.0 - smoothstep(0.36, 0.49, peak));
          float light = neutral * smoothstep(0.42, 0.71, value);

          vec3 paint = mix(color, housing + (value - 0.22) * 0.46, dark * 0.77);
          paint = mix(paint, ivory + (value - 0.76) * 0.54, light * 0.24);
          paint = mix(paint, olive + (value - 0.50) * 0.38, canvas * 0.97);
          paint = mix(paint, slateGreen + (value - 0.43) * 0.46, green * 0.81);
          paint = mix(paint, burntOrange + (value - 0.37) * 0.53, red * 0.84);
          paint = mix(paint, ochre + (value - 0.51) * 0.48, yellow * 0.77);
          paint = mix(paint, olive + (value - 0.51) * 0.12, devicePrintedPatches(uv) * 0.97);
          paint = mix(paint, graphite + (value - 0.63) * 0.38, deviceBands(uv) * 0.97);

          // A small mark on one exposed end of the front band echoes Shady's wing paint.
          float marking = deviceAtlasRegion(uv, vec2(0.836, 0.551), vec2(0.877, 0.602), 0.004);
          float stripe = fract((uv.y - 0.55 * uv.x) * 59.0);
          marking *= smoothstep(0.10, 0.20, stripe) * (1.0 - smoothstep(0.59, 0.68, stripe));
          paint = mix(paint, ochre + (value - 0.69) * 0.38, marking * 0.78);
          return toLinearSpace(clamp(paint, 0.0, 1.0));
        }
      `,
      CUSTOM_FRAGMENT_UPDATE_ALBEDO: `
        #ifdef ALBEDO
          surfaceAlbedo = shadyDeviceColor(surfaceAlbedo, vAlbedoUV);
        #endif
      `,
      CUSTOM_FRAGMENT_UPDATE_METALLICROUGHNESS: `
        metallicRoughness.x *= 0.37;
        metallicRoughness.y = max(metallicRoughness.y, 0.62);
        #ifdef ALBEDO
          float band = deviceBands(vAlbedoUV);
          metallicRoughness.x = mix(metallicRoughness.x, 0.03, band);
          metallicRoughness.y = mix(metallicRoughness.y, 0.89, band);
        #endif
      `,
    };
  }
}
