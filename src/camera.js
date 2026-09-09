import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CONFIG as K } from "./config.js";
export class Director {
  constructor(studio) {
    this.studio = studio;
    this.free = false;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.controls = new OrbitControls(
      studio.camera,
      studio.renderer.domElement,
    );
    this.controls.target.set(...K.camera.target);
    this.controls.enableDamping = true;
    this.controls.minDistance = K.camera.orbitMin;
    this.controls.maxDistance = K.camera.orbitMax;
    this.controls.maxPolarAngle = Math.PI * K.camera.orbitPolarFactor;
    this.controls.enabled = false;
    this.target = new T.Vector3(...K.camera.target);
    this.lastPhase = "";
  }
  setFree(value) {
    this.free = value;
    this.controls.enabled = value;
    this.controls.target.copy(this.target);
  }
  reset() {
    this.studio.camera.position.set(...K.camera.wide);
    this.target.set(...K.camera.target);
    this.controls.target.copy(this.target);
    this.studio.camera.lookAt(this.target);
    this.lastPhase = "";
  }
  update(dt, d) {
    if (!d.running && d.phase !== "BEREIT") return;
    if (this.free) {
      this.controls.update();
      return;
    }
    let pos = K.camera.wide,
      target = K.camera.target;
    if (d.phase === "MISCHEN") {
      pos = K.camera.mix;
      target = K.drum.center;
    }
    if (d.phase === "ZIEHEN") {
      pos = K.camera.draw;
      target = K.drum.center;
    }
    if ((d.phase === "AUSLAUF" || d.phase === "ANZEIGE") && d.current) {
      const b = d.current.body.position;
      target = [b.x, b.y, b.z];
      pos =
        d.phase === "ANZEIGE"
          ? target.map((v, i) => v + K.camera.closeOffset[i])
          : target.map((v, i) => v + K.camera.trackingOffset[i]);
    }
    if (d.phase === "SUPERZAHL") {
      pos = K.camera.super;
      target = K.small.center;
      if (d.current?.state === "rail") {
        const b = d.current.body.position;
        target = [b.x, b.y, b.z];
        pos = target.map((v, i) => v + K.camera.closeOffset[i]);
      }
    }
    const shot =
      d.phase +
      (d.phase === "SUPERZAHL" && d.current?.state === "rail" ? ":NAH" : "");
    const cut = this.reduced.matches;
    const closeCut = d.phase === "ANZEIGE" && this.lastPhase !== shot;
    if (cut || closeCut) {
      if (this.lastPhase !== shot) {
        this.studio.camera.position.set(...pos);
        this.target.set(...target);
      }
    } else {
      const alpha = 1 - Math.exp(-dt * K.camera.smooth);
      this.studio.camera.position.lerp(new T.Vector3(...pos), alpha);
      this.target.lerp(new T.Vector3(...target), alpha);
    }
    this.studio.camera.lookAt(this.target);
    this.lastPhase = shot;
  }
}
