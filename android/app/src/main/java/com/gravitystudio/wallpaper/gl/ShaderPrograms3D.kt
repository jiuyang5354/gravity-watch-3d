package com.gravitystudio.wallpaper.gl

import android.opengl.GLES30
import android.util.Log

/**
 * Pure OpenGL ES 3.0 GLSL shader suite implementing studio-grade PBR objects,
 * 3-bounce 5-band GIA diamond raytracing, animated cyber motherboard traces,
 * Ashikhmin-Charlie velvet drape cushions, and soft contact shadow decals.
 */
object ShaderPrograms3D {

    private const val TAG = "GravityShaders3D"

    private const val COMMON_VERTEX_SHADER = """#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNorm;
layout(location = 2) in vec2 aUv;

uniform mat4 uMvp;
uniform mat4 uModel;
uniform mat3 uNormalMat;

out vec3 vLocalPos;
out vec3 vLocalNorm;
out vec3 vWorldPos;
out vec3 vWorldNorm;
out vec2 vUv;

void main() {
    vec4 wp = uModel * vec4(aPos, 1.0);
    vLocalPos = aPos;
    vLocalNorm = aNorm;
    vWorldPos = wp.xyz;
    vWorldNorm = normalize(uNormalMat * aNorm);
    vUv = aUv;
    gl_Position = uMvp * vec4(aPos, 1.0);
}
"""

