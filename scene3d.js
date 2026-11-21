(function (global) {
  'use strict';

  const ns = (global.GravityWatch = global.GravityWatch || {});

  /* =========================================================
     1. Sculpted Vertex-Displaced 3D Sphere Builders (44x30 = -57% tris, 2.3x faster build)
     ========================================================= */
  function createSculptedTennisGeometry() {
    const geom = new THREE.SphereGeometry(1.0, 44, 30);
    const pos = geom.attributes.position;

    const seamSamples = 200;
    const seamX = new Float32Array(seamSamples);
    const seamY = new Float32Array(seamSamples);
    const seamZ = new Float32Array(seamSamples);
    const k = 0.36;
    const norm = 1 + k;
    const cZ = 2 * Math.sqrt(k);
    for (let s = 0; s < seamSamples; s += 1) {
      const t = (s / seamSamples) * Math.PI * 2;
      seamX[s] = (Math.cos(t) + k * Math.cos(3 * t)) / norm;
      seamY[s] = (Math.sin(t) - k * Math.sin(3 * t)) / norm;
      seamZ[s] = (cZ * Math.sin(2 * t)) / norm;
    }

    const coarseStep = 10;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const len = Math.hypot(x, y, z) || 1;
      const nx = x / len;
      const ny = y / len;
      const nz = z / len;

      let minD2 = 99;
      let bestS = 0;
      for (let s = 0; s < seamSamples; s += coarseStep) {
        const dx = nx - seamX[s];
        const dy = ny - seamY[s];
        const dz = nz - seamZ[s];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < minD2) {
          minD2 = d2;
          bestS = s;
        }
      }
      if (minD2 < 0.085) {
        for (let off = -coarseStep; off <= coarseStep; off += 1) {
          let s = bestS + off;
          if (s < 0) s += seamSamples;
          else if (s >= seamSamples) s -= seamSamples;
          const dx = nx - seamX[s];
          const dy = ny - seamY[s];
          const dz = nz - seamZ[s];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < minD2) minD2 = d2;
        }
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
    const geom = new THREE.SphereGeometry(1.0, 44, 30);
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
    const geom = new THREE.SphereGeometry(1.0, 52, 36);
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
    this.width = width || 192;
    this.height = height || 234;
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
    this.isDirty = false;
    this._staticRestFrames = 0;
    this._hardStamped = false;
    this._hardFreshActive = false;

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
    this.isDirty = false;
    this._staticRestFrames = 0;
    this._hardStamped = false;
    this._hardFreshActive = false;
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
    this.isDirty = false;
    // Cushioned EPDM rubber-granule tennis court: resilient surface leaves ZERO trails or marks
    if (themeId === 'tennis' || strength <= 0.001) {
      if (this.hasData) {
        this.clear();
        this.isDirty = true;
      }
      return;
    }
    if (!physicsBodies || physicsBodies.length === 0) {
      return;
    }

    const clampedDt = Math.min(0.05, dt || 1 / 60);
    const isHardSurface = themeId === 'basketball' || themeId === 'goldBar';
    const total = this.width * this.height;

    const resetPrev = this.prevPos.length !== physicsBodies.length;
    if (resetPrev) {
      this.prevPos = physicsBodies.map(function (b) {
        return { x: b.x, y: b.y };
      });
    }

    // Fast dirty-sleep check: avoid 45k-pixel loop & PCIe GPU upload when all bodies are at rest
    let maxMoveSq = 0;
    let maxSpeedSq = 0;
    if (!resetPrev) {
      for (let i = 0; i < physicsBodies.length; i += 1) {
        const b = physicsBodies[i];
        const prev = this.prevPos[i];
        const dxM = b.x - prev.x;
        const dyM = b.y - prev.y;
        const m2 = dxM * dxM + dyM * dyM;
        if (m2 > maxMoveSq) maxMoveSq = m2;
        const vx = b.vx || 0;
        const vy = b.vy || 0;
        const s2 = vx * vx + vy * vy;
        if (s2 > maxSpeedSq) maxSpeedSq = s2;
      }
    } else {
      maxMoveSq = 1.0;
    }

    const isStationary = maxMoveSq < 1e-6 && maxSpeedSq < 0.0004;
    if (isStationary) {
      if (isHardSurface && this._hardStamped && !this._hardFreshActive) {
        return;
      }
      if (!isHardSurface) {
        this._staticRestFrames += 1;
        const restLimit = themeId === 'soccer' ? 240 : 90;
        if (this._staticRestFrames > restLimit) {
          return;
        }
      }
    } else {
      this._staticRestFrames = 0;
    }

    if (isHardSurface) {
      // Rigid surfaces (lacquered maple hardwood / polished obsidian vault): ZERO scratches or persistent grooves;
      // depth buffer stores instantaneous 60fps optical proximity & color-bleed radiosity strictly beneath each body.
      this.depth.fill(0);
      if (themeId === 'goldBar') {
        this.fresh.fill(0);
        this._hardFreshActive = false;
      } else {
        const hardFreshDecay = Math.pow(0.08, clampedDt);
        let anyFresh = false;
        for (let i = 0; i < total; i += 1) {
          const nf = this.fresh[i] * hardFreshDecay;
          if (nf < 0.002) {
            this.fresh[i] = 0;
          } else {
            this.fresh[i] = nf;
            anyFresh = true;
          }
        }
        this._hardFreshActive = anyFresh;
      }
    } else {
      // Diamond velvet retains crisp combing longer (0.92); soccer 3D grass blades elastically spring back (~4.2s)
      const baseRetention = themeId === 'diamond' ? 0.92 : 0.80;
      const depthDecay = Math.pow(baseRetention, clampedDt);
      const freshDecay = Math.pow(themeId === 'soccer' ? 0.24 : 0.54, clampedDt);

      for (let i = 0; i < total; i += 1) {
        const nd = this.depth[i] * depthDecay;
        this.fresh[i] *= freshDecay;
        if (nd < 0.002) {
          this.depth[i] = 0;
          this.dirX[i] *= 0.85;
          this.dirY[i] *= 0.85;
        } else {
          this.depth[i] = nd;
        }
      }
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
      const maxClearance = isHardSurface ? (themeId === 'goldBar' ? 0.55 : 0.45) : 0.24;

      if (clearance < maxClearance) {
        const contactW = 1.0 - clearance / maxClearance;
        const radWorld = isHardSurface
          ? themeId === 'goldBar'
            ? b.hx * 1.35
            : b.r * 1.15
          : themeId === 'diamond'
          ? b.r * 0.56
          : b.r * 1.08;
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

        if (isHardSurface && targetFreshBase > 0.002) {
          this._hardFreshActive = true;
        }

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

    const depthArr = this.depth;
    const dirXArr = this.dirX;
    const dirYArr = this.dirY;
    const freshArr = this.fresh;
    const out = this.data;

    for (let i = 0; i < total; i += 1) {
      const idx = i * 4;
      const d = depthArr[i];
      const dx = dirXArr[i];
      const dy = dirYArr[i];
      const fr = freshArr[i];
      out[idx] = d <= 0 ? 0 : d >= 1 ? 255 : (d * 255 + 0.5) | 0;
      out[idx + 1] = dx <= -1 ? 0 : dx >= 1 ? 255 : ((dx * 0.5 + 0.5) * 255 + 0.5) | 0;
      out[idx + 2] = dy <= -1 ? 0 : dy >= 1 ? 255 : ((dy * 0.5 + 0.5) * 255 + 0.5) | 0;
      out[idx + 3] = fr <= 0 ? 0 : fr >= 1 ? 255 : (fr * 255 + 0.5) | 0;
    }

    this.hasData = true;
    this.isDirty = true;
    if (isHardSurface) this._hardStamped = true;
    this.texture.needsUpdate = true;
  };

  /* =========================================================
     3. GIA Brilliant Diamond Geometry + GPU BVH HDRI Prismatic Raytracer GLSL
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

  function createDiamondShaderMaterial(floorTex, envEquirectTex, bvhStruct, useLinearHDR) {
    const BVH = global.THREE_ADDONS && global.THREE_ADDONS.BVH;
    const useBVH = Boolean(bvhStruct && BVH && BVH.shaderStructs && BVH.shaderIntersectFunction);

    const vertexShader = [
      'varying vec3 vLocalPos;',
      'varying vec3 vLocalNormal;',
      'varying vec3 vWorldPos;',
      'varying vec3 vWorldNormal;',
      'varying mat3 vRotMat;',
      'void main() {',
      '  vLocalPos = position;',
      '  vLocalNormal = normalize(normal);',
      '  #ifdef USE_INSTANCING',
      '    mat4 mWorld = modelMatrix * instanceMatrix;',
      '  #else',
      '    mat4 mWorld = modelMatrix;',
      '  #endif',
      '  vec4 worldPos = mWorld * vec4(position, 1.0);',
      '  vWorldPos = worldPos.xyz;',
      '  vec3 c0 = mWorld[0].xyz;',
      '  vec3 c1 = mWorld[1].xyz;',
      '  vec3 c2 = mWorld[2].xyz;',
      '  float s = max(0.0001, length(c0));',
      '  vRotMat = mat3(c0 / s, c1 / s, c2 / s);',
      '  vWorldNormal = normalize(vRotMat * normal);',
      '  gl_Position = projectionMatrix * viewMatrix * worldPos;',
      '}'
    ].join('\n');

    const bvhHeader = useBVH
      ? [
          'precision highp isampler2D;',
          'precision highp usampler2D;',
          BVH.shaderStructs,
          BVH.shaderIntersectFunction,
          'uniform BVH bvh;'
        ].join('\n')
      : [
          'void testPlane(vec3 p, vec3 d, vec3 n, float dist, inout float bestT, inout vec3 bestN) {',
          '  float denom = dot(n, d);',
          '  if (denom > 0.0001) {',
          '    float t = (dist - dot(n, p)) / denom;',
          '    if (t > 0.001 && t < bestT) { bestT = t; bestN = n; }',
          '  }',
          '}',
          'void intersectDiamondHull(vec3 p, vec3 d, out float hitT, out vec3 hitN) {',
          '  hitT = 100.0; hitN = vec3(0.0, 0.0, 1.0);',
          '  testPlane(p, d, vec3(0.0, 0.0, 1.0), 0.50, hitT, hitN);',
          '  vec2 dirA = vec2(1.0, 0.0); vec2 dirM = vec2(0.92387953, 0.38268343);',
          '  const float C45 = 0.70710678;',
          '  for (int i = 0; i < 8; i++) {',
          '    testPlane(p, d, vec3(dirA.x * 0.56619, dirA.y * 0.56619, 0.82428), 0.675, hitT, hitN);',
          '    testPlane(p, d, vec3(dirM.x * 0.66013, dirM.y * 0.66013, 0.75115), 0.735, hitT, hitN);',
          '    testPlane(p, d, vec3(dirA.x, dirA.y, 0.0), 1.00, hitT, hitN);',
          '    testPlane(p, d, vec3(dirA.x * 0.65318, dirA.y * 0.65318, -0.75721), 0.575, hitT, hitN);',
          '    testPlane(p, d, vec3(dirM.x * 0.68011, dirM.y * 0.68011, -0.73311), 0.595, hitT, hitN);',
          '    dirA = vec2(dirA.x - dirA.y, dirA.x + dirA.y) * C45;',
          '    dirM = vec2(dirM.x - dirM.y, dirM.x + dirM.y) * C45;',
          '  }',
          '}'
        ].join('\n');

    const traceIntersectBlock = useBVH
      ? [
          '    uvec4 faceIndices = uvec4(0u);',
          '    vec3 faceNormal = vec3(0.0, 0.0, 1.0);',
          '    vec3 barycoord = vec3(0.0);',
          '    float side = 1.0;',
          '    float hitT = 0.0;',
          '    bool hit = bvhIntersectFirstHit(bvh, p, dIn, faceIndices, faceNormal, barycoord, side, hitT);',
          '    if (!hit) {',
          '      vec3 missW = localToWorldDir(dIn);',
          '      accum += weight * sampleDispersedExit(vWorldPos, missW, vRotMat * (dispL * 1.45));',
          '      break;',
          '    }',
          '    p += dIn * max(hitT - 0.001, 0.0);',
          '    weight *= exp(-0.04 * hitT);',
          '    vec3 inwardN = dot(faceNormal, dIn) > 0.0 ? -normalize(faceNormal) : normalize(faceNormal);'
        ].join('\n')
      : [
          '    float hitT;',
          '    vec3 nHit;',
          '    intersectDiamondHull(p, dIn, hitT, nHit);',
          '    p += dIn * hitT;',
          '    weight *= exp(-0.04 * hitT);',
          '    vec3 inwardN = -nHit;'
        ].join('\n');

    const fragmentShader = [
      bvhHeader,
      'uniform float uExposure;',
      'uniform float uLinearOutput;',
      'uniform float uUseBackdrop;',
      'uniform float uHasEnvMap;',
      'uniform mat4 uViewProjMatrix;',
      'uniform sampler2D uFloorMap;',
      'uniform sampler2D uEnvEquirectMap;',
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
      'vec3 sampleJewelStudioFallback(vec3 d) {',
      '  vec3 col = vec3(0.005, 0.007, 0.011) + vec3(0.016, 0.022, 0.032) * smoothstep(0.0, 0.95, d.z);',
      '  float soft1 = pow(max(0.0, dot(d, vec3(-0.350, 0.520, 0.780))), 18.0);',
      '  float soft2 = pow(max(0.0, dot(d, vec3(0.580, 0.240, 0.779))), 26.0);',
      '  float rimBar = smoothstep(0.91, 0.99, abs(dot(d, vec3(0.761, -0.621, 0.180))));',
      '  float pin1 = pow(max(0.0, dot(d, vec3(-0.180, 0.680, 0.711))), 150.0);',
      '  float pin2 = pow(max(0.0, dot(d, vec3(0.540, -0.320, 0.778))), 170.0);',
      '  float pin3 = pow(max(0.0, dot(d, vec3(-0.680, -0.220, 0.699))), 130.0);',
      '  col += vec3(1.05, 1.15, 1.28) * soft1;',
      '  col += vec3(0.85, 1.05, 1.25) * soft2;',
      '  col += vec3(0.95, 1.05, 1.18) * rimBar;',
      '  col += vec3(2.4, 2.5, 2.7) * pin1;',
      '  col += vec3(2.0, 2.2, 2.5) * pin2;',
      '  col += vec3(1.8, 1.95, 2.2) * pin3;',
      '  return col;',
      '}',
      '',
      'vec3 sampleStudioHDRI(vec3 dirW) {',
      '  vec3 d = normalize(dirW);',
      '  if (uHasEnvMap > 0.5) {',
      '    // Align studio overhead ceiling softboxes cleanly with diorama +Z coordinate frame',
      '    vec3 ds = vec3(d.x, d.z, -d.y);',
      '    vec2 eqUv = vec2(atan(ds.z, ds.x) * 0.15915494 + 0.5, asin(clamp(ds.y, -1.0, 1.0)) * 0.31830989 + 0.5);',
      '    vec3 envCol = texture2D(uEnvEquirectMap, eqUv).rgb;',
      '    float luma = dot(envCol, vec3(0.2126, 0.7152, 0.0722));',
      '    // VVS1 D-color jewelry studio curve: dark facets stay crisp crystalline graphite while softboxes stay razor-sharp white',
      '    vec3 graded = envCol * mix(0.13, 1.38, smoothstep(0.20, 1.05, luma));',
      '    float pin1 = pow(max(0.0, dot(d, vec3(-0.22, 0.64, 0.736))), 260.0);',
      '    float pin2 = pow(max(0.0, dot(d, vec3(0.56, -0.34, 0.755))), 310.0);',
      '    float pin3 = pow(max(0.0, dot(d, vec3(-0.56, -0.38, 0.736))), 340.0);',
      '    return graded + vec3(1.15, 1.22, 1.35) * pin1 + vec3(0.95, 1.05, 1.22) * pin2 + vec3(0.90, 0.96, 1.10) * pin3;',
      '  }',
      '  return sampleJewelStudioFallback(d);',
      '}',
      '',
      'vec3 sampleExitDirection(vec3 exitWorldPos, vec3 rayW, float ior) {',
      '  // Multi-diamond inter-refraction & velvet floor capture via linear HDR backdrop pre-pass',
      '  if (uUseBackdrop > 0.5 && rayW.z < 0.28) {',
      '    vec3 samplePos = exitWorldPos + rayW * (rayW.z < -0.05 ? 0.36 : 0.55);',
      '    vec4 clipPos = uViewProjMatrix * vec4(samplePos, 1.0);',
      '    if (clipPos.w > 0.001) {',
      '      vec2 screenUV = clipPos.xy / clipPos.w * 0.5 + 0.5;',
      '      vec2 dispShift = vec2((ior - 2.42) * 0.45) * rayW.xy;',
      '      vec2 refrUV = clamp(screenUV + dispShift, vec2(0.004), vec2(0.996));',
      '      if (screenUV.x > 0.01 && screenUV.x < 0.99 && screenUV.y > 0.01 && screenUV.y < 0.99) {',
      '        vec3 rawScene = texture2D(uSceneBackdropMap, refrUV).rgb;',
      '        float rimSpark = pow(clamp(1.0 - abs(rayW.z), 0.0, 1.0), 2.8) * 0.14;',
      '        if (rayW.z < -0.05) {',
      '          return mix(sampleStudioHDRI(rayW) * 0.35, rawScene * 1.10, 0.72) + vec3(0.75, 0.88, 1.0) * rimSpark;',
      '        }',
      '        return mix(sampleStudioHDRI(rayW), rawScene * 1.08 + vec3(0.65, 0.80, 1.0) * rimSpark, 0.18);',
      '      }',
      '    }',
      '  }',
      '  if (rayW.z < -0.05) {',
      '    float tFloor = max(0.0, -exitWorldPos.z) / (-rayW.z);',
      '    vec2 hitXY = exitWorldPos.xy + rayW.xy * tFloor;',
      '    vec2 uv = hitXY / vec2(6.0, 7.32) + 0.5;',
      '    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {',
      '      vec3 rawFloor = texture2D(uFloorMap, uv).rgb;',
      '      float rimSpark = pow(clamp(1.0 + rayW.z, 0.0, 1.0), 2.8) * 0.14;',
      '      return mix(sampleStudioHDRI(rayW) * 0.35, rawFloor * 1.10, 0.72) + vec3(0.75, 0.88, 1.0) * rimSpark;',
      '    }',
      '  }',
      '  return sampleStudioHDRI(rayW);',
      '}',
      '',
      'vec3 sampleDispersedExit(vec3 exitWorldPos, vec3 dOutW, vec3 dispVecW) {',
      '  vec3 dFan = clamp(dispVecW, vec3(-0.095), vec3(0.095));',
      '  vec3 exitR = normalize(dOutW - dFan * 1.00);',
      '  vec3 exitY = normalize(dOutW - dFan * 0.48);',
      '  vec3 exitC = normalize(dOutW + dFan * 0.48);',
      '  vec3 exitB = normalize(dOutW + dFan * 1.05);',
      '  vec3 cR = sampleExitDirection(exitWorldPos, exitR, 2.385);',
      '  vec3 cY = sampleExitDirection(exitWorldPos, exitY, 2.403);',
      '  vec3 cG = sampleExitDirection(exitWorldPos, dOutW, 2.420);',
      '  vec3 cC = sampleExitDirection(exitWorldPos, exitC, 2.448);',
      '  vec3 cB = sampleExitDirection(exitWorldPos, exitB, 2.475);',
      '  float r = cR.r * 0.55 + cY.r * 0.35 + cG.r * 0.10;',
      '  float g = cY.g * 0.20 + cG.g * 0.60 + cC.g * 0.20;',
      '  float b = cG.b * 0.10 + cC.b * 0.35 + cB.b * 0.55;',
      '  return vec3(r, g, b);',
      '}',
      '',
      'vec3 traceDiamondPrimary(vec3 startP, vec3 startDirL, vec3 entryN) {',
      '  const float iorG = 2.420;',
      '  const float iorB = 2.475;',
      '  vec3 dIn = refract(startDirL, entryN, 1.0 / iorG);',
      '  if (length(dIn) < 0.001) dIn = reflect(startDirL, entryN);',
      '  dIn = normalize(dIn);',
      '  vec3 dInB = refract(startDirL, entryN, 1.0 / iorB);',
      '  vec3 dispL = dot(dInB, dInB) > 0.001 ? (normalize(dInB) - dIn) : vec3(0.0);',
      '  vec3 p = startP - entryN * 0.004;',
      '  vec3 accum = vec3(0.0);',
      '  float weight = 1.0;',
      '',
      '  for (int bounce = 0; bounce < 3; bounce++) {',
      traceIntersectBlock,
      '    float cosI = clamp(dot(-dIn, inwardN), 0.0, 1.0);',
      '    float sin2T = iorG * iorG * (1.0 - cosI * cosI);',
      '',
      '    if (sin2T >= 0.998 || bounce == 2) {',
      '      if (sin2T < 0.998) {',
      '        vec3 dOutL = normalize(refract(dIn, inwardN, iorG));',
      '        vec3 rOutB = refract(dIn, inwardN, iorB);',
      '        vec3 exitDispL = dot(rOutB, rOutB) > 0.001 ? (normalize(rOutB) - dOutL) : (normalize(reflect(dIn, inwardN)) - dOutL) * 0.22;',
      '        vec3 dOutW = localToWorldDir(dOutL);',
      '        vec3 dVecW = vRotMat * (dispL * 1.45 + exitDispL * 1.35);',
      '        accum += weight * sampleDispersedExit(vWorldPos, dOutW, dVecW);',
      '        break;',
      '      }',
      '      dIn = normalize(reflect(dIn, inwardN));',
      '      dispL = reflect(dispL, inwardN);',
      '      p += inwardN * 0.004;',
      '      if (bounce == 2) {',
      '        vec3 finalW = localToWorldDir(dIn);',
      '        accum += weight * sampleDispersedExit(vWorldPos, finalW, vRotMat * (dispL * 1.65));',
      '      }',
      '    } else {',
      '      float fOut = 0.17 + 0.83 * pow(1.0 - cosI, 4.0);',
      '      vec3 dOutL = normalize(refract(dIn, inwardN, iorG));',
      '      vec3 rOutB = refract(dIn, inwardN, iorB);',
      '      vec3 exitDispL = dot(rOutB, rOutB) > 0.001 ? (normalize(rOutB) - dOutL) : vec3(0.0);',
      '      vec3 dOutW = localToWorldDir(dOutL);',
      '      vec3 dVecW = vRotMat * (dispL * 1.45 + exitDispL * 1.35);',
      '      accum += weight * (1.0 - fOut) * sampleDispersedExit(vWorldPos, dOutW, dVecW);',
      '      weight *= fOut * 1.15;',
      '      dIn = normalize(reflect(dIn, inwardN));',
      '      dispL = reflect(dispL, inwardN);',
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
      '  // Front surface mirror reflection from real Studio HDRI + pinpoint crown scintillation',
      '  vec3 reflW = reflect(V_w, N_w);',
      '  vec3 extSpec = sampleStudioHDRI(reflW);',
      '  vec3 H_pin = normalize(-V_w + vec3(-0.56, 0.58, 0.59));',
      '  float pinFlash = pow(max(0.0, dot(N_w, H_pin)), 420.0) * 0.60;',
      '',
      '  // GPU BVH 3-bounce facet raytrace + matched per-exit 5-band chromatic dispersion',
      '  vec3 internalColor = traceDiamondPrimary(vLocalPos, V_l, N_l) * vec3(0.99, 1.00, 1.03);',
      '',
      '  float edgeGlint = pow(1.0 - ndotv, 3.8) * 0.22;',
      '  float facetRidge = clamp(length(fwidth(vLocalNormal)) * 0.65, 0.0, 1.0);',
      '  float ridgeSpec = facetRidge * (0.28 + 0.72 * pow(ndotv, 0.5));',
      '  vec3 hdrColor = internalColor * (1.0 - F_front * 0.88) + extSpec * F_front + vec3(0.86, 0.95, 1.0) * edgeGlint + vec3(1.35, 1.50, 1.72) * ridgeSpec * 0.26 + vec3(1.15, 1.25, 1.40) * pinFlash;',
      '  hdrColor *= uExposure;',
      '  hdrColor = hdrColor / (1.0 + max(vec3(0.0), hdrColor - 2.6) * 0.34);',
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

    const uniforms = {
      uExposure: { value: 1.0 },
      uLinearOutput: { value: useLinearHDR ? 1.0 : 0.0 },
      uUseBackdrop: { value: 0.0 },
      uHasEnvMap: { value: envEquirectTex ? 1.0 : 0.0 },
      uViewProjMatrix: { value: new THREE.Matrix4() },
      uFloorMap: { value: floorTex },
      uEnvEquirectMap: { value: envEquirectTex || floorTex },
      uSceneBackdropMap: { value: null }
    };
    if (useBVH) {
      uniforms.bvh = { value: bvhStruct };
    }

    return new THREE.ShaderMaterial({
      uniforms: uniforms,
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
            'vec2 vTrTexel = vec2(1.0 / 192.0, 1.0 / 234.0);',
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

  /* =========================================================
     3C. Real 3D Instanced Manicured FIFA Stadium Grass (Squircle-Culled 2-Seg Blades + Zero-Alloc Density Tiers)
     ========================================================= */
  function createGrassField3D(trailTex, lineMaskTex, useLinearHDR, initialDensity) {
    const cols = 122;
    const rows = 136;

    // Tapered 2-segment curved blade (5 vertices, 3 triangles -> -40% tris vs 3-seg, identical short-turf silhouette)
    const basePos = new Float32Array([
      -0.5, 0.00, 0.0,
       0.5, 0.00, 0.0,
      -0.5, 0.50, 0.0,
       0.5, 0.50, 0.0,
       0.0, 1.00, 0.0
    ]);
    const baseIdx = [
      0, 1, 3,  0, 3, 2,
      2, 3, 4
    ];

    // Deterministic seeded PRNG for lush, plush manicured stadium ryegrass carpet
    let seed = 1337421;
    function rand() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    const spanX = 4.76;
    const spanY = 5.66;
    const stepX = spanX / cols;
    const stepY = spanY / rows;

    // Squircle cavity visibility bounds (+ generous off-axis parallax margin) to cull invisible off-screen corner blades
    const cullHx = 2.34;
    const cullHy = 2.78;
    const cullCr = 0.84;

    const candidates = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const jx = (rand() - 0.5) * stepX * 0.96;
        const jy = (rand() - 0.5) * stepY * 0.96;
        const rx = -spanX * 0.5 + (c + 0.5) * stepX + jx;
        const ry = -spanY * 0.5 + (r + 0.5) * stepY + jy;

        const qx = Math.abs(rx) - (cullHx - cullCr);
        const qy = Math.abs(ry) - (cullHy - cullCr);
        const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cullCr;
        if (sdf > 0.0) continue;

        // Closely cropped 25mm FIFA pitch proportion (~10-14% of soccer ball diameter, plush & never overgrown)
        const clump = 0.5 + 0.5 * Math.sin(rx * 5.8 + Math.cos(ry * 4.7)) * Math.cos(ry * 6.2 - rx * 3.9);
        const bladeH = 0.068 + rand() * 0.036 + clump * 0.012;
        const bladeW = 0.025 + rand() * 0.012;
        const yaw = rand() * Math.PI * 2.0;
        const bend = 0.28 + rand() * 0.34;
        const colorVar = rand() * 0.72 + clump * 0.28;
        const phase = rand() * Math.PI * 2.0;
        candidates.push([rx, ry, bladeH, bladeW, yaw, bend, colorVar, phase]);
      }
    }

    // Uniform deterministic Fisher-Yates shuffle so any prefix count gives even coverage across the entire pitch
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }

    const maxBladeCount = candidates.length;
    const rootArr = new Float32Array(maxBladeCount * 2);
    const specArr = new Float32Array(maxBladeCount * 4);
    const toneArr = new Float32Array(maxBladeCount * 2);

    for (let i = 0; i < maxBladeCount; i += 1) {
      const b = candidates[i];
      const p2 = i * 2;
      const p4 = i * 4;
      rootArr[p2] = b[0];
      rootArr[p2 + 1] = b[1];
      specArr[p4] = b[2];
      specArr[p4 + 1] = b[3];
      specArr[p4 + 2] = b[4];
      specArr[p4 + 3] = b[5];
      toneArr[p2] = b[6];
      toneArr[p2 + 1] = b[7];
    }

    const geom = new THREE.InstancedBufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(basePos, 3));
    geom.setIndex(baseIdx);
    geom.setAttribute('aBladeRoot', new THREE.InstancedBufferAttribute(rootArr, 2));
    geom.setAttribute('aBladeSpec', new THREE.InstancedBufferAttribute(specArr, 4));
    geom.setAttribute('aBladeTone', new THREE.InstancedBufferAttribute(toneArr, 2));

    const maxBalls = 36;
    const ballUniforms = [];
    for (let i = 0; i < maxBalls; i += 1) {
      ballUniforms.push(new THREE.Vector4(0, 0, -10, 0.35));
    }

    const vertexShader = [
      'attribute vec2 aBladeRoot;',
      'attribute vec4 aBladeSpec;',
      'attribute vec2 aBladeTone;',
      '',
      'uniform float uTime;',
      'uniform float uBladeWidthScale;',
      'uniform sampler2D uTrailMap;',
      'uniform float uTrailStrength;',
      'uniform vec4 uBalls[36];',
      'uniform int uBallCount;',
      'uniform vec3 uKeyLightPos;',
      '',
      'varying float vHeightFrac;',
      'varying float vSide;',
      'varying float vColorVar;',
      'varying float vStripeSign;',
      'varying vec2 vPitchUv;',
      'varying vec3 vWorldPos;',
      'varying vec3 vNormal;',
      'varying float vBallShadow;',
      'varying float vWakeAlign;',
      'varying float vWakeDepth;',
      '',
      'void main() {',
      '  float side = position.x;',
      '  float t = position.y;',
      '  vec2 rootXY = aBladeRoot;',
      '  float bladeH = aBladeSpec.x;',
      '  float bladeW = aBladeSpec.y * uBladeWidthScale;',
      '  float yaw = aBladeSpec.z;',
      '  float natBend = aBladeSpec.w;',
      '  float colorVar = aBladeTone.x;',
      '  float phase = aBladeTone.y;',
      '',
      '  vec2 pitchUv = vec2(rootXY.x / 6.0 + 0.5, rootXY.y / 7.32 + 0.5);',
      '  float stripeIdx = floor((1.0 - pitchUv.y) * 14.0);',
      '  float stripeSign = mod(stripeIdx, 2.0) < 0.5 ? 1.0 : -1.0;',
      '',
      '  // Real physical mower-roller stripe lean + organic yaw lean',
      '  vec2 yawDir = vec2(cos(yaw), sin(yaw));',
      '  vec2 restLean = (yawDir * 0.24 + vec2(0.0, stripeSign * 0.42)) * natBend;',
      '',
      '  // Subtle living stadium breeze rippling across blade tips',
      '  float windWave = sin(uTime * 1.65 + rootXY.x * 1.85 + rootXY.y * 1.25 + phase * 0.45);',
      '  vec2 windDisp = vec2(0.032, 0.022) * windWave;',
      '',
      '  // Elastic directional trampling wake & springy shudder from SurfaceTrailBuffer',
      '  vec4 trS = texture2D(uTrailMap, clamp(pitchUv, vec2(0.002), vec2(0.998)));',
      '  float trDepth = clamp(trS.r * uTrailStrength, 0.0, 1.0);',
      '  vec2 trVec = trS.gb * 2.0 - 1.0;',
      '  float trLen = length(trVec);',
      '  vec2 wakeDir = trLen > 0.06 ? (trVec / trLen) : yawDir;',
      '  float trFresh = clamp(trS.a * uTrailStrength, 0.0, 1.0);',
      '  float springWobble = sin(uTime * 15.5 + phase) * trFresh * 0.34;',
      '  vec2 wakeLean = wakeDir * (trDepth * 1.35 + springWobble);',
      '',
      '  // Exact real-time multi-ball radial grass parting, flattening & analytic directional shadows (AABB pruned)',
      '  vec2 ballPushXY = vec2(0.0);',
      '  float ballFlatten = 0.0;',
      '  float maxAllowedZ = 2.0;',
      '  float ballShadow = 1.0;',
      '  vec3 keyDirW = normalize(uKeyLightPos - vec3(rootXY, 0.05));',
      '',
      '  for (int i = 0; i < 36; i++) {',
      '    if (i >= uBallCount) break;',
      '    vec4 b = uBalls[i];',
      '    vec2 dXY = rootXY - b.xy;',
      '    if (abs(dXY.x) > 1.60 || abs(dXY.y) > 1.60) continue;',
      '    float dist2 = dot(dXY, dXY);',
      '    float pushR = b.w * 1.24;',
      '    if (dist2 < pushR * pushR && b.z < b.w * 1.65) {',
      '      float dist = sqrt(max(0.00001, dist2));',
      '      float zTouch = clamp(1.0 - max(0.0, b.z - b.w * 1.02) / (b.w * 0.65), 0.0, 1.0);',
      '      float radialProx = 1.0 - dist / pushR;',
      '      float pushStr = smoothstep(0.0, 1.0, radialProx) * zTouch;',
      '      vec2 outDir = dist > 0.002 ? (dXY / dist) : yawDir;',
      '      ballPushXY += outDir * pushStr * 1.48;',
      '      ballFlatten = max(ballFlatten, smoothstep(0.05, 0.70, radialProx) * zTouch);',
      '      if (dist < b.w * 0.99) {',
      '        float sphereBotZ = b.z - sqrt(max(0.0, b.w * b.w - dist2));',
      '        maxAllowedZ = min(maxAllowedZ, max(0.008, sphereBotZ - 0.015));',
      '      }',
      '      float contactAO = 1.0 - smoothstep(b.w * 0.40, b.w * 1.28, dist) * zTouch * 0.76;',
      '      ballShadow = min(ballShadow, contactAO);',
      '    }',
      '    // Directional soft sphere shadow cast onto grass blades by raking studio key light',
      '    vec3 oc = b.xyz - vec3(rootXY, 0.05);',
      '    float tProj = dot(oc, keyDirW);',
      '    if (tProj > 0.0 && tProj < 2.2) {',
      '      float perp2 = dot(oc, oc) - tProj * tProj;',
      '      float shadowR = b.w * 1.20;',
      '      if (perp2 < shadowR * shadowR) {',
      '        float occ = 1.0 - smoothstep(b.w * 0.68, shadowR, sqrt(max(0.0, perp2)));',
      '        ballShadow = min(ballShadow, 1.0 - occ * 0.68);',
      '      }',
      '    }',
      '  }',
      '',
      '  vec2 totalBend = restLean + windDisp + wakeLean + ballPushXY;',
      '  float bendLen = length(totalBend);',
      '  vec2 bendDir = bendLen > 0.0001 ? (totalBend / bendLen) : yawDir;',
      '  float bendAngle = min(1.50, bendLen * 1.05 + max(trDepth * 0.92, ballFlatten * 1.38));',
      '',
      '  // Curved Ghost-of-Tsushima quadratic spine (stiff root anchored in soil, graceful arcing tip)',
      '  float theta = bendAngle * (0.30 * t + 0.70 * t * t);',
      '  float horiz = bladeH * (t * sin(theta) * 0.96);',
      '  float vertZ = min(bladeH * (t * cos(theta * 0.88)), maxAllowedZ);',
      '',
      '  // Blend cross-blade ribbon orientation toward perpendicular to bend direction so bent grass shows broad face',
      '  vec2 perpBend = vec2(-bendDir.y, bendDir.x);',
      '  vec2 perpYaw = vec2(-yawDir.y, yawDir.x);',
      '  float bendFlatWeight = clamp(bendAngle * 0.68, 0.0, 0.88);',
      '  vec2 rawSide = mix(perpYaw, perpBend * (dot(perpYaw, perpBend) >= 0.0 ? 1.0 : -1.0), bendFlatWeight);',
      '  vec2 bladeSide = normalize(rawSide + vec2(0.0001, 0.0));',
      '  float wHalf = bladeW * (1.0 - pow(t, 1.35) * 0.88);',
      '',
      '  vec3 worldPos = vec3(rootXY + bendDir * horiz + bladeSide * (side * wHalf), vertZ);',
      '',
      '  // Curved blade tangent + V-fold cross-blade normal for crisp midrib shading',
      '  vec3 T = normalize(vec3(bendDir * sin(theta), max(0.08, cos(theta))));',
      '  vec3 B = vec3(bladeSide, 0.0);',
      '  vec3 N = normalize(cross(B, T) + B * (side * 0.36));',
      '  if (N.z < 0.0) N = -N;',
      '',
      '  vHeightFrac = t;',
      '  vSide = side;',
      '  vColorVar = colorVar;',
      '  vStripeSign = stripeSign;',
      '  vPitchUv = pitchUv;',
      '  vWorldPos = worldPos;',
      '  vNormal = N;',
      '  vBallShadow = mix(0.22, 1.0, ballShadow);',
      '  vWakeAlign = dot(bendDir, normalize(uKeyLightPos.xy - rootXY + vec2(0.001))) * clamp(bendAngle, 0.0, 1.0);',
      '  vWakeDepth = max(trDepth, ballFlatten);',
      '',
      '  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);',
      '}'
    ].join('\n');

    const fragmentShader = [
      'uniform sampler2D uPitchLineMask;',
      'uniform vec3 uKeyLightPos;',
      'uniform vec3 uRimLightPos;',
      'uniform vec3 uEyePos;',
      'uniform float uKeyIntensity;',
      'uniform float uLinearOutput;',
      '',
      'varying float vHeightFrac;',
      'varying float vSide;',
      'varying float vColorVar;',
      'varying float vStripeSign;',
      'varying vec2 vPitchUv;',
      'varying vec3 vWorldPos;',
      'varying vec3 vNormal;',
      'varying float vBallShadow;',
      'varying float vWakeAlign;',
      'varying float vWakeDepth;',
      '',
      'void main() {',
      '  vec3 N = normalize(vNormal);',
      '  vec3 V = normalize(uEyePos - vWorldPos);',
      '  vec3 L_key = normalize(uKeyLightPos - vWorldPos);',
      '  vec3 L_rim = normalize(uRimLightPos - vWorldPos);',
      '  vec3 H_key = normalize(V + L_key);',
      '',
      '  // Lush Premier League emerald ryegrass chlorophyll gradient (rich dark roots -> vibrant emerald -> warm sunlit tips)',
      '  vec3 rootCol = vec3(0.018, 0.056, 0.008);',
      '  vec3 midCol = mix(vec3(0.058, 0.195, 0.020), vec3(0.112, 0.280, 0.030), vColorVar);',
      '  vec3 tipCol = mix(vec3(0.140, 0.340, 0.034), vec3(0.245, 0.410, 0.054), vColorVar);',
      '  vec3 albedo = vHeightFrac < 0.42',
      '    ? mix(rootCol, midCol, vHeightFrac / 0.42)',
      '    : mix(midCol, tipCol, (vHeightFrac - 0.42) / 0.58);',
      '',
      '  // Midrib crease shading + crisp mowed stadium stripes + directional flattened-blade wake sheen',
      '  float midrib = 0.88 + 0.20 * (1.0 - abs(vSide) * 1.45);',
      '  float wakeSheen = 1.0 + vWakeAlign * (0.16 + 0.30 * vWakeDepth) + vWakeDepth * 0.14 * vHeightFrac;',
      '  albedo *= midrib * (1.0 + vStripeSign * 0.15) * wakeSheen;',
      '',
      '  // Painted white stadium chalk coating the upper 78% of blades growing on pitch markings',
      '  float chalkMask = texture2D(uPitchLineMask, clamp(vPitchUv, vec2(0.002), vec2(0.998))).r;',
      '  float chalkPaint = smoothstep(0.18, 0.68, chalkMask) * smoothstep(0.12, 0.42, vHeightFrac);',
      '  albedo = mix(albedo, vec3(0.68, 0.72, 0.66), chalkPaint * 0.90);',
      '',
      '  // Wrapped Lambert diffuse + waxy grass cuticle specular + Ghost-of-Tsushima translucent SSS',
      '  float ndl = max(0.0, (dot(N, L_key) + 0.38) / 1.38);',
      '  float keyIrr = uKeyIntensity * 0.54 * vBallShadow;',
      '  vec3 diffLight = albedo * (ndl * keyIrr + 0.15 * vBallShadow);',
      '',
      '  float specLobe = pow(max(0.0, dot(N, H_key)), 24.0) * (0.20 + 0.22 * vWakeDepth) * (1.0 - chalkPaint * 0.85) * vHeightFrac;',
      '  vec3 specLight = vec3(0.78, 0.96, 0.54) * specLobe * keyIrr;',
      '',
      '  float sssView = pow(clamp(dot(V, normalize(-L_key + N * 0.55)), 0.0, 1.0), 2.3);',
      '  vec3 sssLight = vec3(0.15, 0.32, 0.030) * sssView * vHeightFrac * (1.0 - chalkPaint * 0.82) * keyIrr;',
      '',
      '  float rimNdl = pow(max(0.0, dot(N, L_rim)), 2.1) * vHeightFrac;',
      '  vec3 rimLight = vec3(0.22, 0.36, 0.20) * rimNdl * 0.26 * vBallShadow;',
      '',
      '  // Root-to-tip ambient occlusion + smooth outer stadium vignette matching floor',
      '  float rootAO = 0.26 + 0.74 * pow(vHeightFrac, 0.65);',
      '  vec2 cUv = (vPitchUv - 0.5) * 2.0;',
      '  float vig = clamp(1.06 - dot(cUv, cUv) * 0.34, 0.36, 1.0);',
      '  vec3 hdrCol = (diffLight + specLight + sssLight + rimLight) * rootAO * vig;',
      '',
      '  if (uLinearOutput > 0.5) {',
      '    gl_FragColor = vec4(hdrCol, 1.0);',
      '  } else {',
      '    vec3 mapped = (hdrCol * (2.51 * hdrCol + 0.03)) / (hdrCol * (2.43 * hdrCol + 0.59) + 0.14);',
      '    mapped = pow(clamp(mapped, 0.0, 1.0), vec3(1.0 / 2.2));',
      '    gl_FragColor = vec4(mapped, 1.0);',
      '  }',
      '}'
    ].join('\n');

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uBladeWidthScale: { value: 1.04 },
        uTrailMap: { value: trailTex || null },
        uTrailStrength: { value: 1.0 },
        uPitchLineMask: { value: lineMaskTex || null },
        uBalls: { value: ballUniforms },
        uBallCount: { value: 0 },
        uKeyLightPos: { value: new THREE.Vector3(-5.2, 5.0, 4.2) },
        uRimLightPos: { value: new THREE.Vector3(4.8, -4.0, 0.75) },
        uEyePos: { value: new THREE.Vector3(0, 0, 6.92) },
        uKeyIntensity: { value: 2.12 },
        uLinearOutput: { value: useLinearHDR ? 1.0 : 0.0 }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.visible = false;
    mesh.userData.maxBladeCount = maxBladeCount;
    mesh.userData.applyDensityTier = function (tier) {
      const t = tier || 'balanced';
      let targetCount = Math.min(maxBladeCount, 9200);
      let wScale = 1.04;
      if (t === 'lite') {
        targetCount = Math.min(maxBladeCount, 5400);
        wScale = 1.24;
      } else if (t === 'dense') {
        targetCount = maxBladeCount;
        wScale = 0.92;
      }
      geom.instanceCount = targetCount;
      mat.uniforms.uBladeWidthScale.value = wScale;
      return targetCount;
    };
    mesh.userData.applyDensityTier(initialDensity || 'balanced');
    return mesh;
  }

  /* =========================================================
     3D. Real 3D Shell-Textured Tennis Wool Fuzz (Instanced Multi-Shell Shader)
     ========================================================= */
  function createTennisFuzzShells(count, tennisMaps, useLinearHDR, sharedShellGeo) {
    const layers = [0.14, 0.26, 0.38, 0.50, 0.62, 0.74, 0.87, 1.00];
    const layerCount = layers.length;
    const totalInstances = count * layerCount;

    const baseGeo = sharedShellGeo || new THREE.SphereGeometry(1.0, 28, 20);
    const geom = baseGeo.clone();
    const layerArr = new Float32Array(totalInstances);
    for (let b = 0; b < count; b += 1) {
      for (let l = 0; l < layerCount; l += 1) {
        layerArr[b * layerCount + l] = layers[l];
      }
    }
    geom.setAttribute('aShellLayer', new THREE.InstancedBufferAttribute(layerArr, 1));

    const vertexShader = [
      'attribute float aShellLayer;',
      'uniform sampler2D uRoughSeamMap;',
      'varying vec2 vUv;',
      'varying vec3 vLocalPos;',
      'varying vec3 vWorldPos;',
      'varying vec3 vWorldNormal;',
      'varying float vLayer;',
      'varying float vSeamMask;',
      '',
      'void main() {',
      '  vUv = uv;',
      '  vLayer = aShellLayer;',
      '  float seamMask = texture2D(uRoughSeamMap, uv).b;',
      '  vSeamMask = seamMask;',
      '  vec3 displaced = position + normal * (0.036 * aShellLayer * seamMask);',
      '  vLocalPos = displaced;',
      '  #ifdef USE_INSTANCING',
      '    mat4 mWorld = modelMatrix * instanceMatrix;',
      '  #else',
      '    mat4 mWorld = modelMatrix;',
      '  #endif',
      '  vec4 worldPos = mWorld * vec4(displaced, 1.0);',
      '  vWorldPos = worldPos.xyz;',
      '  vec3 c0 = mWorld[0].xyz;',
      '  vec3 c1 = mWorld[1].xyz;',
      '  vec3 c2 = mWorld[2].xyz;',
      '  vWorldNormal = normalize(mat3(c0, c1, c2) * normal);',
      '  gl_Position = projectionMatrix * viewMatrix * worldPos;',
      '}'
    ].join('\n');

    const fragmentShader = [
      'uniform sampler2D uColorMap;',
      'uniform vec3 uKeyLightPos;',
      'uniform vec3 uRimLightPos;',
      'uniform vec3 uEyePos;',
      'uniform float uKeyIntensity;',
      'uniform float uExposure;',
      'uniform float uLinearOutput;',
      '',
      'varying vec2 vUv;',
      'varying vec3 vLocalPos;',
      'varying vec3 vWorldPos;',
      'varying vec3 vWorldNormal;',
      'varying float vLayer;',
      'varying float vSeamMask;',
      '',
      'float fuzzHash3(vec3 p) {',
      '  p = fract(p * 0.1031);',
      '  p += dot(p, p.yzx + 33.33);',
      '  return fract((p.x + p.y) * p.z);',
      '}',
      '',
      'float fuzzNoise3(vec3 p) {',
      '  vec3 i = floor(p);',
      '  vec3 f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  float n000 = fuzzHash3(i);',
      '  float n100 = fuzzHash3(i + vec3(1.0, 0.0, 0.0));',
      '  float n010 = fuzzHash3(i + vec3(0.0, 1.0, 0.0));',
      '  float n110 = fuzzHash3(i + vec3(1.0, 1.0, 0.0));',
      '  float n001 = fuzzHash3(i + vec3(0.0, 0.0, 1.0));',
      '  float n101 = fuzzHash3(i + vec3(1.0, 0.0, 1.0));',
      '  float n011 = fuzzHash3(i + vec3(0.0, 1.0, 1.0));',
      '  float n111 = fuzzHash3(i + vec3(1.0, 1.0, 1.0));',
      '  float nx00 = mix(n000, n100, f.x);',
      '  float nx10 = mix(n010, n110, f.x);',
      '  float nx01 = mix(n001, n101, f.x);',
      '  float nx11 = mix(n011, n111, f.x);',
      '  float nxy0 = mix(nx00, nx10, f.y);',
      '  float nxy1 = mix(nx01, nx11, f.y);',
      '  return mix(nxy0, nxy1, f.z);',
      '}',
      '',
      'void main() {',
      '  if (vSeamMask < 0.25) discard;',
      '  vec3 dirL = normalize(vLocalPos);',
      '  float tuft = fuzzNoise3(dirL * 42.0);',
      '  float strand = fuzzNoise3(dirL * 92.0 + vec3(tuft * 1.35));',
      '  float strandHeight = clamp(strand * 0.72 + tuft * 0.42, 0.0, 1.15);',
      '  if (strandHeight < vLayer * 0.88) discard;',
      '',
      '  // uColorMap is SRGB8_ALPHA8 (THREE.SRGBColorSpace), so hardware sampling already returns linear RGB',
      '  vec3 baseAlb = texture2D(uColorMap, vUv).rgb;',
      '  float tipAO = 0.72 + 0.28 * vLayer;',
      '',
      '  vec3 N = normalize(vWorldNormal);',
      '  vec3 V = normalize(uEyePos - vWorldPos);',
      '  vec3 L_key = normalize(uKeyLightPos - vWorldPos);',
      '  vec3 L_rim = normalize(uRimLightPos - vWorldPos);',
      '',
      '  float ndl = max(0.0, (dot(N, L_key) + 0.42) / 1.42);',
      '  float ndotv = clamp(dot(N, V), 0.0, 1.0);',
      '  float fuzzHalo = pow(1.0 - ndotv, 2.4) * vLayer * 0.58;',
      '  float rimBack = pow(max(0.0, (dot(N, L_rim) + 0.35) / 1.35), 1.7) * vLayer * 0.36;',
      '',
      '  vec3 lit = baseAlb * tipAO * (ndl * uKeyIntensity * 0.58 + 0.30);',
      '  lit += vec3(0.76, 0.90, 0.20) * (fuzzHalo * (0.35 + 0.65 * ndl) + rimBack * 0.85) * tipAO;',
      '  lit *= uExposure;',
      '',
      '  if (uLinearOutput > 0.5) {',
      '    gl_FragColor = vec4(lit, 1.0);',
      '  } else {',
      '    vec3 mapped = (lit * (2.51 * lit + 0.03)) / (lit * (2.43 * lit + 0.59) + 0.14);',
      '    mapped = pow(clamp(mapped, 0.0, 1.0), vec3(1.0 / 2.2));',
      '    gl_FragColor = vec4(mapped, 1.0);',
      '  }',
      '}'
    ].join('\n');

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColorMap: { value: tennisMaps.map },
        uRoughSeamMap: { value: tennisMaps.roughnessMap },
        uKeyLightPos: { value: new THREE.Vector3(-5.2, 5.0, 4.2) },
        uRimLightPos: { value: new THREE.Vector3(4.8, -4.0, 0.75) },
        uEyePos: { value: new THREE.Vector3(0, 0, 6.92) },
        uKeyIntensity: { value: 2.25 },
        uExposure: { value: 1.0 },
        uLinearOutput: { value: useLinearHDR ? 1.0 : 0.0 }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.FrontSide,
      depthWrite: true,
      transparent: false
    });

    const mesh = new THREE.InstancedMesh(geom, mat, totalInstances);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.ballCount = count;
    mesh.userData.layers = layers;
    return mesh;
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
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.toneMappingMode = 'neutral';
    this.bloomStrength = 0.06;
    this.trailStrength = 1.0;
    this.grassDensity = 'balanced';
    this.activeGrassBlades = 0;
    this.n8aoEnabled = true;
    this.tennisFuzzEnabled = true;
    this.currentHdrPresetId = 'studio09';
    this._shadowDirty = true;
    this._pass1Dirty = true;
    this._matricesDirty = true;
    this._lastEyeX = 999;
    this._lastEyeY = 999;
    this._lastKeyX = 999;
    this._lastKeyY = 999;
    this._lastAod = null;
    this.trailBuffer = new SurfaceTrailBuffer(192, 234);

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

    this.offAxisCamera = new THREE.PerspectiveCamera(36, 4.0 / 4.88, 1.2, 24.0);

    const canHalfFloatRT =
      this.renderer.capabilities.isWebGL2 &&
      (Boolean(this.renderer.extensions.get('EXT_color_buffer_float')) ||
        Boolean(this.renderer.extensions.get('EXT_color_buffer_half_float')));

    this.useLinearHDRRT = canHalfFloatRT;
    // 600x732 = 2.46x supersampled over the 244x298 OLED viewport (>2x Retina) at ~60% lower MSAA/fillrate cost
    const rtW = 600;
    const rtH = 732;
    if (canHalfFloatRT) {
      this.screenRT = new THREE.WebGLRenderTarget(rtW, rtH, {
        type: THREE.HalfFloatType,
        samples: 2,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false
      });
      this.refractBackdropRT = new THREE.WebGLRenderTarget(256, 312, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false
      });
    } else {
      this.screenRT = new THREE.WebGLRenderTarget(rtW, rtH, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false
      });
      this.refractBackdropRT = null;
    }

    this._tmpViewProjMat = new THREE.Matrix4();
    this._dummyObj = new THREE.Object3D();
    this._cachedCanvasRect = null;
    this.geometryCache = {};

    this.resize(watchWidthPx, watchHeightPx);

    const initEnv = ns.getStudioEnvMap(this.renderer);
    this.scene.environment = initEnv;
    this.dioramaScene.environment = initEnv;

    this.contactShadowTex = ns.getContactShadowTexture();
    this.diamondCausticTex = ns.getDiamondCausticTexture();

    this.parallaxStrength = 1.0;
    this.bodiesInstancedMesh = null;
    this.decalsInstancedMesh = null;
    this.tennisFuzzMesh = null;
    this.tennisShellBaseGeo = null;
    this.diamondBVHCache = null;
    this.grassFieldMesh = null;
    this._grassTime = 0.0;
    this.instanceCount = 0;
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
      this.dioramaComposer.setSize(rtW, rtH);
      this.dioramaComposer.renderToScreen = false;
      this.dioramaRenderPass = new Addons.RenderPass(this.dioramaScene, this.offAxisCamera);
      this.dioramaRenderPass.enabled = !Addons.N8AOPass;
      this.dioramaComposer.addPass(this.dioramaRenderPass);
      if (Addons.N8AOPass) {
        this.n8aoPass = new Addons.N8AOPass(this.dioramaScene, this.offAxisCamera, rtW, rtH);
        this.n8aoPass.configuration.halfRes = true;
        this.n8aoPass.configuration.aoSamples = 16;
        this.n8aoPass.configuration.denoiseSamples = 8;
        this.n8aoPass.configuration.denoiseRadius = 6;
        this.n8aoPass.configuration.denoiseIterations = 2;
        this.n8aoPass.configuration.aoRadius = 0.60;
        this.n8aoPass.configuration.distanceFalloff = 0.85;
        this.n8aoPass.configuration.intensity = 2.3;
        this.n8aoPass.configuration.colorMultiply = true;
        this.n8aoPass.configuration.gammaCorrection = false;
        this.n8aoPass.configuration.transparencyAware = false;
        this.dioramaComposer.addPass(this.n8aoPass);
      } else {
        this.n8aoPass = null;
      }
      this.dioramaBloomPass = new Addons.UnrealBloomPass(
        new THREE.Vector2(rtW, rtH),
        this.bloomStrength,
        0.32,
        1.95
      );
      this.dioramaComposer.addPass(this.dioramaBloomPass);
      this.hardware.setScreenTexture(this.dioramaComposer.readBuffer.texture);
    } else {
      this.dioramaComposer = null;
      this.n8aoPass = null;
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

  Scene3D.prototype.invalidateRectCache = function () {
    this._cachedCanvasRect = null;
  };

  Scene3D.prototype.resize = function (widthPx, heightPx) {
    if (widthPx && heightPx) {
      this.watchWidthPx = widthPx;
      this.watchHeightPx = heightPx;
    }
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.watchWidthPx, this.watchHeightPx, false);
    this.camera.aspect = this.watchWidthPx / this.watchHeightPx;
    this.camera.updateProjectionMatrix();
    this._cachedCanvasRect = null;
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
    // Tight-frustum 1024x1024 shadow map: 4x fewer shadow texels while keeping razor contact precision
    this.dioramaKeyLight.shadow.mapSize.width = 1024;
    this.dioramaKeyLight.shadow.mapSize.height = 1024;
    this.dioramaKeyLight.shadow.camera.near = 1.5;
    this.dioramaKeyLight.shadow.camera.far = 15.0;
    this.dioramaKeyLight.shadow.camera.left = -2.5;
    this.dioramaKeyLight.shadow.camera.right = 2.5;
    this.dioramaKeyLight.shadow.camera.top = 2.9;
    this.dioramaKeyLight.shadow.camera.bottom = -2.9;
    this.dioramaKeyLight.shadow.bias = -0.0003;
    this.dioramaKeyLight.shadow.normalBias = 0.016;
    this.dioramaKeyLight.shadow.radius = 2.8;
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
            'varying vec2 vFloorTrailUv;',
            'float flFastGrain(vec2 p) {',
            '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
            '  p3 += dot(p3, p3.yzx + 33.33);',
            '  return fract((p3.x + p3.y) * p3.z);',
            '}'
          ].join('\n')
        )
        .replace(
          '#include <map_fragment>',
          [
            '#include <map_fragment>',
            'vec4 flTrS = texture2D(uTrailMap, vFloorTrailUv);',
            'float flTrDepth = clamp(flTrS.r * uTrailStrength, 0.0, 1.0);',
            'float flTrFresh = clamp(flTrS.a * uTrailStrength, 0.0, 1.0);',
            'float flMicroGrain = 0.5;',
            'if (uTrailThemeMode < 0.5) {',
            '  // Zero-loop fine EPDM rubber micro-grain complementing pre-baked normalMap (replaces 18-iter Voronoi)',
            '  vec2 gUv = floor(vFloorTrailUv * vec2(440.0, 536.0));',
            '  flMicroGrain = flFastGrain(gUv);',
            '  diffuseColor.rgb *= (0.97 + 0.055 * flMicroGrain);',
            '} else if (uTrailThemeMode > 2.5) {',
            '  // Dark soil/thatch underlayer beneath real 3D instanced grass blades: subtle damp soil reveal under trampled spots',
            '  diffuseColor.rgb *= (1.0 - flTrDepth * 0.22);',
            '}'
          ].join('\n')
        )
        .replace(
          '#include <roughnessmap_fragment>',
          [
            '#include <roughnessmap_fragment>',
            'if (uTrailThemeMode < 0.5) {',
            '  // Refined cushioned rubber micro-grain sheen: velvety-matte tournament court finish',
            '  roughnessFactor = clamp(roughnessFactor - (flMicroGrain - 0.5) * 0.08, 0.72, 0.94);',
            '} else if (uTrailThemeMode > 0.5 && uTrailThemeMode < 1.5) {',
            '  // Rigid lacquered maple: only fleeting dry rubber chirp haze under extreme high-speed skids',
            '  roughnessFactor = mix(roughnessFactor, 0.80, flTrFresh * 0.38);',
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
      return 'floor_surface_physics_v4';
    };

    // 1.5x extended floor (6.00 x 7.32) ensures zero borders or box walls even at extreme off-axis tilt
    const floorGeo = new THREE.PlaneGeometry(6.0, 7.32);
    this.floorMesh = new THREE.Mesh(floorGeo, this.floorMat);
    this.floorMesh.position.set(0, 0, 0);
    this.floorMesh.receiveShadow = true;
    this.dioramaScene.add(this.floorMesh);

    this.maxDecalInstances = 64;
    this.decalOpacityArray = new Float32Array(this.maxDecalInstances);
    this.decalOpacityAttr = new THREE.InstancedBufferAttribute(this.decalOpacityArray, 1);
    this.decalOpacityAttr.setUsage(THREE.DynamicDrawUsage);

    this.shadowDecalGeo = new THREE.PlaneGeometry(1, 1);
    this.shadowDecalGeo.setAttribute('aInstOpacity', this.decalOpacityAttr);

    const createInstancedDecalMat = function (mapTex) {
      const m = new THREE.MeshBasicMaterial({
        map: mapTex,
        transparent: true,
        depthWrite: false,
        opacity: 1.0
      });
      m.onBeforeCompile = function (shader) {
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            ['#include <common>', 'attribute float aInstOpacity;', 'varying float vInstOpacity;'].join('\n')
          )
          .replace(
            '#include <begin_vertex>',
            ['#include <begin_vertex>', 'vInstOpacity = aInstOpacity;'].join('\n')
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', ['#include <common>', 'varying float vInstOpacity;'].join('\n'))
          .replace(
            '#include <map_fragment>',
            ['#include <map_fragment>', 'diffuseColor.a *= vInstOpacity;'].join('\n')
          );
      };
      m.customProgramCacheKey = function () {
        return 'inst_decal_opacity_v1';
      };
      return m;
    };

    this.shadowDecalInstMat = createInstancedDecalMat(this.contactShadowTex);
    this.causticDecalInstMat = createInstancedDecalMat(this.diamondCausticTex);
  };

  Scene3D.prototype.createMaterialForTheme = function (themeId) {
    const maps = ns.getObjectMaps(themeId);

    if (themeId === 'tennis') {
      return new THREE.MeshPhysicalMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        normalScale: new THREE.Vector2(1.65, 1.65),
        roughnessMap: maps.roughnessMap,
        roughness: 1.0,
        metalness: 0.0,
        specularIntensity: 0.16,
        sheen: 0.56,
        sheenRoughness: 0.78,
        sheenColor: new THREE.Color(0xe2ff58),
        envMapIntensity: 0.20
      });
    }
    if (themeId === 'basketball') {
      return new THREE.MeshPhysicalMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        normalScale: new THREE.Vector2(1.55, 1.55),
        roughnessMap: maps.roughnessMap,
        roughness: 1.0,
        metalness: 0.0,
        specularIntensity: 0.68,
        clearcoat: 0.22,
        clearcoatRoughness: 0.32,
        envMapIntensity: 0.56
      });
    }
    if (themeId === 'soccer') {
      return new THREE.MeshPhysicalMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        normalScale: new THREE.Vector2(1.55, 1.55),
        roughnessMap: maps.roughnessMap,
        roughness: 1.0,
        metalness: 0.0,
        specularIntensity: 0.68,
        clearcoat: 0.32,
        clearcoatRoughness: 0.22,
        envMapIntensity: 0.56
      });
    }
    if (themeId === 'goldBar') {
      return new THREE.MeshPhysicalMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughnessMap: maps.roughnessMap,
        anisotropyMap: maps.anisotropyMap || null,
        anisotropy: 0.46,
        anisotropyRotation: 0.0,
        clearcoat: 0.0,
        specularColor: new THREE.Color(0xfff0b8),
        color: 0xffffff,
        metalness: 1.0,
        roughness: 1.0,
        envMapIntensity: 1.55
      });
    }
    const floorMaps = ns.getFloorMaps('diamond');
    const diamondBVH = this.getOrCreateDiamondBVH();
    const envEquirect = ns.getStudioEquirectMap ? ns.getStudioEquirectMap(this.currentHdrPresetId) : null;
    return createDiamondShaderMaterial(
      floorMaps.map,
      envEquirect,
      diamondBVH ? diamondBVH.struct : null,
      this.useLinearHDRRT
    );
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
        this.floorMat.metalness = 0.08;
        this.floorMat.envMapIntensity = 0.48;
        this.floorMat.normalScale.set(0.42, 0.42);
      } else if (themeId === 'basketball') {
        this.floorMat.metalness = 0.02;
        this.floorMat.envMapIntensity = 0.62;
        this.floorMat.normalScale.set(0.44, 0.44);
      } else if (themeId === 'tennis') {
        // Cushioned EPDM rubber-granule court: crisp pre-baked micro-pebble normal relief, velvety-matte dielectric
        this.floorMat.metalness = 0.0;
        this.floorMat.envMapIntensity = 0.16;
        this.floorMat.normalScale.set(1.05, 1.05);
      } else {
        this.floorMat.metalness = 0.0;
        this.floorMat.envMapIntensity = 0.10;
        this.floorMat.normalScale.set(1.15, 1.15);
      }
      this.floorMat.needsUpdate = true;
    }

    if (themeId === 'soccer') {
      if (!this.grassFieldMesh) {
        this.grassFieldMesh = createGrassField3D(
          this.trailBuffer.texture,
          floorMaps.lineMask || null,
          this.useLinearHDRRT,
          this.grassDensity
        );
        this.dioramaScene.add(this.grassFieldMesh);
      }
      this.activeGrassBlades = this.grassFieldMesh.userData.applyDensityTier(this.grassDensity);
      const gu = this.grassFieldMesh.material.uniforms;
      if (gu) {
        gu.uPitchLineMask.value = floorMaps.lineMask || null;
        gu.uTrailMap.value = this.trailBuffer.texture;
        gu.uTrailStrength.value = this.trailStrength;
      }
      this.grassFieldMesh.visible = true;
    } else if (this.grassFieldMesh) {
      this.grassFieldMesh.visible = false;
      this.activeGrassBlades = 0;
    } else {
      this.activeGrassBlades = 0;
    }

    if (this.n8aoPass) {
      const cfg = this.n8aoPass.configuration;
      if (themeId === 'tennis') {
        cfg.intensity = 1.05;
        cfg.aoRadius = 0.40;
        cfg.color.setHex(0x202614);
      } else if (themeId === 'basketball') {
        cfg.intensity = 1.10;
        cfg.aoRadius = 0.40;
        cfg.color.setHex(0x241810);
      } else if (themeId === 'goldBar') {
        cfg.intensity = 1.10;
        cfg.aoRadius = 0.38;
        cfg.color.setHex(0x161410);
      } else if (themeId === 'soccer') {
        cfg.intensity = 1.05;
        cfg.aoRadius = 0.40;
        cfg.color.setHex(0x0d220c);
      } else {
        cfg.intensity = 1.15;
        cfg.aoRadius = 0.38;
        cfg.color.setHex(0x050810);
      }
    }

    this.dioramaKeyLight.castShadow = themeId !== 'diamond';
    this._shadowDirty = true;
    this._pass1Dirty = true;
    this._matricesDirty = true;

    this.dioramaKeyLight.color.setHex(isLuxury ? 0xfffaf2 : 0xfff8ee);
    this.dioramaHemi.color.setHex(0xf8fbff);
    this.dioramaHemi.groundColor.setHex(isLuxury ? 0x1c2028 : 0x24282c);
    this.dioramaHemi.intensity =
      themeId === 'diamond'
        ? 0.32
        : themeId === 'goldBar'
        ? 0.56
        : themeId === 'basketball'
        ? 0.48
        : themeId === 'soccer'
        ? 0.52
        : 0.48;

    this.dioramaFillLight.color.setHex(isLuxury ? 0xdbeaff : 0xd4e6ff);
    this.dioramaFillLight.intensity =
      themeId === 'diamond'
        ? 0.30
        : themeId === 'goldBar'
        ? 0.58
        : themeId === 'basketball'
        ? 0.46
        : themeId === 'soccer'
        ? 0.48
        : 0.44;

    if (this.dioramaRimLight) {
      if (themeId === 'goldBar') {
        this.dioramaRimLight.position.set(4.2, -3.4, 2.8);
        this.dioramaRimLight.color.setHex(0xfff0cc);
        this.dioramaRimLight.intensity = 1.05;
      } else if (themeId === 'diamond') {
        this.dioramaRimLight.position.set(4.2, -3.4, 2.8);
        this.dioramaRimLight.color.setHex(0xcce8ff);
        this.dioramaRimLight.intensity = 0.72;
      } else if (themeId === 'basketball') {
        this.dioramaRimLight.position.set(4.8, -4.0, 1.35);
        this.dioramaRimLight.color.setHex(0xffe4c4);
        this.dioramaRimLight.intensity = 0.96;
      } else if (themeId === 'soccer') {
        this.dioramaRimLight.position.set(4.8, -4.0, 1.35);
        this.dioramaRimLight.color.setHex(0xeaf4ff);
        this.dioramaRimLight.intensity = 0.94;
      } else {
        this.dioramaRimLight.position.set(4.8, -4.0, 1.35);
        this.dioramaRimLight.color.setHex(0xf2ffcf);
        this.dioramaRimLight.intensity = 0.88;
      }
    }

    this.vaultRimLight.intensity = 0.0;
  };

  Scene3D.prototype.getOrCreateDiamondBVH = function () {
    if (this.diamondBVHCache) return this.diamondBVHCache;
    const BVH = global.THREE_ADDONS && global.THREE_ADDONS.BVH;
    if (!BVH || !BVH.MeshBVH || !BVH.MeshBVHUniformStruct) return null;
    const geom = this.getOrCreateGeometry('diamond');
    const bvh = new BVH.MeshBVH(geom, { strategy: BVH.SAH, lazyGeneration: false });
    const struct = new BVH.MeshBVHUniformStruct();
    struct.updateFrom(bvh);
    this.diamondBVHCache = { bvh: bvh, struct: struct };
    return this.diamondBVHCache;
  };

  Scene3D.prototype.getOrCreateGeometry = function (themeId) {
    if (this.geometryCache[themeId]) {
      return this.geometryCache[themeId];
    }
    let geom;
    if (themeId === 'tennis') {
      geom = createSculptedTennisGeometry();
    } else if (themeId === 'basketball') {
      geom = createSculptedBasketballGeometry();
    } else if (themeId === 'soccer') {
      geom = createSculptedSoccerGeometry();
    } else if (themeId === 'goldBar') {
      geom = createBeveledGoldBarGeometry(0.54, 0.24, 0.14);
    } else {
      geom = createBrilliantDiamondGeometry();
    }
    this.geometryCache[themeId] = geom;
    return geom;
  };

  Scene3D.prototype.refreshPhotogrammetryModels = function () {};

  Scene3D.prototype.prewarmTheme = function (themeId) {
    this.getOrCreateGeometry(themeId);
    if (themeId === 'soccer' && !this.grassFieldMesh) {
      const floorMaps = ns.getFloorMaps('soccer');
      this.grassFieldMesh = createGrassField3D(
        this.trailBuffer.texture,
        floorMaps.lineMask || null,
        this.useLinearHDRRT,
        this.grassDensity
      );
      this.grassFieldMesh.visible = this.currentThemeId === 'soccer';
      this.dioramaScene.add(this.grassFieldMesh);
    }
  };

  Scene3D.prototype.setGrassDensity = function (tier) {
    this.grassDensity = tier || 'balanced';
    if (this.grassFieldMesh && this.grassFieldMesh.userData && this.grassFieldMesh.userData.applyDensityTier) {
      const count = this.grassFieldMesh.userData.applyDensityTier(this.grassDensity);
      if (this.currentThemeId === 'soccer') {
        this.activeGrassBlades = count;
      }
    }
    this._pass1Dirty = true;
  };

  Scene3D.prototype.setN8AOEnabled = function (enabled) {
    this.n8aoEnabled = Boolean(enabled);
    this._pass1Dirty = true;
  };

  Scene3D.prototype.setTennisFuzzEnabled = function (enabled) {
    this.tennisFuzzEnabled = Boolean(enabled);
    if (this.tennisFuzzMesh) {
      this.tennisFuzzMesh.visible = this.currentThemeId === 'tennis' && this.tennisFuzzEnabled;
    }
    this._pass1Dirty = true;
  };

  Scene3D.prototype.getPerfStats = function () {
    return {
      bodies: this.instanceCount || 0,
      grassBlades: this.currentThemeId === 'soccer' ? this.activeGrassBlades : 0,
      rtWidth: this.screenRT ? this.screenRT.width : 0,
      rtHeight: this.screenRT ? this.screenRT.height : 0,
      n8ao: Boolean(this.n8aoEnabled),
      fuzz: this.currentThemeId === 'tennis' && Boolean(this.tennisFuzzEnabled)
    };
  };

  Scene3D.prototype.rebuildBodies = function (themeId, physicsBodies) {
    this.currentThemeId = themeId;
    if (this.trailBuffer) {
      this.trailBuffer.clear();
    }

    if (this.bodiesInstancedMesh) {
      this.dioramaScene.remove(this.bodiesInstancedMesh);
      this.bodiesInstancedMesh.dispose();
      this.bodiesInstancedMesh = null;
    }
    if (this.decalsInstancedMesh) {
      this.dioramaScene.remove(this.decalsInstancedMesh);
      this.decalsInstancedMesh.dispose();
      this.decalsInstancedMesh = null;
    }
    if (this.tennisFuzzMesh) {
      this.dioramaScene.remove(this.tennisFuzzMesh);
      if (this.tennisFuzzMesh.geometry) this.tennisFuzzMesh.geometry.dispose();
      if (this.tennisFuzzMesh.material) this.tennisFuzzMesh.material.dispose();
      this.tennisFuzzMesh.dispose();
      this.tennisFuzzMesh = null;
    }

    if (this.sharedMat) this.sharedMat.dispose();

    this.applyThemeMaterialSettings(themeId);
    this.sharedMat = this.createMaterialForTheme(themeId);
    this.sharedGeo = this.getOrCreateGeometry(themeId);

    const count = physicsBodies.length;
    this.instanceCount = count;
    if (count === 0) return;

    if (count > this.maxDecalInstances) {
      this.maxDecalInstances = count;
      this.decalOpacityArray = new Float32Array(count);
      this.decalOpacityAttr = new THREE.InstancedBufferAttribute(this.decalOpacityArray, 1);
      this.decalOpacityAttr.setUsage(THREE.DynamicDrawUsage);
      this.shadowDecalGeo.setAttribute('aInstOpacity', this.decalOpacityAttr);
    }

    // Single InstancedMesh draw call for all 15-40 bodies (color pass + shadow pass + backdrop pass)
    const bodiesInst = new THREE.InstancedMesh(this.sharedGeo, this.sharedMat, count);
    bodiesInst.castShadow = themeId !== 'diamond';
    bodiesInst.receiveShadow = themeId !== 'diamond';
    bodiesInst.frustumCulled = false;
    bodiesInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const decalMat = themeId === 'diamond' ? this.causticDecalInstMat : this.shadowDecalInstMat;
    const decalsInst = new THREE.InstancedMesh(this.shadowDecalGeo, decalMat, count);
    decalsInst.frustumCulled = false;
    decalsInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = this._dummyObj;
    const isGold = themeId === 'goldBar';
    for (let i = 0; i < count; i += 1) {
      const b = physicsBodies[i];
      dummy.position.set(b.x, b.y, b.z);
      dummy.quaternion.copy(b.q);
      if (isGold) {
        const s = b.hx / 0.54;
        dummy.scale.set(s, s, s);
      } else {
        dummy.scale.set(b.r, b.r, b.r);
      }
      dummy.updateMatrix();
      bodiesInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(b.x, b.y, 0.008);
      dummy.rotation.set(0, 0, 0);
      const decalW = isGold ? b.hx * 2.5 : b.r * 2.5;
      const decalH = isGold ? b.hy * 2.7 : b.r * 2.5;
      dummy.scale.set(decalW, decalH, 1);
      dummy.updateMatrix();
      decalsInst.setMatrixAt(i, dummy.matrix);
      this.decalOpacityArray[i] = themeId === 'diamond' ? 0.9 : 0.72;
    }

    bodiesInst.instanceMatrix.needsUpdate = true;
    decalsInst.instanceMatrix.needsUpdate = true;
    this.decalOpacityAttr.needsUpdate = true;

    this.bodiesInstancedMesh = bodiesInst;
    this.decalsInstancedMesh = decalsInst;
    this.dioramaScene.add(bodiesInst);
    this.dioramaScene.add(decalsInst);

    if (themeId === 'tennis') {
      if (!this.tennisShellBaseGeo) {
        this.tennisShellBaseGeo = new THREE.SphereGeometry(1.0, 28, 20);
      }
      const tennisMaps = ns.getObjectMaps('tennis');
      const fuzzMesh = createTennisFuzzShells(count, tennisMaps, this.useLinearHDRRT, this.tennisShellBaseGeo);
      const layers = fuzzMesh.userData.layers;
      const tmpMat = this._dummyObj.matrix;
      for (let i = 0; i < count; i += 1) {
        bodiesInst.getMatrixAt(i, tmpMat);
        for (let l = 0; l < layers.length; l += 1) {
          fuzzMesh.setMatrixAt(i * layers.length + l, tmpMat);
        }
      }
      fuzzMesh.instanceMatrix.needsUpdate = true;
      fuzzMesh.visible = Boolean(this.tennisFuzzEnabled);
      this.tennisFuzzMesh = fuzzMesh;
      this.dioramaScene.add(fuzzMesh);
    }

    this._matricesDirty = true;
    this._shadowDirty = true;
    this._pass1Dirty = true;
  };

  Scene3D.prototype.refreshPhotographicMaterials = function () {
    this.hardware.applyHardwarePBRMaps(ns.getWatchHardwareMaps());
    if (this.velvetFloorMat) {
      this.applyVelvetMapsToShader(ns.getFloorMaps('diamond'));
    }
    this.applyThemeMaterialSettings(this.currentThemeId);
    this._pass1Dirty = true;

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
      if (this.bodiesInstancedMesh) {
        this.bodiesInstancedMesh.material = newMat;
      }
      oldMat.dispose();
    }

    if (this.currentThemeId === 'tennis' && this.tennisFuzzMesh && this.tennisFuzzMesh.material && this.tennisFuzzMesh.material.uniforms) {
      const tm = ns.getObjectMaps('tennis');
      const fu = this.tennisFuzzMesh.material.uniforms;
      fu.uColorMap.value = tm.map;
      fu.uRoughSeamMap.value = tm.roughnessMap;
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
    this._pass1Dirty = true;
  };

  Scene3D.prototype.setBloomStrength = function (val) {
    const clamped = Math.max(0, Math.min(1.5, Number.isFinite(val) ? val : 0.32));
    this.bloomStrength = clamped;
    if (this.dioramaBloomPass && this.currentThemeId === 'diamond') {
      this.dioramaBloomPass.strength = clamped;
    }
    this._pass1Dirty = true;
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
    if (this.grassFieldMesh && this.grassFieldMesh.material && this.grassFieldMesh.material.uniforms) {
      this.grassFieldMesh.material.uniforms.uTrailStrength.value = clamped;
    }
    this._pass1Dirty = true;
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
    this._pass1Dirty = true;
  };

  Scene3D.prototype.setStudioHDRI = function (presetId) {
    const self = this;
    this.currentHdrPresetId = presetId || 'studio09';
    ns.loadStudioHDRI(this.renderer, this.currentHdrPresetId, function (envTex) {
      if (envTex) {
        self.scene.environment = envTex;
        self.dioramaScene.environment = envTex;
        if (self.currentThemeId === 'diamond' && self.sharedMat && self.sharedMat.uniforms) {
          const equirect =
            (envTex.userData && envTex.userData.equirectTex) ||
            (ns.getStudioEquirectMap ? ns.getStudioEquirectMap(self.currentHdrPresetId) : null);
          if (equirect && self.sharedMat.uniforms.uEnvEquirectMap) {
            self.sharedMat.uniforms.uEnvEquirectMap.value = equirect;
            self.sharedMat.uniforms.uHasEnvMap.value = 1.0;
          }
        }
        self._pass1Dirty = true;
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
    const rect = this._cachedCanvasRect || (this._cachedCanvasRect = this.canvas.getBoundingClientRect());
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

  Scene3D.prototype.syncAndRender = function (
    physicsBodies,
    gx,
    gy,
    aodMode,
    watchRotX,
    watchRotY,
    watchRotZ,
    dt,
    isPhysicsResting
  ) {
    const frameDt = Math.min(0.05, Math.max(1 / 240, dt || 1 / 60));
    const smoothAlpha = 1.0 - Math.exp(-9.5 * frameDt);
    const resting = Boolean(isPhysicsResting);

    const isLuxuryTheme = this.currentThemeId === 'diamond' || this.currentThemeId === 'goldBar';
    const targetExp =
      this.currentThemeId === 'diamond'
        ? aodMode ? 0.52 : 1.02
        : this.currentThemeId === 'goldBar'
        ? aodMode ? 0.50 : 1.04
        : this.currentThemeId === 'basketball'
        ? aodMode ? 0.50 : 1.06
        : aodMode ? 0.48 : 1.04;
    const expDelta = Math.abs(targetExp - this.renderer.toneMappingExposure);
    this.renderer.toneMappingExposure += (targetExp - this.renderer.toneMappingExposure) * smoothAlpha;

    const targetEmissive = this.floorEmissiveBase * (aodMode ? 0.45 : 1.0);
    const emissiveDelta = Math.abs(targetEmissive - this.floorMat.emissiveIntensity);
    this.floorMat.emissiveIntensity += (targetEmissive - this.floorMat.emissiveIntensity) * smoothAlpha;

    if (this.sharedMat && this.sharedMat.uniforms && this.sharedMat.uniforms.uExposure) {
      this.sharedMat.uniforms.uExposure.value = this.useLinearHDRRT
        ? (aodMode ? 0.58 : 0.98)
        : this.renderer.toneMappingExposure * 1.02;
    }

    const needMatrixUpload = !resting || this._matricesDirty;
    if (needMatrixUpload && this.bodiesInstancedMesh && this.decalsInstancedMesh) {
      const dummy = this._dummyObj;
      const isGold = this.currentThemeId === 'goldBar';
      const shadowOffX = isLuxuryTheme ? 0.045 : 0.062;
      const shadowOffY = isLuxuryTheme ? -0.055 : -0.062;
      const decalBaseOpacity =
        this.currentThemeId === 'diamond'
          ? 0.80
          : isGold
          ? 0.38
          : this.currentThemeId === 'soccer'
          ? 0.30
          : this.currentThemeId === 'basketball'
          ? 0.46
          : 0.44;
      const count = Math.min(physicsBodies.length, this.instanceCount);

      for (let i = 0; i < count; i += 1) {
        const b = physicsBodies[i];
        dummy.position.set(b.x, b.y, b.z);
        dummy.quaternion.copy(b.q);
        if (isGold) {
          const s = b.hx / 0.54;
          dummy.scale.set(s, s, s);
        } else {
          dummy.scale.set(b.r, b.r, b.r);
        }
        dummy.updateMatrix();
        this.bodiesInstancedMesh.setMatrixAt(i, dummy.matrix);
        if (this.tennisFuzzMesh && this.tennisFuzzMesh.visible) {
          const layers = this.tennisFuzzMesh.userData.layers;
          for (let l = 0; l < layers.length; l += 1) {
            this.tennisFuzzMesh.setMatrixAt(i * layers.length + l, dummy.matrix);
          }
        }

        const floorDist = Math.max(0, b.z - (isGold ? b.hz : b.r));
        const contactFade = Math.max(0.08, 1.0 - floorDist * 0.9);
        const expand = 1.0 + floorDist * 0.35;
        dummy.position.set(b.x + shadowOffX, b.y + shadowOffY, 0.008);
        if (isGold) {
          const yaw = Math.atan2(
            2 * (b.q.w * b.q.z + b.q.x * b.q.y),
            1 - 2 * (b.q.y * b.q.y + b.q.z * b.q.z)
          );
          dummy.rotation.set(0, 0, yaw);
          dummy.scale.set(b.hx * 2.5 * expand, b.hy * 2.7 * expand, 1);
        } else {
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(b.r * 2.5 * expand, b.r * 2.5 * expand, 1);
        }
        dummy.updateMatrix();
        this.decalsInstancedMesh.setMatrixAt(i, dummy.matrix);
        this.decalOpacityArray[i] = decalBaseOpacity * contactFade;
      }

      this.bodiesInstancedMesh.instanceMatrix.needsUpdate = true;
      if (this.tennisFuzzMesh && this.tennisFuzzMesh.visible) {
        this.tennisFuzzMesh.instanceMatrix.needsUpdate = true;
      }
      this.decalsInstancedMesh.instanceMatrix.needsUpdate = true;
      this.decalOpacityAttr.needsUpdate = true;
      this._matricesDirty = false;
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
    const eyeMoved = Math.abs(eyeX - this._lastEyeX) + Math.abs(eyeY - this._lastEyeY) > 0.0004;
    if (eyeMoved) {
      this._lastEyeX = eyeX;
      this._lastEyeY = eyeY;
    }

    this.offAxisCamera.position.set(eyeX, eyeY, eyeZ);
    this.offAxisCamera.rotation.set(0, 0, 0);
    this.offAxisCamera.updateMatrixWorld();
    this.offAxisCamera.matrixWorldInverse.copy(this.offAxisCamera.matrixWorld).invert();

    const near = 1.2;
    const far = 24.0;
    this.offAxisCamera.near = near;
    this.offAxisCamera.far = far;
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

    const keyX = (isLuxuryTheme ? -4.4 : -5.2) - gx * 1.6;
    const keyY = (isLuxuryTheme ? 4.6 : 5.0) - gy * 1.4;
    const keyZ = isLuxuryTheme ? 5.2 : 4.2;
    const lightMoved = Math.abs(keyX - this._lastKeyX) + Math.abs(keyY - this._lastKeyY) > 0.0006;
    if (lightMoved) {
      this._lastKeyX = keyX;
      this._lastKeyY = keyY;
    }
    this.dioramaKeyLight.position.set(keyX, keyY, keyZ);
    this.keyLight.position.set(-5.6 - gx * 1.6, 6.4 - gy * 1.4, 8.2);
    const targetDioramaKey =
      this.currentThemeId === 'diamond'
        ? aodMode ? 1.5 : 2.40
        : this.currentThemeId === 'goldBar'
        ? aodMode ? 1.2 : 2.30
        : this.currentThemeId === 'basketball'
        ? aodMode ? 1.40 : 2.58
        : this.currentThemeId === 'tennis'
        ? aodMode ? 1.20 : 2.38
        : aodMode ? 1.15 : 2.48;
    const keyIntDelta = Math.abs(targetDioramaKey - this.dioramaKeyLight.intensity);
    this.dioramaKeyLight.intensity += (targetDioramaKey - this.dioramaKeyLight.intensity) * smoothAlpha;

    const aodChanged = this._lastAod !== aodMode;
    this._lastAod = aodMode;

    if (this.trailBuffer) {
      this.trailBuffer.update(physicsBodies, this.currentThemeId, frameDt, this.trailStrength);
    }

    if (this.currentThemeId === 'diamond' && this.velvetFloorMat) {
      const vu = this.velvetFloorMat.userData && this.velvetFloorMat.userData.velvetUniforms;
      if (vu) {
        vu.uEyePos.value.set(eyeX, eyeY, eyeZ);
        vu.uKeyLightPos.value.copy(this.dioramaKeyLight.position);
      }
    }

    if (this.currentThemeId === 'tennis' && this.tennisFuzzMesh && this.tennisFuzzMesh.visible) {
      const fu = this.tennisFuzzMesh.material.uniforms;
      if (fu) {
        fu.uEyePos.value.set(eyeX, eyeY, eyeZ);
        fu.uKeyLightPos.value.copy(this.dioramaKeyLight.position);
        fu.uKeyIntensity.value = this.dioramaKeyLight.intensity;
        fu.uExposure.value = this.useLinearHDRRT
          ? (aodMode ? 0.62 : 1.00)
          : this.renderer.toneMappingExposure * 1.05;
      }
    }

    if (this.currentThemeId === 'soccer' && this.grassFieldMesh && this.grassFieldMesh.visible) {
      this._grassTime += frameDt;
      const gu = this.grassFieldMesh.material.uniforms;
      if (gu) {
        gu.uTime.value = this._grassTime;
        gu.uEyePos.value.set(eyeX, eyeY, eyeZ);
        gu.uKeyLightPos.value.copy(this.dioramaKeyLight.position);
        gu.uKeyIntensity.value = this.dioramaKeyLight.intensity;
        gu.uTrailStrength.value = this.trailStrength;
        const ballArr = gu.uBalls.value;
        const bCount = Math.min(physicsBodies.length, ballArr.length);
        gu.uBallCount.value = bCount;
        for (let i = 0; i < bCount; i += 1) {
          const b = physicsBodies[i];
          ballArr[i].set(b.x, b.y, b.z, b.r);
        }
      }
    }

    const shift = 0.28 * this.parallaxStrength;
    this.camera.position.set(-gx * shift, -gy * shift, this.baseCameraZ);
    this.camera.lookAt(0, 0, 0);

    const needPass1 =
      this._pass1Dirty ||
      needMatrixUpload ||
      eyeMoved ||
      lightMoved ||
      aodChanged ||
      expDelta > 0.001 ||
      emissiveDelta > 0.0005 ||
      keyIntDelta > 0.002 ||
      this.currentThemeId === 'soccer' ||
      Boolean(this.trailBuffer && this.trailBuffer.isDirty);

    if (needPass1) {
      // On-demand shadow map update: only re-rasterize shadows when bodies/light/theme changed
      this.renderer.shadowMap.needsUpdate =
        this.dioramaKeyLight.castShadow && (needMatrixUpload || lightMoved || this._shadowDirty);

      // Pass 1: Render spatial diorama into high-DPI HDR portal RT (bypassing Bloom passes completely when inactive)
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

      const baseBloom = aodMode ? this.bloomStrength * 0.45 : this.bloomStrength;
      const effectiveBloom = this.currentThemeId === 'diamond' ? baseBloom * 0.45 : 0.0;

      const useN8AO = Boolean(this.n8aoPass && this.n8aoEnabled);
      const useBloom = Boolean(this.dioramaBloomPass && effectiveBloom > 0.001);

      if (this.dioramaComposer && (useN8AO || useBloom)) {
        if (this.dioramaRenderPass) {
          this.dioramaRenderPass.enabled = !useN8AO;
        }
        if (this.n8aoPass) {
          this.n8aoPass.enabled = useN8AO;
        }
        if (this.dioramaBloomPass) {
          this.dioramaBloomPass.enabled = useBloom;
          if (useBloom) {
            this.dioramaBloomPass.threshold = 3.35;
            this.dioramaBloomPass.radius = 0.12;
            this.dioramaBloomPass.strength = effectiveBloom;
          }
        }
        this.dioramaComposer.render();
        this.hardware.setScreenTexture(this.dioramaComposer.readBuffer.texture);
      } else {
        // Fallback single-pass MSAA direct render when both N8AO & Bloom are disabled
        this.renderer.setRenderTarget(this.screenRT);
        this.renderer.clear();
        this.renderer.render(this.dioramaScene, this.offAxisCamera);
        this.hardware.setScreenTexture(this.screenRT.texture);
      }

      this.renderer.toneMapping = prevToneMapping;
      this.renderer.shadowMap.needsUpdate = false;
      this._shadowDirty = false;
      this._pass1Dirty = false;
    }

    // Pass 2: Render solid 3D Apple Watch + single-pass AR sapphire crystal + HDR screen onto poster
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.render(this.scene, this.camera);
  };

  ns.Scene3D = Scene3D;
})(window);
