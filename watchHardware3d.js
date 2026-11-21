(function (global) {
  'use strict';

  const ns = (global.GravityWatch = global.GravityWatch || {});

  const CAVITY_HX = 2.0;
  const CAVITY_HY = 2.44;
  const CAVITY_CR = 0.72;
  const CAVITY_DEPTH = 1.08;

  function safeComputeTangents(geom) {
    if (
      geom &&
      geom.index &&
      geom.attributes.position &&
      geom.attributes.normal &&
      geom.attributes.uv &&
      typeof geom.computeTangents === 'function'
    ) {
      geom.computeTangents();
    }
    return geom;
  }

  /* =========================================================
     Parametric Rounded-Squircle Geometry Utilities
     ========================================================= */
  function sampleRoundedRectLoop(hx, hy, cornerR, segsPerCorner) {
    const cr = Math.min(cornerR, hx * 0.49, hy * 0.49);
    const ix = hx - cr;
    const iy = hy - cr;
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

    // Remove duplicate seams between corners cleanly while keeping smooth loop
    const unique = [];
    for (let i = 0; i < pts.length; i += 1) {
      const prev = unique.length > 0 ? unique[unique.length - 1] : null;
      if (!prev || Math.hypot(pts[i][0] - prev[0], pts[i][1] - prev[1]) > 0.0005) {
        unique.push(pts[i]);
      }
    }
    if (unique.length > 1) {
      const first = unique[0];
      const last = unique[unique.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.0005) {
        unique.pop();
      }
    }
    return unique;
  }

  function computeLoopArcU(pts) {
    const u = [0];
    let total = 0;
    for (let i = 1; i <= pts.length; i += 1) {
      const p0 = pts[i - 1];
      const p1 = pts[i % pts.length];
      total += Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      u.push(total);
    }
    if (total > 0.0001) {
      for (let i = 0; i < u.length; i += 1) {
        u[i] /= total;
      }
    }
    return u;
  }

  function buildLoftedRingGeometry(profiles, segsPerCorner, flipWinding) {
    const rings = profiles.map(function (p) {
      const pts = sampleRoundedRectLoop(p.hx, p.hy, p.cr, segsPerCorner);
      return { z: p.z, pts: pts, u: computeLoopArcU(pts) };
    });

    const ringCount = rings.length;
    const ptsCount = rings[0].pts.length;
    const stride = ptsCount + 1;

    const positions = [];
    const uvs = [];
    const indices = [];

    let vAccum = 0;
    for (let r = 0; r < ringCount; r += 1) {
      if (r > 0) {
        const prev = rings[r - 1];
        const curr = rings[r];
        const dx = curr.pts[0][0] - prev.pts[0][0];
        const dy = curr.pts[0][1] - prev.pts[0][1];
        const dz = curr.z - prev.z;
        vAccum += Math.hypot(dx, dy, dz);
      }

      const ring = rings[r];
      for (let i = 0; i <= ptsCount; i += 1) {
        const pt = ring.pts[i % ptsCount];
        positions.push(pt[0], pt[1], ring.z);
        uvs.push(ring.u[i] * 4.0, vAccum * 0.6);
      }
    }

    for (let r = 0; r < ringCount - 1; r += 1) {
      const rowA = r * stride;
      const rowB = (r + 1) * stride;
      for (let i = 0; i < ptsCount; i += 1) {
        const a0 = rowA + i;
        const a1 = rowA + i + 1;
        const b1 = rowB + i + 1;
        const b0 = rowB + i;
        if (flipWinding) {
          indices.push(a0, b1, a1, a0, b0, b1);
        } else {
          indices.push(a0, a1, b1, a0, b1, b0);
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return safeComputeTangents(geom);
  }

  function buildRoundedRectCapGeometry(hx, hy, cr, z, normalZ, segsPerCorner) {
    const pts = sampleRoundedRectLoop(hx, hy, cr, segsPerCorner);
    const positions = [0, 0, z];
    const uvs = [0.5, 0.5];
    const indices = [];

    for (let i = 0; i < pts.length; i += 1) {
      const px = pts[i][0];
      const py = pts[i][1];
      positions.push(px, py, z);
      uvs.push(px / (hx * 2) + 0.5, py / (hy * 2) + 0.5);
    }

    for (let i = 0; i < pts.length; i += 1) {
      const next = (i + 1) % pts.length;
      if (normalZ >= 0) {
        indices.push(0, 1 + i, 1 + next);
      } else {
        indices.push(0, 1 + next, 1 + i);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return safeComputeTangents(geom);
  }

  function buildRoundedRectBorderGeometry(innerHx, innerHy, innerCr, outerHx, outerHy, outerCr, innerZ, outerZ, segsPerCorner) {
    const innerPts = sampleRoundedRectLoop(innerHx, innerHy, innerCr, segsPerCorner);
    const outerPts = sampleRoundedRectLoop(outerHx, outerHy, outerCr, segsPerCorner);
    const count = innerPts.length;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= count; i += 1) {
      const p = innerPts[i % count];
      positions.push(p[0], p[1], innerZ);
      uvs.push(i / count, 0);
    }
    for (let i = 0; i <= count; i += 1) {
      const p = outerPts[i % count];
      positions.push(p[0], p[1], outerZ);
      uvs.push(i / count, 1);
    }

    const stride = count + 1;
    for (let i = 0; i < count; i += 1) {
      const a0 = i;
      const a1 = i + 1;
      const b0 = stride + i;
      const b1 = stride + i + 1;
      indices.push(a0, b0, b1, a0, b1, a1);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return safeComputeTangents(geom);
  }

  function buildCurvedSapphireDomeGeometry(hx, hy, cr, baseZ, domeHeight, edgeDrop, segsPerCorner) {
    // Profile rings wrap smoothly outside the bezel skirt then crown gently over the OLED face (+Z normals)
    const spec =
      edgeDrop > 0.05
        ? [
            { s: 1.0, z: baseZ - edgeDrop },
            { s: 0.955, z: baseZ - edgeDrop * 0.4 },
            { s: 0.905, z: baseZ - edgeDrop * 0.06 },
            { s: 0.87, z: baseZ + domeHeight * 0.14 },
            { s: 0.72, z: baseZ + domeHeight * 0.42 },
            { s: 0.56, z: baseZ + domeHeight * 0.68 },
            { s: 0.4, z: baseZ + domeHeight * 0.86 },
            { s: 0.24, z: baseZ + domeHeight * 0.96 },
            { s: 0.08, z: baseZ + domeHeight * 0.99 }
          ]
        : [
            { s: 1.0, z: baseZ - edgeDrop },
            { s: 0.92, z: baseZ + domeHeight * 0.2 },
            { s: 0.72, z: baseZ + domeHeight * 0.55 },
            { s: 0.5, z: baseZ + domeHeight * 0.8 },
            { s: 0.28, z: baseZ + domeHeight * 0.94 },
            { s: 0.1, z: baseZ + domeHeight * 0.99 }
          ];

    const rings = spec.map(function (item) {
      return {
        z: item.z,
        pts: sampleRoundedRectLoop(hx * item.s, hy * item.s, Math.max(0.02, cr * item.s), segsPerCorner)
      };
    });

    const ptsCount = rings[0].pts.length;
    const stride = ptsCount + 1;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let r = 0; r < rings.length; r += 1) {
      const ring = rings[r];
      for (let i = 0; i <= ptsCount; i += 1) {
        const pt = ring.pts[i % ptsCount];
        positions.push(pt[0], pt[1], ring.z);
        uvs.push(pt[0] / (hx * 2) + 0.5, pt[1] / (hy * 2) + 0.5);
      }
    }

    for (let r = 0; r < rings.length - 1; r += 1) {
      const rowA = r * stride;
      const rowB = (r + 1) * stride;
      for (let i = 0; i < ptsCount; i += 1) {
        const a0 = rowA + i;
        const a1 = rowA + i + 1;
        const b1 = rowB + i + 1;
        const b0 = rowB + i;
        indices.push(a0, a1, b1, a0, b1, b0);
      }
    }

    const apexZ = baseZ + domeHeight;
    const apexIdx = positions.length / 3;
    positions.push(0, 0, apexZ);
    uvs.push(0.5, 0.5);

    const lastRow = (rings.length - 1) * stride;
    for (let i = 0; i < ptsCount; i += 1) {
      indices.push(lastRow + i, lastRow + i + 1, apexIdx);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return safeComputeTangents(geom);
  }

  function buildKnurledCrownGeometry(teethCount, outerR, valleyR, thickness) {
    const shape = new THREE.Shape();
    const steps = teethCount * 4;
    for (let i = 0; i <= steps; i += 1) {
      const a = (i / steps) * Math.PI * 2;
      const mod = i % 4;
      const r = mod === 1 || mod === 2 ? outerR : valleyR;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }

    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.028,
      bevelSize: 0.022,
      bevelSegments: 2,
      curveSegments: 1
    });
    extrude.translate(0, 0, -thickness * 0.5);
    extrude.rotateY(Math.PI * 0.5);
    extrude.computeVertexNormals();
    return extrude;
  }

  function buildBeveledPillGeometry(widthX, heightY, depthZ, radius) {
    const w = widthX * 0.5;
    const h = heightY * 0.5;
    const r = Math.min(radius, w * 0.9, h * 0.9);
    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: depthZ,
      bevelEnabled: true,
      bevelThickness: 0.032,
      bevelSize: 0.03,
      bevelSegments: 3
    });
    geom.translate(0, 0, -depthZ * 0.5);
    geom.computeVertexNormals();
    return geom;
  }

  function buildSportBandGeometry(signY) {
    // Sculpted fluoroelastomer strap arcing backward in -Z as it leaves watch lug
    const steps = 10;
    const segsX = 14;
    const segsAround = 26;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const y = signY * (2.68 + t * 0.78);
      const zCenter = 0.24 - Math.pow(t, 1.35) * 0.56;
      const halfW = 1.24 - t * 0.14;
      const halfThick = 0.15 - t * 0.028;

      for (let a = 0; a <= segsAround; a += 1) {
        const ang = (a / segsAround) * Math.PI * 2;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        // Super-ellipse cross-section for sculpted curved edges
        const sx = Math.sign(cosA) * Math.pow(Math.abs(cosA), 0.42) * halfW;
        const sz = Math.sign(sinA) * Math.pow(Math.abs(sinA), 0.52) * halfThick;
        positions.push(sx, y, zCenter + sz);
        uvs.push(a / segsAround * 2.0, t * 1.4);
      }
    }

    const stride = segsAround + 1;
    for (let s = 0; s < steps; s += 1) {
      const rowA = s * stride;
      const rowB = (s + 1) * stride;
      for (let a = 0; a < segsAround; a += 1) {
        const a0 = rowA + a;
        const a1 = rowA + a + 1;
        const b1 = rowB + a + 1;
        const b0 = rowB + a;
        if (signY > 0) {
          indices.push(a0, b0, b1, a0, b1, a1);
        } else {
          indices.push(a0, a1, b1, a0, b1, b0);
        }
      }
    }

    // Cap tip end
    const tipZ = 0.24 - 0.56;
    const tipY = signY * (2.68 + 0.78);
    const tipCenterIdx = positions.length / 3;
    positions.push(0, tipY, tipZ);
    uvs.push(0.5, 1.0);
    const tipRow = steps * stride;
    for (let a = 0; a < segsAround; a += 1) {
      if (signY > 0) indices.push(tipCenterIdx, tipRow + a, tipRow + a + 1);
      else indices.push(tipCenterIdx, tipRow + a + 1, tipRow + a);
    }

    void segsX;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  function buildPosterShadowTexture() {
    const w = 256;
    const h = 320;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);

    for (let y = 0; y < h; y += 1) {
      const ny = (y / h - 0.5) * 2.0;
      for (let x = 0; x < w; x += 1) {
        const nx = (x / w - 0.5) * 2.0;
        // Rounded rect signed distance in normalized space
        const bx = 0.56;
        const by = 0.64;
        const cr = 0.22;
        const qx = Math.abs(nx) - (bx - cr);
        const qy = Math.abs(ny) - (by - cr);
        const outD = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cr;
        const rawAlpha = outD <= 0 ? 1.0 : Math.exp(-outD * outD * 18.0);
        const edgeFadeX = Math.max(0, 1.0 - Math.pow(Math.abs(nx), 4.0));
        const edgeFadeY = Math.max(0, 1.0 - Math.pow(Math.abs(ny), 4.0));
        const alpha = rawAlpha * edgeFadeX * edgeFadeY;
        const idx = (y * w + x) * 4;
        img.data[idx] = 2;
        img.data[idx + 1] = 28;
        img.data[idx + 2] = 3;
        img.data[idx + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 138);
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    if ('SRGBColorSpace' in THREE) {
      tex.colorSpace = THREE.SRGBColorSpace;
    } else {
      tex.encoding = THREE.sRGBEncoding;
    }
    tex.needsUpdate = true;
    return tex;
  }

  /* =========================================================
     3D Glass-Plane Clock & Complications HUD Renderer
     ========================================================= */
  function createHUDCanvasRenderer() {
    const W = 600;
    const H = 732;
    const LOGICAL_W = 768;
    const LOGICAL_H = 936;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    if ('SRGBColorSpace' in THREE) {
      tex.colorSpace = THREE.SRGBColorSpace;
    } else {
      tex.encoding = THREE.sRGBEncoding;
    }
    tex.anisotropy = 4;

    let lastKey = '';

    function drawComplicationCircle(cx, cy, r) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(14, 17, 22, 0.66)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.stroke();
      ctx.restore();
    }

    function update(state) {
      const key =
        state.dateText + '|' +
        state.timeText + '|' +
        String(state.showComplications) + '|' +
        String(state.aodMode);
      if (key === lastKey) return;
      lastKey = key;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(W / LOGICAL_W, 0, 0, H / LOGICAL_H, 0, 0);

      // Subtle diagonal glass screen reflection & crisp micro pixel perimeter on OLED glass
      const screenGrad = ctx.createLinearGradient(0, 0, LOGICAL_W * 0.72, LOGICAL_H * 0.65);
      screenGrad.addColorStop(0, state.aodMode ? 'rgba(255, 255, 255, 0.035)' : 'rgba(255, 255, 255, 0.075)');
      screenGrad.addColorStop(0.28, state.aodMode ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.026)');
      screenGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = screenGrad;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      // Hairline active OLED edge definition
      ctx.save();
      const pad = 2.5;
      const rr = 136;
      ctx.beginPath();
      ctx.moveTo(pad + rr, pad);
      ctx.lineTo(LOGICAL_W - pad - rr, pad);
      ctx.quadraticCurveTo(LOGICAL_W - pad, pad, LOGICAL_W - pad, pad + rr);
      ctx.lineTo(LOGICAL_W - pad, LOGICAL_H - pad - rr);
      ctx.quadraticCurveTo(LOGICAL_W - pad, LOGICAL_H - pad, LOGICAL_W - pad - rr, LOGICAL_H - pad);
      ctx.lineTo(pad + rr, LOGICAL_H - pad);
      ctx.quadraticCurveTo(pad, LOGICAL_H - pad, pad, LOGICAL_H - pad - rr);
      ctx.lineTo(pad, pad + rr);
      ctx.quadraticCurveTo(pad, pad, pad + rr, pad);
      ctx.closePath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
      ctx.stroke();
      ctx.restore();

      const alphaClock = state.aodMode ? 0.56 : 1.0;
      const alphaDate = state.aodMode ? 0.42 : 0.92;
      const alphaComp = state.aodMode ? 0.46 : 0.95;

      // Upper-right rounded digital clock & date (matches native watchOS WatchClockOverlayView)
      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 4;

      ctx.fillStyle = 'rgba(255, 255, 255, ' + alphaDate + ')';
      ctx.font = '700 37px "Nunito", "SF Pro Rounded", sans-serif';
      ctx.fillText(state.dateText || 'FRI 20', LOGICAL_W - 52, 52);

      ctx.shadowBlur = 24;
      ctx.fillStyle = 'rgba(255, 255, 255, ' + alphaClock + ')';
      ctx.font = '800 142px "Nunito", "SF Pro Rounded", sans-serif';
      ctx.fillText(state.timeText || '10:09', LOGICAL_W - 46, 94);
      ctx.restore();

      if (state.showComplications) {
        ctx.save();
        ctx.globalAlpha = alphaComp;
        const cr = 56;

        // Top-left Sunset / Daylight Complication
        const tlX = 96;
        const tlY = 104;
        drawComplicationCircle(tlX, tlY, cr);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tlX - 24, tlY + 4);
        ctx.lineTo(tlX + 24, tlY + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(tlX, tlY + 4, 13, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tlX, tlY - 24);
        ctx.lineTo(tlX, tlY - 16);
        ctx.moveTo(tlX - 18, tlY - 14);
        ctx.lineTo(tlX - 12, tlY - 9);
        ctx.moveTo(tlX + 18, tlY - 14);
        ctx.lineTo(tlX + 12, tlY - 9);
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '700 22px "Nunito", sans-serif';
        ctx.fillText('5:42', tlX, tlY + 12);

        // Bottom-left Arc Gauge + Spark Line Complication
        const blX = 96;
        const blY = LOGICAL_H - 104;
        drawComplicationCircle(blX, blY, cr);
        ctx.lineWidth = 6.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.arc(blX, blY, cr - 12, Math.PI * 0.72, Math.PI * 2.28);
        ctx.stroke();
        ctx.strokeStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(blX, blY, cr - 12, Math.PI * 0.72, Math.PI * 1.85);
        ctx.stroke();
        ctx.lineWidth = 4.2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(blX - 20, blY + 12);
        ctx.lineTo(blX - 6, blY - 6);
        ctx.lineTo(blX + 5, blY + 5);
        ctx.lineTo(blX + 18, blY - 12);
        ctx.stroke();

        // Bottom-right 3 Concentric Activity Rings Complication
        const brX = LOGICAL_W - 96;
        const brY = LOGICAL_H - 104;
        drawComplicationCircle(brX, brY, cr);
        const rings = [
          { rad: 40, end: 0.74, col: 'rgba(255, 255, 255, 0.96)' },
          { rad: 28, end: 0.68, col: 'rgba(255, 255, 255, 0.85)' },
          { rad: 16, end: 0.58, col: 'rgba(255, 255, 255, 0.74)' }
        ];
        for (let i = 0; i < rings.length; i += 1) {
          const rg = rings[i];
          ctx.lineWidth = 6;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
          ctx.beginPath();
          ctx.arc(brX, brY, rg.rad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = rg.col;
          ctx.beginPath();
          ctx.arc(brX, brY, rg.rad, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * rg.end);
          ctx.stroke();
        }
        ctx.restore();
      }

      tex.needsUpdate = true;
    }

    return {
      texture: tex,
      update: update
    };
  }

  /* =========================================================
     Unified 3D Sculpted Apple Watch Hardware Builder
     ========================================================= */
  function WatchHardware3D() {
    this.group = new THREE.Group();
    this.interactiveTargets = [];
    this.caseVariant = 'series10';
    this.crownAngle = 0;
    this.crownTargetAngle = 0;

    this.buildMaterials();
    this.buildGeometry();
    this.setCaseVariant('series10');
  }

  WatchHardware3D.prototype.buildMaterials = function () {
    this.caseMat = new THREE.MeshPhysicalMaterial({
      color: 0x16181d,
      metalness: 0.94,
      roughness: 0.16,
      clearcoat: 0.72,
      clearcoatRoughness: 0.08,
      anisotropy: 0.38,
      anisotropyRotation: 0,
      envMapIntensity: 1.85,
      normalScale: new THREE.Vector2(0.18, 0.18)
    });

    this.crownBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x20232a,
      metalness: 0.94,
      roughness: 0.22,
      clearcoat: 0.45,
      clearcoatRoughness: 0.12,
      anisotropy: 0.82,
      anisotropyRotation: Math.PI * 0.5,
      envMapIntensity: 1.9,
      normalScale: new THREE.Vector2(0.25, 0.25)
    });

    this.crownAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf43b18,
      metalness: 0.18,
      roughness: 0.22,
      envMapIntensity: 1.1
    });

    this.actionOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xff5216,
      metalness: 0.22,
      roughness: 0.26,
      envMapIntensity: 1.15
    });

    this.oledScreenMat = new THREE.MeshBasicMaterial({
      color: 0xffffff
    });

    this.bezelBlackMat = new THREE.MeshPhysicalMaterial({
      color: 0x010204,
      metalness: 0.04,
      roughness: 0.03,
      clearcoat: 1.0,
      clearcoatRoughness: 0.015,
      envMapIntensity: 2.15
    });

    this.ceramicBackMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b0c10,
      metalness: 0.12,
      roughness: 0.14,
      clearcoat: 0.9,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.1
    });

    this.bandMat = new THREE.MeshStandardMaterial({
      color: 0x0c0d11,
      metalness: 0.0,
      roughness: 0.92,
      envMapIntensity: 0.16,
      normalScale: new THREE.Vector2(0.55, 0.55)
    });

    // Single-pass physical sapphire AR coating (eliminates Three.js hidden full-scene transmission pre-pass & mipmap chain)
    this.sapphireMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4f8ff,
      transparent: true,
      opacity: 0.14,
      transmission: 0.0,
      ior: 1.77,
      roughness: 0.012,
      metalness: 0.0,
      reflectivity: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.012,
      iridescence: 0.28,
      iridescenceIOR: 1.38,
      iridescenceThicknessRange: [120, 320],
      envMapIntensity: 1.12,
      depthWrite: false
    });

    this.hudRenderer = createHUDCanvasRenderer();
    this.hudMat = new THREE.MeshBasicMaterial({
      map: this.hudRenderer.texture,
      transparent: true,
      depthWrite: false
    });

    this.posterShadowMat = new THREE.MeshBasicMaterial({
      map: buildPosterShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.72
    });
  };

  WatchHardware3D.prototype.buildGeometry = function () {
    const segs = 10;

    // 1. Solid Flush Edge-to-Edge LTPO3 OLED Display Screen Panel (tucked beneath curved black bezel & crystal)
    const oledGeo = buildRoundedRectCapGeometry(
      CAVITY_HX + 0.016,
      CAVITY_HY + 0.016,
      CAVITY_CR + 0.008,
      1.13,
      1,
      segs
    );
    this.oledScreenMesh = new THREE.Mesh(oledGeo, this.oledScreenMat);
    this.oledScreenMesh.renderOrder = 5;
    this.group.add(this.oledScreenMesh);

    // 2. Ultra 2 Inner Black OLED Screen Border Frame bridging screen perimeter to flat crystal perimeter
    const bezelBorderGeo = buildRoundedRectBorderGeometry(
      CAVITY_HX + 0.01,
      CAVITY_HY + 0.01,
      CAVITY_CR + 0.005,
      2.19,
      2.63,
      0.85,
      1.133,
      1.138,
      segs
    );
    this.bezelBorderMesh = new THREE.Mesh(bezelBorderGeo, this.bezelBlackMat);
    this.group.add(this.bezelBorderMesh);

    // 2b. Series 10 Curved Piano-Black Display Glass Skirt wrapping over shoulder down to metal split seam
    const glassSkirtProfiles = [
      { z: 0.77, hx: 2.275, hy: 2.725, cr: 0.94 },
      { z: 0.93, hx: 2.255, hy: 2.705, cr: 0.92 },
      { z: 1.05, hx: 2.19, hy: 2.635, cr: 0.86 },
      { z: 1.115, hx: 2.10, hy: 2.545, cr: 0.79 },
      { z: 1.135, hx: 2.008, hy: 2.448, cr: 0.725 }
    ];
    this.seriesGlassSkirtMesh = new THREE.Mesh(
      buildLoftedRingGeometry(glassSkirtProfiles, segs, false),
      this.bezelBlackMat
    );
    this.group.add(this.seriesGlassSkirtMesh);

    // 3. Series 10 / Titanium Gold Sculpted Pebble-Curved Unibody Shell (terminates cleanly at side glass split seam)
    const seriesProfiles = [
      { z: -0.34, hx: 1.92, hy: 2.36, cr: 0.74 },
      { z: -0.24, hx: 2.11, hy: 2.55, cr: 0.87 },
      { z: -0.04, hx: 2.27, hy: 2.72, cr: 0.98 },
      { z: 0.22, hx: 2.345, hy: 2.795, cr: 1.04 },
      { z: 0.48, hx: 2.35, hy: 2.80, cr: 1.04 },
      { z: 0.68, hx: 2.31, hy: 2.76, cr: 0.99 },
      { z: 0.78, hx: 2.275, hy: 2.725, cr: 0.94 }
    ];
    this.seriesBodyMesh = new THREE.Mesh(
      buildLoftedRingGeometry(seriesProfiles, segs, false),
      this.caseMat
    );
    this.seriesBodyMesh.castShadow = false;
    this.seriesBodyMesh.receiveShadow = true;
    this.group.add(this.seriesBodyMesh);

    // 4. Ultra 2 CNC-Machined Titanium Shell with Crisp Chamfers & Raised Protective Bezel Lip
    const ultraProfiles = [
      { z: -0.34, hx: 1.95, hy: 2.39, cr: 0.74 },
      { z: -0.20, hx: 2.26, hy: 2.71, cr: 0.89 },
      { z: -0.02, hx: 2.40, hy: 2.86, cr: 0.97 },
      { z: 0.94, hx: 2.40, hy: 2.86, cr: 0.97 },
      { z: 1.12, hx: 2.29, hy: 2.74, cr: 0.90 },
      { z: 1.205, hx: 2.27, hy: 2.72, cr: 0.88 },
      { z: 1.215, hx: 2.20, hy: 2.64, cr: 0.84 },
      { z: 1.14, hx: 2.185, hy: 2.625, cr: 0.84 }
    ];
    this.ultraBodyMesh = new THREE.Mesh(
      buildLoftedRingGeometry(ultraProfiles, segs, false),
      this.caseMat
    );
    this.ultraBodyMesh.castShadow = false;
    this.ultraBodyMesh.receiveShadow = true;
    this.group.add(this.ultraBodyMesh);

    // 5. Rear Ceramic Backplate & Heart-Rate Optical Sensor Ring (visible at extreme tilt)
    this.rearBackMesh = new THREE.Mesh(
      buildRoundedRectCapGeometry(1.94, 2.38, 0.74, -0.34, -1, segs),
      this.ceramicBackMat
    );
    this.group.add(this.rearBackMesh);

    const sensorRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.86, 0.045, 12, 48),
      this.caseMat
    );
    sensorRing.position.set(0, 0, -0.35);
    this.group.add(sensorRing);

    // 6. 36-Tooth Knurled 3D Digital Crown + Stem + Orange Ring
    this.crownGroup = new THREE.Group();
    this.crownGroup.position.set(2.38, 0.78, 0.54);

    const stemMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.24, 0.24, 28),
      this.crownBodyMat
    );
    stemMesh.rotation.z = Math.PI * 0.5;
    stemMesh.position.x = -0.04;
    this.crownGroup.add(stemMesh);

    const gearGeo = buildKnurledCrownGeometry(36, 0.365, 0.338, 0.24);
    this.crownWheelMesh = new THREE.Mesh(gearGeo, this.crownBodyMat);
    this.crownWheelMesh.position.x = 0.12;
    this.crownWheelMesh.castShadow = true;
    this.crownWheelMesh.userData.hitTag = 'crown';
    this.crownGroup.add(this.crownWheelMesh);

    const crownEndCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.03, 32),
      this.bezelBlackMat
    );
    crownEndCap.rotation.z = Math.PI * 0.5;
    crownEndCap.position.x = 0.265;
    crownEndCap.userData.hitTag = 'crown';
    this.crownGroup.add(crownEndCap);

    const crownAccentRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.225, 0.022, 12, 36),
      this.crownAccentMat
    );
    crownAccentRing.rotation.y = Math.PI * 0.5;
    crownAccentRing.position.x = 0.27;
    crownAccentRing.userData.hitTag = 'crown';
    this.crownGroup.add(crownAccentRing);

    this.group.add(this.crownGroup);
    this.interactiveTargets.push(this.crownWheelMesh, crownEndCap, crownAccentRing);

    // 7. Ultra 2 Machined Titanium Crown Guard
    const guardGroup = new THREE.Group();
    const guardUpper = new THREE.Mesh(
      buildBeveledPillGeometry(0.28, 1.56, 0.68, 0.11),
      this.caseMat
    );
    guardUpper.position.set(2.42, 0.38, 0.44);
    guardUpper.castShadow = true;
    guardGroup.add(guardUpper);

    const guardSideLip = new THREE.Mesh(
      buildBeveledPillGeometry(0.18, 0.96, 0.54, 0.07),
      this.caseMat
    );
    guardSideLip.position.set(2.47, -0.68, 0.48);
    guardGroup.add(guardSideLip);
    this.crownGuardGroup = guardGroup;
    this.group.add(this.crownGuardGroup);

    // 8. Sculpted 3D Side Button
    this.sideButtonMesh = new THREE.Mesh(
      buildBeveledPillGeometry(0.16, 1.06, 0.28, 0.07),
      this.crownBodyMat
    );
    this.sideButtonMesh.position.set(2.34, -0.68, 0.50);
    this.sideButtonMesh.castShadow = true;
    this.sideButtonMesh.userData.hitTag = 'sideButton';
    this.group.add(this.sideButtonMesh);
    this.interactiveTargets.push(this.sideButtonMesh);

    // 9. Ultra 2 International Orange Action Button + Left Acoustic Speaker Grilles
    this.actionButtonGroup = new THREE.Group();
    const actionPocket = new THREE.Mesh(
      buildBeveledPillGeometry(0.12, 1.12, 0.34, 0.05),
      this.bezelBlackMat
    );
    actionPocket.position.set(-2.36, 0.12, 0.50);
    this.actionButtonGroup.add(actionPocket);

    this.actionButtonMesh = new THREE.Mesh(
      buildBeveledPillGeometry(0.16, 0.96, 0.25, 0.06),
      this.actionOrangeMat
    );
    this.actionButtonMesh.position.set(-2.41, 0.12, 0.50);
    this.actionButtonMesh.userData.hitTag = 'actionButton';
    this.actionButtonGroup.add(this.actionButtonMesh);
    this.group.add(this.actionButtonGroup);
    this.interactiveTargets.push(this.actionButtonMesh);

    // Subtle dark speaker grille slits along left flank
    this.speakerGroup = new THREE.Group();
    for (let i = 0; i < 2; i += 1) {
      const slit = new THREE.Mesh(
        buildBeveledPillGeometry(0.06, 0.44, 0.08, 0.02),
        this.bezelBlackMat
      );
      slit.position.set(-2.32, i === 0 ? -0.82 : -0.18, 0.48);
      this.speakerGroup.add(slit);
    }
    this.group.add(this.speakerGroup);

    // 10. Curved Watch Lugs + Sport Band + Ultra 2 Tubular Ocean Band
    this.bandsParent = new THREE.Group();

    const sportBandGroup = new THREE.Group();
    const topLugSlot = new THREE.Mesh(buildBeveledPillGeometry(2.38, 0.26, 0.36, 0.1), this.bezelBlackMat);
    topLugSlot.position.set(0, 2.72, 0.26);
    const botLugSlot = new THREE.Mesh(buildBeveledPillGeometry(2.38, 0.26, 0.36, 0.1), this.bezelBlackMat);
    botLugSlot.position.set(0, -2.72, 0.26);
    sportBandGroup.add(topLugSlot, botLugSlot);

    const topSport = new THREE.Mesh(buildSportBandGeometry(1), this.bandMat);
    const botSport = new THREE.Mesh(buildSportBandGeometry(-1), this.bandMat);
    topSport.castShadow = true;
    botSport.castShadow = true;
    sportBandGroup.add(topSport, botSport);
    this.sportBandGroup = sportBandGroup;
    this.bandsParent.add(this.sportBandGroup);

    // Ocean Band (ribbed tubular segments + metallic keeper)
    const oceanBandGroup = new THREE.Group();
    const topOceanCore = new THREE.Mesh(buildSportBandGeometry(1), this.bandMat);
    const botOceanCore = new THREE.Mesh(buildSportBandGeometry(-1), this.bandMat);
    oceanBandGroup.add(topOceanCore, botOceanCore);

    const ribOffsets = [2.86, 3.06, 3.26, 3.44];
    for (let i = 0; i < ribOffsets.length; i += 1) {
      const yAbs = ribOffsets[i];
      const t = i / (ribOffsets.length - 1);
      const zArc = 0.24 - Math.pow(t, 1.35) * 0.50;
      const ribW = 2.42 - t * 0.22;

      const ribGeo = new THREE.CylinderGeometry(0.115, 0.115, ribW, 18);
      ribGeo.rotateZ(Math.PI * 0.5);

      const topRib = new THREE.Mesh(ribGeo, this.bandMat);
      topRib.position.set(0, yAbs, zArc + 0.03);
      const botRib = new THREE.Mesh(ribGeo, this.bandMat);
      botRib.position.set(0, -yAbs, zArc + 0.03);
      oceanBandGroup.add(topRib, botRib);
    }
    const topKeeper = new THREE.Mesh(buildBeveledPillGeometry(2.44, 0.14, 0.40, 0.05), this.caseMat);
    topKeeper.position.set(0, 3.16, 0.05);
    const botKeeper = new THREE.Mesh(buildBeveledPillGeometry(2.44, 0.14, 0.40, 0.05), this.caseMat);
    botKeeper.position.set(0, -3.16, 0.05);
    oceanBandGroup.add(topKeeper, botKeeper);
    this.oceanBandGroup = oceanBandGroup;
    this.bandsParent.add(this.oceanBandGroup);

    this.group.add(this.bandsParent);

    // 11. 3D Glass-Plane Clock & Complications HUD Mesh + Screen Hit Target
    const hudGeo = buildRoundedRectCapGeometry(CAVITY_HX - 0.008, CAVITY_HY - 0.008, CAVITY_CR - 0.006, 1.139, 1, segs);
    this.hudMesh = new THREE.Mesh(hudGeo, this.hudMat);
    this.hudMesh.renderOrder = 25;
    this.hudMesh.userData.hitTag = 'screen';
    this.group.add(this.hudMesh);
    this.interactiveTargets.push(this.hudMesh);

    // 12. 2.5D Curved Sapphire Crystal Glass Dome (Series 10 wrap-around curved vs Ultra 2 flat chamfered)
    this.glassSeriesMesh = new THREE.Mesh(
      buildCurvedSapphireDomeGeometry(2.265, 2.715, 0.92, 1.158, 0.038, 0.21, segs),
      this.sapphireMat
    );
    this.glassSeriesMesh.renderOrder = 20;
    this.group.add(this.glassSeriesMesh);

    this.glassUltraMesh = new THREE.Mesh(
      buildCurvedSapphireDomeGeometry(2.18, 2.62, 0.84, 1.148, 0.01, 0.004, segs),
      this.sapphireMat
    );
    this.glassUltraMesh.renderOrder = 20;
    this.group.add(this.glassUltraMesh);

    // 13. Poster Contact Shadow Plane (placed outside watchPivot onto chartreuse paper)
    this.posterShadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 7.5), this.posterShadowMat);
    this.posterShadowMesh.position.set(0.18, -0.34, -1.35);
    this.posterShadowMesh.renderOrder = -1;
  };

  WatchHardware3D.prototype.setCaseVariant = function (variant) {
    this.caseVariant = variant || 'series10';
    const isUltra = this.caseVariant === 'ultra2';
    const isFrameless = this.caseVariant === 'frameless';
    const isGold = this.caseVariant === 'titaniumGold';

    this.seriesBodyMesh.visible = !isUltra && !isFrameless;
    this.seriesGlassSkirtMesh.visible = !isUltra && !isFrameless;
    this.bezelBorderMesh.visible = isUltra;
    this.ultraBodyMesh.visible = isUltra;
    this.rearBackMesh.visible = !isFrameless;
    this.crownGroup.visible = !isFrameless;
    this.sideButtonMesh.visible = !isFrameless;
    this.crownGuardGroup.visible = isUltra;
    this.actionButtonGroup.visible = isUltra;
    this.speakerGroup.visible = !isUltra && !isFrameless;
    this.bandsParent.visible = !isFrameless;
    this.sportBandGroup.visible = !isUltra;
    this.oceanBandGroup.visible = isUltra;
    this.glassSeriesMesh.visible = !isUltra && !isFrameless;
    this.glassUltraMesh.visible = isUltra && !isFrameless;

    if (isUltra) {
      // Grade-5 Brushed Natural Titanium with raw bare-metal anisotropy
      this.caseMat.color.setHex(0xcfc6b8);
      this.caseMat.metalness = 0.97;
      this.caseMat.roughness = 0.26;
      this.caseMat.clearcoat = 0.0;
      this.caseMat.anisotropy = 0.94;
      this.caseMat.anisotropyRotation = 0.0;
      this.caseMat.envMapIntensity = 2.35;
      this.caseMat.normalScale.set(0.58, 0.58);

      this.crownBodyMat.color.setHex(0xd8cfc1);
      this.crownBodyMat.metalness = 0.97;
      this.crownBodyMat.roughness = 0.24;
      this.crownBodyMat.clearcoat = 0.0;
      this.crownBodyMat.anisotropy = 0.92;
      this.crownBodyMat.envMapIntensity = 2.4;

      this.sapphireMat.iridescence = 0.20;

      this.bandMat.color.setHex(0x161b22);
      this.bandMat.roughness = 0.88;

      this.crownGroup.position.set(2.47, 0.78, 0.54);
      this.sideButtonMesh.position.set(2.44, -0.68, 0.50);
    } else if (isGold) {
      // Mirror-Lapped Warm Champagne PVD Gold Titanium
      this.caseMat.color.setHex(0xe8c47e);
      this.caseMat.metalness = 0.99;
      this.caseMat.roughness = 0.10;
      this.caseMat.clearcoat = 0.0;
      this.caseMat.anisotropy = 0.34;
      this.caseMat.anisotropyRotation = 0.35;
      this.caseMat.envMapIntensity = 2.65;
      this.caseMat.normalScale.set(0.20, 0.20);

      this.crownBodyMat.color.setHex(0xdeb872);
      this.crownBodyMat.metalness = 0.99;
      this.crownBodyMat.roughness = 0.14;
      this.crownBodyMat.clearcoat = 0.0;
      this.crownBodyMat.anisotropy = 0.88;
      this.crownBodyMat.envMapIntensity = 2.6;

      this.sapphireMat.iridescence = 0.28;

      this.bandMat.color.setHex(0x12100e);
      this.bandMat.roughness = 0.9;

      this.crownGroup.position.set(2.38, 0.78, 0.54);
      this.sideButtonMesh.position.set(2.34, -0.68, 0.50);
    } else {
      // Series 10 Jet Black Liquid PVD Aluminum (obsidian gloss with razor metallic bevel)
      this.caseMat.color.setHex(0x0b0d12);
      this.caseMat.metalness = 0.96;
      this.caseMat.roughness = 0.08;
      this.caseMat.clearcoat = 0.22;
      this.caseMat.clearcoatRoughness = 0.03;
      this.caseMat.anisotropy = 0.42;
      this.caseMat.anisotropyRotation = 0.0;
      this.caseMat.envMapIntensity = 2.30;
      this.caseMat.normalScale.set(0.18, 0.18);

      this.crownBodyMat.color.setHex(0x151820);
      this.crownBodyMat.metalness = 0.96;
      this.crownBodyMat.roughness = 0.14;
      this.crownBodyMat.clearcoat = 0.18;
      this.crownBodyMat.anisotropy = 0.88;
      this.crownBodyMat.envMapIntensity = 2.35;

      this.sapphireMat.iridescence = 0.28;

      this.bandMat.color.setHex(0x0b0c10);
      this.bandMat.roughness = 0.92;

      this.crownGroup.position.set(2.38, 0.78, 0.54);
      this.sideButtonMesh.position.set(2.34, -0.68, 0.50);
    }

    this.caseMat.needsUpdate = true;
    this.crownBodyMat.needsUpdate = true;
    this.sapphireMat.needsUpdate = true;
    this.bandMat.needsUpdate = true;
  };

  WatchHardware3D.prototype.applyHardwarePBRMaps = function (maps) {
    if (!maps) return;
    if (maps.metalNormalMap) {
      this.caseMat.normalMap = maps.metalNormalMap;
      this.crownBodyMat.normalMap = maps.metalNormalMap;
    }
    if (maps.metalRoughnessMap) {
      this.caseMat.roughnessMap = maps.metalRoughnessMap;
      this.crownBodyMat.roughnessMap = maps.metalRoughnessMap;
    }
    if (maps.metalAnisotropyMap) {
      this.caseMat.anisotropyMap = maps.metalAnisotropyMap;
      this.crownBodyMat.anisotropyMap = maps.metalAnisotropyMap;
    }
    if (maps.rubberNormalMap) {
      this.bandMat.normalMap = maps.rubberNormalMap;
    }
    this.caseMat.needsUpdate = true;
    this.crownBodyMat.needsUpdate = true;
    this.bandMat.needsUpdate = true;
  };

  WatchHardware3D.prototype.setScreenTexture = function (tex) {
    if (this.oledScreenMat.map !== tex) {
      this.oledScreenMat.map = tex;
      this.oledScreenMat.needsUpdate = true;
    }
  };

  WatchHardware3D.prototype.setCavityWallTheme = function () {};

  WatchHardware3D.prototype.updateHUD = function (state) {
    this.hudRenderer.update(state);
  };

  WatchHardware3D.prototype.spinCrown = function (deltaRad) {
    this.crownTargetAngle += deltaRad;
  };

  WatchHardware3D.prototype.updateFrame = function (rotX, rotY, gx, gy, aodMode) {
    this.crownAngle += (this.crownTargetAngle - this.crownAngle) * 0.22;
    this.crownWheelMesh.rotation.x = this.crownAngle;

    this.sapphireMat.opacity = aodMode ? 0.08 : 0.14;
    this.oledScreenMat.color.setHex(aodMode ? 0x86909c : 0xffffff);

    // Subtle dynamic poster cast shadow tracking 3D watch tilt & light direction
    this.posterShadowMesh.position.set(
      0.22 + rotY * 0.55 - gx * 0.12,
      -0.36 - rotX * 0.45 - gy * 0.1,
      -1.35
    );
    const tiltSpread = 1.0 + (Math.abs(rotX) + Math.abs(rotY)) * 0.14;
    this.posterShadowMesh.scale.set(tiltSpread, tiltSpread, 1);
  };

  WatchHardware3D.prototype.getInteractiveTargets = function () {
    return this.interactiveTargets;
  };

  ns.WatchHardware3D = WatchHardware3D;
})(window);
