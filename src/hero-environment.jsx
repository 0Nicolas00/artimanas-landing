import { useLayoutEffect } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { EquirectangularReflectionMapping } from 'three';
import { RGBELoader } from 'three-stdlib';
import { useShaderGradientCanvasContext } from '@shadergradient/react';

// Reemplazo acotado de EnvironmentMap en ShaderGradient 2.4.20.
// Conserva el mapa city original; evita cargar dawn y lobby en cada visita.
function HeroEnvironment({ background = false, envPreset = 'city' }) {
  const { envBasePath } = useShaderGradientCanvasContext();
  if (envPreset !== 'city') throw new Error('La portada optimizada utiliza envPreset="city".');
  const texture = useLoader(RGBELoader, `${envBasePath || 'assets/shader-environments/'}city.hdr`);
  const scene = useThree(state => state.scene);
  useLayoutEffect(() => {
    const previousEnvironment = scene.environment;
    const previousBackground = scene.background;
    texture.mapping = EquirectangularReflectionMapping;
    if (background !== 'only') scene.environment = texture;
    if (background) scene.background = texture;
    return () => {
      scene.environment = previousEnvironment;
      if (background) scene.background = previousBackground;
    };
  }, [scene, texture, background]);
  return null;
}

// Nombre interno del export de la versión fijada; el build valida esa versión.
export { HeroEnvironment as a };