    private const val PBR_OBJECT_FRAGMENT_SHADER = """#version 300 es
precision highp float;

in vec3 vLocalPos;
in vec3 vLocalNorm;
in vec3 vWorldPos;
in vec3 vWorldNorm;
in vec2 vUv;

uniform int uObjMode;
uniform vec3 uCameraPos;
uniform vec3 uKeyLightPos;
uniform float uExposure;
uniform float uTime;
uniform sampler2D uDiffuseTex;
uniform sampler2D uNormalTex;

out vec4 fragColor;

float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash31(i);
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
    return mix(
        mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
        mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
        f.z
    );
}

vec3 sampleStudioEnv(vec3 d) {
    vec3 col = mix(vec3(0.11, 0.13, 0.17), vec3(0.40, 0.44, 0.52), smoothstep(-0.35, 0.90, d.z));
    float soft1 = pow(max(0.0, dot(d, normalize(vec3(-0.35, 0.52, 0.78)))), 14.0);
    float soft2 = pow(max(0.0, dot(d, normalize(vec3(0.62, 0.25, 0.74)))), 22.0);
    float strip = smoothstep(0.86, 0.98, abs(dot(d, normalize(vec3(0.75, -0.60, 0.26)))));
    float rim = pow(max(0.0, dot(d, normalize(vec3(0.55, -0.58, 0.60)))), 12.0);
    col += vec3(1.45, 1.48, 1.54) * soft1;
    col += vec3(1.05, 1.18, 1.38) * soft2;
    col += vec3(1.15, 1.22, 1.35) * strip * 0.55;
    col += vec3(1.10, 1.04, 0.92) * rim * 0.65;
    return col;
}

vec3 acesTonemap(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
    vec3 N = normalize(vWorldNorm);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 dL = normalize(vLocalPos);

    vec3 texAlb = pow(texture(uDiffuseTex, vUv).rgb, vec3(2.2));
    vec3 texNor = texture(uNormalTex, vUv * 2.0).xyz * 2.0 - 1.0;

    // Subtle tangent micro-normal perturbation
    vec3 upHint = abs(N.z) < 0.92 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 T = normalize(cross(upHint, N));
    vec3 B = cross(N, T);
    vec3 Np = normalize(N + (T * texNor.x + B * texNor.y) * 0.16);

    vec3 albedo = texAlb;
    float roughness = 0.55;
    float metalness = 0.0;
    vec3 emissive = vec3(0.0);
    float clearCoat = 0.0;

    if (uObjMode == 0) {
        // 01 Tennis: clean US Open optic yellow felt + crisp white vulcanized rubber seam + microfiber halo
        float ang = atan(dL.y, dL.x);
        float zCurve = 0.44 * sin(2.0 * atan(dL.y, dL.x));
        // Classic sinusoidal tennis seam approximation
        float seamWave = 0.36 * (cos(ang) * dL.x - sin(ang) * dL.y);
        float c2 = (dL.z * dL.z + (dL.x * dL.x - dL.y * dL.y) * 0.25);
        float seamDist = abs(dL.z - 0.54 * (dL.x * dL.x - dL.y * dL.y));
        float seamMask = 1.0 - smoothstep(0.036, 0.056, seamDist);
        float fuzz = noise3(dL * 48.0) * 0.10 - 0.05;
        vec3 feltCol = vec3(0.76, 0.93, 0.07) * (0.94 + fuzz);
        vec3 rubberCol = vec3(0.92, 0.91, 0.87);
        albedo = mix(feltCol, rubberCol, seamMask);
        roughness = mix(0.92, 0.48, seamMask);
        float halo = pow(1.0 - clamp(dot(Np, V), 0.0, 1.0), 2.5) * (1.0 - seamMask);
        emissive = vec3(0.55, 0.68, 0.06) * halo * 0.36;
    } else if (uObjMode == 2) {
        // 03 Basketball: saturated Wilson orange pebbled leather + dark sunken channels
        float dEq = abs(dL.y);
        float dMer = abs(dL.z);
        float sideArg = abs(abs(dL.x) - (0.58 - 0.25 * dL.y * dL.y));
        float dSide = abs(dL.y) < 0.9 ? sideArg : 99.0;
        float channelDist = min(dEq, min(dMer, dSide));
        float isChannel = 1.0 - smoothstep(0.025, 0.044, channelDist);
        float pebble = noise3(dL * 78.0);
        vec3 leatherCol = vec3(0.68, 0.21, 0.035) * (0.88 + 0.22 * pebble);
        albedo = mix(leatherCol, vec3(0.02, 0.02, 0.024), isChannel);
        roughness = mix(0.46, 0.72, isChannel);
        clearCoat = (1.0 - isChannel) * 0.28;
    } else if (uObjMode == 3) {
        // 04 Gold Bar: pristine 24K Swiss bullion physical Au reflectance + subtle stamped plateau
        albedo = vec3(1.00, 0.805, 0.285);
        metalness = 0.985;
        roughness = mix(0.22, 0.14, abs(vLocalNorm.z));
        // Subtle debossed border on top stamped plateau
        if (vLocalNorm.z > 0.85) {
            vec2 edgeDist = abs(vUv - 0.5);
            float stampBorder = smoothstep(0.32, 0.34, max(edgeDist.x, edgeDist.y))
                * (1.0 - smoothstep(0.36, 0.38, max(edgeDist.x, edgeDist.y)));
            roughness = mix(roughness, 0.34, stampBorder);
        }
    } else if (uObjMode == 4) {
        // 05 Soccer: clean 32-panel truncated icosahedron pearlescent white & jet black match ball
        vec3 ico0 = normalize(vec3(0.0, 1.0, 1.618034));
        vec3 ico1 = normalize(vec3(0.0, -1.0, 1.618034));
        vec3 ico2 = normalize(vec3(0.0, 1.0, -1.618034));
        vec3 ico3 = normalize(vec3(0.0, -1.0, -1.618034));
        vec3 ico4 = normalize(vec3(1.0, 1.618034, 0.0));
        vec3 ico5 = normalize(vec3(-1.0, 1.618034, 0.0));
        vec3 ico6 = normalize(vec3(1.0, -1.618034, 0.0));
        vec3 ico7 = normalize(vec3(-1.0, -1.618034, 0.0));
        vec3 ico8 = normalize(vec3(1.618034, 0.0, 1.0));
        vec3 ico9 = normalize(vec3(-1.618034, 0.0, 1.0));
        vec3 ico10 = normalize(vec3(1.618034, 0.0, -1.0));
        vec3 ico11 = normalize(vec3(-1.618034, 0.0, -1.0));

        float maxV = max(max(max(dot(dL, ico0), dot(dL, ico1)), max(dot(dL, ico2), dot(dL, ico3))),
                         max(max(dot(dL, ico4), dot(dL, ico5)), max(dot(dL, ico6), dot(dL, ico7))));
        maxV = max(maxV, max(max(dot(dL, ico8), dot(dL, ico9)), max(dot(dL, ico10), dot(dL, ico11))));

        // Pentagon panels sit near the 12 icosahedron vertices (cos threshold ~0.855)
        float isBlack = smoothstep(0.848, 0.864, maxV);
        float stitchEdge = smoothstep(0.835, 0.850, maxV) * (1.0 - smoothstep(0.856, 0.872, maxV));
        albedo = mix(vec3(0.91, 0.90, 0.88), vec3(0.025, 0.028, 0.036), isBlack);
        albedo *= (1.0 - stitchEdge * 0.42);
        roughness = mix(0.28, 0.38, isBlack);
        clearCoat = 0.42;
    } else {
        // 06 Cyber Circuit: translucent smoked-sapphire silicon core chip with glowing neon edge trim
        albedo = vec3(0.05, 0.09, 0.16);
        metalness = 0.45;
        roughness = 0.16;
        clearCoat = 0.85;
        float ndv = clamp(dot(Np, V), 0.0, 1.0);
        float edgePulse = 0.72 + 0.28 * sin(uTime * 1.570796);
        vec2 cUv = abs(vUv - 0.5);
        float borderGlow = smoothstep(0.30, 0.44, max(cUv.x, cUv.y));
        float coreRing = 1.0 - smoothstep(0.16, 0.23, length(vUv - 0.5));
        float fresnel = pow(1.0 - ndv, 3.0);
        emissive = vec3(0.18, 0.86, 1.0) * (fresnel * 0.68 + coreRing * 0.52) * edgePulse
                 + vec3(1.0, 0.76, 0.28) * borderGlow * 0.22;
    }

    vec3 F0 = mix(vec3(0.04), albedo, metalness);
    vec3 R = reflect(-V, Np);
    vec3 envCol = sampleStudioEnv(R);

    vec3 L1 = normalize(uKeyLightPos - vWorldPos);
    vec3 H1 = normalize(V + L1);
    float ndl1 = max(0.0, dot(Np, L1));
    float ndh1 = max(0.0, dot(Np, H1));
    float specExp1 = mix(220.0, 12.0, roughness * roughness);
    float spec1 = pow(ndh1, specExp1) * mix(1.4, 0.25, roughness);

    vec3 L2 = normalize(vec3(3.6, -2.6, 4.4) - vWorldPos);
    float ndl2 = max(0.0, dot(Np, L2));

    vec3 Lrim = normalize(vec3(4.5, -3.8, 1.8));
    float rim = pow(1.0 - clamp(dot(Np, V), 0.0, 1.0), 3.4) * max(0.2, dot(Np, Lrim));

    float ndv = clamp(dot(Np, V), 0.0, 1.0);
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - ndv, 5.0);

    vec3 diffusePart = albedo * (1.0 - metalness) * (0.28 + 1.05 * ndl1 + 0.34 * ndl2);
    vec3 specularPart = envCol * F * mix(1.10, 0.35, roughness) + mix(vec3(1.0), albedo, metalness) * spec1 * ndl1;
    if (clearCoat > 0.01) {
        float ccSpec = pow(ndh1, 140.0) * clearCoat * 0.65;
        specularPart += sampleStudioEnv(R) * (0.04 + 0.96 * pow(1.0 - ndv, 5.0)) * clearCoat * 0.45 + vec3(ccSpec);
    }

    vec3 color = (diffusePart + specularPart + vec3(0.85, 0.92, 1.0) * rim * 0.16 + emissive) * uExposure;
    fragColor = vec4(acesTonemap(color), 1.0);
}
"""

