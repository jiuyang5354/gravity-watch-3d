(function (global) {
  'use strict';

  const ns = (global.GravityWatch = global.GravityWatch || {});

  /* =========================================================
     1. Sculpted Vertex-Displaced 3D Sphere Builders
     ========================================================= */
  function createSculptedTennisGeometry() {
    const geom = new THREE.SphereGeometry(1.0, 64, 48);
    const pos = geom.attributes.position;

    const seamSamples = 200;
    const seamPts = [];
    const k = 0.36;
    const norm = 1 + k;
    const cZ = 2 * Math.sqrt(k);
    for (let s = 0; s < seamSamples; s += 1) {
      const t = (s / seamSamples) * Math.PI * 2;
      seamPts.push([
        (Math.cos(t) + k * Math.cos(3 * t)) / norm,
        (Math.sin(t) - k * Math.sin(3 * t)) / norm,
        (cZ * Math.sin(2 * t)) / norm
      ]);
    }

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const len = Math.hypot(x, y, z) || 1;
      const nx = x / len;
      const ny = y / len;
      const nz = z / len;

      let minD2 = 99;
      for (let s = 0; s < seamSamples; s += 1) {
        const sp = seamPts[s];
        const dx = nx - sp[0];
        const dy = ny - sp[1];
        const dz = nz - sp[2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < minD2) minD2 = d2;
      }

      let r = 1.0;
      if (minD2 < 0.0036) {
        const t = Math.max(0, 1.0 - minD2 / 0.0036);
        r -= 0.025 * t * t;
      }

      pos.setXYZ(i, nx * r, ny * r, nz * r);
    }

    pos.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }

  function createSculptedBasketballGeometry() {
    const geom = new THREE.SphereGeometry(1.0, 64, 48);
    const pos = geom.attributes.position;

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const len = Math.hypot(x, y, z) || 1;
      const nx = x / len;
      const ny = y / len;
      const nz = z / len;

      const dEq = Math.abs(ny);
      const dMer = Math.abs(nz);
      const dSide = Math.abs(ny) < 0.9 ? Math.abs(Math.abs(nx) - (0.58 - 0.25 * ny * ny)) : 99;
      const channelDist = Math.min(dEq, dMer, dSide);

      let r = 1.0;
      if (channelDist < 0.05) {
        const t = Math.max(0, 1.0 - channelDist / 0.05);
        r -= 0.028 * t * t;
      }

      pos.setXYZ(i, nx * r, ny * r, nz * r);
    }

    pos.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }

  function createSculptedSoccerGeometry() {
    const geom = new THREE.SphereGeometry(1.0, 64, 48);
    const pos = geom.attributes.position;

    const phi = (1 + Math.sqrt(5)) * 0.5;
    const rawV = [
      [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
      [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
      [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
    ];
    const verts = rawV.map(function (v) {
      const l = Math.hypot(v[0], v[1], v[2]);
      return [v[0] / l, v[1] / l, v[2] / l];
    });

    const faces = [];
    for (let i = 0; i < 12; i += 1) {
      for (let j = i + 1; j < 12; j += 1) {
        if (verts[i][0] * verts[j][0] + verts[i][1] * verts[j][1] + verts[i][2] * verts[j][2] < 0.35) continue;
        for (let k = j + 1; k < 12; k += 1) {
          const dik = verts[i][0] * verts[k][0] + verts[i][1] * verts[k][1] + verts[i][2] * verts[k][2];
          const djk = verts[j][0] * verts[k][0] + verts[j][1] * verts[k][1] + verts[j][2] * verts[k][2];
          if (dik > 0.35 && djk > 0.35) {
            const fx = verts[i][0] + verts[j][0] + verts[k][0];
            const fy = verts[i][1] + verts[j][1] + verts[k][1];
            const fz = verts[i][2] + verts[j][2] + verts[k][2];
            const fl = Math.hypot(fx, fy, fz);
            faces.push([fx / fl, fy / fl, fz / fl]);
          }
        }
      }
    }

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const len = Math.hypot(x, y, z) || 1;
      const nx = x / len;
      const ny = y / len;
      const nz = z / len;

      let bestV = -1;
      for (let v = 0; v < verts.length; v += 1) {
        const d = nx * verts[v][0] + ny * verts[v][1] + nz * verts[v][2];
        if (d > bestV) bestV = d;
      }

      let bestF = -1;
      let secondF = -1;
      for (let f = 0; f < faces.length; f += 1) {
        const d = nx * faces[f][0] + ny * faces[f][1] + nz * faces[f][2];
        if (d > bestF) {
          secondF = bestF;
          bestF = d;
        } else if (d > secondF) {
          secondF = d;
        }
      }

      const pentGap = 1.0166 * bestV - bestF;
      const edgeDist = pentGap > 0 ? Math.abs(pentGap) : Math.min(Math.abs(pentGap), bestF - secondF);

      const cushion = Math.min(1.0, edgeDist / 0.055);
      const r = 0.974 + 0.042 * Math.sqrt(cushion);
      pos.setXYZ(i, nx * r, ny * r, nz * r);
    }

    pos.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }

  /* =========================================================
     2. Rounded-Corner Multi-Tier Beveled Cast Gold Bar Mesh
     ========================================================= */
  function sampleRoundedRectLoop(rx, ry, cornerR, segsPerCorner) {
    const cr = Math.min(cornerR, rx * 0.48, ry * 0.48);
    const ix = rx - cr;
    const iy = ry - cr;
    const pts = [];

    const corners = [
      { cx: ix, cy: iy, start: 0 },
      { cx: -ix, cy: iy, start: Math.PI * 0.5 },
      { cx: -ix, cy: -iy, start: Math.PI },
      { cx: ix, cy: -iy, start: Math.PI * 1.5 }
    ];

    for (let c = 0; c < 4; c += 1) {
      const corner = corners[c];
      for (let s = 0; s <= segsPerCorner; s += 1) {
        const a = corner.start + (s / segsPerCorner) * (Math.PI * 0.5);
        pts.push([corner.cx + Math.cos(a) * cr, corner.cy + Math.sin(a) * cr]);
      }
    }
    return pts;
  }

  function createBeveledGoldBarGeometry(hx, hy, hz) {
    const profiles = [
      { z: -hz, sx: 0.96, sy: 0.94, cr: 0.045 },
      { z: -hz * 0.72, sx: 1.0, sy: 1.0, cr: 0.055 },
      { z: hz * 0.58, sx: 0.85, sy: 0.79, cr: 0.05 },
      { z: hz * 0.88, sx: 0.81, sy: 0.74, cr: 0.045 },
      { z: hz, sx: 0.77, sy: 0.69, cr: 0.04 }
    ];

    const segsPerCorner = 4;
    const rings = profiles.map(function (p) {
      return {
        z: p.z,
        pts: sampleRoundedRectLoop(hx * p.sx, hy * p.sy, p.cr, segsPerCorner)
      };
    });

    const ringLen = rings[0].pts.length;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let r = 0; r < rings.length; r += 1) {
      const ring = rings[r];
      const borderV = 0.012 + (r / Math.max(1, rings.length - 1)) * 0.036;
      for (let i = 0; i < ringLen; i += 1) {
        positions.push(ring.pts[i][0], ring.pts[i][1], ring.z);
        const borderU = 0.012 + (i / ringLen) * 0.036;
        uvs.push(borderU, borderV);
      }
    }

    for (let r = 0; r < rings.length - 1; r += 1) {
      const rowA = r * ringLen;
      const rowB = (r + 1) * ringLen;
      for (let i = 0; i < ringLen; i += 1) {
        const next = (i + 1) % ringLen;
        const a0 = rowA + i;
        const a1 = rowA + next;
        const b1 = rowB + next;
        const b0 = rowB + i;
        indices.push(a0, a1, b1, a0, b1, b0);
      }
    }

    const topRing = rings[rings.length - 1];
    const topCenterIdx = positions.length / 3;
    positions.push(0, 0, topRing.z);
    uvs.push(0.5, 0.5);

    const topTx = hx * 0.77;
    const topTy = hy * 0.69;
    const topStartIdx = positions.length / 3;
    for (let i = 0; i < ringLen; i += 1) {
      const px = topRing.pts[i][0];
      const py = topRing.pts[i][1];
      positions.push(px, py, topRing.z);
      uvs.push(px / (topTx * 2) + 0.5, py / (topTy * 2) + 0.5);
    }
    for (let i = 0; i < ringLen; i += 1) {
      const next = (i + 1) % ringLen;
      indices.push(topCenterIdx, topStartIdx + i, topStartIdx + next);
    }

    const botRing = rings[0];
    const botCenterIdx = positions.length / 3;
    positions.push(0, 0, botRing.z);
    uvs.push(0.03, 0.03);

    const botStartIdx = positions.length / 3;
    for (let i = 0; i < ringLen; i += 1) {
      positions.push(botRing.pts[i][0], botRing.pts[i][1], botRing.z);
      uvs.push(0.012 + (i / ringLen) * 0.036, 0.012);
    }
    for (let i = 0; i < ringLen; i += 1) {
      const next = (i + 1) % ringLen;
      indices.push(botCenterIdx, botStartIdx + next, botStartIdx + i);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    if (typeof geom.computeTangents === 'function') {
      geom.computeTangents();
    }
    return geom;
  }

  /* =========================================================
     2B. Real-Time Surface Micro-Interaction Trail Buffer (Velvet / Clay / Wood / Gold / Turf)
     ========================================================= */
  function SurfaceTrailBuffer(width, height) {
    this.width = width || 256;
    this.height = height || 312;
    this.floorW = 6.0;
    this.floorH = 7.32;
    const total = this.width * this.height;
    this.depth = new Float32Array(total);
    this.dirX = new Float32Array(total);
    this.dirY = new Float32Array(total);
    this.fresh = new Float32Array(total);
    this.data = new Uint8Array(total * 4);
    this.prevPos = [];
    this.hasData = false;

    this.texture = new THREE.DataTexture(
      this.data,
      this.width,
      this.height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.flipY = false;
    this.clear();
  }

  SurfaceTrailBuffer.prototype.clear = function () {
    this.depth.fill(0);
    this.dirX.fill(0);
    this.dirY.fill(0);
    this.fresh.fill(0);
    this.prevPos = [];
    this.hasData = false;
    const total = this.width * this.height;
    for (let i = 0; i < total; i += 1) {
      const idx = i * 4;
      this.data[idx] = 0;
      this.data[idx + 1] = 128;
      this.data[idx + 2] = 128;
      this.data[idx + 3] = 0;
    }
    this.texture.needsUpdate = true;
  };

  SurfaceTrailBuffer.prototype.update = function (physicsBodies, themeId, dt, strength) {
    if (strength <= 0.001) {
      if (this.hasData) this.clear();
      return;
    }
    const clampedDt = Math.min(0.05, dt || 1 / 60);
    const isHardSurface = themeId === 'basketball' || themeId === 'goldBar';
    const total = this.width * this.height;

    if (isHardSurface) {
      // Rigid surfaces (lacquered maple hardwood / polished obsidian vault): ZERO scratches or persistent grooves;
      // depth buffer stores instantaneous 60fps optical proximity & color-bleed radiosity strictly beneath each body.
      this.depth.fill(0);
      if (themeId === 'goldBar') {
        this.fresh.fill(0);
      } else {
        const hardFreshDecay = Math.pow(0.08, clampedDt);
        for (let i = 0; i < total; i += 1) {
          this.fresh[i] *= hardFreshDecay;
          if (this.fresh[i] < 0.002) this.fresh[i] = 0;
        }
      }
    } else {
      let baseRetention = 0.87;
      if (themeId === 'diamond') baseRetention = 0.92;
      else if (themeId === 'soccer') baseRetention = 0.86;

      const depthDecay = Math.pow(baseRetention, clampedDt);
      const freshDecay = Math.pow(0.54, clampedDt);

      for (let i = 0; i < total; i += 1) {
        this.depth[i] *= depthDecay;
        this.fresh[i] *= freshDecay;
        if (this.depth[i] < 0.002) {
          this.depth[i] = 0;
          this.dirX[i] *= 0.85;
          this.dirY[i] *= 0.85;
        }
      }
    }

    if (!physicsBodies || physicsBodies.length === 0) {
      return;
    }
    if (this.prevPos.length !== physicsBodies.length) {
      this.prevPos = physicsBodies.map(function (b) {
        return { x: b.x, y: b.y };
      });
    }

    const W = this.width;
    const H = this.height;
    const invFloorW = 1.0 / this.floorW;
    const invFloorH = 1.0 / this.floorH;

    for (let i = 0; i < physicsBodies.length; i += 1) {
      const b = physicsBodies[i];
      const prev = this.prevPos[i];
      const dxMove = b.x - prev.x;
      const dyMove = b.y - prev.y;
      const moveDist = Math.hypot(dxMove, dyMove);

      const contactRef = themeId === 'goldBar' ? b.hz * 1.15 : b.r * 1.05;
      const clearance = Math.max(0, b.z - contactRef);
      const maxClearance = isHardSurface ? (themeId === 'goldBar' ? 0.55 : 0.45) : 0.18;

      if (clearance < maxClearance) {
        const contactW = 1.0 - clearance / maxClearance;
        const radWorld = isHardSurface
          ? themeId === 'goldBar'
            ? b.hx * 1.35
            : b.r * 1.15
          : themeId === 'diamond'
          ? b.r * 0.56
          : b.r * 0.78;
        const spd = Math.hypot(b.vx || 0, b.vy || 0);
        const hasVel = spd > 0.05;
        const ux = hasVel ? b.vx / spd : 0;
        const uy = hasVel ? b.vy / spd : 0;

        const continuous = !isHardSurface && moveDist > 0.001 && moveDist < 1.2;
        const steps = continuous ? Math.min(8, Math.max(1, Math.ceil(moveDist / (radWorld * 0.28)))) : 1;

        const rxTex = (radWorld * invFloorW) * W;
        const ryTex = (radWorld * invFloorH) * H;
        const rPxX = Math.max(2, Math.ceil(rxTex));
        const rPxY = Math.max(2, Math.ceil(ryTex));

        const targetDepthBase = isHardSurface
          ? contactW
          : (hasVel ? Math.min(1.0, 0.56 + spd * 0.28) : 0.62) * contactW;
        const targetFreshBase = isHardSurface
          ? themeId === 'basketball' && hasVel && spd > 4.0 && contactW > 0.7
            ? Math.min(1.0, (spd - 4.0) * 0.25) * contactW
            : 0.0
          : hasVel
          ? Math.min(1.0, spd * 0.45 * contactW)
          : 0.08 * contactW;

        for (let s = 0; s < steps; s += 1) {
          const frac = steps === 1 ? 1.0 : (s + 1) / steps;
          const wx = continuous ? prev.x + dxMove * frac : b.x;
          const wy = continuous ? prev.y + dyMove * frac : b.y;

          const cx = (wx * invFloorW + 0.5) * W;
          const cy = (wy * invFloorH + 0.5) * H;
          const xMin = Math.max(0, Math.floor(cx - rPxX));
          const xMax = Math.min(W - 1, Math.ceil(cx + rPxX));
          const yMin = Math.max(0, Math.floor(cy - rPxY));
          const yMax = Math.min(H - 1, Math.ceil(cy + rPxY));

          for (let py = yMin; py <= yMax; py += 1) {
            const ny = (py - cy) / ryTex;
            const ny2 = ny * ny;
            if (ny2 >= 1.0) continue;
            const rowOff = py * W;
            for (let px = xMin; px <= xMax; px += 1) {
              const nx = (px - cx) / rxTex;
              const r2 = nx * nx + ny2;
              if (r2 >= 1.0) continue;

              const falloff = (1.0 - r2) * (1.0 - r2);
              const idx = rowOff + px;
              const td = targetDepthBase * falloff;
              if (td > this.depth[idx]) {
                this.depth[idx] = td;
              }
              if (!isHardSurface && hasVel) {
                const blend = Math.min(0.92, (0.36 + Math.min(0.55, spd * 0.25)) * falloff * contactW);
                this.dirX[idx] += (ux - this.dirX[idx]) * blend;
                this.dirY[idx] += (uy - this.dirY[idx]) * blend;
              }
              if (targetFreshBase > 0) {
                const tf = targetFreshBase * falloff;
                if (tf > this.fresh[idx]) {
                  this.fresh[idx] = tf;
                }
              }
            }
          }
        }
      }

      prev.x = b.x;
      prev.y = b.y;
    }

    for (let i = 0; i < total; i += 1) {
      const idx = i * 4;
      const d = Math.max(0, Math.min(1, this.depth[i]));
      const dx = Math.max(-1, Math.min(1, this.dirX[i]));
      const dy = Math.max(-1, Math.min(1, this.dirY[i]));
      const fr = Math.max(0, Math.min(1, this.fresh[i]));
      this.data[idx] = Math.round(d * 255);
      this.data[idx + 1] = Math.round((dx * 0.5 + 0.5) * 255);
      this.data[idx + 2] = Math.round((dy * 0.5 + 0.5) * 255);
      this.data[idx + 3] = Math.round(fr * 255);
    }

    this.hasData = true;
    this.texture.needsUpdate = true;
  };

  /* =========================================================
     3. GIA Brilliant Diamond Geometry + 5-Wavelength Prismatic Raytracer GLSL
     ========================================================= */
  function createBrilliantDiamondGeometry() {
    const positions = [];

    function pushTri(a, b, c) {
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    }

    const tableR = 0.55;
    const starR = 0.78;
    const girdleR = 1.0;

    // GIA optical angles (34.5 deg crown, 40.75 deg pavilion)
    const crownZ = 0.5;
    const starZ = 0.36;
    const girdleTopZ = 0.13;
    const girdleBotZ = 0.07;
    const pavLowerZ = -0.31;
    const culetZ = -0.76;

    const tableCenter = [0, 0, crownZ];
    const culet = [0, 0, culetZ];

    const tPts = [];
    const sPts = [];
    const gTop = [];
    const gBot = [];
    const pavMid = [];

    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const aMid = ((i + 0.5) / 8) * Math.PI * 2;
      tPts.push([Math.cos(a) * tableR, Math.sin(a) * tableR, crownZ]);
      sPts.push([Math.cos(aMid) * starR, Math.sin(aMid) * starR, starZ]);
      pavMid.push([Math.cos(aMid) * 0.53, Math.sin(aMid) * 0.53, pavLowerZ]);
    }

    for (let k = 0; k < 16; k += 1) {
      const ak = (k / 16) * Math.PI * 2;
      gTop.push([Math.cos(ak) * girdleR, Math.sin(ak) * girdleR, girdleTopZ]);
      gBot.push([Math.cos(ak) * girdleR, Math.sin(ak) * girdleR, girdleBotZ]);
    }

    for (let i = 0; i < 8; i += 1) {
      const next = (i + 1) % 8;
      const k0 = i * 2;
      const k1 = (i * 2 + 1) % 16;
      const k2 = (i * 2 + 2) % 16;

      pushTri(tableCenter, tPts[i], tPts[next]);
      pushTri(tPts[i], sPts[i], tPts[next]);

      pushTri(tPts[i], gTop[k0], sPts[i]);
      pushTri(sPts[i], gTop[k0], gTop[k1]);
      pushTri(tPts[next], sPts[i], gTop[k2]);
      pushTri(sPts[i], gTop[k1], gTop[k2]);

      pushTri(gTop[k0], gBot[k0], gBot[k1]);
      pushTri(gTop[k0], gBot[k1], gTop[k1]);
      pushTri(gTop[k1], gBot[k1], gBot[k2]);
      pushTri(gTop[k1], gBot[k2], gTop[k2]);

      pushTri(gBot[k0], pavMid[i], gBot[k1]);
      pushTri(gBot[k1], pavMid[i], gBot[k2]);
      pushTri(gBot[k0], culet, pavMid[i]);
      pushTri(pavMid[i], culet, gBot[k2]);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    return geom;
  }

  function createDiamondShaderMaterial(floorTex, useLinearHDR) {
    const vertexShader = [
      'varying vec3 vLocalPos;',
      'varying vec3 vLocalNormal;',
      'varying vec3 vWorldPos;',
      'varying vec3 vWorldNormal;',
      'varying mat3 vRotMat;',
      'void main() {',
      '  vLocalPos = position;',
      '  vLocalNormal = normalize(normal);',
      '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
      '  vWorldPos = worldPos.xyz;',
      '  vec3 c0 = modelMatrix[0].xyz;',
      '  vec3 c1 = modelMatrix[1].xyz;',
      '  vec3 c2 = modelMatrix[2].xyz;',
      '  float s = max(0.0001, length(c0));',
      '  vRotMat = mat3(c0 / s, c1 / s, c2 / s);',
      '  vWorldNormal = normalize(vRotMat * normal);',
      '  gl_Position = projectionMatrix * viewMatrix * worldPos;',
      '}'
    ].join('\n');

    const fragmentShader = [
      'uniform float uExposure;',
      'uniform float uLinearOutput;',
      'uniform float uUseBackdrop;',
      'uniform mat4 uViewProjMatrix;',
      'uniform sampler2D uFloorMap;',
      'uniform sampler2D uSceneBackdropMap;',
      'varying vec3 vLocalPos;',
      'varying vec3 vLocalNormal;',
      'varying vec3 vWorldPos;',
      'varying vec3 vWorldNormal;',
      'varying mat3 vRotMat;',
      '',
      'vec3 worldToLocalDir(vec3 d) {',
      '  return normalize(vec3(dot(vRotMat[0], d), dot(vRotMat[1], d), dot(vRotMat[2], d)));',
      '}',
      '',
      'vec3 localToWorldDir(vec3 d) {',
      '  return normalize(vRotMat * d);',
      '}',
      '',
      'void testPlane(vec3 p, vec3 d, vec3 n, float dist, inout float bestT, inout vec3 bestN) {',
      '  float denom = dot(n, d);',
      '  if (denom > 0.0001) {',
      '    float t = (dist - dot(n, p)) / denom;',
      '    if (t > 0.001 && t < bestT) {',
      '      bestT = t;',
      '      bestN = n;',
      '    }',
      '  }',
      '}',
      '',
      'void intersectDiamondHull(vec3 p, vec3 d, out float hitT, out vec3 hitN) {',
      '  hitT = 100.0;',
      '  hitN = vec3(0.0, 0.0, 1.0);',
      '  testPlane(p, d, vec3(0.0, 0.0, 1.0), 0.50, hitT, hitN);',
      '  for (int i = 0; i < 8; i++) {',
      '    float a = float(i) * 0.78539816;',
      '    float ca = cos(a); float sa = sin(a);',
      '    float aMid = a + 0.39269908;',
      '    float cm = cos(aMid); float sm = sin(aMid);',
      '    testPlane(p, d, normalize(vec3(ca * 0.566, sa * 0.566, 0.824)), 0.675, hitT, hitN);',
      '    testPlane(p, d, normalize(vec3(cm * 0.66, sm * 0.66, 0.751)), 0.735, hitT, hitN);',
      '    testPlane(p, d, vec3(ca, sa, 0.0), 1.00, hitT, hitN);',
      '    testPlane(p, d, normalize(vec3(ca * 0.653, sa * 0.653, -0.757)), 0.575, hitT, hitN);',
      '    testPlane(p, d, normalize(vec3(cm * 0.68, sm * 0.68, -0.733)), 0.595, hitT, hitN);',
      '  }',
      '}',
      '',
      'vec3 sampleJewelStudio(vec3 dirW) {',
      '  vec3 d = normalize(dirW);',
      '  // Ultra-deep dark jeweler studio backdrop for genuine transparent crystal contrast',
      '  vec3 col = vec3(0.005, 0.007, 0.011) + vec3(0.016, 0.022, 0.032) * smoothstep(0.0, 0.95, d.z);',
      '  float soft1 = pow(max(0.0, dot(d, normalize(vec3(-0.35, 0.52, 0.78)))), 18.0);',
      '  float soft2 = pow(max(0.0, dot(d, normalize(vec3(0.58, 0.24, 0.78)))), 26.0);',
      '  float rimBar = smoothstep(0.91, 0.99, abs(dot(d, normalize(vec3(0.76, -0.62, 0.18)))));',
      '  float pin1 = pow(max(0.0, dot(d, normalize(vec3(-0.18, 0.68, 0.71)))), 140.0);',
      '  float pin2 = pow(max(0.0, dot(d, normalize(vec3(0.54, -0.32, 0.78)))), 160.0);',
      '  float pin3 = pow(max(0.0, dot(d, normalize(vec3(-0.68, -0.22, 0.70)))), 120.0);',
      '  col += vec3(1.45, 1.55, 1.72) * soft1;',
      '  col += vec3(1.10, 1.38, 1.65) * soft2;',
      '  col += vec3(1.35, 1.48, 1.62) * rimBar;',
      '  col += vec3(6.5, 6.8, 7.2) * pin1;',
      '  col += vec3(5.2, 5.8, 6.6) * pin2;',
      '  col += vec3(4.6, 5.0, 5.8) * pin3;',
      '  return col;',
      '}',
      '',
      'vec3 sampleExitDirection(vec3 exitWorldPos, vec3 rayW, float ior) {',
      '  // Multi-diamond inter-refraction & velvet floor capture via HDR backdrop pre-pass',
      '  if (uUseBackdrop > 0.5 && rayW.z < 0.28) {',
      '    vec3 samplePos = exitWorldPos + rayW * (rayW.z < -0.05 ? 0.36 : 0.55);',
      '    vec4 clipPos = uViewProjMatrix * vec4(samplePos, 1.0);',
      '    if (clipPos.w > 0.001) {',
      '      vec2 screenUV = clipPos.xy / clipPos.w * 0.5 + 0.5;',
      '      vec2 dispShift = vec2((ior - 2.42) * 0.45) * rayW.xy;',
      '      vec2 refrUV = clamp(screenUV + dispShift, vec2(0.004), vec2(0.996));',
      '      if (screenUV.x > 0.01 && screenUV.x < 0.99 && screenUV.y > 0.01 && screenUV.y < 0.99) {',
      '        vec3 rawScene = texture2D(uSceneBackdropMap, refrUV).rgb;',
      '        vec3 sceneCol = mix(rawScene, pow(rawScene, vec3(2.2)), uLinearOutput);',
      '        float rimSpark = pow(clamp(1.0 - abs(rayW.z), 0.0, 1.0), 2.8) * 0.16;',
      '        if (rayW.z < -0.05) {',
      '          return sceneCol * 1.32 + vec3(0.55, 0.72, 0.95) * rimSpark;',
      '        }',
      '        return mix(sampleJewelStudio(rayW), sceneCol * 1.15 + vec3(0.45, 0.65, 0.95) * rimSpark, 0.62);',
      '      }',
      '    }',
      '  }',
      '  // Fallback direct planar velvet floor sample when pre-pass unavailable',
      '  if (rayW.z < -0.05) {',
      '    float tFloor = max(0.0, -exitWorldPos.z) / (-rayW.z);',
      '    vec2 hitXY = exitWorldPos.xy + rayW.xy * tFloor;',
      '    vec2 uv = hitXY / vec2(6.0, 7.32) + 0.5;',
      '    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {',
      '      vec3 rawFloor = texture2D(uFloorMap, uv).rgb;',
      '      vec3 floorCol = mix(rawFloor, pow(rawFloor, vec3(2.2)), uLinearOutput);',
      '      float rimSpark = pow(clamp(1.0 + rayW.z, 0.0, 1.0), 2.8) * 0.14;',
      '      return floorCol * 1.45 + vec3(0.55, 0.72, 0.95) * rimSpark;',
      '    }',
      '  }',
      '  return sampleJewelStudio(rayW);',
      '}',
      '',
      'vec3 traceChannel(vec3 startP, vec3 startDirL, float ior) {',
      '  vec3 dIn = refract(startDirL, normalize(vLocalNormal), 1.0 / ior);',
      '  if (length(dIn) < 0.001) dIn = reflect(startDirL, normalize(vLocalNormal));',
      '  dIn = normalize(dIn);',
      '  vec3 p = startP * 0.985;',
      '  vec3 accum = vec3(0.0);',
      '  float weight = 1.0;',
      '',
      '  for (int bounce = 0; bounce < 3; bounce++) {',
      '    float tHit;',
      '    vec3 nHit;',
      '    intersectDiamondHull(p, dIn, tHit, nHit);',
      '    p += dIn * tHit;',
      '    weight *= exp(-0.04 * tHit);',
      '',
      '    vec3 inwardN = -normalize(nHit);',
      '    float cosI = clamp(dot(-dIn, inwardN), 0.0, 1.0);',
      '    float sin2T = ior * ior * (1.0 - cosI * cosI);',
      '',
      '    if (sin2T >= 0.998 || bounce == 2) {',
      '      if (sin2T < 0.998) {',
      '        vec3 dOutL = normalize(refract(dIn, inwardN, ior));',
      '        vec3 dOutW = localToWorldDir(dOutL);',
      '        accum += weight * sampleExitDirection(vWorldPos, dOutW, ior);',
      '        break;',
      '      }',
      '      dIn = normalize(reflect(dIn, inwardN));',
      '      p += inwardN * 0.004;',
      '      if (bounce == 2) {',
      '        vec3 finalW = localToWorldDir(dIn);',
      '        accum += weight * sampleExitDirection(vWorldPos, finalW, ior);',
      '      }',
      '    } else {',
      '      float fOut = 0.17 + 0.83 * pow(1.0 - cosI, 4.0);',
      '      vec3 dOutL = normalize(refract(dIn, inwardN, ior));',
      '      vec3 dOutW = localToWorldDir(dOutL);',
      '      accum += weight * (1.0 - fOut) * sampleExitDirection(vWorldPos, dOutW, ior);',
      '      weight *= fOut * 1.15;',
      '      dIn = normalize(reflect(dIn, inwardN));',
      '      p += inwardN * 0.004;',
      '    }',
      '  }',
      '  return accum;',
      '}',
      '',
      'void main() {',
      '  vec3 N_w = normalize(vWorldNormal);',
      '  vec3 N_l = normalize(vLocalNormal);',
      '  if (!gl_FrontFacing) { N_w = -N_w; N_l = -N_l; }',
      '  vec3 V_w = normalize(vWorldPos - cameraPosition);',
      '  vec3 V_l = worldToLocalDir(V_w);',
      '',
      '  float ndotv = clamp(dot(-V_w, N_w), 0.0, 1.0);',
      '  float F_front = 0.17 + 0.83 * pow(1.0 - ndotv, 5.0);',
      '',
      '  // Front surface crisp mirror specular',
      '  vec3 extSpec = sampleJewelStudio(reflect(V_w, N_w));',
      '',
      '  // 5-Wavelength spectral dispersion rays through GIA polyhedron for authentic prismatic fire',
      '  float cR = traceChannel(vLocalPos, V_l, 2.385).r;',
      '  vec3  cAmber = traceChannel(vLocalPos, V_l, 2.405);',
      '  float cG = traceChannel(vLocalPos, V_l, 2.420).g;',
      '  vec3  cCyan = traceChannel(vLocalPos, V_l, 2.445);',
      '  vec3  cViolet = traceChannel(vLocalPos, V_l, 2.475);',
      '  vec3 internalColor = vec3(',
      '    cR * 0.62 + cAmber.r * 0.34 + cViolet.r * 0.14,',
      '    cAmber.g * 0.30 + cG * 0.46 + cCyan.g * 0.30,',
      '    cCyan.b * 0.36 + cViolet.b * 0.68',
      '  ) * vec3(0.98, 1.00, 1.05);',
      '',
      '  // Crisp diamond edge definition, ice clarity & micro-bevel facet-ridge scintillation',
      '  float edgeGlint = pow(1.0 - ndotv, 3.6) * 0.34;',
      '  float facetRidge = clamp(length(fwidth(vLocalNormal)) * 0.65, 0.0, 1.0);',
      '  float ridgeSpec = facetRidge * (0.28 + 0.72 * pow(clamp(dot(-V_w, N_w), 0.0, 1.0), 0.5));',
      '  vec3 hdrColor = internalColor * (1.0 - F_front * 0.88) + extSpec * F_front + vec3(0.84, 0.94, 1.0) * edgeGlint + vec3(1.55, 1.72, 1.95) * ridgeSpec * 0.32;',
      '  hdrColor *= uExposure;',
      '',
      '  if (uLinearOutput > 0.5) {',
      '    gl_FragColor = vec4(hdrColor, 1.0);',
      '  } else {',
      '    vec3 mapped = (hdrColor * (2.51 * hdrColor + 0.03)) / (hdrColor * (2.43 * hdrColor + 0.59) + 0.14);',
      '    mapped = pow(clamp(mapped, 0.0, 1.0), vec3(1.0 / 2.2));',
      '    gl_FragColor = vec4(mapped, 1.0);',
      '  }',
      '}'
    ].join('\n');

    return new THREE.ShaderMaterial({
      uniforms: {
        uExposure: { value: 1.0 },
        uLinearOutput: { value: useLinearHDR ? 1.0 : 0.0 },
        uUseBackdrop: { value: 0.0 },
        uViewProjMatrix: { value: new THREE.Matrix4() },
        uFloorMap: { value: floorTex },
        uSceneBackdropMap: { value: null }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });
  }

  /* =========================================================
     3B. Composable PBR Velvet Cushion Material + Real-Time Brushed Trail Interaction
     ========================================================= */
  function createVelvetPhysicalMaterial(velvetMaps, trailTex) {
    const preset = velvetMaps.preset || ns.getVelvetPresetData();
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 1.0,
      sheenRoughness: 0.36,
      sheenColor: new THREE.Color(preset.sheen[0], preset.sheen[1], preset.sheen[2]),
      envMapIntensity: 0.18
    });

    const customUniforms = {
      uVelvetDiffuseMap: { value: velvetMaps.map },
      uVelvetNormalMap: { value: velvetMaps.normalMap },
      uVelvetDataMap: { value: velvetMaps.dataMap },
      uTrailMap: { value: trailTex || null },
      uTrailStrength: { value: 1.0 },
      uCoreColor: { value: new THREE.Vector3(preset.core[0], preset.core[1], preset.core[2]) },
      uMidColor: { value: new THREE.Vector3(preset.mid[0], preset.mid[1], preset.mid[2]) },
      uSheenColor: { value: new THREE.Vector3(preset.sheen[0], preset.sheen[1], preset.sheen[2]) },
      uRimColor: { value: new THREE.Vector3(preset.rim[0], preset.rim[1], preset.rim[2]) },
      uEyePos: { value: new THREE.Vector3(0, 0, 6.92) },
      uKeyLightPos: { value: new THREE.Vector3(-2.4, 3.6, 7.6) }
    };
    mat.userData.velvetUniforms = customUniforms;

    mat.onBeforeCompile = function (shader) {
      Object.assign(shader.uniforms, customUniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          [
            '#include <common>',
            'varying vec2 vVelvetUv;',
            'varying vec3 vVelvetWorldPos;'
          ].join('\n')
        )
        .replace(
          '#include <project_vertex>',
          [
            '#include <project_vertex>',
            'vVelvetUv = uv;',
            'vVelvetWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
          ].join('\n')
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          [
            '#include <map_pars_fragment>',
            'uniform sampler2D uVelvetDiffuseMap;',
            'uniform sampler2D uVelvetNormalMap;',
            'uniform sampler2D uVelvetDataMap;',
            'uniform sampler2D uTrailMap;',
            'uniform float uTrailStrength;',
            'uniform vec3 uCoreColor;',
            'uniform vec3 uMidColor;',
            'uniform vec3 uSheenColor;',
            'uniform vec3 uRimColor;',
            'uniform vec3 uEyePos;',
            'uniform vec3 uKeyLightPos;',
            'varying vec2 vVelvetUv;',
            'varying vec3 vVelvetWorldPos;',
            'float vHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
            'float vNoise(vec2 p) {',
            '  vec2 i = floor(p); vec2 f = fract(p);',
            '  f = f * f * (3.0 - 2.0 * f);',
            '  return mix(mix(vHash(i), vHash(i + vec2(1.0, 0.0)), f.x), mix(vHash(i + vec2(0.0, 1.0)), vHash(i + vec2(1.0, 1.0)), f.x), f.y);',
            '}'
          ].join('\n')
        )
        .replace(
          '#include <map_fragment>',
          [
            '#include <map_fragment>',
            'vec3 V_velvetW = normalize(uEyePos - vVelvetWorldPos);',
            'float vH0 = texture2D(uVelvetDataMap, vVelvetUv).r;',
            'vec2 vParDir = V_velvetW.xy / max(0.45, V_velvetW.z);',
            'vec2 vUv1 = clamp(vVelvetUv + vParDir * (vH0 - 0.5) * 0.022, vec2(0.002), vec2(0.998));',
            'float vH1 = texture2D(uVelvetDataMap, vUv1).r;',
            'vec2 velvetUvP = clamp(vVelvetUv + vParDir * (((vH0 + vH1) * 0.5) - 0.5) * 0.028, vec2(0.002), vec2(0.998));',
            'vec4 vDataS = texture2D(uVelvetDataMap, velvetUvP);',
            'float velvetFoldH = vDataS.r;',
            'vec2 velvetNapDir = normalize(vDataS.gb * 2.0 - 1.0 + vec2(0.001));',
            'float velvetFuzz = vDataS.a;',
            'vec4 velvetTrS = texture2D(uTrailMap, velvetUvP);',
            'float velvetTrailDepth = clamp(velvetTrS.r * uTrailStrength, 0.0, 1.0);',
            'vec2 velvetTrailVec = velvetTrS.gb * 2.0 - 1.0;',
            'float velvetTrailFresh = clamp(velvetTrS.a * uTrailStrength, 0.0, 1.0);',
            'if (length(velvetTrailVec) > 0.08) {',
            '  velvetNapDir = normalize(mix(velvetNapDir, normalize(velvetTrailVec), clamp(velvetTrailDepth * 0.92, 0.0, 0.92)));',
            '}',
            'float velvetNapAlign = dot(velvetNapDir, normalize(uKeyLightPos.xy - vVelvetWorldPos.xy + vec2(0.001)));',
            'vec2 vPerpDir = vec2(-velvetNapDir.y, velvetNapDir.x);',
            'vec2 vBrushedUV = vec2(dot(velvetUvP, velvetNapDir) * 62.0, dot(velvetUvP, vPerpDir) * 185.0);',
            'float vBrushStreak = vNoise(vBrushedUV);',
            'float vTipA = vNoise(velvetUvP * 235.0);',
            'float vTipB = vNoise(velvetUvP * 235.0 + vec2(31.7, 17.3));',
            'float vNapCloud = vNoise(velvetUvP * 9.5 + velvetNapDir * 0.65);',
            'float velvetFiberTooth = mix(vTipA, vBrushStreak, 0.55) * (0.72 + 0.56 * vNapCloud);',
            'vec2 velvetMicroPerturb = vec2(vTipA - 0.5, vTipB - 0.5) * 0.30;',
            'float velvetFoldAO = (0.14 + 0.86 * pow(clamp(velvetFoldH, 0.0, 1.0), 0.82)) * (1.0 - 0.42 * velvetTrailDepth);',
            'vec3 vDiffTex = texture2D(uVelvetDiffuseMap, velvetUvP).rgb;',
            'diffuseColor.rgb = mix(uCoreColor, uMidColor, velvetFoldAO * (0.35 + 0.75 * velvetFuzz * (0.65 + 0.55 * velvetFiberTooth))) + vDiffTex * 0.14;'
          ].join('\n')
        )
        .replace(
          '#include <normal_fragment_maps>',
          [
            '#include <normal_fragment_maps>',
            'vec3 vRawN = texture2D(uVelvetNormalMap, velvetUvP).xyz * 2.0 - 1.0;',
            'vec2 vTrTexel = vec2(1.0 / 256.0, 1.0 / 312.0);',
            'float vTrR = texture2D(uTrailMap, clamp(velvetUvP + vec2(vTrTexel.x, 0.0), 0.002, 0.998)).r;',
            'float vTrL = texture2D(uTrailMap, clamp(velvetUvP - vec2(vTrTexel.x, 0.0), 0.002, 0.998)).r;',
            'float vTrU = texture2D(uTrailMap, clamp(velvetUvP + vec2(0.0, vTrTexel.y), 0.002, 0.998)).r;',
            'float vTrD = texture2D(uTrailMap, clamp(velvetUvP - vec2(0.0, vTrTexel.y), 0.002, 0.998)).r;',
            'vec2 vTrSlope = vec2(vTrR - vTrL, vTrU - vTrD) * 4.4 * uTrailStrength;',
            'vec3 velvetWorldN = normalize(vec3(vRawN.x * 2.1 + velvetMicroPerturb.x + vTrSlope.x, vRawN.y * 2.1 + velvetMicroPerturb.y + vTrSlope.y, max(0.24, vRawN.z)));',
            'vec3 velvetWorldNap = normalize(vec3(velvetWorldN.xy + velvetNapDir * 0.36, max(0.22, velvetWorldN.z)));',
            'normal = normalize((viewMatrix * vec4(velvetWorldN, 0.0)).xyz);'
          ].join('\n')
        )
        .replace(
          '#include <lights_fragment_end>',
          [
            '#include <lights_fragment_end>',
            'vec3 L1_v = normalize(uKeyLightPos - vVelvetWorldPos);',
            'vec3 H1_v = normalize(V_velvetW + L1_v);',
            'float ndh1_v = clamp(dot(velvetWorldNap, H1_v), 0.0, 0.999);',
            'float cot2H1_v = (ndh1_v * ndh1_v) / max(0.0001, 1.0 - ndh1_v * ndh1_v);',
            'float ash1_v = exp(-cot2H1_v / (0.34 * 0.34)) * pow(1.0 - ndh1_v, 0.65);',
            'vec3 L2_v = normalize(vec3(3.6, -2.8, 3.8) - vVelvetWorldPos);',
            'vec3 H2_v = normalize(V_velvetW + L2_v);',
            'float ndh2_v = clamp(dot(velvetWorldNap, H2_v), 0.0, 0.999);',
            'float cot2H2_v = (ndh2_v * ndh2_v) / max(0.0001, 1.0 - ndh2_v * ndh2_v);',
            'float ash2_v = exp(-cot2H2_v / (0.36 * 0.36)) * pow(1.0 - ndh2_v, 0.65);',
            'float ndv_v = clamp(dot(velvetWorldNap, V_velvetW), 0.0, 1.0);',
            'vec2 vCentered = (velvetUvP - 0.5) * vec2(1.45, 1.45);',
            'float vRad = length(vCentered);',
            'float cushionMask_v = smoothstep(1.18, 0.42, vRad);',
            'float charlie_v = pow(1.0 - ndv_v, 3.4) * (0.40 + 0.85 * velvetFuzz * velvetFiberTooth) * cushionMask_v;',
            'float fuzzMod_v = 0.55 + 0.85 * velvetFiberTooth;',
            'float trailRimWall = clamp(length(vTrSlope) * 1.15, 0.0, 1.0);',
            'float trailSheenMod = 1.0 + velvetTrailDepth * (0.28 * velvetNapAlign - 0.22) + trailRimWall * 0.42;',
            'vec3 trailCombWake = (uRimColor * (velvetTrailDepth * smoothstep(0.05, 0.95, velvetNapAlign) * 0.24 + trailRimWall * 0.18) + uSheenColor * velvetTrailFresh * 0.16) * (0.35 + 1.15 * vBrushStreak * velvetFiberTooth) * cushionMask_v;',
            'vec3 ashCharlieLobe =',
            '  (uSheenColor * (ash1_v * 0.68 + charlie_v * 0.72) * velvetFoldAO * fuzzMod_v +',
            '  uRimColor * (ash2_v * 0.36 * velvetFoldAO * fuzzMod_v * cushionMask_v)) * trailSheenMod + trailCombWake;',
            'float vig_v = clamp(1.02 - dot(vCentered, vCentered) * 0.62, 0.14, 1.0);',
            'reflectedLight.directDiffuse *= (0.48 + 0.52 * velvetFoldAO) * vig_v;',
            'reflectedLight.indirectDiffuse *= (0.35 + 0.55 * velvetFoldAO) * vig_v;',
            'reflectedLight.indirectSpecular *= 0.28 * vig_v;',
            'reflectedLight.directSpecular += ashCharlieLobe * vig_v;'
          ].join('\n')
        );
    };

    mat.customProgramCacheKey = function () {
      return 'velvet_pbr_trails_v2';
    };

    return mat;
  }

  function isChainVisible(obj) {
    let cur = obj;
    while (cur) {
      if (!cur.visible) return false;
      cur = cur.parent;
    }
    return true;
  }

  /* =========================================================
     4. Two-Pass Off-Axis Portal 3D Scene Orchestrator
     ========================================================= */
  function Scene3D(canvas, watchWidthPx, watchHeightPx) {
    this.canvas = canvas;
    this.watchWidthPx = watchWidthPx;
    this.watchHeightPx = watchHeightPx;

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.transmissionResolutionScale = 1.0;

    this.toneMappingMode = 'neutral';
    this.bloomStrength = 0.32;
    this.trailStrength = 1.0;
    this.trailBuffer = new SurfaceTrailBuffer(256, 312);

    // Pass 2 Scene: 3D Watch Hardware floating over transparent Chrome poster
    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.baseCameraZ = 13.6;
    this.camera = new THREE.PerspectiveCamera(32, watchWidthPx / watchHeightPx, 0.1, 45);
    this.camera.position.set(0, 0, this.baseCameraZ);
    this.camera.lookAt(0, 0, 0);

    // Pass 1 Scene: Virtual interior rendered via asymmetric off-axis portal projection
    this.dioramaScene = new THREE.Scene();
    this.dioramaScene.background = new THREE.Color(0x040508);

    this.offAxisCamera = new THREE.PerspectiveCamera(36, 4.0 / 4.88, 0.5, 28);

    const canHalfFloatRT =
      this.renderer.capabilities.isWebGL2 &&
      (Boolean(this.renderer.extensions.get('EXT_color_buffer_float')) ||
        Boolean(this.renderer.extensions.get('EXT_color_buffer_half_float')));

    this.useLinearHDRRT = canHalfFloatRT;
    if (canHalfFloatRT) {
      this.screenRT = new THREE.WebGLRenderTarget(1024, 1248, {
        type: THREE.HalfFloatType,
        samples: 4,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false
      });
      this.refractBackdropRT = new THREE.WebGLRenderTarget(512, 624, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false
      });
    } else {
      this.screenRT = new THREE.WebGLRenderTarget(1024, 1248, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false
      });
      this.refractBackdropRT = null;
    }

    this._tmpViewProjMat = new THREE.Matrix4();

    this.resize(watchWidthPx, watchHeightPx);

    const initEnv = ns.getStudioEnvMap(this.renderer);
    this.scene.environment = initEnv;
    this.dioramaScene.environment = initEnv;

    this.contactShadowTex = ns.getContactShadowTexture();
    this.diamondCausticTex = ns.getDiamondCausticTexture();

    this.parallaxStrength = 1.0;
    this.meshes = [];
    this.shadowDecals = [];
    this.currentThemeId = 'tennis';

    this.raycaster = new THREE.Raycaster();
    this.ndcVec = new THREE.Vector2();

    this.watchPivot = new THREE.Group();
    this.scene.add(this.watchPivot);

    this.hardware = new ns.WatchHardware3D();
    this.hardware.group.position.set(0, 0, -0.52);

    const Addons = global.THREE_ADDONS;
    if (Addons && Addons.EffectComposer && this.useLinearHDRRT) {
      this.dioramaComposer = new Addons.EffectComposer(this.renderer, this.screenRT);
      this.dioramaComposer.setPixelRatio(1);
      this.dioramaComposer.setSize(1024, 1248);
      this.dioramaComposer.renderToScreen = false;
      this.dioramaRenderPass = new Addons.RenderPass(this.dioramaScene, this.offAxisCamera);
      this.dioramaComposer.addPass(this.dioramaRenderPass);
      this.dioramaBloomPass = new Addons.UnrealBloomPass(
        new THREE.Vector2(1024, 1248),
        this.bloomStrength,
        0.32,
        1.95
      );
      this.dioramaComposer.addPass(this.dioramaBloomPass);
      this.hardware.setScreenTexture(this.dioramaComposer.readBuffer.texture);
    } else {
      this.dioramaComposer = null;
      this.dioramaBloomPass = null;
      this.hardware.setScreenTexture(this.screenRT.texture);
    }

    if (!this.useLinearHDRRT && this.hardware.oledScreenMat) {
      this.hardware.oledScreenMat.toneMapped = false;
    }
    this.watchPivot.add(this.hardware.group);
    this.scene.add(this.hardware.posterShadowMesh);

    this.setupLighting();
    this.setupDioramaStage();
    this.hardware.applyHardwarePBRMaps(ns.getWatchHardwareMaps());
  }

  Scene3D.prototype.resize = function (widthPx, heightPx) {
    if (widthPx && heightPx) {
      this.watchWidthPx = widthPx;
      this.watchHeightPx = heightPx;
    }
    const dpr = Math.min(global.devicePixelRatio || 1, 2.5);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.watchWidthPx, this.watchHeightPx, false);
    this.camera.aspect = this.watchWidthPx / this.watchHeightPx;
    this.camera.updateProjectionMatrix();
  };

  Scene3D.prototype.setupLighting = function () {
    // Hardware exterior studio lighting (Pass 2) - Three r187 raking 3-point + opposing lower rim
    this.hemiLight = new THREE.HemisphereLight(0xf6f9ff, 0x162214, 1.05);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff7ea, 4.25);
    this.keyLight.position.set(-5.6, 6.4, 8.2);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xbcd8ff, 1.35);
    this.fillLight.position.set(5.8, -3.6, 5.4);
    this.scene.add(this.fillLight);

    this.topRimLight = new THREE.DirectionalLight(0xfff1dc, 1.85);
    this.topRimLight.position.set(1.8, 7.2, 2.6);
    this.scene.add(this.topRimLight);

    this.lowRimLight = new THREE.DirectionalLight(0xdce8ff, 0.90);
    this.lowRimLight.position.set(-4.8, -5.2, 4.2);
    this.scene.add(this.lowRimLight);

    // Interior portal diorama studio lighting (Pass 1) - raking 48 deg key + opposing kicker rim
    this.dioramaHemi = new THREE.HemisphereLight(0xf8fbff, 0x121618, 0.72);
    this.dioramaScene.add(this.dioramaHemi);

    this.dioramaKeyLight = new THREE.DirectionalLight(0xfff7ea, 2.95);
    this.dioramaKeyLight.position.set(-4.4, 4.6, 5.2);
    this.dioramaKeyLight.castShadow = true;
    this.dioramaKeyLight.shadow.mapSize.width = 2048;
    this.dioramaKeyLight.shadow.mapSize.height = 2048;
    this.dioramaKeyLight.shadow.camera.near = 1.5;
    this.dioramaKeyLight.shadow.camera.far = 16.0;
    this.dioramaKeyLight.shadow.camera.left = -3.4;
    this.dioramaKeyLight.shadow.camera.right = 3.4;
    this.dioramaKeyLight.shadow.camera.top = 3.8;
    this.dioramaKeyLight.shadow.camera.bottom = -3.8;
    this.dioramaKeyLight.shadow.bias = -0.00025;
    this.dioramaKeyLight.shadow.normalBias = 0.016;
    this.dioramaKeyLight.shadow.radius = 2.2;
    this.dioramaScene.add(this.dioramaKeyLight);

    this.dioramaFillLight = new THREE.DirectionalLight(0xc2ddff, 0.78);
    this.dioramaFillLight.position.set(3.4, -2.6, 4.8);
    this.dioramaScene.add(this.dioramaFillLight);

    this.dioramaRimLight = new THREE.DirectionalLight(0x9bc4ff, 1.05);
    this.dioramaRimLight.position.set(4.2, -3.4, 2.8);
    this.dioramaScene.add(this.dioramaRimLight);

    this.vaultRimLight = new THREE.PointLight(0xffd266, 0.0, 9.5, 1.2);
    this.vaultRimLight.position.set(0, -1.0, 3.2);
    this.dioramaScene.add(this.vaultRimLight);
  };

  Scene3D.prototype.setupDioramaStage = function () {
    const initFloor = ns.getFloorMaps('tennis');
    this.floorEmissiveBase = 0.24;
    this.floorMat = new THREE.MeshStandardMaterial({
      map: initFloor.map,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: initFloor.map,
      emissiveIntensity: this.floorEmissiveBase,
      normalMap: initFloor.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughnessMap: initFloor.roughnessMap,
      roughness: 1.0,
      metalness: 0.04,
      envMapIntensity: 0.35
    });

    const floorTrailUniforms = {
      uTrailMap: { value: this.trailBuffer.texture },
      uTrailStrength: { value: this.trailStrength },
      uTrailThemeMode: { value: 0.0 }
    };
    this.floorMat.userData.trailUniforms = floorTrailUniforms;
    this.floorMat.onBeforeCompile = function (shader) {
      Object.assign(shader.uniforms, floorTrailUniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          ['#include <common>', 'varying vec2 vFloorTrailUv;'].join('\n')
        )
        .replace(
          '#include <project_vertex>',
          ['#include <project_vertex>', 'vFloorTrailUv = uv;'].join('\n')
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          [
            '#include <map_pars_fragment>',
            'uniform sampler2D uTrailMap;',
            'uniform float uTrailStrength;',
            'uniform float uTrailThemeMode;',
            'varying vec2 vFloorTrailUv;'
          ].join('\n')
        )
        .replace(
          '#include <map_fragment>',
          [
            '#include <map_fragment>',
            'vec4 flTrS = texture2D(uTrailMap, vFloorTrailUv);',
            'float flTrDepth = clamp(flTrS.r * uTrailStrength, 0.0, 1.0);',
            'vec2 flTrDir = flTrS.gb * 2.0 - 1.0;',
            'float flTrFresh = clamp(flTrS.a * uTrailStrength, 0.0, 1.0);',
            'if (uTrailThemeMode < 0.5) {',
            '  // Soft loose crushed-brick clay: dry dust displacement along tracks',
            '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.16, 0.09), flTrDepth * 0.16 + flTrFresh * 0.10);',
            '} else if (uTrailThemeMode > 2.5) {',
            '  // Elastic grass blades: directional bent-turf nap shading',
            '  float flTurfBend = dot(flTrDir, vec2(0.55, 0.83));',
            '  diffuseColor.rgb *= (1.0 + flTurfBend * flTrDepth * 0.24 - (1.0 - abs(flTurfBend)) * flTrDepth * 0.07);',
            '}'
          ].join('\n')
        )
        .replace(
          '#include <roughnessmap_fragment>',
          [
            '#include <roughnessmap_fragment>',
            'if (uTrailThemeMode > 0.5 && uTrailThemeMode < 1.5) {',
            '  // Rigid lacquered maple: only fleeting dry rubber chirp haze under extreme high-speed skids',
            '  roughnessFactor = mix(roughnessFactor, 0.80, flTrFresh * 0.38);',
            '}'
          ].join('\n')
        )
        .replace(
          '#include <normal_fragment_maps>',
          [
            '#include <normal_fragment_maps>',
            'if (uTrailThemeMode < 0.5 || uTrailThemeMode > 2.5) {',
            '  vec2 flTrTexel = vec2(1.0 / 256.0, 1.0 / 312.0);',
            '  float flTrR = texture2D(uTrailMap, clamp(vFloorTrailUv + vec2(flTrTexel.x, 0.0), 0.002, 0.998)).r;',
            '  float flTrL = texture2D(uTrailMap, clamp(vFloorTrailUv - vec2(flTrTexel.x, 0.0), 0.002, 0.998)).r;',
            '  float flTrU = texture2D(uTrailMap, clamp(vFloorTrailUv + vec2(0.0, flTrTexel.y), 0.002, 0.998)).r;',
            '  float flTrD = texture2D(uTrailMap, clamp(vFloorTrailUv - vec2(0.0, flTrTexel.y), 0.002, 0.998)).r;',
            '  vec2 flTrSlope = vec2(flTrR - flTrL, flTrU - flTrD) * (uTrailThemeMode < 0.5 ? 1.6 : 1.8) * uTrailStrength;',
            '  normal = normalize(normal + (viewMatrix * vec4(flTrSlope.x, flTrSlope.y, 0.0, 0.0)).xyz);',
            '}'
          ].join('\n')
        )
        .replace(
          '#include <lights_fragment_end>',
          [
            '#include <lights_fragment_end>',
            'if (uTrailThemeMode > 0.5 && uTrailThemeMode < 1.5) {',
            '  // Lacquered maple hardwood: instantaneous warm orange leather color bleed & gloss reflection underneath ball',
            '  reflectedLight.indirectDiffuse += vec3(0.16, 0.055, 0.012) * flTrDepth * 0.42;',
            '  reflectedLight.indirectSpecular += vec3(0.24, 0.09, 0.025) * pow(flTrDepth, 1.25) * 0.34;',
            '} else if (uTrailThemeMode >= 1.5 && uTrailThemeMode < 2.5) {',
            '  // Polished obsidian vault stone: restrained 24K molten-gold reflection & warm bounce strictly under ingot',
            '  reflectedLight.indirectSpecular += vec3(0.58, 0.40, 0.11) * pow(flTrDepth, 1.35) * 0.34;',
            '  reflectedLight.indirectDiffuse += vec3(0.20, 0.13, 0.03) * flTrDepth * 0.16;',
            '}'
          ].join('\n')
        );
    };
    this.floorMat.customProgramCacheKey = function () {
      return 'floor_surface_physics_v2';
    };

    // 1.5x extended floor (6.00 x 7.32) ensures zero borders or box walls even at extreme off-axis tilt
    const floorGeo = new THREE.PlaneGeometry(6.0, 7.32);
    this.floorMesh = new THREE.Mesh(floorGeo, this.floorMat);
    this.floorMesh.position.set(0, 0, 0);
    this.floorMesh.receiveShadow = true;
    this.dioramaScene.add(this.floorMesh);

    this.shadowDecalGeo = new THREE.PlaneGeometry(1, 1);
    this.shadowDecalBaseMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.58
    });
    this.causticDecalBaseMat = new THREE.MeshBasicMaterial({
      map: this.diamondCausticTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.92
    });
  };

  Scene3D.prototype.createMaterialForTheme = function (themeId) {
    const maps = ns.getObjectMaps(themeId);

    if (themeId === 'tennis') {
      return new THREE.MeshPhysicalMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        normalScale: new THREE.Vector2(2.3, 2.3),
        roughnessMap: maps.roughnessMap,
        roughness: 1.0,
        metalness: 0.0,
        specularIntensity: 0.12,
        sheen: 0.42,
        sheenRoughness: 0.88,
        sheenColor: new THREE.Color(0xb8cf42),
        envMapIntensity: 0.10
      });
    }
    if (themeId === 'basketball') {
      return new THREE.MeshPhysicalMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        normalScale: new THREE.Vector2(2.4, 2.4),
        roughnessMap: maps.roughnessMap,
        roughness: 1.0,
        metalness: 0.0,
        specularIntensity: 0.38,
        clearcoat: 0.0,
        envMapIntensity: 0.22
      });
    }
    if (themeId === 'soccer') {
      return new THREE.MeshPhysicalMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        normalScale: new THREE.Vector2(2.0, 2.0),
        roughnessMap: maps.roughnessMap,
        roughness: 1.0,
        metalness: 0.0,
        specularIntensity: 0.42,
        clearcoat: 0.08,
        clearcoatRoughness: 0.46,
        envMapIntensity: 0.26
      });
    }
    if (themeId === 'goldBar') {
      return new THREE.MeshPhysicalMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        normalScale: new THREE.Vector2(1.9, 1.9),
        roughnessMap: maps.roughnessMap,
        anisotropyMap: maps.anisotropyMap || null,
        anisotropy: 0.92,
        anisotropyRotation: 0.0,
        clearcoat: 0.0,
        specularColor: new THREE.Color(0xfff0b0),
        color: 0xf4c44a,
        metalness: 1.0,
        roughness: 1.0,
        envMapIntensity: 1.72
      });
    }
    const floorMaps = ns.getFloorMaps('diamond');
    return createDiamondShaderMaterial(floorMaps.map, this.useLinearHDRRT);
  };

  Scene3D.prototype.applyVelvetMapsToShader = function (velvetMaps) {
    if (!this.velvetFloorMat) {
      this.velvetFloorMat = createVelvetPhysicalMaterial(velvetMaps, this.trailBuffer.texture);
      if (this.velvetFloorMat.userData && this.velvetFloorMat.userData.velvetUniforms) {
        this.velvetFloorMat.userData.velvetUniforms.uTrailStrength.value = this.trailStrength;
      }
      return;
    }
    const u = this.velvetFloorMat.userData && this.velvetFloorMat.userData.velvetUniforms;
    const preset = velvetMaps.preset || ns.getVelvetPresetData();
    if (u) {
      u.uVelvetDiffuseMap.value = velvetMaps.map;
      u.uVelvetNormalMap.value = velvetMaps.normalMap;
      u.uVelvetDataMap.value = velvetMaps.dataMap;
      u.uTrailMap.value = this.trailBuffer.texture;
      u.uTrailStrength.value = this.trailStrength;
      u.uCoreColor.value.set(preset.core[0], preset.core[1], preset.core[2]);
      u.uMidColor.value.set(preset.mid[0], preset.mid[1], preset.mid[2]);
      u.uSheenColor.value.set(preset.sheen[0], preset.sheen[1], preset.sheen[2]);
      u.uRimColor.value.set(preset.rim[0], preset.rim[1], preset.rim[2]);
    }
    if (this.velvetFloorMat.sheenColor) {
      this.velvetFloorMat.sheenColor.setRGB(preset.sheen[0], preset.sheen[1], preset.sheen[2]);
    }
  };

  Scene3D.prototype.applyThemeMaterialSettings = function (themeId) {
    const isLuxury = themeId === 'diamond' || themeId === 'goldBar';
    const floorMaps = ns.getFloorMaps(themeId);

    if (this.floorMat && this.floorMat.userData && this.floorMat.userData.trailUniforms) {
      const tu = this.floorMat.userData.trailUniforms;
      tu.uTrailThemeMode.value =
        themeId === 'basketball' ? 1.0 : themeId === 'goldBar' ? 2.0 : themeId === 'soccer' ? 3.0 : 0.0;
      tu.uTrailStrength.value = this.trailStrength;
    }

    if (themeId === 'diamond') {
      this.applyVelvetMapsToShader(floorMaps);
      this.floorMesh.material = this.velvetFloorMat;
    } else {
      this.floorMesh.material = this.floorMat;
      this.floorMat.map = floorMaps.map;
      this.floorMat.emissive.setHex(0xffffff);
      this.floorMat.emissiveMap = floorMaps.map;
      this.floorEmissiveBase = isLuxury ? 0.014 : themeId === 'basketball' ? 0.014 : 0.012;
      this.floorMat.emissiveIntensity = this.floorEmissiveBase;
      this.floorMat.normalMap = floorMaps.normalMap;
      this.floorMat.roughnessMap = floorMaps.roughnessMap;
      this.floorMat.color.setHex(0xffffff);

      if (themeId === 'goldBar') {
        this.floorMat.metalness = 0.34;
        this.floorMat.envMapIntensity = 0.78;
        this.floorMat.normalScale.set(0.75, 0.75);
      } else if (themeId === 'basketball') {
        this.floorMat.metalness = 0.03;
        this.floorMat.envMapIntensity = 0.42;
        this.floorMat.normalScale.set(0.72, 0.72);
      } else {
        this.floorMat.metalness = 0.01;
        this.floorMat.envMapIntensity = 0.12;
        this.floorMat.normalScale.set(1.15, 1.15);
      }
      this.floorMat.needsUpdate = true;
    }

    this.dioramaKeyLight.color.setHex(isLuxury ? 0xfff7ea : 0xfff4e4);
    this.dioramaHemi.color.setHex(isLuxury ? 0xf8fbff : 0xdbe6f5);
    this.dioramaHemi.groundColor.setHex(isLuxury ? 0x121618 : 0x080a0c);
    this.dioramaHemi.intensity = isLuxury ? 0.62 : 0.18;

    this.dioramaFillLight.color.setHex(isLuxury ? 0xc2ddff : 0xa8c4e8);
    this.dioramaFillLight.intensity = isLuxury ? 0.76 : 0.16;

    if (this.dioramaRimLight) {
      if (themeId === 'goldBar') {
        this.dioramaRimLight.position.set(4.2, -3.4, 2.8);
        this.dioramaRimLight.color.setHex(0xffe0a6);
        this.dioramaRimLight.intensity = 1.15;
      } else if (themeId === 'diamond') {
        this.dioramaRimLight.position.set(4.2, -3.4, 2.8);
        this.dioramaRimLight.color.setHex(0xa8dcff);
        this.dioramaRimLight.intensity = 1.25;
      } else if (themeId === 'basketball') {
        this.dioramaRimLight.position.set(4.8, -4.0, 0.75);
        this.dioramaRimLight.color.setHex(0xffd2a4);
        this.dioramaRimLight.intensity = 0.58;
      } else {
        this.dioramaRimLight.position.set(4.8, -4.0, 0.75);
        this.dioramaRimLight.color.setHex(0xd8e8ff);
        this.dioramaRimLight.intensity = 0.52;
      }
    }

    if (themeId === 'goldBar') {
      this.vaultRimLight.color.setHex(0xffd15c);
      this.vaultRimLight.intensity = 4.2;
    } else if (themeId === 'diamond') {
      this.vaultRimLight.color.setHex(0xb8ecff);
      this.vaultRimLight.intensity = 9.5;
    } else {
      this.vaultRimLight.intensity = 0.0;
    }
  };

  Scene3D.prototype.rebuildBodies = function (themeId, physicsBodies) {
    this.currentThemeId = themeId;
    if (this.trailBuffer) {
      this.trailBuffer.clear();
    }

    for (let i = 0; i < this.meshes.length; i += 1) {
      this.dioramaScene.remove(this.meshes[i]);
    }
    for (let i = 0; i < this.shadowDecals.length; i += 1) {
      this.dioramaScene.remove(this.shadowDecals[i]);
      this.shadowDecals[i].material.dispose();
    }
    this.meshes = [];
    this.shadowDecals = [];

    if (this.sharedGeo) this.sharedGeo.dispose();
    if (this.sharedMat) this.sharedMat.dispose();

    this.applyThemeMaterialSettings(themeId);
    this.sharedMat = this.createMaterialForTheme(themeId);

    if (themeId === 'tennis') {
      this.sharedGeo = createSculptedTennisGeometry();
    } else if (themeId === 'basketball') {
      this.sharedGeo = createSculptedBasketballGeometry();
    } else if (themeId === 'soccer') {
      this.sharedGeo = createSculptedSoccerGeometry();
    } else if (themeId === 'goldBar') {
      const first = physicsBodies[0] || { hx: 0.54, hy: 0.24, hz: 0.14 };
      this.sharedGeo = createBeveledGoldBarGeometry(first.hx, first.hy, first.hz);
    } else {
      this.sharedGeo = createBrilliantDiamondGeometry();
    }

    for (let i = 0; i < physicsBodies.length; i += 1) {
      const b = physicsBodies[i];
      const mesh = new THREE.Mesh(this.sharedGeo, this.sharedMat);
      // Diamonds stay transparent (casting crisp refractive caustic + thin girdle AO via decal below)
      mesh.castShadow = themeId !== 'diamond';
      mesh.receiveShadow = themeId !== 'diamond';

      if (themeId !== 'goldBar') {
        mesh.scale.set(b.r, b.r, b.r);
      }
      mesh.position.set(b.x, b.y, b.z);
      mesh.quaternion.copy(b.q);

      this.dioramaScene.add(mesh);
      this.meshes.push(mesh);

      const decalMat =
        themeId === 'diamond' ? this.causticDecalBaseMat.clone() : this.shadowDecalBaseMat.clone();
      const decal = new THREE.Mesh(this.shadowDecalGeo, decalMat);
      const decalW = themeId === 'goldBar' ? b.hx * 2.5 : b.r * 2.5;
      const decalH = themeId === 'goldBar' ? b.hy * 2.7 : b.r * 2.5;
      decal.scale.set(decalW, decalH, 1);
      decal.position.set(b.x, b.y, 0.008);
      this.dioramaScene.add(decal);
      this.shadowDecals.push(decal);
    }
  };

  Scene3D.prototype.refreshPhotographicMaterials = function () {
    this.hardware.applyHardwarePBRMaps(ns.getWatchHardwareMaps());
    if (this.velvetFloorMat) {
      this.applyVelvetMapsToShader(ns.getFloorMaps('diamond'));
    }
    this.applyThemeMaterialSettings(this.currentThemeId);

    if (this.currentThemeId === 'diamond') {
      if (this.sharedMat && this.sharedMat.uniforms && this.sharedMat.uniforms.uFloorMap) {
        this.sharedMat.uniforms.uFloorMap.value = ns.getFloorMaps('diamond').map;
      }
      return;
    }

    if (this.sharedMat) {
      const oldMat = this.sharedMat;
      const newMat = this.createMaterialForTheme(this.currentThemeId);
      this.sharedMat = newMat;
      for (let i = 0; i < this.meshes.length; i += 1) {
        this.meshes[i].material = newMat;
      }
      oldMat.dispose();
    }
  };

  Scene3D.prototype.setCaseVariant = function (variant) {
    this.hardware.setCaseVariant(variant);
  };

  Scene3D.prototype.setToneMapping = function (mode) {
    this.toneMappingMode = mode || 'neutral';
    if (this.toneMappingMode === 'agx') {
      this.renderer.toneMapping = THREE.AgXToneMapping;
    } else if (this.toneMappingMode === 'aces') {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    } else {
      this.renderer.toneMapping = THREE.NeutralToneMapping;
    }
  };

  Scene3D.prototype.setBloomStrength = function (val) {
    const clamped = Math.max(0, Math.min(1.5, Number.isFinite(val) ? val : 0.32));
    this.bloomStrength = clamped;
    if (this.dioramaBloomPass && this.currentThemeId === 'diamond') {
      this.dioramaBloomPass.strength = clamped;
    }
  };

  Scene3D.prototype.setTrailStrength = function (val) {
    const clamped = Math.max(0, Math.min(2.0, Number.isFinite(val) ? val : 1.0));
    this.trailStrength = clamped;
    if (this.velvetFloorMat && this.velvetFloorMat.userData && this.velvetFloorMat.userData.velvetUniforms) {
      this.velvetFloorMat.userData.velvetUniforms.uTrailStrength.value = clamped;
    }
    if (this.floorMat && this.floorMat.userData && this.floorMat.userData.trailUniforms) {
      this.floorMat.userData.trailUniforms.uTrailStrength.value = clamped;
    }
  };

  Scene3D.prototype.setVelvetPreset = function (presetId) {
    ns.setVelvetPreset(presetId);
    const velvetMaps = ns.getFloorMaps('diamond');
    this.applyVelvetMapsToShader(velvetMaps);
    if (this.currentThemeId === 'diamond') {
      this.floorMesh.material = this.velvetFloorMat;
      if (this.sharedMat && this.sharedMat.uniforms && this.sharedMat.uniforms.uFloorMap) {
        this.sharedMat.uniforms.uFloorMap.value = velvetMaps.map;
      }
    }
  };

  Scene3D.prototype.setStudioHDRI = function (presetId) {
    const self = this;
    ns.loadStudioHDRI(this.renderer, presetId, function (envTex) {
      if (envTex) {
        self.scene.environment = envTex;
        self.dioramaScene.environment = envTex;
      }
    });
  };

  Scene3D.prototype.updateHUD = function (state) {
    this.hardware.updateHUD(state);
  };

  Scene3D.prototype.spinCrown = function (deltaRad) {
    this.hardware.spinCrown(deltaRad);
  };

  Scene3D.prototype.hitTestHardware = function (clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    this.ndcVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndcVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.ndcVec, this.camera);
    const targets = this.hardware.getInteractiveTargets().filter(isChainVisible);
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length > 0 && hits[0].object.userData && hits[0].object.userData.hitTag) {
      return hits[0].object.userData.hitTag;
    }
    return null;
  };

  Scene3D.prototype.syncAndRender = function (physicsBodies, gx, gy, aodMode, watchRotX, watchRotY, watchRotZ) {
    const isLuxuryTheme = this.currentThemeId === 'diamond' || this.currentThemeId === 'goldBar';
    const targetExp = isLuxuryTheme ? (aodMode ? 0.54 : 1.08) : aodMode ? 0.48 : 0.92;
    this.renderer.toneMappingExposure += (targetExp - this.renderer.toneMappingExposure) * 0.15;

    const targetEmissive = this.floorEmissiveBase * (aodMode ? 0.45 : 1.0);
    this.floorMat.emissiveIntensity += (targetEmissive - this.floorMat.emissiveIntensity) * 0.15;

    if (this.sharedMat && this.sharedMat.uniforms && this.sharedMat.uniforms.uExposure) {
      this.sharedMat.uniforms.uExposure.value = this.useLinearHDRRT
        ? (aodMode ? 0.62 : 1.06)
        : this.renderer.toneMappingExposure * 1.1;
    }

    for (let i = 0; i < physicsBodies.length && i < this.meshes.length; i += 1) {
      const b = physicsBodies[i];
      const m = this.meshes[i];
      m.position.set(b.x, b.y, b.z);
      m.quaternion.copy(b.q);

      const decal = this.shadowDecals[i];
      if (decal) {
        const floorDist = Math.max(0, b.z - (this.currentThemeId === 'goldBar' ? b.hz : b.r));
        const contactFade = Math.max(0.08, 1.0 - floorDist * 0.9);
        const expand = 1.0 + floorDist * 0.35;
        const shadowOffX = isLuxuryTheme ? 0.045 : 0.062;
        const shadowOffY = isLuxuryTheme ? -0.055 : -0.062;
        decal.position.set(b.x + shadowOffX, b.y + shadowOffY, 0.008);
        if (this.currentThemeId === 'goldBar') {
          decal.scale.set(b.hx * 2.5 * expand, b.hy * 2.7 * expand, 1);
          decal.rotation.z = Math.atan2(
            2 * (b.q.w * b.q.z + b.q.x * b.q.y),
            1 - 2 * (b.q.y * b.q.y + b.q.z * b.q.z)
          );
        } else {
          decal.scale.set(b.r * 2.5 * expand, b.r * 2.5 * expand, 1);
        }
        const decalBaseOpacity =
          this.currentThemeId === 'diamond' ? 0.9 : this.currentThemeId === 'goldBar' ? 0.60 : 0.78;
        decal.material.opacity = decalBaseOpacity * contactFade;
      }
    }

    const rX = watchRotX || 0;
    const rY = watchRotY || 0;
    const rZ = watchRotZ || 0;
    this.watchPivot.rotation.set(rX, rY, rZ);
    this.hardware.updateFrame(rX, rY, gx, gy, aodMode);

    // Compute virtual eye position relative to the 4.00 x 4.88 screen window at zWin = 1.12
    const zWin = 1.12;
    const eyeZ = 6.92;
    const dWin = eyeZ - zWin;
    const eyeX = Math.max(-2.15, Math.min(2.15, (-Math.sin(rY) * 3.8 - gx * 1.15) * this.parallaxStrength));
    const eyeY = Math.max(-2.15, Math.min(2.15, (Math.sin(rX) * 3.8 - gy * 1.15) * this.parallaxStrength));

    this.offAxisCamera.position.set(eyeX, eyeY, eyeZ);
    this.offAxisCamera.rotation.set(0, 0, 0);
    this.offAxisCamera.updateMatrixWorld();
    this.offAxisCamera.matrixWorldInverse.copy(this.offAxisCamera.matrixWorld).invert();

    const near = 1.2;
    const far = 24.0;
    const k = near / dWin;
    this.offAxisCamera.projectionMatrix.makePerspective(
      (-2.0 - eyeX) * k,
      (2.0 - eyeX) * k,
      (2.44 - eyeY) * k,
      (-2.44 - eyeY) * k,
      near,
      far
    );
    this.offAxisCamera.projectionMatrixInverse.copy(this.offAxisCamera.projectionMatrix).invert();

    if (isLuxuryTheme) {
      this.dioramaKeyLight.position.set(-4.4 - gx * 1.6, 4.6 - gy * 1.4, 5.2);
    } else {
      this.dioramaKeyLight.position.set(-5.2 - gx * 1.6, 5.0 - gy * 1.4, 4.2);
    }
    this.keyLight.position.set(-5.6 - gx * 1.6, 6.4 - gy * 1.4, 8.2);
    const targetDioramaKey =
      this.currentThemeId === 'diamond'
        ? aodMode ? 2.1 : 3.65
        : this.currentThemeId === 'goldBar'
        ? aodMode ? 1.5 : 2.55
        : this.currentThemeId === 'basketball'
        ? aodMode ? 1.25 : 2.35
        : this.currentThemeId === 'tennis'
        ? aodMode ? 1.15 : 2.15
        : aodMode ? 1.10 : 2.05;
    this.dioramaKeyLight.intensity += (targetDioramaKey - this.dioramaKeyLight.intensity) * 0.15;

    if (this.trailBuffer) {
      this.trailBuffer.update(physicsBodies, this.currentThemeId, 1 / 60, this.trailStrength);
    }

    if (this.currentThemeId === 'diamond' && this.velvetFloorMat) {
      const vu = this.velvetFloorMat.userData && this.velvetFloorMat.userData.velvetUniforms;
      if (vu) {
        vu.uEyePos.value.set(eyeX, eyeY, eyeZ);
        vu.uKeyLightPos.value.copy(this.dioramaKeyLight.position);
      }
    }

    const shift = 0.28 * this.parallaxStrength;
    this.camera.position.set(-gx * shift, -gy * shift, this.baseCameraZ);
    this.camera.lookAt(0, 0, 0);

    // Pass 1: Render spatial diorama into high-DPI HDR portal RT (with inter-diamond refraction & Bloom)
    const prevToneMapping = this.renderer.toneMapping;
    if (this.useLinearHDRRT) {
      this.renderer.toneMapping = THREE.NoToneMapping;
    }

    if (this.currentThemeId === 'diamond' && this.refractBackdropRT && this.sharedMat && this.sharedMat.uniforms) {
      const u = this.sharedMat.uniforms;
      u.uUseBackdrop.value = 0.0;
      this.renderer.setRenderTarget(this.refractBackdropRT);
      this.renderer.clear();
      this.renderer.render(this.dioramaScene, this.offAxisCamera);

      this._tmpViewProjMat.multiplyMatrices(
        this.offAxisCamera.projectionMatrix,
        this.offAxisCamera.matrixWorldInverse
      );
      u.uViewProjMatrix.value.copy(this._tmpViewProjMat);
      u.uSceneBackdropMap.value = this.refractBackdropRT.texture;
      u.uUseBackdrop.value = 1.0;
    } else if (this.sharedMat && this.sharedMat.uniforms && this.sharedMat.uniforms.uUseBackdrop) {
      this.sharedMat.uniforms.uUseBackdrop.value = 0.0;
    }

    if (this.dioramaComposer) {
      if (this.dioramaBloomPass) {
        const baseBloom = aodMode ? this.bloomStrength * 0.45 : this.bloomStrength;
        if (this.currentThemeId === 'goldBar') {
          this.dioramaBloomPass.threshold = 3.4;
          this.dioramaBloomPass.radius = 0.2;
          this.dioramaBloomPass.strength = baseBloom * 0.22;
        } else if (this.currentThemeId === 'diamond') {
          this.dioramaBloomPass.threshold = 1.95;
          this.dioramaBloomPass.radius = 0.32;
          this.dioramaBloomPass.strength = baseBloom;
        } else {
          this.dioramaBloomPass.threshold = 3.5;
          this.dioramaBloomPass.radius = 0.2;
          this.dioramaBloomPass.strength = 0.0;
        }
      }
      this.dioramaComposer.render();
      this.hardware.setScreenTexture(this.dioramaComposer.readBuffer.texture);
    } else {
      this.renderer.setRenderTarget(this.screenRT);
      this.renderer.clear();
      this.renderer.render(this.dioramaScene, this.offAxisCamera);
      this.hardware.setScreenTexture(this.screenRT.texture);
    }

    this.renderer.toneMapping = prevToneMapping;

    // Pass 2: Render solid 3D Apple Watch + refractive sapphire glass + HDR screen onto poster
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.render(this.scene, this.camera);
  };

  ns.Scene3D = Scene3D;
})(window);
