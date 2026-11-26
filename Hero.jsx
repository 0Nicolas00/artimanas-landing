import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

// Paletas exactas de la referencia. Solo este archivo define los colores del shader.
export const PALETTES = [
  { colors: ["#14032A", "#451489", "#9F5EF3"], loading: "#14032A", text: "#ffffff" }, // violeta oscuro
  { colors: ["#3105BD", "#EB6944", "#DC4390"], loading: "#342367", text: "#ffffff" }, // azul / naranja / rosa
  { colors: ["#08CCDD", "#00B9D0", "#00E6D0"], loading: "#17636A", text: "#ffffff" }, // turquesa
  { colors: ["#E7632F", "#F65FBD", "#E45749"], loading: "#8C3F30", text: "#ffffff" }, // naranja / rosa
  { colors: ["#EAF158", "#E1B5E1", "#2F04BC"], loading: "#71602E", text: "#ffffff" }, // amarillo / lila / azul
];

// @shadergradient/react 2.4.20 ignores frameRate for the on-canvas render loop.
// Lower the render resolution and omit the grain postprocessing pass.
export const SHADER_SETTINGS = {
  animate: "on", axesHelper: "off", brightness: 0.8,
  cAzimuthAngle: 270, cDistance: 0.5, cPolarAngle: 180, cameraZoom: 15.1,
  destination: "onCanvas", embedMode: "off", envPreset: "city", format: "gif",
  fov: 45, frameRate: 10, gizmoHelper: "hide", grain: "off", lightType: "env",
  pixelDensity: 0.75, positionX: -0.1, positionY: 0, positionZ: 0,
  range: "disabled", rangeEnd: 40, rangeStart: 0, reflection: 0.4,
  rotationX: 0, rotationY: 130, rotationZ: 70, shader: "defaults", type: "sphere",
  uAmplitude: 3.2, uDensity: 0.8, uFrequency: 5.5, uSpeed: 0.3,
  uStrength: 0.3, uTime: 0, wireframe: false,
};

// React dibuja solo el fondo. El contenido y el fundido pertenecen al HTML/CSS.
export default function HeroBackground({ palette, children, pixelDensity = SHADER_SETTINGS.pixelDensity, grain = SHADER_SETTINGS.grain }) {
  return (
    <ShaderGradientCanvas
      style={{ position: "absolute", inset: 0 }}
      pointerEvents="none"
      pixelDensity={pixelDensity}
      fov={SHADER_SETTINGS.fov}
      envBasePath="assets/shader-environments/"
      lazyLoad={false}
    >
      <ShaderGradient
        {...SHADER_SETTINGS}
        grain={grain}
        color1={palette.colors[0]}
        color2={palette.colors[1]}
        color3={palette.colors[2]}
      />
      {children}
    </ShaderGradientCanvas>
  );
}