    private const val DIAMOND_FRAGMENT_SHADER = """#version 300 es
precision highp float;

in vec3 vLocalPos;
in vec3 vLocalNorm;
in vec3 vWorldPos;
in vec3 vWorldNorm;

uniform mat4 uModel;
uniform mat3 uNormalMat;
uniform float uInvRadius;
uniform float uExposure;
uniform vec3 uCameraPos;
uniform sampler2D uFloorTex;

out vec4 fragColor;

void testPlane(vec3 p, vec3 d, vec3 n, float dist, inout float bestT, inout vec3 bestN) {
    float denom = dot(n, d);
    if (denom > 0.0001) {
        float t = (dist - dot(n, p)) / denom;
        if (t > 0.001 && t < bestT) {
            bestT = t;
            bestN = n;
        }
    }
}

void intersectHull(vec3 p, vec3 d, out float hitT, out vec3 hitN) {
    hitT = 100.0;
    hitN = vec3(0.0, 0.0, 1.0);
    testPlane(p, d, vec3(0.0, 0.0, 1.0), 0.50, hitT, hitN);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.78539816;
        float ca = cos(a);
        float sa = sin(a);
        float aMid = a + 0.39269908;
        float cm = cos(aMid);
        float sm = sin(aMid);
        testPlane(p, d, normalize(vec3(ca * 0.566, sa * 0.566, 0.824)), 0.675, hitT, hitN);
        testPlane(p, d, normalize(vec3(cm * 0.660, sm * 0.660, 0.751)), 0.735, hitT, hitN);
        testPlane(p, d, vec3(ca, sa, 0.0), 1.00, hitT, hitN);
        testPlane(p, d, normalize(vec3(ca * 0.653, sa * 0.653, -0.757)), 0.575, hitT, hitN);
        testPlane(p, d, normalize(vec3(cm * 0.680, sm * 0.680, -0.733)), 0.595, hitT, hitN);
    }
}

vec3 sampleStudio(vec3 dirW) {
    vec3 d = normalize(dirW);
    vec3 col = vec3(0.045, 0.050, 0.062) + vec3(0.042, 0.048, 0.058) * smoothstep(0.0, 0.95, d.z);
    float soft1 = pow(max(0.0, dot(d, normalize(vec3(-0.35, 0.52, 0.78)))), 18.0);
    float soft2 = pow(max(0.0, dot(d, normalize(vec3(0.58, 0.24, 0.78)))), 26.0);
    float rimBar = smoothstep(0.91, 0.99, abs(dot(d, normalize(vec3(0.76, -0.62, 0.18)))));
    float pin1 = pow(max(0.0, dot(d, normalize(vec3(-0.22, 0.64, 0.736)))), 220.0);
    float pin2 = pow(max(0.0, dot(d, normalize(vec3(0.56, -0.34, 0.755)))), 260.0);
    col += vec3(1.50, 1.56, 1.66) * soft1;
    col += vec3(1.18, 1.32, 1.52) * soft2;
    col += vec3(1.30, 1.40, 1.54) * rimBar;
    col += vec3(2.40, 2.52, 2.75) * pin1;
    col += vec3(2.05, 2.22, 2.48) * pin2;
    return col;
}

vec3 sampleExit(vec3 exitWorldPos, vec3 rayW) {
    if (rayW.z < -0.05) {
        float tFloor = max(0.0, -exitWorldPos.z) / (-rayW.z);
        vec2 hitXY = exitWorldPos.xy + rayW.xy * tFloor;
        vec2 uv = vec2(hitXY.x / 6.0 + 0.5, 0.5 - hitXY.y / 10.6);
        if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
            vec3 rawFloor = texture(uFloorTex, uv).rgb;
            return mix(sampleStudio(rayW) * 0.35, rawFloor * 1.15, 0.65);
        }
    }
    return sampleStudio(rayW);
}

vec3 sampleDispersedExit(vec3 exitWorldPos, vec3 dOutW, vec3 dispVecW) {
    vec3 dFan = clamp(dispVecW, vec3(-0.095), vec3(0.095));
    vec3 cR = sampleExit(exitWorldPos, normalize(dOutW - dFan * 1.00));
    vec3 cY = sampleExit(exitWorldPos, normalize(dOutW - dFan * 0.48));
    vec3 cG = sampleExit(exitWorldPos, dOutW);
    vec3 cC = sampleExit(exitWorldPos, normalize(dOutW + dFan * 0.48));
    vec3 cB = sampleExit(exitWorldPos, normalize(dOutW + dFan * 1.05));
    float r = cR.r * 0.55 + cY.r * 0.35 + cG.r * 0.10;
    float g = cY.g * 0.20 + cG.g * 0.60 + cC.g * 0.20;
    float b = cG.b * 0.10 + cC.b * 0.35 + cB.b * 0.55;
    return vec3(r, g, b);
}

void main() {
    vec3 worldNormal = normalize(vWorldNorm);
    vec3 V_w = normalize(vWorldPos - uCameraPos);
    if (dot(-V_w, worldNormal) < 0.0) worldNormal = -worldNormal;

    mat3 invRot = transpose(uNormalMat);
    vec3 localNormal = normalize(invRot * normalize(vWorldNorm));
    vec3 V_l = normalize(invRot * V_w);
    vec3 startP = vLocalPos * uInvRadius;

    float iorG = 2.420;
    float iorB = 2.475;
    vec3 dIn = refract(V_l, localNormal, 1.0 / iorG);
    if (length(dIn) < 0.001) dIn = reflect(V_l, localNormal);
    dIn = normalize(dIn);
    vec3 dInB = refract(V_l, localNormal, 1.0 / iorB);
    vec3 dispL = dot(dInB, dInB) > 0.001 ? (normalize(dInB) - dIn) : vec3(0.0);

    vec3 p = startP * 0.985;
    vec3 internalCol = vec3(0.0);
    float weight = 1.0;

    for (int bounce = 0; bounce < 3; bounce++) {
        float tHit;
        vec3 nHit;
        intersectHull(p, dIn, tHit, nHit);
        p += dIn * tHit;
        weight *= exp(-0.04 * tHit);

        vec3 inwardN = -normalize(nHit);
        float cosI = clamp(dot(-dIn, inwardN), 0.0, 1.0);
        float sin2T = iorG * iorG * (1.0 - cosI * cosI);

        if (sin2T >= 0.998 || bounce == 2) {
            if (sin2T < 0.998) {
                vec3 dOutL = normalize(refract(dIn, inwardN, iorG));
                vec3 rOutB = refract(dIn, inwardN, iorB);
                vec3 exitDispL = dot(rOutB, rOutB) > 0.001
                    ? (normalize(rOutB) - dOutL)
                    : (normalize(reflect(dIn, inwardN)) - dOutL) * 0.22;
                internalCol += weight * sampleDispersedExit(vWorldPos, normalize(uNormalMat * dOutL), uNormalMat * (dispL * 1.45 + exitDispL * 1.35));
                break;
            }
            dIn = normalize(reflect(dIn, inwardN));
            dispL = reflect(dispL, inwardN);
            p += inwardN * 0.004;
            if (bounce == 2) {
                internalCol += weight * sampleDispersedExit(vWorldPos, normalize(uNormalMat * dIn), uNormalMat * (dispL * 1.65));
            }
        } else {
            float fOut = 0.17 + 0.83 * pow(1.0 - cosI, 4.0);
            vec3 dOutL = normalize(refract(dIn, inwardN, iorG));
            vec3 rOutB = refract(dIn, inwardN, iorB);
            vec3 exitDispL = dot(rOutB, rOutB) > 0.001 ? (normalize(rOutB) - dOutL) : vec3(0.0);
            internalCol += weight * (1.0 - fOut) * sampleDispersedExit(vWorldPos, normalize(uNormalMat * dOutL), uNormalMat * (dispL * 1.45 + exitDispL * 1.35));
            weight *= fOut * 1.15;
            dIn = normalize(reflect(dIn, inwardN));
            dispL = reflect(dispL, inwardN);
            p += inwardN * 0.004;
        }
    }

    float ndotv = clamp(dot(-V_w, worldNormal), 0.0, 1.0);
    float F_front = 0.17 + 0.83 * pow(1.0 - ndotv, 5.0);
    vec3 extSpec = sampleStudio(reflect(V_w, worldNormal));
    vec3 H_pin = normalize(-V_w + normalize(vec3(-0.56, 0.58, 0.59)));
    float pinFlash = pow(max(0.0, dot(worldNormal, H_pin)), 360.0) * 0.60;

    vec3 hdrColor = (internalCol * (1.0 - F_front * 0.88) + extSpec * F_front + vec3(1.15, 1.25, 1.40) * pinFlash) * uExposure;
    hdrColor = hdrColor / (1.0 + max(vec3(0.0), hdrColor - 2.6) * 0.34);
    vec3 mapped = (hdrColor * (2.51 * hdrColor + 0.03)) / (hdrColor * (2.43 * hdrColor + 0.59) + 0.14);
    fragColor = vec4(clamp(mapped, 0.0, 1.0), 1.0);
}
"""

