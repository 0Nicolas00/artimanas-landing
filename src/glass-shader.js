import { DISTANCE_RANGE, POINTER_DISPLACEMENT, POINTER_FALLOFF, TRACE_COMPLETE, TRACE_FEATHER, WAVE_AMPLITUDE, WAVE_FREQUENCY, WAVE_RIPPLE } from './glass-motion.mjs';
import { TRACE_SAMPLES } from './glass-trace.mjs';

export const vertexShader = `
 varying vec2 vUv;
 void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
`;

export const fragmentShader = `
 precision highp float;
 varying vec2 vUv;
 uniform sampler2D uBackground;
 uniform vec2 uResolution;
 uniform sampler2D uField;
 uniform vec4 uFieldView; // scale and offset into the traced silhouette texture
 uniform vec4 uWave; // wave phases, strength and contour expansion
 uniform float uGlassFill;
 uniform vec3 uGlassTrace; // drawing progress, stroke opacity and rim softness
 uniform sampler2D uTraceTiming;
 uniform float uTraceRows;
 uniform vec3 uPointer; // screen UV and eased pressure
 uniform float uGrainStrength;
 uniform float uGrainMix;
 uniform vec3 uIntroPlane;
 uniform float uBackgroundMix;
 vec3 sampleScene(vec2 uv) {
   return texture2D(uBackground, clamp(uv, .001, .999)).rgb;
 }
 // A weighted two-dimensional tent filters only the refracted scene.
 vec3 frostedScene(vec2 uv,vec2 radius) {
   vec2 x=vec2(radius.x,0.), y=vec2(0.,radius.y);
   vec3 axes=sampleScene(uv+x)+sampleScene(uv-x)+sampleScene(uv+y)+sampleScene(uv-y);
   vec3 corners=sampleScene(uv+x+y)+sampleScene(uv+x-y)+sampleScene(uv-x+y)+sampleScene(uv-x-y);
   return (4.*sampleScene(uv)+2.*axes+corners)/16.;
 }
 // ShaderMaterial injects luminance() using the renderer’s working colour space.

 // Warp the sampling coordinates locally. The traced shapes stay in place.
 vec4 glassSample(vec2 uv, vec2 metric) {
   vec2 point=vec2(uv.x,1.-uv.y);
   vec2 fromPointer=(point-uPointer.xy)*metric;
   float radius2=dot(fromPointer,fromPointer);
   float strength=${POINTER_DISPLACEMENT}*uPointer.z*exp(-radius2/${POINTER_FALLOFF});
   vec2 shift=strength*fromPointer/max(.055,sqrt(radius2));
   vec2 spatial=vec2(${WAVE_FREQUENCY.join(',')})*point.yx;
   vec2 wave=uWave.z*vec2(${WAVE_AMPLITUDE.join(',')})
     *(sin(spatial-uWave.xy)+${WAVE_RIPPLE}*sin(1.7*spatial+uWave.xy));
   vec2 fieldUv=(point+(wave-shift)/metric)*uFieldView.xy+uFieldView.zw;
   return texture2D(uField,fieldUv);
 }
 float glassDistance(vec4 fieldSample) {
   float unit=dot(fieldSample.rg,vec2(4080.,15.))/4095.;
   return (2.*unit-1.)*${DISTANCE_RANGE} - uWave.w;
 }
 float grainHash(vec2 p) {
   vec3 v=fract(p.xyx*vec3(.1031,.11369,.13787));
   v+=dot(v,v.yzx+19.19);
   return fract((v.x+v.y)*v.z)-.5;
 }
 void main() {
   vec2 metric=vec2(uResolution.x/uResolution.y,1.);
   vec3 underneath=sampleScene(vUv);
   vec4 fieldSample=glassSample(vUv,metric);
   float d=glassDistance(fieldSample);
   vec2 footprint=vec2(dFdx(d),dFdy(d));
   float feather=uGlassTrace.z;
   float aa=max(.5/uResolution.y,.85*(abs(footprint.x)+abs(footprint.y)))+feather;
   vec3 color=underneath;
   float glassOpacity=uGlassFill;
   if(d<aa) {
     float revealed=1.;
     if(uGlassTrace.x<${TRACE_COMPLETE} && d>-.036) {
       float arc=(fieldSample.b*255.+.5)/${TRACE_SAMPLES}.;
       float row=(floor(fieldSample.a*255.+.5)+.5)/uTraceRows;
       float arrival=texture2D(uTraceTiming,vec2(arc,row)).r;
       revealed=smoothstep(-${TRACE_FEATHER},${TRACE_FEATHER},uGlassTrace.x-arrival);
     }
     glassOpacity+=(1.-uGlassFill)*uGlassTrace.y*revealed*(1.-smoothstep(0.,.025,abs(d)));
     vec2 slope=footprint;
     if(d>-.074) {
       // Sample symmetrically so neighbouring pixels don't share a quantized lighting direction.
       vec2 stepUv=1.15/uResolution;
       vec2 dx=vec2(stepUv.x,0.),dy=vec2(0.,stepUv.y);
       slope=vec2(glassDistance(glassSample(vUv+dx,metric))-glassDistance(glassSample(vUv-dx,metric)),
                  glassDistance(glassSample(vUv+dy,metric))-glassDistance(glassSample(vUv-dy,metric)))/2.3;
     }
     vec2 grad=slope*uResolution.y;
     float gradientLength=length(grad);
     // Opposing normals cancel at a pinching neck. Fade its tiny caustic
     // before normalizing to avoid a bright needle inside the glass.
     float confidence=smoothstep(.07,.46,gradientLength);
     vec2 normal=grad/max(gradientLength,.24);
     float rim=confidence*exp(min(0.,d)*34.);
     vec2 direction=normal/metric;
     vec2 lens=direction*(.003*exp(min(d,0.)*8.)+.034*rim*rim);
     float blurRadius=clamp(uResolution.y*.009,2.,10.)*(1.-.45*rim);
     vec3 transmitted=frostedScene(vUv-lens,vec2(blurRadius)/uResolution);
     // Sample the live gradient on both sides of the edge. Colour, strength and
     // direction of the reflection all follow illumination in the underlying frame.
     vec3 outside=sampleScene(vUv+direction*.082);
     vec3 inside=sampleScene(vUv-direction*.082);
     float facingLight=clamp((luminance(outside)-luminance(inside))*2.5+.5,0.,1.);
     float exposure=1.-exp(-2.8*luminance(outside));
     float glint=pow(abs(dot(normal,normalize(vec2(-.62,.88)))),5.);
     // Keep the thin specular line white and tint the broad reflection
     // with the actual colour below this particular segment of the rim.
     vec3 localLight = .65 * underneath + .25 * transmitted + .10 * outside;
     float peak = max(localLight.r, max(localLight.g, localLight.b));
     vec3 hue = localLight / max(peak, .001);
     vec3 reflection = mix(vec3(.86,.89,.96), hue, .88 * smoothstep(.005,.16,peak));
     float pixelVariance=dot(slope,slope)+feather*feather*.5;
     float glintDistance=d+.0027;
     float bevelDistance=d+.009;
     float fine=exp(-glintDistance*glintDistance/(.0024*.0024+pixelVariance));
     float broad=exp(-bevelDistance*bevelDistance/(.0056*.0056+pixelVariance));
     float edgeLight=confidence*revealed*(.25+.90*glint+.98*exposure)*(.56+.8*facingLight)/(1.+feather*95.);
     vec3 glass=transmitted*(1.-.44*rim*rim) + (mix(reflection,vec3(1.),.62)*fine + .8*mix(reflection,vec3(1.),.23)*broad)*edgeLight;
     glass+=mix(vec3(.032),outside*.14,.45)*(.45+rim);
     color=mix(underneath,glass,glassOpacity*(1.-smoothstep(-aa,aa,d)));
   }
   gl_FragColor=vec4(color,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   gl_FragColor.rgb=mix(uIntroPlane,gl_FragColor.rgb,uBackgroundMix);
   // Add display-space grain after refraction and exclude the glass silhouette.
   float grainMask=mix(1.,smoothstep(0.,aa,d),glassOpacity);
   if(grainMask>0. && uGrainStrength>0.) {
     vec2 pixel=floor(gl_FragCoord.xy);
     vec2 cell=floor(pixel/2.);
     float coarse=mix(grainHash(cell+91.),grainHash(cell+vec2(137.,53.)),uGrainMix);
     float noise=.70*grainHash(pixel)+.30*coarse;
     float grain=noise*uGrainStrength*grainMask;
     gl_FragColor.rgb=clamp(gl_FragColor.rgb+grain,0.,1.);
   }
 }
`;
