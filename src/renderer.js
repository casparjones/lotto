import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CONFIG as K, railPosition, scoopLines, outletPath } from "./config.js";
const V = (a) => new T.Vector3(...a);
export class Studio {
  constructor(host, drawing) {
    this.host = host;
    this.drawing = drawing;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(K.colors.background);
    this.scene.fog = new T.Fog(K.colors.background, ...K.studio.fog);
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, K.render.pixelRatio),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = K.render.exposure;
    host.append(this.renderer.domElement);
    this.camera = new T.PerspectiveCamera(
      K.camera.fov,
      1,
      K.camera.near,
      K.camera.far,
    );
    this.camera.position.set(...K.camera.wide);
    this.camera.lookAt(...K.camera.target);
    const pmrem = new T.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room).texture;
    this.scene.environment = this.environment;
    room.dispose();
    pmrem.dispose();
    this.materials = Object.fromEntries(
      Object.entries(K.materials).map(([name, options]) => [
        name,
        new (name === "glass" || name === "tube"
          ? T.MeshPhysicalMaterial
          : T.MeshStandardMaterial)(options),
      ]),
    );
    this.buildSet();
    this.devices = [this.buildMachine(0), this.buildMachine(1)];
    this.ballGeometry = new T.SphereGeometry(
      K.ball.radius,
      ...K.studio.ballSegments,
    );
    this.textures = new Map();
    this.ballMeshes = [];
    this.rebuildBalls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }
  mesh(geometry, material, position, parent = this.scene) {
    const m = new T.Mesh(geometry, material);
    m.position.set(...position);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  box(size, pos, mat = this.materials.metal, parent) {
    return this.mesh(new T.BoxGeometry(...size), mat, pos, parent);
  }
  cylinder(radius, height, pos, mat = this.materials.metal, parent) {
    return this.mesh(
      new T.CylinderGeometry(radius, radius, height, K.studio.cylinderSegments),
      mat,
      pos,
      parent,
    );
  }
  tube(
    points,
    radius,
    mat = this.materials.silver,
    parent = this.scene,
    smooth = true,
  ) {
    const curve = smooth
      ? new T.CatmullRomCurve3(points.map(V))
      : new T.CurvePath();
    if (!smooth)
      for (let i = 1; i < points.length; i++)
        curve.add(new T.LineCurve3(V(points[i - 1]), V(points[i])));
    return this.mesh(
      new T.TubeGeometry(
        curve,
        K.studio.tubeSegments[0],
        radius,
        K.studio.tubeSegments[1],
        false,
      ),
      mat,
      [0, 0, 0],
      parent,
    );
  }
  label(
    text,
    width,
    height,
    pos,
    size = K.studio.labelFont,
    color = K.studio.labelInk,
    background = K.studio.labelBackground,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = K.studio.labelPixels[0];
    canvas.height = K.studio.labelPixels[1];
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `500 ${size}px Arial`;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    return this.mesh(
      new T.PlaneGeometry(width, height),
      new T.MeshBasicMaterial({ map: tex }),
      pos,
    );
  }
  buildSet() {
    const k = K.studio;
    this.scene.add(new T.AmbientLight(...k.ambient));
    for (const [name, config] of [
      ["key", k.key],
      ["fill", k.fill],
      ["rim", k.rim],
    ]) {
      const light =
        name === "fill"
          ? new T.DirectionalLight(...config.args)
          : new T.SpotLight(...config.args);
      light.position.set(...config.position);
      if (config.target) {
        light.target.position.set(...config.target);
        this.scene.add(light.target);
      }
      if (name === "key") {
        light.castShadow = true;
        light.shadow.mapSize.set(K.render.shadowSize, K.render.shadowSize);
      }
      this.scene.add(light);
    }
    // Dekor und Beschriftungen sind eine freie Studiointerpretation ohne Senderbezug.
    for (const spec of k.boxes) {
      const box = this.box(
        spec.size,
        spec.position,
        this.materials[spec.material],
      );
      box.rotation.x = spec.rotation || 0;
    }
    for (const spec of k.cylinders)
      this.cylinder(
        spec.radius,
        spec.height,
        spec.position,
        this.materials[spec.material],
      );
    for (let i = -k.strips.halfCount; i <= k.strips.halfCount; i++)
      this.box(
        k.strips.size,
        [i * k.strips.spacing, k.strips.y, k.strips.z],
        this.materials.strip,
      );
    for (const label of k.labels) this.label(...label);
    const seats = [
      ...Array.from({ length: 7 }, (_, i) => ({
        position: railPosition(i),
        text: i === 6 ? "ZZ" : String(i + 1),
      })),
      { position: K.rail.super, text: "SZ" },
    ];
    for (const seat of seats) {
      const [x, y, z] = seat.position,
        extra = seat.text === "SZ";
      this.cylinder(
        k.seats.radius,
        k.seats.height,
        [x, y - k.seats.drop, z],
        extra ? this.materials.brass : this.materials.dark,
      );
      this.label(
        seat.text,
        ...k.seats.labelSize,
        [x, k.seats.labelY, k.seats.labelZ],
        k.seats.font,
        extra ? k.seats.specialInk : k.seats.ink,
        k.seats.background,
      );
    }
    for (const z of k.guards.z)
      this.tube(
        k.guards.x.map((x) => [x, k.guards.y, z]),
        k.guards.radius,
      );
    k.buttons.colors.forEach((color, i) =>
      this.cylinder(
        k.buttons.radius,
        k.buttons.height,
        [k.buttons.x + i * k.buttons.spacing, k.buttons.y, k.buttons.z],
        new T.MeshStandardMaterial({
          color,
          emissive: i === 0 ? k.buttons.emissive : 0,
          emissiveIntensity: k.buttons.intensity,
        }),
      ),
    );
  }
  buildMachine(index) {
    const m = this.drawing.physics.machines[index],
      c = m.center,
      r = m.radius;
    const a = K.apparatus;
    const rotator = new T.Group();
    rotator.position.set(...c);
    this.scene.add(rotator);
    const trommel = this.mesh(
      new T.SphereGeometry(r, ...K.studio.sphereSegments),
      this.materials.glass,
      [0, 0, 0],
      rotator,
    );
    trommel.castShadow = false;
    for (const x of [-1, 1]) {
      this.box(
        [a.support.width, c[1] - a.support.baseY, a.support.depth],
        [
          c[0] + x * (r + a.support.sideGap),
          (c[1] + a.support.baseY) / 2,
          c[2] - r - a.support.backGap,
        ],
        this.materials.dark,
      );
      this.box(
        a.support.foot,
        [
          c[0] + x * (r + a.support.sideGap),
          a.support.baseY,
          c[2] - r - a.support.backGap,
        ],
        this.materials.metal,
      );
    }
    this.box(
      [
        r * 2 + a.support.crossExtra,
        a.support.crossHeight,
        a.support.crossDepth,
      ],
      [c[0], c[1], c[2] - r - a.support.backGap],
      this.materials.metal,
    );
    // Die sichtbare Drehachse liegt normal zur Trommelebene (horizontal, in Z-Richtung).
    for (const z of [-r, r]) {
      const cap = this.cylinder(
        r * a.axle.radiusRatio,
        a.axle.height,
        [c[0], c[1], c[2] + z],
        this.materials.silver,
      );
      cap.rotation.x = Math.PI / 2;
    }
    const ring = this.mesh(
      new T.TorusGeometry(
        r + a.rings.offset,
        a.rings.thickness[0],
        ...K.studio.torusSegments,
      ),
      this.materials.silver,
      [0, 0, 0],
      rotator,
    );
    ring.rotation.y = Math.PI / 2;
    const rim = this.mesh(
      new T.TorusGeometry(
        r + a.rings.offset,
        a.rings.thickness[1],
        ...K.studio.torusSegments,
      ),
      this.materials.silver,
      [0, 0, 0],
      rotator,
    );
    rim.rotation.x = a.rings.tilt;
    const greifarm = new T.Group();
    rotator.add(greifarm);
    const gr = r - K.scoop.inset;
    this.tube(
      [
        [0, 0, 0],
        [gr - K.scoop.halfWidth, K.scoop.floor, 0],
      ],
      K.scoop.wire,
      this.materials.silver,
      greifarm,
    );
    for (const points of scoopLines(r))
      this.tube(points, K.scoop.wire, this.materials.silver, greifarm);
    const trayY = a.tray.y[index];
    const trayWidth = a.tray.width[index];
    const schuette = this.box(
      [trayWidth, a.tray.thickness, a.tray.depth[index]],
      [c[0], trayY, a.tray.z[index]],
      this.materials.metal,
    );
    schuette.rotation.x = a.tray.tilt;
    for (let i = 0; i < K.tray.counts[index]; i++) {
      const b = this.drawing.physics.balls.filter((b) => b.machine === index)[
        i
      ];
      const well = this.mesh(
        new T.TorusGeometry(...a.tray.well),
        this.materials.silver,
        [b.tray[0], b.tray[1] - a.tray.wellDrop, b.tray[2]],
      );
      well.rotation.x = Math.PI / 2;
    }
    this.box(
      a.tray.support,
      [c[0] - trayWidth / 2, trayY - a.tray.supportDrop, a.tray.supportZ],
      this.materials.silver,
    );
    this.box(
      a.tray.support,
      [c[0] + trayWidth / 2, trayY - a.tray.supportDrop, a.tray.supportZ],
      this.materials.silver,
    );
    const path = outletPath(m, index ? K.rail.super : railPosition(0));
    const [outlet, elbow, bottom, entry] = path;
    this.tube(
      [outlet, elbow, bottom],
      a.outlet.radius,
      this.materials.tube,
      this.scene,
      false,
    );
    this.tube(
      [
        bottom.map((v, i) => (i === 1 ? v - a.outlet.floorDrop : v)),
        entry.map((v, i) => (i === 1 ? v - a.outlet.floorDrop : v)),
      ],
      a.outlet.floorRadius,
      this.materials.metal,
    );
    for (const side of [-1, 1])
      this.tube(
        [
          bottom.map((v, i) => (i === 0 ? v + side * a.outlet.guardOffset : v)),
          entry.map((v, i) => (i === 0 ? v + side * a.outlet.guardOffset : v)),
        ],
        a.outlet.guardRadius,
        this.materials.silver,
      );
    this.tube(
      [
        [c[0], a.feed.startY[index], a.feed.startZ],
        [c[0], c[1] + r + a.feed.elbowY, a.feed.elbowZ],
        [c[0], c[1] + r + a.feed.endY, 0],
      ],
      a.feed.radius[index],
      this.materials.tube,
    );
    this.label(
      index ? "SUPERZAHL" : "6 AUS 49",
      a.label.width[index],
      a.label.height,
      [c[0], a.label.y, a.label.z],
      a.label.font,
    );
    return { trommel, rotator, greifarm, schuette, angle: 0 };
  }
  numberMaterial(number) {
    if (this.textures.has(number)) return this.textures.get(number);
    const c = document.createElement("canvas");
    c.width = K.texture.width;
    c.height = K.texture.height;
    const ctx = c.getContext("2d");
    ctx.fillStyle = K.texture.background;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = K.texture.ink;
    ctx.font = `900 ${K.texture.fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < K.texture.rows; y++)
      for (let x = 0; x < K.texture.columns; x++)
        ctx.fillText(
          String(number),
          ((x + 0.5) * c.width) / K.texture.columns,
          ((y + 0.5) * c.height) / K.texture.rows,
        );
    const map = new T.CanvasTexture(c);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = Math.min(
      K.texture.anisotropy,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    const material = new T.MeshStandardMaterial({
      map,
      ...K.materials.ball,
    });
    this.textures.set(number, material);
    return material;
  }
  rebuildBalls() {
    for (const mesh of this.ballMeshes) this.scene.remove(mesh);
    this.ballMeshes = this.drawing.physics.balls.map((b) =>
      this.mesh(this.ballGeometry, this.numberMaterial(b.number), [
        b.body.position.x,
        b.body.position.y,
        b.body.position.z,
      ]),
    );
  }
  update(dt) {
    const p = this.drawing.physics;
    for (let i = 0; i < p.balls.length; i++) {
      const b = p.balls[i],
        mesh = this.ballMeshes[i];
      mesh.position.copy(b.body.position);
      mesh.quaternion.copy(b.body.quaternion);
      if (b.state === "rail") {
        // Eine nummerierte Texturfläche wird zur Kamera orientiert, ohne Sprite.
        mesh.quaternion.setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 4);
      }
    }
    for (let i = 0; i < 2; i++) {
      const device = this.devices[i],
        m = p.machines[i];
      if (this.drawing.running || this.drawing.phase === "BEREIT") {
        device.offset = (device.offset || 0) * Math.exp(-K.drum.ramp * dt);
        if (this.drawing.phase === "BEREIT") device.offset = 0;
        device.angle = m.angle + device.offset;
        device.coast = m.omega;
      } else {
        device.coast = (device.coast || 0) * Math.exp(-K.drum.ramp * dt);
        device.angle += device.coast * dt;
        device.offset = device.angle - m.angle;
      }
      device.rotator.rotation.z = device.angle;
      device.schuette.position.x =
        m.center[0] + (this.drawing.phase === "BEREIT" ? 0 : K.tray.slide);
    }
  }
  resize() {
    const { width, height } = this.host.getBoundingClientRect();
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  lowerQuality() {
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = false;
    this.materials.glass.transmission = 0;
    this.materials.glass.needsUpdate = true;
    this.resize();
  }
}
