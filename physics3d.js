(function (global) {
  'use strict';

  const ns = (global.GravityWatch = global.GravityWatch || {});

  // Real-world calibrated physical parameters per watch face material
  const MATERIAL_PROFILES = {
    tennis: {
      mass: 0.058,
      inertiaFactor: 0.55,
      restitution: 0.50,
      muS: 0.58,
      muK: 0.44,
      rollingRes: 0.045,
      airDrag: 0.36,
      magnus: 0.045,
      rotAirDrag: 0.055
    },
    diamond: {
      mass: 0.14,
      inertiaFactor: 0.40,
      restitution: 0.36,
      muS: 0.28,
      muK: 0.20,
      rollingRes: 0.065,
      airDrag: 0.06,
      magnus: 0.005,
      rotAirDrag: 0.015
    },
    basketball: {
      mass: 0.62,
      inertiaFactor: 0.66,
      restitution: 0.60,
      muS: 0.52,
      muK: 0.38,
      rollingRes: 0.016,
      airDrag: 0.18,
      magnus: 0.025,
      rotAirDrag: 0.025
    },
    goldBar: {
      mass: 1.85,
      inertiaFactor: 0.34,
      restitution: 0.18,
      muS: 0.36,
      muK: 0.26,
      rollingRes: 0.09,
      airDrag: 0.018,
      magnus: 0.0,
      rotAirDrag: 0.008
    },
    soccer: {
      mass: 0.43,
      inertiaFactor: 0.66,
      restitution: 0.54,
      muS: 0.48,
      muK: 0.36,
      rollingRes: 0.032,
      airDrag: 0.20,
      magnus: 0.035,
      rotAirDrag: 0.028
    }
  };

  function buildDiamondHullPoints(r) {
    const pts = [];
    // Table center
    pts.push(0, 0, 0.5 * r);
    // 8 crown table perimeter vertices + 8 star vertices + 8 pavilion mid vertices
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const aMid = ((i + 0.5) / 8) * Math.PI * 2;
      pts.push(Math.cos(a) * 0.55 * r, Math.sin(a) * 0.55 * r, 0.5 * r);
      pts.push(Math.cos(aMid) * 0.78 * r, Math.sin(aMid) * 0.78 * r, 0.36 * r);
      pts.push(Math.cos(aMid) * 0.53 * r, Math.sin(aMid) * 0.53 * r, -0.31 * r);
    }
    // 16 girdle perimeter vertices
    for (let k = 0; k < 16; k += 1) {
      const ak = (k / 16) * Math.PI * 2;
      const gz = k % 2 === 0 ? 0.13 * r : 0.07 * r;
      pts.push(Math.cos(ak) * r, Math.sin(ak) * r, gz);
    }
    // Culet point (42 vertices total)
    pts.push(0, 0, -0.76 * r);
    return new Float32Array(pts);
  }

  function PhysicsWorld3D(options) {
    const opts = options || {};
    this.width = opts.width || 4.0;
    this.height = opts.height || 4.88;
    this.depth = opts.depth || 1.08;
    this.cornerRadius = opts.cornerRadius || 0.72;

    this.themeId = 'tennis';
    this.mode = 'sphere'; // 'sphere' | 'goldBar' | 'diamond'
    this.profile = MATERIAL_PROFILES.tennis;
    this.engineMode = opts.engineMode || (global.RAPIER ? 'rapier' : 'analytic');

    // Tweaks modulators (null restitutionOverride = use true per-material restitution)
    this.restitutionOverride = null;
    this.frictionScale = 1.0;
    this.airDragScale = 1.0;
    this.gravityScale = 1.0;

    // Unit-sphere Earth gravity (default ~47° comfortable wrist viewing angle)
    this.gravity = { x: 0, y: -0.73, z: -0.68 };
    this.bodies = [];
    this.onCollision = opts.onCollision || null;

    this.rapierWorld = null;
    this.rapierBodies = [];
    this.rapierColliders = [];
    this.rapierWallColliders = [];
    this._lastAppliedRest = -1;
    this._lastAppliedMu = -1;
    this._lastSoundMs = 0;

    this._qDelta = new THREE.Quaternion();
    this._axis = new THREE.Vector3();
    this._axAxis = new THREE.Vector3();
    this._bxAxis = new THREE.Vector3();
    this._vLocal = new THREE.Vector3();
  }

  PhysicsWorld3D.prototype.getEffectiveRestitution = function () {
    return this.restitutionOverride !== null ? this.restitutionOverride : this.profile.restitution;
  };

  PhysicsWorld3D.prototype.destroyRapierWorld = function () {
    if (this.rapierWorld && typeof this.rapierWorld.free === 'function') {
      try {
        this.rapierWorld.free();
      } catch (_err) {
        // Ignore double-free
      }
    }
    this.rapierWorld = null;
    this.rapierBodies = [];
    this.rapierColliders = [];
    this.rapierWallColliders = [];
    this._lastAppliedRest = -1;
    this._lastAppliedMu = -1;
  };

  PhysicsWorld3D.prototype.rebuildRapierWorld = function () {
    this.destroyRapierWorld();
    if (this.engineMode !== 'rapier' || !global.RAPIER) return;

    const RAPIER = global.RAPIER;
    const gAccel = 14.5 * this.gravityScale;
    this.rapierWorld = new RAPIER.World({
      x: this.gravity.x * gAccel,
      y: this.gravity.y * gAccel,
      z: this.gravity.z * gAccel
    });

    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;
    const depth = this.depth;
    const cr = this.cornerRadius;

    const effRest = this.getEffectiveRestitution();
    const effMu = Math.max(0.0, this.profile.muK * this.frictionScale);
    this._lastAppliedRest = effRest;
    this._lastAppliedMu = effMu;

    const combineMax = RAPIER.CoefficientCombineRule ? RAPIER.CoefficientCombineRule.Max : undefined;
    const wallRb = this.rapierWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const addWallDesc = (desc) => {
      desc.setRestitution(effRest).setFriction(effMu);
      if (combineMax !== undefined && typeof desc.setRestitutionCombineRule === 'function') {
        desc.setRestitutionCombineRule(combineMax);
      }
      const col = this.rapierWorld.createCollider(desc, wallRb);
      this.rapierWallColliders.push(col);
    };

    // Floor (top strictly at z = 0) and sapphire glass ceiling (bottom strictly at z = depth)
    addWallDesc(
      RAPIER.ColliderDesc.cuboid(halfW + 1.0, halfH + 1.0, 0.5).setTranslation(0, 0, -0.5)
    );
    addWallDesc(
      RAPIER.ColliderDesc.cuboid(halfW + 1.0, halfH + 1.0, 0.5).setTranslation(0, 0, depth + 0.5)
    );

    // Four flat outer perimeter walls
    addWallDesc(
      RAPIER.ColliderDesc.cuboid(0.5, halfH + 0.5, depth + 1.0).setTranslation(-halfW - 0.5, 0, depth * 0.5)
    );
    addWallDesc(
      RAPIER.ColliderDesc.cuboid(0.5, halfH + 0.5, depth + 1.0).setTranslation(halfW + 0.5, 0, depth * 0.5)
    );
    addWallDesc(
      RAPIER.ColliderDesc.cuboid(halfW + 0.5, 0.5, depth + 1.0).setTranslation(0, -halfH - 0.5, depth * 0.5)
    );
    addWallDesc(
      RAPIER.ColliderDesc.cuboid(halfW + 0.5, 0.5, depth + 1.0).setTranslation(0, halfH + 0.5, depth * 0.5)
    );

    // 32 angled corner arc panels (8 segments per quadrant matching cornerRadius = 0.72)
    const wallHalfT = 0.25;
    const segsPerCorner = 8;
    const dTheta = (Math.PI * 0.5) / segsPerCorner;
    const segHalfSpan = cr * Math.tan(dTheta * 0.5) + 0.08;
    const ix = halfW - cr;
    const iy = halfH - cr;
    const corners = [
      { cx: ix, cy: iy, start: 0 },
      { cx: -ix, cy: iy, start: Math.PI * 0.5 },
      { cx: -ix, cy: -iy, start: Math.PI },
      { cx: ix, cy: -iy, start: Math.PI * 1.5 }
    ];

    for (let c = 0; c < corners.length; c += 1) {
      const corner = corners[c];
      for (let s = 0; s < segsPerCorner; s += 1) {
        const a = corner.start + (s + 0.5) * dTheta;
        const px = corner.cx + Math.cos(a) * (cr + wallHalfT);
        const py = corner.cy + Math.sin(a) * (cr + wallHalfT);
        const halfA = a * 0.5;
        addWallDesc(
          RAPIER.ColliderDesc.cuboid(wallHalfT, segHalfSpan, depth + 1.0)
            .setTranslation(px, py, depth * 0.5)
            .setRotation({ x: 0, y: 0, z: Math.sin(halfA), w: Math.cos(halfA) })
        );
      }
    }

    const densityBase = Math.max(0.5, this.profile.mass * 18.0);
    for (let i = 0; i < this.bodies.length; i += 1) {
      const b = this.bodies[i];
      const rbDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(b.x, b.y, b.z)
        .setRotation({ x: b.q.x, y: b.q.y, z: b.q.z, w: b.q.w })
        .setLinearDamping(this.mode === 'goldBar' ? 0.16 : 0.05)
        .setAngularDamping(this.mode === 'goldBar' ? 0.72 : 0.14)
        .setCanSleep(false)
        .setCcdEnabled(true);

      const rb = this.rapierWorld.createRigidBody(rbDesc);
      rb.setLinvel({ x: b.vx, y: b.vy, z: b.vz }, true);
      rb.setAngvel({ x: b.wx, y: b.wy, z: b.wz }, true);

      let colDesc = null;
      if (this.mode === 'goldBar') {
        colDesc = RAPIER.ColliderDesc.roundCuboid(
          Math.max(0.05, b.hx - 0.03),
          Math.max(0.05, b.hy - 0.03),
          Math.max(0.025, b.hz - 0.025),
          0.03
        );
      } else if (this.mode === 'diamond') {
        colDesc = RAPIER.ColliderDesc.convexHull(buildDiamondHullPoints(b.r));
        if (!colDesc) {
          colDesc = RAPIER.ColliderDesc.ball(b.r * 0.86);
        }
      } else {
        colDesc = RAPIER.ColliderDesc.ball(b.r);
      }

      colDesc.setRestitution(effRest).setFriction(effMu).setDensity(densityBase);
      if (combineMax !== undefined && typeof colDesc.setRestitutionCombineRule === 'function') {
        colDesc.setRestitutionCombineRule(combineMax);
      }
      const col = this.rapierWorld.createCollider(colDesc, rb);
      this.rapierBodies.push(rb);
      this.rapierColliders.push(col);
    }
  };

  PhysicsWorld3D.prototype.setEngineMode = function (mode) {
    const next = mode === 'rapier' && global.RAPIER ? 'rapier' : 'analytic';
    if (this.engineMode === next) return;
    this.engineMode = next;
    if (this.engineMode === 'rapier') {
      this.rebuildRapierWorld();
    } else {
      this.destroyRapierWorld();
    }
  };

  PhysicsWorld3D.prototype.configure = function (mode, count, themeId) {
    this.mode = mode;
    if (themeId && MATERIAL_PROFILES[themeId]) {
      this.themeId = themeId;
      this.profile = MATERIAL_PROFILES[themeId];
    }
    this.bodies = [];

    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;

    let baseRadius = 0.36;
    if (mode === 'sphere') {
      baseRadius = Math.min(0.42, Math.max(0.22, 0.365 * Math.sqrt(17 / Math.max(count, 10))));
    } else if (mode === 'diamond') {
      baseRadius = Math.min(0.38, Math.max(0.21, 0.34 * Math.sqrt(19 / Math.max(count, 10))));
    } else {
      baseRadius = Math.min(0.34, Math.max(0.22, 0.31 * Math.sqrt(15 / Math.max(count, 8))));
    }

    const cols = mode === 'goldBar' ? 3 : Math.max(3, Math.floor((this.width - 0.5) / (baseRadius * 2.15)));
    const spacingX = (this.width - baseRadius * 2.4) / Math.max(cols, 1);

    for (let i = 0; i < count; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols) % 4;
      const layer = Math.floor(i / (cols * 4));

      const scale =
        mode === 'diamond'
          ? 0.84 + Math.random() * 0.32
          : mode === 'goldBar'
          ? 0.94 + Math.random() * 0.1
          : 1.0;

      const r = baseRadius * scale;
      const stagger = (row % 2) * (spacingX * 0.35) - spacingX * 0.16;
      const x = -halfW + baseRadius * 1.2 + (col + 0.5) * spacingX + stagger + (Math.random() - 0.5) * 0.22;
      const y = -halfH * 0.52 + row * (baseRadius * 2.02) + (Math.random() - 0.5) * 0.2;
      const z = r + 0.08 + layer * (r * 1.35) + Math.random() * 0.12;

      const q = new THREE.Quaternion();
      q.setFromEuler(
        new THREE.Euler(
          mode === 'goldBar' ? (Math.random() - 0.5) * 0.9 : Math.random() * Math.PI * 2,
          mode === 'goldBar' ? (Math.random() - 0.5) * 0.9 : Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        )
      );

      this.bodies.push({
        x: Math.min(Math.max(x, -halfW + r + 0.05), halfW - r - 0.05),
        y: Math.min(Math.max(y, -halfH + r + 0.05), halfH - r - 0.05),
        z: Math.min(Math.max(z, r + 0.04), this.depth - r - 0.04),
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        vz: 0,
        wx: (Math.random() - 0.5) * 1.4,
        wy: (Math.random() - 0.5) * 1.4,
        wz: (Math.random() - 0.5) * 1.4,
        q: q,
        r: r,
        scale: scale,
        hx: 0.54 * (r / 0.31),
        hy: 0.24 * (r / 0.31),
        hz: 0.14 * (r / 0.31)
      });
    }

    if (this.engineMode === 'rapier' && global.RAPIER) {
      this.rebuildRapierWorld();
    } else {
      this.destroyRapierWorld();
    }
  };

  PhysicsWorld3D.prototype.setGravity3D = function (gx, gy, gz) {
    const len = Math.hypot(gx, gy, gz) || 1;
    this.gravity.x = gx / len;
    this.gravity.y = gy / len;
    this.gravity.z = gz / len;
  };

  PhysicsWorld3D.prototype._syncBodiesToRapierVel = function () {
    if (this.engineMode !== 'rapier' || !this.rapierWorld) return;
    for (let i = 0; i < this.bodies.length && i < this.rapierBodies.length; i += 1) {
      const b = this.bodies[i];
      const rb = this.rapierBodies[i];
      rb.setLinvel({ x: b.vx, y: b.vy, z: b.vz }, true);
      rb.setAngvel({ x: b.wx, y: b.wy, z: b.wz }, true);
    }
  };

  PhysicsWorld3D.prototype.applyInertialAcceleration = function (ax, ay, az) {
    // d'Alembert inertial force from brisk wrist flicks (lighter airier objects scatter slightly livelier)
    const massFactor = Math.max(0.45, Math.min(1.25, Math.pow(0.45 / this.profile.mass, 0.12)));
    for (let i = 0; i < this.bodies.length; i += 1) {
      const b = this.bodies[i];
      b.vx += ax * massFactor;
      b.vy += ay * massFactor;
      b.vz += az * massFactor;
    }
    this._syncBodiesToRapierVel();
  };

  PhysicsWorld3D.prototype.applyThemePop = function () {
    for (let i = 0; i < this.bodies.length; i += 1) {
      const b = this.bodies[i];
      b.vx += (Math.random() - 0.5) * 1.6;
      b.vy += (Math.random() - 0.5) * 1.6;
      b.vz += 1.3 + Math.random() * 1.0;
      b.wx += (Math.random() - 0.5) * 4.5;
      b.wy += (Math.random() - 0.5) * 4.5;
      b.wz += (Math.random() - 0.5) * 4.5;
    }
    this._syncBodiesToRapierVel();
  };

  PhysicsWorld3D.prototype.shake = function () {
    // Heavy gold ingots feel weightier; light tennis balls catch air & spin wildly
    const liftScale = Math.max(0.65, Math.min(1.3, Math.pow(0.45 / this.profile.mass, 0.15)));
    for (let i = 0; i < this.bodies.length; i += 1) {
      const b = this.bodies[i];
      b.vx += (-b.x * 1.7 + (Math.random() - 0.5) * 4.8) * liftScale;
      b.vy += (-b.y * 1.7 + (Math.random() - 0.5) * 4.8) * liftScale;
      b.vz += (2.5 + Math.random() * 1.8) * liftScale;
      b.wx += (Math.random() - 0.5) * 11 * liftScale;
      b.wy += (Math.random() - 0.5) * 11 * liftScale;
      b.wz += (Math.random() - 0.5) * 11 * liftScale;
    }
    this._syncBodiesToRapierVel();
  };

  PhysicsWorld3D.prototype.applyContactImpulse = function (b, nx, ny, nz, rx, ry, rz, penetration, applyVel) {
    if (penetration <= 0) return;

    b.x += nx * penetration;
    b.y += ny * penetration;
    b.z += nz * penetration;

    if (!applyVel) return;

    const vcx = b.vx + (b.wy * rz - b.wz * ry);
    const vcy = b.vy + (b.wz * rx - b.wx * rz);
    const vcz = b.vz + (b.wx * ry - b.wy * rx);

    const vn = vcx * nx + vcy * ny + vcz * nz;
    if (vn >= 0) return;

    const impactSpeed = -vn;
    const effRestitution = this.getEffectiveRestitution();
    const e = impactSpeed > 0.3 ? effRestitution : 0.0;
    const jn = -(1 + e) * vn;

    b.vx += jn * nx;
    b.vy += jn * ny;
    b.vz += jn * nz;

    const inertiaNorm = Math.max(0.015, this.profile.inertiaFactor * b.r * b.r);
    const invInertia = 1.0 / inertiaNorm;

    // Gentle normal tip torque for rectangular gold bullion bars
    if (this.mode === 'goldBar') {
      const rxN = ry * nz - rz * ny;
      const ryN = rz * nx - rx * nz;
      const rzN = rx * ny - ry * nx;
      b.wx += rxN * jn * 0.42;
      b.wy += ryN * jn * 0.42;
      b.wz += rzN * jn * 0.42;
    }

    // True Coulomb static-lock vs kinetic friction
    const tx = vcx - vn * nx;
    const ty = vcy - vn * ny;
    const tz = vcz - vn * nz;
    const tMag = Math.hypot(tx, ty, tz);

    const muS = this.profile.muS * this.frictionScale;
    const muK = this.profile.muK * this.frictionScale;

    if (tMag > 0.0001 && this.frictionScale > 0) {
      const ux = tx / tMag;
      const uy = ty / tMag;
      const uz = tz / tMag;

      const rCuX = ry * uz - rz * uy;
      const rCuY = rz * ux - rx * uz;
      const rCuZ = rx * uy - ry * ux;
      const invMassEff = 1.0 + (rCuX * rCuX + rCuY * rCuY + rCuZ * rCuZ) * invInertia;

      const jStop = tMag / invMassEff;
      const maxStatic = muS * jn;
      const jt = jStop <= maxStatic ? jStop : Math.min(jStop, muK * jn);

      b.vx -= jt * ux;
      b.vy -= jt * uy;
      b.vz -= jt * uz;

      const jtx = -jt * ux;
      const jty = -jt * uy;
      const jtz = -jt * uz;

      const torqueScale = this.mode === 'goldBar' ? 0.32 : 1.0;
      b.wx += (ry * jtz - rz * jty) * invInertia * torqueScale;
      b.wy += (rz * jtx - rx * jtz) * invInertia * torqueScale;
      b.wz += (rx * jty - ry * jtx) * invInertia * torqueScale;
    }

    // Rolling resistance proportional to normal load (settles balls & ingots cleanly without perpetual creep)
    const rollRes = this.profile.rollingRes * Math.max(0.2, this.frictionScale);
    if (rollRes > 0) {
      const wMag = Math.hypot(b.wx, b.wy, b.wz);
      if (wMag > 0.0001) {
        const wBrake = Math.min(wMag, jn * rollRes * 6.5);
        const factor = 1.0 - wBrake / wMag;
        b.wx *= factor;
        b.wy *= factor;
        b.wz *= factor;
      }
      // Subtle translational contact damping to kill micro-drift
      const speed = Math.hypot(b.vx, b.vy, b.vz);
      if (speed < 0.06 && jStopThresholdSmall(tMag, muS * jn)) {
        b.vx *= 0.82;
        b.vy *= 0.82;
      }
    }

    if (this.onCollision && impactSpeed > 1.2) {
      this.onCollision(impactSpeed);
    }
  };

  function jStopThresholdSmall(tMag, maxStatic) {
    return tMag < maxStatic * 0.9;
  }

  PhysicsWorld3D.prototype.constrainRoundedXY = function (b, px, py, padRadius, applyVel) {
    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;
    const cr = this.cornerRadius;

    let cx = null;
    let cy = null;
    if (px < -halfW + cr && py < -halfH + cr) {
      cx = -halfW + cr;
      cy = -halfH + cr;
    } else if (px > halfW - cr && py < -halfH + cr) {
      cx = halfW - cr;
      cy = -halfH + cr;
    } else if (px < -halfW + cr && py > halfH - cr) {
      cx = -halfW + cr;
      cy = halfH - cr;
    } else if (px > halfW - cr && py > halfH - cr) {
      cx = halfW - cr;
      cy = halfH - cr;
    }

    if (cx !== null) {
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.hypot(dx, dy);
      const limit = cr - padRadius;
      if (dist > limit && dist > 0.0001) {
        const nx = -dx / dist;
        const ny = -dy / dist;
        // Exact contact lever arm on curved watch bezel wall
        this.applyContactImpulse(b, nx, ny, 0, -nx * padRadius, -ny * padRadius, 0, dist - limit, applyVel);
      }
      return;
    }

    if (px < -halfW + padRadius) {
      this.applyContactImpulse(b, 1, 0, 0, -padRadius, 0, 0, -halfW + padRadius - px, applyVel);
    } else if (px > halfW - padRadius) {
      this.applyContactImpulse(b, -1, 0, 0, padRadius, 0, 0, px - (halfW - padRadius), applyVel);
    }

    if (py < -halfH + padRadius) {
      this.applyContactImpulse(b, 0, 1, 0, 0, -padRadius, 0, -halfH + padRadius - py, applyVel);
    } else if (py > halfH - padRadius) {
      this.applyContactImpulse(b, 0, -1, 0, 0, padRadius, 0, py - (halfH - padRadius), applyVel);
    }
  };

  PhysicsWorld3D.prototype.constrainGoldBar = function (b, applyVel) {
    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;
    const pad = 0.02;

    let minZ = 99, minZRx = 0, minZRy = 0, minZRz = 0;
    let maxZ = -99, maxZRx = 0, maxZRy = 0, maxZRz = 0;
    let minX = 99, minXRx = 0, minXRy = 0, minXRz = 0;
    let maxX = -99, maxXRx = 0, maxXRy = 0, maxXRz = 0;
    let minY = 99, minYRx = 0, minYRy = 0, minYRz = 0;
    let maxY = -99, maxYRx = 0, maxYRy = 0, maxYRz = 0;

    let worstCornerDist = 0;
    let worstCornerNx = 0, worstCornerNy = 0;
    let worstCornerRx = 0, worstCornerRy = 0, worstCornerRz = 0;

    const signs = [-1, 1];
    for (let sx = 0; sx < 2; sx += 1) {
      for (let sy = 0; sy < 2; sy += 1) {
        for (let sz = 0; sz < 2; sz += 1) {
          this._vLocal.set(signs[sx] * b.hx, signs[sy] * b.hy, signs[sz] * b.hz);
          this._vLocal.applyQuaternion(b.q);

          const rx = this._vLocal.x;
          const ry = this._vLocal.y;
          const rz = this._vLocal.z;
          const px = b.x + rx;
          const py = b.y + ry;
          const pz = b.z + rz;

          if (pz < minZ) { minZ = pz; minZRx = rx; minZRy = ry; minZRz = rz; }
          if (pz > maxZ) { maxZ = pz; maxZRx = rx; maxZRy = ry; maxZRz = rz; }
          if (px < minX) { minX = px; minXRx = rx; minXRy = ry; minXRz = rz; }
          if (px > maxX) { maxX = px; maxXRx = rx; maxXRy = ry; maxXRz = rz; }
          if (py < minY) { minY = py; minYRx = rx; minYRy = ry; minYRz = rz; }
          if (py > maxY) { maxY = py; maxYRx = rx; maxYRy = ry; maxYRz = rz; }

          const cr = this.cornerRadius;
          let cx = null;
          let cy = null;
          if (px < -halfW + cr && py < -halfH + cr) { cx = -halfW + cr; cy = -halfH + cr; }
          else if (px > halfW - cr && py < -halfH + cr) { cx = halfW - cr; cy = -halfH + cr; }
          else if (px < -halfW + cr && py > halfH - cr) { cx = -halfW + cr; cy = halfH - cr; }
          else if (px > halfW - cr && py > halfH - cr) { cx = halfW - cr; cy = halfH - cr; }

          if (cx !== null) {
            const dx = px - cx;
            const dy = py - cy;
            const dist = Math.hypot(dx, dy);
            const pen = dist - (cr - pad);
            if (pen > worstCornerDist && dist > 0.0001) {
              worstCornerDist = pen;
              worstCornerNx = -dx / dist;
              worstCornerNy = -dy / dist;
              worstCornerRx = rx;
              worstCornerRy = ry;
              worstCornerRz = rz;
            }
          }
        }
      }
    }

    if (minZ < 0) this.applyContactImpulse(b, 0, 0, 1, minZRx, minZRy, minZRz, -minZ, applyVel);
    else if (maxZ > this.depth) this.applyContactImpulse(b, 0, 0, -1, maxZRx, maxZRy, maxZRz, maxZ - this.depth, applyVel);

    if (worstCornerDist > 0) {
      this.applyContactImpulse(b, worstCornerNx, worstCornerNy, 0, worstCornerRx, worstCornerRy, worstCornerRz, worstCornerDist, applyVel);
      return;
    }

    if (minX < -halfW + pad) this.applyContactImpulse(b, 1, 0, 0, minXRx, minXRy, minXRz, -halfW + pad - minX, applyVel);
    else if (maxX > halfW - pad) this.applyContactImpulse(b, -1, 0, 0, maxXRx, maxXRy, maxXRz, maxX - (halfW - pad), applyVel);

    if (minY < -halfH + pad) this.applyContactImpulse(b, 0, 1, 0, minYRx, minYRy, minYRz, -halfH + pad - minY, applyVel);
    else if (maxY > halfH - pad) this.applyContactImpulse(b, 0, -1, 0, maxYRx, maxYRy, maxYRz, maxY - (halfH - pad), applyVel);
  };

  PhysicsWorld3D.prototype.constrainBody = function (b, applyVel) {
    if (this.mode === 'goldBar') {
      this.constrainGoldBar(b, applyVel);
      return;
    }

    const r = b.r;
    if (b.z < r) {
      this.applyContactImpulse(b, 0, 0, 1, 0, 0, -r, r - b.z, applyVel);
    } else if (b.z > this.depth - r) {
      this.applyContactImpulse(b, 0, 0, -1, 0, 0, r, b.z - (this.depth - r), applyVel);
    }

    this.constrainRoundedXY(b, b.x, b.y, r, applyVel);
  };

  PhysicsWorld3D.prototype.resolveSubSpherePair = function (
    bodyA,
    ax,
    ay,
    az,
    ra,
    bodyB,
    bx,
    by,
    bz,
    rb,
    applyImpulse
  ) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const minDist = ra + rb;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq >= minDist * minDist || distSq < 0.000001) return;

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const nz = dz / dist;
    const overlap = minDist - dist;

    const corr = overlap * 0.5;
    bodyA.x -= nx * corr;
    bodyA.y -= ny * corr;
    bodyA.z -= nz * corr;
    bodyB.x += nx * corr;
    bodyB.y += ny * corr;
    bodyB.z += nz * corr;

    if (!applyImpulse) return;

    // Contact lever arms from centers (includes omega x r surface spin velocities!)
    const rAx = nx * ra;
    const rAy = ny * ra;
    const rAz = nz * ra;
    const rBx = -nx * rb;
    const rBy = -ny * rb;
    const rBz = -nz * rb;

    const vcAx = bodyA.vx + (bodyA.wy * rAz - bodyA.wz * rAy);
    const vcAy = bodyA.vy + (bodyA.wz * rAx - bodyA.wx * rAz);
    const vcAz = bodyA.vz + (bodyA.wx * rAy - bodyA.wy * rAx);

    const vcBx = bodyB.vx + (bodyB.wy * rBz - bodyB.wz * rBy);
    const vcBy = bodyB.vy + (bodyB.wz * rBx - bodyB.wx * rBz);
    const vcBz = bodyB.vz + (bodyB.wx * rBy - bodyB.wy * rBx);

    const rvx = vcBx - vcAx;
    const rvy = vcBy - vcAy;
    const rvz = vcBz - vcAz;
    const vn = rvx * nx + rvy * ny + rvz * nz;
    if (vn >= 0) return;

    const impactSpeed = -vn;
    const effRestitution = this.getEffectiveRestitution();
    const e = impactSpeed > 0.32 ? effRestitution : 0.0;
    const jn = (-(1 + e) * vn) * 0.5;

    bodyA.vx -= jn * nx;
    bodyA.vy -= jn * ny;
    bodyA.vz -= jn * nz;
    bodyB.vx += jn * nx;
    bodyB.vy += jn * ny;
    bodyB.vz += jn * nz;

    const tx = rvx - vn * nx;
    const ty = rvy - vn * ny;
    const tz = rvz - vn * nz;
    const tMag = Math.hypot(tx, ty, tz);

    if (tMag > 0.0001 && this.frictionScale > 0) {
      const ux = tx / tMag;
      const uy = ty / tMag;
      const uz = tz / tMag;

      const muS = this.profile.muS * this.frictionScale;
      const muK = this.profile.muK * this.frictionScale;
      const inertiaFactor = this.profile.inertiaFactor;

      // Account for equal-mass two-body tangential effective denominator
      const denom = 2.0 + 2.0 / Math.max(inertiaFactor, 0.25);
      const jStop = tMag / denom;
      const jt = jStop <= muS * jn ? jStop : Math.min(jStop, muK * jn);

      bodyA.vx += jt * ux;
      bodyA.vy += jt * uy;
      bodyA.vz += jt * uz;
      bodyB.vx -= jt * ux;
      bodyB.vy -= jt * uy;
      bodyB.vz -= jt * uz;

      const jtx = jt * ux;
      const jty = jt * uy;
      const jtz = jt * uz;

      const invIA = (this.mode === 'goldBar' ? 0.35 : 1.0) / Math.max(0.015, inertiaFactor * bodyA.r * bodyA.r);
      const invIB = (this.mode === 'goldBar' ? 0.35 : 1.0) / Math.max(0.015, inertiaFactor * bodyB.r * bodyB.r);

      bodyA.wx += (rAy * jtz - rAz * jty) * invIA;
      bodyA.wy += (rAz * jtx - rAx * jtz) * invIA;
      bodyA.wz += (rAx * jty - rAy * jtx) * invIA;

      bodyB.wx -= (rBy * jtz - rBz * jty) * invIB;
      bodyB.wy -= (rBz * jtx - rBx * jtz) * invIB;
      bodyB.wz -= (rBx * jty - rBy * jtx) * invIB;
    }

    if (this.onCollision && impactSpeed > 1.3) {
      this.onCollision(impactSpeed);
    }
  };

  PhysicsWorld3D.prototype.resolveBodyPair = function (a, b, applyImpulse) {
    if (this.mode !== 'goldBar') {
      this.resolveSubSpherePair(a, a.x, a.y, a.z, a.r, b, b.x, b.y, b.z, b.r, applyImpulse);
      return;
    }

    const broadDist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (broadDist > a.hx * 2.2 + b.hx * 2.2) return;

    const offsets = [-0.62, 0, 0.62];
    this._axAxis.set(1, 0, 0).applyQuaternion(a.q);
    this._bxAxis.set(1, 0, 0).applyQuaternion(b.q);

    const ra = a.hy * 0.85;
    const rb = b.hy * 0.85;
    const minDist = ra + rb;

    let bestPen = 0;
    let bestAx = 0, bestAy = 0, bestAz = 0;
    let bestBx = 0, bestBy = 0, bestBz = 0;

    for (let i = 0; i < 3; i += 1) {
      const oxA = this._axAxis.x * a.hx * offsets[i];
      const oyA = this._axAxis.y * a.hx * offsets[i];
      const ozA = this._axAxis.z * a.hx * offsets[i];
      const pAx = a.x + oxA;
      const pAy = a.y + oyA;
      const pAz = a.z + ozA;

      for (let j = 0; j < 3; j += 1) {
        const oxB = this._bxAxis.x * b.hx * offsets[j];
        const oyB = this._bxAxis.y * b.hx * offsets[j];
        const ozB = this._bxAxis.z * b.hx * offsets[j];
        const pBx = b.x + oxB;
        const pBy = b.y + oyB;
        const pBz = b.z + ozB;

        const d = Math.hypot(pBx - pAx, pBy - pAy, pBz - pAz);
        const pen = minDist - d;
        if (pen > 0) {
          if (pen > bestPen) {
            bestPen = pen;
            bestAx = pAx; bestAy = pAy; bestAz = pAz;
            bestBx = pBx; bestBy = pBy; bestBz = pBz;
          }
          if (!applyImpulse) {
            this.resolveSubSpherePair(a, pAx, pAy, pAz, ra, b, pBx, pBy, pBz, rb, false);
          }
        }
      }
    }

    if (applyImpulse && bestPen > 0) {
      this.resolveSubSpherePair(a, bestAx, bestAy, bestAz, ra, b, bestBx, bestBy, bestBz, rb, true);
    }
  };

  PhysicsWorld3D.prototype._stepRapier = function (dt) {
    const clampedDt = Math.min(dt, 1 / 30);
    const substeps = 2;
    const subDt = clampedDt / substeps;

    const gAccel = 14.5 * this.gravityScale;
    const gx = this.gravity.x * gAccel;
    const gy = this.gravity.y * gAccel;
    const gz = this.gravity.z * gAccel;

    this.rapierWorld.gravity = { x: gx, y: gy, z: gz };

    const effRest = this.getEffectiveRestitution();
    const effMu = Math.max(0.0, this.profile.muK * this.frictionScale);
    if (Math.abs(effRest - this._lastAppliedRest) > 0.001 || Math.abs(effMu - this._lastAppliedMu) > 0.001) {
      for (let i = 0; i < this.rapierColliders.length; i += 1) {
        this.rapierColliders[i].setRestitution(effRest);
        this.rapierColliders[i].setFriction(effMu);
      }
      for (let i = 0; i < this.rapierWallColliders.length; i += 1) {
        this.rapierWallColliders[i].setRestitution(effRest);
        this.rapierWallColliders[i].setFriction(effMu);
      }
      this._lastAppliedRest = effRest;
      this._lastAppliedMu = effMu;
    }

    const airDragK = this.profile.airDrag * this.airDragScale;
    const magnusK = this.profile.magnus * this.airDragScale;
    const rotAirK = (this.mode === 'goldBar' ? 0.14 : this.profile.rotAirDrag) * Math.max(0.25, this.airDragScale);

    const n = this.bodies.length;
    const maxVel = 16.0;
    const maxOmega = 18.0;
    let maxImpactDelta = 0.0;

    const prevVx = new Float32Array(n);
    const prevVy = new Float32Array(n);
    const prevVz = new Float32Array(n);

    this.rapierWorld.timestep = subDt;

    for (let s = 0; s < substeps; s += 1) {
      for (let i = 0; i < n && i < this.rapierBodies.length; i += 1) {
        const rb = this.rapierBodies[i];
        const v = rb.linvel();
        const w = rb.angvel();

        const vMag = Math.hypot(v.x, v.y, v.z);
        const dragMul = 1.0 / (1.0 + airDragK * vMag * subDt);
        let magAx = 0;
        let magAy = 0;
        let magAz = 0;
        if (magnusK > 0 && vMag > 0.05) {
          magAx = (w.y * v.z - w.z * v.y) * magnusK;
          magAy = (w.z * v.x - w.x * v.z) * magnusK;
          magAz = (w.x * v.y - w.y * v.x) * magnusK;
        }

        const nxV = Math.max(-maxVel, Math.min(maxVel, (v.x + magAx * subDt) * dragMul));
        const nyV = Math.max(-maxVel, Math.min(maxVel, (v.y + magAy * subDt) * dragMul));
        const nzV = Math.max(-maxVel, Math.min(maxVel, (v.z + magAz * subDt) * dragMul));
        rb.setLinvel({ x: nxV, y: nyV, z: nzV }, true);

        const wSpeed = Math.hypot(w.x, w.y, w.z);
        if (wSpeed > 0.01) {
          const rotDragMul = 1.0 / (1.0 + rotAirK * wSpeed * subDt);
          rb.setAngvel(
            {
              x: Math.max(-maxOmega, Math.min(maxOmega, w.x * rotDragMul)),
              y: Math.max(-maxOmega, Math.min(maxOmega, w.y * rotDragMul)),
              z: Math.max(-maxOmega, Math.min(maxOmega, w.z * rotDragMul))
            },
            true
          );
        }

        prevVx[i] = nxV;
        prevVy[i] = nyV;
        prevVz[i] = nzV;
      }

      this.rapierWorld.step();

      for (let i = 0; i < n && i < this.rapierBodies.length; i += 1) {
        const rb = this.rapierBodies[i];
        const nv = rb.linvel();
        const dvx = nv.x - (prevVx[i] + gx * subDt);
        const dvy = nv.y - (prevVy[i] + gy * subDt);
        const dvz = nv.z - (prevVz[i] + gz * subDt);
        const dv = Math.hypot(dvx, dvy, dvz);
        if (dv > maxImpactDelta) maxImpactDelta = dv;
      }
    }

    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;
    for (let i = 0; i < n && i < this.rapierBodies.length; i += 1) {
      const b = this.bodies[i];
      const rb = this.rapierBodies[i];
      const t = rb.translation();
      const rot = rb.rotation();
      const nv = rb.linvel();
      const nw = rb.angvel();

      if (
        !Number.isFinite(t.x) ||
        !Number.isFinite(t.y) ||
        !Number.isFinite(t.z) ||
        Math.abs(t.x) > halfW + 0.6 ||
        Math.abs(t.y) > halfH + 0.6 ||
        t.z < -0.5 ||
        t.z > this.depth + 0.6
      ) {
        b.x = 0;
        b.y = 0;
        b.z = Math.min(this.depth - b.r - 0.05, b.r + 0.15);
        b.vx = 0;
        b.vy = 0;
        b.vz = 0;
        b.wx = 0;
        b.wy = 0;
        b.wz = 0;
        b.q.set(0, 0, 0, 1);
        rb.setTranslation({ x: b.x, y: b.y, z: b.z }, true);
        rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      } else {
        b.x = t.x;
        b.y = t.y;
        b.z = t.z;
        b.q.set(rot.x, rot.y, rot.z, rot.w).normalize();
        b.vx = nv.x;
        b.vy = nv.y;
        b.vz = nv.z;
        b.wx = nw.x;
        b.wy = nw.y;
        b.wz = nw.z;
      }
    }

    if (this.onCollision && maxImpactDelta > 1.35) {
      const nowMs = global.performance ? global.performance.now() : Date.now();
      if (nowMs - this._lastSoundMs > 48) {
        this._lastSoundMs = nowMs;
        this.onCollision(Math.min(12.0, maxImpactDelta));
      }
    }
  };

  PhysicsWorld3D.prototype.step = function (dt) {
    if (this.engineMode === 'rapier' && this.rapierWorld) {
      this._stepRapier(dt);
      return;
    }

    const clampedDt = Math.min(dt, 1 / 30);
    const substeps = 4;
    const subDt = clampedDt / substeps;

    const gAccel = 14.5 * this.gravityScale;
    const gx = this.gravity.x * gAccel;
    const gy = this.gravity.y * gAccel;
    const gz = this.gravity.z * gAccel;

    const airDragK = this.profile.airDrag * this.airDragScale;
    const magnusK = this.profile.magnus * this.airDragScale;
    const rotAirK = (this.mode === 'goldBar' ? 0.14 : this.profile.rotAirDrag) * Math.max(0.25, this.airDragScale);

    const n = this.bodies.length;
    const maxVel = 16.0;
    const maxOmega = 18.0;

    for (let s = 0; s < substeps; s += 1) {
      for (let i = 0; i < n; i += 1) {
        const b = this.bodies[i];
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.z) || !Number.isFinite(b.q.w)) {
          b.x = 0; b.y = 0; b.z = b.r + 0.15;
          b.vx = 0; b.vy = 0; b.vz = 0;
          b.wx = 0; b.wy = 0; b.wz = 0;
          b.q.set(0, 0, 0, 1);
        }

        // Quadratic aerodynamic drag: a_drag = -k_drag * |v| * v
        const vMag = Math.hypot(b.vx, b.vy, b.vz);
        const dragMul = 1.0 / (1.0 + airDragK * vMag * subDt);

        // Magnus spin-induced curve force: a_magnus = k_m * (w x v)
        let magAx = 0;
        let magAy = 0;
        let magAz = 0;
        if (magnusK > 0 && vMag > 0.05) {
          magAx = (b.wy * b.vz - b.wz * b.vy) * magnusK;
          magAy = (b.wz * b.vx - b.wx * b.vz) * magnusK;
          magAz = (b.wx * b.vy - b.wy * b.vx) * magnusK;
        }

        b.vx = Math.max(-maxVel, Math.min(maxVel, (b.vx + (gx + magAx) * subDt) * dragMul));
        b.vy = Math.max(-maxVel, Math.min(maxVel, (b.vy + (gy + magAy) * subDt) * dragMul));
        b.vz = Math.max(-maxVel, Math.min(maxVel, (b.vz + (gz + magAz) * subDt) * dragMul));

        // Quadratic rotational air drag: alpha_air = -k_rot * |w| * w
        const wSpeed = Math.hypot(b.wx, b.wy, b.wz);
        const rotDragMul = 1.0 / (1.0 + (rotAirK * wSpeed + (this.mode === 'goldBar' ? 1.4 : 0.18)) * subDt);

        b.wx = Math.max(-maxOmega, Math.min(maxOmega, b.wx * rotDragMul));
        b.wy = Math.max(-maxOmega, Math.min(maxOmega, b.wy * rotDragMul));
        b.wz = Math.max(-maxOmega, Math.min(maxOmega, b.wz * rotDragMul));

        b.x += b.vx * subDt;
        b.y += b.vy * subDt;
        b.z += b.vz * subDt;

        const wMag = Math.hypot(b.wx, b.wy, b.wz);
        if (wMag > 0.0001) {
          this._axis.set(b.wx / wMag, b.wy / wMag, b.wz / wMag);
          this._qDelta.setFromAxisAngle(this._axis, wMag * subDt);
          b.q.premultiply(this._qDelta).normalize();
        }
      }

      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          this.resolveBodyPair(this.bodies[i], this.bodies[j], true);
        }
        this.constrainBody(this.bodies[i], true);
      }

      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          this.resolveBodyPair(this.bodies[i], this.bodies[j], false);
        }
        this.constrainBody(this.bodies[i], false);
      }
    }
  };

  ns.MATERIAL_PROFILES = MATERIAL_PROFILES;
  ns.PhysicsWorld3D = PhysicsWorld3D;
})(window);
