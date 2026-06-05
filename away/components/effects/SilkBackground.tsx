// ============================================================================
// SilkBackground.tsx
// ----------------------------------------------------------------------------
// Animated "silk" shader background filling the viewport on most pages.
//
// Adapted from React Bits' Silk component (https://reactbits.dev/backgrounds/silk).
// Renders a full-screen plane through React Three Fiber, driving the GLSL
// fragment shader's `uTime` uniform on every frame for smooth animation.
//
// Props let callers tune speed, colour, scale, rotation, and noise intensity
// — the defaults are the values tuned for the Away theme. `animated={false}`
// stops the time uniform from advancing (used when reducedMotion is enabled).
// ============================================================================

"use client";

import { useEffect, useRef, useMemo, useState, forwardRef } from "react";
import { createPortal } from "react-dom";
import { Canvas as ThreeCanvas, useFrame, useThree } from "@react-three/fiber";
import { Color, Mesh, ShaderMaterial } from "three";

const hexToNormalizedRGB = (hex: string): [number, number, number] => {
  hex = hex.replace("#", "");
  return [parseInt(hex.slice(0, 2), 16) / 55, parseInt(hex.slice(2, 4), 16) / 55, parseInt(hex.slice(4, 6), 16) / 55];
};

const vertexShader = `
varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vPosition = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;
uniform float uTime;
uniform vec3  uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;
const float e = 2.71828182845904523536;
float noise(vec2 texCoord) {
  float G = e;
  vec2  r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}
vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2  rot = mat2(c, -s, s, c);
  return rot * uv;
}
void main() {
  float rnd        = noise(gl_FragCoord.xy);
  vec2  uv         = rotateUvs(vUv * uScale, uRotation);
  vec2  tex        = uv * uScale;
  float tOffset    = uSpeed * uTime;
  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);
  float pattern = 0.6 +
                  0.4 * sin(5.0 * (tex.x + tex.y +
                                   cos(3.0 * tex.x + 5.0 * tex.y) +
                                   0.02 * tOffset) +
                            sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));
  vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
  col.a = 1.0;
  gl_FragColor = col;
}
`;

interface SilkUniforms {
  [uniform: string]: { value: number | Color };
  uSpeed: { value: number };
  uScale: { value: number };
  uNoiseIntensity: { value: number };
  uColor: { value: Color };
  uRotation: { value: number };
  uTime: { value: number };
}

const SilkPlane = forwardRef<Mesh, { uniforms: SilkUniforms; animated: boolean }>(function SilkPlane(
  { uniforms, animated },
  ref,
) {
  const { viewport } = useThree();

  useEffect(() => {
    if (ref && typeof ref !== "function" && ref.current) {
      ref.current.scale.set(viewport.width, viewport.height, 1);
    }
  }, [ref, viewport]);

  useFrame((_, delta) => {
    if (!animated) return;
    if (ref && typeof ref !== "function" && ref.current) {
      const material = ref.current.material as ShaderMaterial;
      material.uniforms.uTime.value += 0.2 * delta;
    }
  });

  return (
    <mesh ref={ref}>
      <planeGeometry args={[1, 2, 2, 2]} />
      <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
    </mesh>
  );
});

interface SilkProps {
  speed?: number;
  scale?: number;
  color?: string;
  noiseIntensity?: number;
  rotation?: number;
  animated?: boolean;
}

export const SilkBackground: React.FC<SilkProps> = ({
  speed = 1,
  scale = 1.2,
  color = "#0f061c",
  noiseIntensity = 1.2,
  rotation = 0,
  animated = true,
}) => {
  const meshRef = useRef<Mesh>(null);
  // The background renders into the full-viewport layer that lives *outside*
  // the scaled stage (see app/layout.tsx), so the silk bleeds edge-to-edge
  // across the whole screen instead of being clipped to the letterboxed stage.
  const [bgLayer, setBgLayer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setBgLayer(document.getElementById("app-bg-layer"));
  }, []);

  const uniforms = useMemo<SilkUniforms>(
    () => ({
      uSpeed: { value: speed },
      uScale: { value: scale },
      uNoiseIntensity: { value: noiseIntensity },
      uColor: { value: new Color(...hexToNormalizedRGB(color)) },
      uRotation: { value: rotation },
      uTime: { value: 0 },
    }),
    [speed, scale, noiseIntensity, color, rotation],
  );

  if (!bgLayer) return null;

  return createPortal(
    <ThreeCanvas className="silk-bg" dpr={[1, 1.5]} frameloop={animated ? "always" : "demand"} style={{ position: "absolute", inset: 0, zIndex: 0, width: "100%", height: "100%" }}>
      <SilkPlane ref={meshRef} uniforms={uniforms} animated={animated} />
    </ThreeCanvas>,
    bgLayer,
  );
};
