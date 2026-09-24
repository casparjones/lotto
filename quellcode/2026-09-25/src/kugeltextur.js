// Kugelmaterial: matte Tischtennisbälle mit 12 fetten Ziffern-Aufdrucken rundum.
// Die Aufdrucke sitzen auf den Ecken eines Ikosaeders und werden im Fragment-Shader als
// unverzerrte Abziehbilder (Decals) auf die Kugeloberfläche projiziert – eine Textur, kein Sprite.
import * as THREE from "three";
import { CONFIG } from "./config.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const RICHTUNGEN = [];
const OBEN = [];
for (const [a, b] of [[1, PHI], [-1, PHI], [1, -PHI], [-1, -PHI]]) {
  RICHTUNGEN.push(new THREE.Vector3(0, a, b).normalize());
  RICHTUNGEN.push(new THREE.Vector3(a, b, 0).normalize());
  RICHTUNGEN.push(new THREE.Vector3(b, 0, a).normalize());
}
for (const d of RICHTUNGEN) {
  // Leserichtung: „oben" möglichst nach Welt-y, sonst nach z
  const ref = Math.abs(d.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  OBEN.push(ref.clone().sub(d.clone().multiplyScalar(ref.dot(d))).normalize());
}

const texturCache = new Map();

function zahlTextur(text) {
  if (texturCache.has(text)) return texturCache.get(text);
  const n = 256;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d");
  g.clearRect(0, 0, n, n);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const px = Math.round(n * 0.5);
  g.font = CONFIG.kugel.schrift.replace("{px}", px);
  // schmal genug für zweistellige Zahlen
  const breite = g.measureText(text).width;
  const max = n * 0.86;
  if (breite > max) g.font = CONFIG.kugel.schrift.replace("{px}", Math.round((px * max) / breite));
  g.fillText(text, n / 2, n / 2 + n * 0.02);
  if (text === "6" || text === "9") g.fillRect(n * 0.36, n * 0.77, n * 0.28, n * 0.05); // Unterstrich
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  texturCache.set(text, t);
  return t;
}

/** Halbe Kantenlänge des Aufdruck-Quadrats in Tangentialkoordinaten (Ziffernhöhe 9 mm auf Ø 40 mm). */
const AUFDRUCK = (CONFIG.kugel.ziffernHoehe / 2 / CONFIG.kugel.radius) / 0.5;

export function kugelMaterial(nummer, farbe) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(...farbe), roughness: 0.62, metalness: 0 });
  const tex = zahlTextur(String(nummer));
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uZahl = { value: tex };
    shader.uniforms.uDir = { value: RICHTUNGEN };
    shader.uniforms.uOben = { value: OBEN };
    shader.uniforms.uGroesse = { value: AUFDRUCK };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjN;")
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nvObjN = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vObjN;
uniform sampler2D uZahl;
uniform vec3 uDir[12];
uniform vec3 uOben[12];
uniform float uGroesse;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  vec3 n = normalize(vObjN);
  float best = -2.0; int bi = 0;
  for (int i = 0; i < 12; i++) { float d = dot(n, uDir[i]); if (d > best) { best = d; bi = i; } }
  vec3 dir = uDir[0]; vec3 up = uOben[0];
  for (int i = 0; i < 12; i++) { if (i == bi) { dir = uDir[i]; up = uOben[i]; } }
  vec3 re = cross(up, dir);
  vec2 uv = vec2(dot(n, re), dot(n, up)) / uGroesse;
  if (abs(uv.x) < 1.0 && abs(uv.y) < 1.0) {
    float a = texture2D(uZahl, uv * 0.5 + 0.5).a;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02), a);
  }
}`,
      );
  };
  m.customProgramCacheKey = () => "kugel";
  return m;
}
