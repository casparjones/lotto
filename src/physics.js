import * as C from "cannon-es";
import { CONFIG as K, railPosition, scoopLines, outletPath } from "./config.js";
// Der PRNG wird ausschließlich bei der Vorbereitung für Anfangsbedingungen benutzt.
function generator(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class Physics {
  constructor(seed = "1993", impact = () => {}) {
    this.impact = impact;
    this.reset(seed);
  }
  reset(seed) {
    this.world = new C.World({ gravity: new C.Vec3(0, -K.gravity, 0) });
    this.world.solver.iterations = K.physics.solverIterations;
    this.world.defaultContactMaterial.friction = K.ball.friction;
    this.world.defaultContactMaterial.restitution = K.ball.restitution;
    this.ballMaterial = new C.Material("Kugel");
    this.scoopMaterial = new C.Material("Stahldraht");
    this.world.addContactMaterial(
      new C.ContactMaterial(this.ballMaterial, this.scoopMaterial, {
        friction: K.scoop.friction,
        restitution: K.scoop.restitution,
      }),
    );
    this.balls = [];
    this.time = 0;
    this.escaped = 0;
    this.machines = [
      {
        center: K.drum.center,
        radius: K.drum.radius,
        angle: 0,
        omega: 0,
        target: 0,
        boost: 1,
      },
      {
        center: K.small.center,
        radius: K.small.radius,
        angle: 0,
        omega: 0,
        target: 0,
        boost: 1,
      },
    ];
    const rand = generator(seed);
    for (let machine = 0; machine < 2; machine++) {
      for (let i = 0; i < K.tray.counts[machine]; i++) {
        const mass = K.ball.mass * (1 + (rand() - 0.5) * 2 * K.ball.massSpread);
        const body = new C.Body({
          mass,
          material: this.ballMaterial,
          shape: new C.Sphere(K.ball.radius),
          linearDamping: K.ball.damping,
          angularDamping: K.physics.angularDamping,
        });
        const center = this.machines[machine].center;
        const columns = K.tray.columns[machine],
          row = Math.floor(i / columns);
        const tray = [
          center[0] +
            ((i % columns) - (columns - 1) / 2) * K.tray.spacing[machine],
          K.tray.baseY[machine] + row * K.tray.rowRise,
          K.tray.frontZ - row * K.tray.rowDepth,
        ];
        body.position.set(...tray);
        body.type = C.Body.KINEMATIC;
        body.collisionFilterMask = 0;
        const ball = {
          number: machine ? i : i + 1,
          machine,
          body,
          tray,
          state: "tray",
          release:
            (i / K.tray.counts[machine]) *
              (K.timing.load - K.tray.feedDuration) +
            rand() * K.tray.releaseJitter,
          jitter: K.tray.positionJitter.map(
            (amplitude) => (rand() - 0.5) * amplitude,
          ),
          route: 0,
          speed: 0,
        };
        body.addEventListener("collide", (e) => {
          const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
          if (v > K.physics.impactThreshold) this.impact(v);
        });
        this.world.addBody(body);
        this.balls.push(ball);
      }
    }
    this.buildScoops();
  }
  buildScoops() {
    for (const m of this.machines) {
      const body = new C.Body({
        type: C.Body.KINEMATIC,
        material: this.scoopMaterial,
        mass: 0,
        position: new C.Vec3(...m.center),
      });
      const wire = K.scoop.wire;
      const line = (a, b) => {
        const length = Math.hypot(...a.map((v, i) => b[i] - v));
        const count = Math.ceil(length / K.scoop.segmentLength);
        for (let i = 0; i <= count; i++)
          body.addShape(
            new C.Sphere(wire),
            new C.Vec3(...a.map((v, j) => v + ((b[j] - v) * i) / count)),
          );
      };
      // Offener Drahtkorb mit einer niedrigen radialen Lippe, ohne Kontaktverriegelung.
      for (const [a, b] of scoopLines(m.radius)) line(a, b);
      m.scoop = body;
      this.world.addBody(body);
    }
  }
  release(ball) {
    ball.state = "feed";
    ball.feedTime = 0;
  }
  finishFeed(ball) {
    ball.state = "free";
    ball.body.type = C.Body.DYNAMIC;
    ball.body.collisionFilterMask = -1;
    ball.body.updateMassProperties();
    // Tischtennisball als dünne Hohlkugel: I = 2/3 m r².
    const inertia = (2 / 3) * ball.body.mass * K.ball.radius * K.ball.radius;
    ball.body.inertia.set(inertia, inertia, inertia);
    ball.body.invInertia.set(1 / inertia, 1 / inertia, 1 / inertia);
    ball.body.updateInertiaWorld(true);
    const m = this.machines[ball.machine];
    ball.body.position.set(
      m.center[0] + ball.jitter[0],
      m.center[1] + m.radius - K.ball.radius,
      m.center[2] + ball.jitter[2],
    );
    ball.body.velocity.set(ball.jitter[1], K.tray.entrySpeed, 0);
  }
  step(
    dt,
    { load = false, draw = false, smallDraw = false, gate = false } = {},
  ) {
    this.time += dt;
    for (const ball of this.balls)
      if (
        ball.state === "tray" &&
        load &&
        ball.machine === 0 &&
        this.time >= ball.release
      )
        this.release(ball);
    for (const m of this.machines) {
      m.omega += (m.target - m.omega) * Math.min(1, dt * K.drum.ramp);
      m.angle += m.omega * dt;
    }
    for (const m of this.machines) {
      m.scoop.quaternion.setFromEuler(0, 0, m.angle - m.omega * dt);
      m.scoop.angularVelocity.set(0, 0, m.omega);
    }
    this.world.step(dt);
    let caught = null;
    for (const ball of this.balls) {
      const b = ball.body,
        m = this.machines[ball.machine];
      if (ball.state === "feed") {
        ball.feedTime += dt;
        const u = Math.min(1, ball.feedTime / K.tray.feedDuration);
        const end = [
          m.center[0] + ball.jitter[0],
          m.center[1] + m.radius - K.ball.radius,
          m.center[2] + ball.jitter[2],
        ];
        b.position.set(...ball.tray.map((v, i) => v + (end[i] - v) * u * u));
        b.quaternion.setFromEuler(u * K.tray.feedSpin, 0, 0);
        if (u >= 1) this.finishFeed(ball);
      }
      if (ball.state === "free") {
        // Analytische Innenwand: Normalstoß und tangentialer Impuls relativ zur rotierenden Acrylwand.
        const n = b.position.vsub(new C.Vec3(...m.center)),
          r = m.radius - K.ball.radius,
          d = n.length();
        if (d > r) {
          n.scale(1 / d, n);
          b.position.set(
            m.center[0] + n.x * r,
            m.center[1] + n.y * r,
            m.center[2] + n.z * r,
          );
          const vn = b.velocity.dot(n);
          if (vn > 0) {
            b.velocity.vsub(n.scale((1 + K.ball.restitution) * vn), b.velocity);
            this.impact(vn);
          }
          const wall = new C.Vec3(-m.omega * n.y * r, m.omega * n.x * r, 0);
          const contactPoint = n.scale(K.ball.radius);
          const contactVelocity = b.velocity.vadd(
            b.angularVelocity.cross(contactPoint),
          );
          const relative = wall.vsub(contactVelocity);
          relative.vsub(n.scale(relative.dot(n)), relative);
          const speed = relative.length();
          if (speed > K.physics.epsilon) {
            const normalImpulse =
              b.mass * (1 + K.ball.restitution) * Math.max(0, vn);
            const impulse = Math.min(
              K.ball.friction * normalImpulse,
              (b.mass * speed) / (1 + 1 / (2 / 3)),
            );
            b.applyImpulse(relative.scale(impulse / speed), contactPoint);
          }
        }
        // Die Kugel erreicht den weltfesten Auslass durch Kontakte mit dem rotierenden Drahtkorb.
        const enabled = ball.machine ? smallDraw : draw;
        const angle = Math.atan2(
          b.position.y - m.center[1],
          b.position.x - m.center[0],
        );
        const radius = Math.hypot(
          b.position.x - m.center[0],
          b.position.y - m.center[1],
        );
        if (
          enabled &&
          gate &&
          Math.abs(angle - K.scoop.outlet) < K.scoop.outletAngleTolerance &&
          radius > m.radius - K.scoop.outletRadialDepth &&
          Math.abs(b.position.z - m.center[2]) < K.scoop.outletHalfDepth &&
          !caught
        ) {
          ball.state = "outlet";
          b.type = C.Body.KINEMATIC;
          b.collisionFilterMask = 0;
          b.velocity.set(0, 0, 0);
          caught = ball;
        }
      }
      if (ball.state === "route") this.advanceRoute(ball, dt);
    }
    return caught;
  }
  startRoute(ball, index) {
    ball.state = "route";
    ball.route = 0;
    ball.speed = K.route.entrySpeed;
    ball.slot = index;
    const m = this.machines[ball.machine];
    ball.path = outletPath(
      m,
      ball.machine ? K.rail.super : railPosition(index),
    );
    ball.path[0] = [
      ball.body.position.x,
      ball.body.position.y,
      ball.body.position.z,
    ];
    ball.body.velocity.set(0, 0, 0);
  }
  advanceRoute(ball, dt) {
    const points = ball.path;
    const last = points.length - 1;
    const segment = Math.min(last - 1, Math.floor(ball.route));
    const a = points[segment],
      b = points[segment + 1];
    const length = Math.hypot(...a.map((v, i) => b[i] - v));
    const slope = (a[1] - b[1]) / length; // Zwangsführung im Rohr: Hangabtrieb einer rollenden Hohlkugel, ohne neue Zufallswerte.
    ball.speed = Math.min(
      K.route.maxSpeed,
      Math.max(
        K.route.minSpeed,
        ball.speed + K.gravity * slope * K.route.rollingFactor * dt,
      ),
    );
    ball.route += (ball.speed * dt) / length;
    if (ball.route >= last) {
      ball.route = last;
      ball.state = "rail";
      ball.body.position.set(...points[last]);
      ball.body.quaternion.set(0, 0, 0, 1);
      this.impact(K.route.clickSpeed);
      return;
    }
    const s = Math.min(last - 1, Math.floor(ball.route)),
      u = ball.route - s;
    ball.body.position.set(
      ...points[s].map((v, i) => v + (points[s + 1][i] - v) * u),
    );
    ball.body.quaternion.setFromEuler(ball.route * K.route.spin, 0, 0);
  }
  intervene(ball) {
    ball.state = "rail";
    ball.route = ball.path.length - 1;
    ball.body.position.set(...ball.path.at(-1));
    ball.body.quaternion.set(0, 0, 0, 1);
  }
}