    private const val FLOOR_FRAGMENT_SHADER = """#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec2 vUv;

uniform int uFloorMode;
uniform vec3 uCameraPos;
uniform vec3 uKeyLightPos;
uniform float uExposure;
uniform float uTime;
uniform vec3 uVelvetCore;
uniform vec3 uVelvetMid;
uniform vec3 uVelvetSheen;
uniform vec3 uVelvetRim;
uniform sampler2D uDiffuseTex;
uniform sampler2D uNormalTex;
uniform sampler2D uGlowMaskTex;

out vec4 fragColor;

vec3 acesTonemap(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 L = normalize(uKeyLightPos - vWorldPos);
    vec3 texDiff = pow(texture(uDiffuseTex, vUv).rgb, vec3(2.2));
    vec3 texNor = texture(uNormalTex, vUv * 2.5).xyz * 2.0 - 1.0;
    vec3 N = normalize(vec3(texNor.x * 0.45, texNor.y * 0.45, 1.0));
    float ndl = max(0.0, dot(N, L));

    vec3 hdrColor = vec3(0.0);

    if (uFloorMode == 1) {
        // Ashikhmin-Charlie velvet cushion with soft drape folds
        float warp = 0.09 * sin(vUv.x * 4.2 - vUv.y * 3.1 + 0.55);
        float ph1 = (vUv.x * 1.15 - vUv.y * 0.90 + warp) * 6.28318 * 1.15;
        float ph2 = (vUv.x * 0.70 + vUv.y * 0.95) * 6.28318 * 0.85;
        float h = clamp(0.62 * pow(0.05 + 0.95 * abs(sin(ph1)), 0.55) + 0.32 * pow(0.05 + 0.95 * abs(sin(ph2)), 0.6), 0.0, 1.0);
        float foldAO = 0.22 + 0.78 * h;
        vec3 bodyCol = mix(uVelvetCore, uVelvetMid, foldAO) + texDiff * 0.12;
        vec3 H = normalize(V + L);
        float ndh = clamp(dot(N, H), 0.0, 0.999);
        float cot2 = (ndh * ndh) / max(0.0001, 1.0 - ndh * ndh);
        float ash = exp(-cot2 / (0.35 * 0.35)) * pow(1.0 - ndh, 0.65);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float charlie = pow(1.0 - ndv, 3.2) * 0.65;
        hdrColor = bodyCol * (0.22 + 0.92 * ndl) + uVelvetSheen * (ash * 0.68 + charlie * 0.55) * foldAO + uVelvetRim * ash * 0.25;
    } else if (uFloorMode == 5) {
        // Cyber Circuit Motherboard with flowing luminous pulse waves along cyan & amber PCB buses
        vec3 glowS = texture(uGlowMaskTex, vUv).rgb;
        float pulseWave = 0.55 + 0.45 * sin(vUv.y * 16.0 - uTime * 3.2 + abs(vUv.x - 0.5) * 8.0);
        float breath = 0.70 + 0.30 * sin(uTime * 1.570796);
        vec3 specRef = vec3(pow(max(0.0, dot(N, normalize(V + L))), 64.0) * 0.14);
        vec3 cyanTrace = vec3(0.18, 0.88, 1.00) * glowS.r * (0.55 + 0.85 * pulseWave) * breath;
        vec3 amberTrace = vec3(1.00, 0.76, 0.26) * glowS.g * (0.50 + 0.65 * (1.0 - pulseWave)) * breath;
        vec3 coilAura = vec3(0.26, 0.58, 1.00) * glowS.b * 0.65 * breath;
        hdrColor = texDiff * (0.45 + 0.80 * ndl) + specRef + cyanTrace + amberTrace + coilAura;
    } else if (uFloorMode == 3) {
        // Nero Marquina Obsidian Vault (desaturated dark stone, delicate calcite vein + soft sheen)
        float lum = dot(texDiff, vec3(0.299, 0.587, 0.114));
        vec3 marq = mix(vec3(lum), texDiff, 0.16) * 0.52;
        float veinHi = smoothstep(0.32, 0.62, lum) * 0.18;
        float spec = pow(max(0.0, dot(N, normalize(V + L))), 42.0) * 0.12;
        hdrColor = (marq + vec3(veinHi)) * (0.36 + 0.85 * ndl) + vec3(spec);
    } else {
        // Clean studio EPDM tennis / maple court / manicured soccer grass
        float specPow = uFloorMode == 2 ? 48.0 : 18.0;
        float specAmp = uFloorMode == 2 ? 0.16 : 0.04;
        float spec = pow(max(0.0, dot(N, normalize(V + L))), specPow) * specAmp;
        vec3 baseCol = texDiff;
        if (uFloorMode == 4) {
            float stripe = step(0.5, fract(vUv.y * 6.0));
            baseCol *= mix(0.86, 1.10, stripe);
        }
        hdrColor = baseCol * (0.42 + 0.82 * ndl) + vec3(spec);
    }

    vec2 centered = (vUv - 0.5) * vec2(1.15, 1.0);
    float vignette = clamp(1.04 - dot(centered, centered) * 0.45, 0.25, 1.0);
    fragColor = vec4(acesTonemap(hdrColor * vignette * uExposure), 1.0);
}
"""

    private const val DECAL_FRAGMENT_SHADER = """#version 300 es
precision highp float;

in vec2 vUv;

uniform int uIsCaustic;
uniform float uAlpha;
uniform float uAspect;

out vec4 fragColor;

void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= uAspect;
    float d = length(p);
    if (d > 1.0) discard;

    if (uIsCaustic == 1) {
        float ring = exp(-pow((d - 0.48) * 3.5, 2.0));
        float core = exp(-d * d * 4.5);
        vec3 col = vec3(0.45, 0.85, 1.0) * (ring * 0.65 + core * 0.35);
        fragColor = vec4(col, (ring + core * 0.5) * uAlpha);
    } else {
        float falloff = pow(1.0 - d, 2.1);
        fragColor = vec4(0.0, 0.0, 0.0, falloff * uAlpha);
    }
}
"""

    class ProgramHandle(val id: Int) {
        val uMvp = GLES30.glGetUniformLocation(id, "uMvp")
        val uModel = GLES30.glGetUniformLocation(id, "uModel")
        val uNormalMat = GLES30.glGetUniformLocation(id, "uNormalMat")
        val uCameraPos = GLES30.glGetUniformLocation(id, "uCameraPos")
        val uKeyLightPos = GLES30.glGetUniformLocation(id, "uKeyLightPos")
        val uExposure = GLES30.glGetUniformLocation(id, "uExposure")
        val uTime = GLES30.glGetUniformLocation(id, "uTime")
        val uDiffuseTex = GLES30.glGetUniformLocation(id, "uDiffuseTex")
        val uNormalTex = GLES30.glGetUniformLocation(id, "uNormalTex")
        val uObjMode = GLES30.glGetUniformLocation(id, "uObjMode")
        val uInvRadius = GLES30.glGetUniformLocation(id, "uInvRadius")
        val uFloorTex = GLES30.glGetUniformLocation(id, "uFloorTex")
        val uFloorMode = GLES30.glGetUniformLocation(id, "uFloorMode")
        val uGlowMaskTex = GLES30.glGetUniformLocation(id, "uGlowMaskTex")
        val uVelvetCore = GLES30.glGetUniformLocation(id, "uVelvetCore")
        val uVelvetMid = GLES30.glGetUniformLocation(id, "uVelvetMid")
        val uVelvetSheen = GLES30.glGetUniformLocation(id, "uVelvetSheen")
        val uVelvetRim = GLES30.glGetUniformLocation(id, "uVelvetRim")
        val uIsCaustic = GLES30.glGetUniformLocation(id, "uIsCaustic")
        val uAlpha = GLES30.glGetUniformLocation(id, "uAlpha")
        val uAspect = GLES30.glGetUniformLocation(id, "uAspect")
    }

    fun buildPbrObjectProgram(): ProgramHandle =
        ProgramHandle(compileAndLink(COMMON_VERTEX_SHADER, PBR_OBJECT_FRAGMENT_SHADER, "PbrObject"))

    fun buildDiamondProgram(): ProgramHandle =
        ProgramHandle(compileAndLink(COMMON_VERTEX_SHADER, DIAMOND_FRAGMENT_SHADER, "DiamondRaytrace"))

    fun buildFloorProgram(): ProgramHandle =
        ProgramHandle(compileAndLink(COMMON_VERTEX_SHADER, FLOOR_FRAGMENT_SHADER, "StudioFloor"))

    fun buildDecalProgram(): ProgramHandle =
        ProgramHandle(compileAndLink(COMMON_VERTEX_SHADER, DECAL_FRAGMENT_SHADER, "ShadowDecal"))

    private fun compileAndLink(vertSrc: String, fragSrc: String, label: String): Int {
        val vs = compileShader(GLES30.GL_VERTEX_SHADER, vertSrc, "${label}VS")
        val fs = compileShader(GLES30.GL_FRAGMENT_SHADER, fragSrc, "${label}FS")
        val prog = GLES30.glCreateProgram()
        GLES30.glAttachShader(prog, vs)
        GLES30.glAttachShader(prog, fs)
        GLES30.glLinkProgram(prog)
        val status = IntArray(1)
        GLES30.glGetProgramiv(prog, GLES30.GL_LINK_STATUS, status, 0)
        if (status[0] == 0) {
            val log = GLES30.glGetProgramInfoLog(prog)
            GLES30.glDeleteProgram(prog)
            Log.e(TAG, "Program link error [$label]: $log")
            throw IllegalStateException("Program link error [$label]: $log")
        }
        GLES30.glDeleteShader(vs)
        GLES30.glDeleteShader(fs)
        return prog
    }

    private fun compileShader(type: Int, src: String, label: String): Int {
        val shader = GLES30.glCreateShader(type)
        GLES30.glShaderSource(shader, src)
        GLES30.glCompileShader(shader)
        val status = IntArray(1)
        GLES30.glGetShaderiv(shader, GLES30.GL_COMPILE_STATUS, status, 0)
        if (status[0] == 0) {
            val log = GLES30.glGetShaderInfoLog(shader)
            GLES30.glDeleteShader(shader)
            Log.e(TAG, "Shader compile error [$label]: $log")
            throw IllegalStateException("Shader compile error [$label]: $log")
        }
        return shader
    }
}
