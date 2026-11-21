import CoreGraphics
import Foundation
import SceneKit

enum DiamondShader3D {
    private static let surfaceModifier: String = """
    #pragma body
    float3 _ensureNormalVarying = _surface.normal;
    float3 _ensurePosVarying = _surface.position;
    _surface.normal = _ensureNormalVarying;
    _surface.position = _ensurePosVarying;
    """

    private static let diamondFragmentModifier: String = """
    #pragma arguments
    float u_invRadius;
    float u_exposure;
    texture2d<float> u_floorTex;

    static inline void diaTestPlane(
        float3 p,
        float3 d,
        float3 n,
        float dist,
        thread float& bestT,
        thread float3& bestN
    ) {
        float denom = dot(n, d);
        if (denom > 0.0001f) {
            float t = (dist - dot(n, p)) / denom;
            if (t > 0.001f && t < bestT) {
                bestT = t;
                bestN = n;
            }
        }
    }

    static inline void diaIntersectHull(
        float3 p,
        float3 d,
        thread float& hitT,
        thread float3& hitN
    ) {
        hitT = 100.0f;
        hitN = float3(0.0f, 0.0f, 1.0f);
        diaTestPlane(p, d, float3(0.0f, 0.0f, 1.0f), 0.50f, hitT, hitN);

        for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.78539816f;
            float ca = cos(a);
            float sa = sin(a);
            float aMid = a + 0.39269908f;
            float cm = cos(aMid);
            float sm = sin(aMid);

            diaTestPlane(p, d, normalize(float3(ca * 0.566f, sa * 0.566f, 0.824f)), 0.675f, hitT, hitN);
            diaTestPlane(p, d, normalize(float3(cm * 0.660f, sm * 0.660f, 0.751f)), 0.735f, hitT, hitN);
            diaTestPlane(p, d, float3(ca, sa, 0.0f), 1.00f, hitT, hitN);
            diaTestPlane(p, d, normalize(float3(ca * 0.653f, sa * 0.653f, -0.757f)), 0.575f, hitT, hitN);
            diaTestPlane(p, d, normalize(float3(cm * 0.680f, sm * 0.680f, -0.733f)), 0.595f, hitT, hitN);
        }
    }

    static inline float3 diaSampleStudio(float3 dirW) {
        float3 d = normalize(dirW);
        // VVS1 D-color jewelry studio contrast: clean crystalline graphite shadows + crisp softboxes
        float3 col = float3(0.045f, 0.050f, 0.060f)
            + float3(0.040f, 0.046f, 0.056f) * smoothstep(0.0f, 0.95f, d.z);

        float soft1 = pow(max(0.0f, dot(d, normalize(float3(-0.35f, 0.52f, 0.78f)))), 18.0f);
        float soft2 = pow(max(0.0f, dot(d, normalize(float3(0.58f, 0.24f, 0.78f)))), 26.0f);
        float rimBar = smoothstep(0.91f, 0.99f, abs(dot(d, normalize(float3(0.76f, -0.62f, 0.18f)))));
        float pin1 = pow(max(0.0f, dot(d, normalize(float3(-0.22f, 0.64f, 0.736f)))), 220.0f);
        float pin2 = pow(max(0.0f, dot(d, normalize(float3(0.56f, -0.34f, 0.755f)))), 260.0f);
        float pin3 = pow(max(0.0f, dot(d, normalize(float3(-0.56f, -0.38f, 0.736f)))), 280.0f);

        col += float3(1.50f, 1.56f, 1.66f) * soft1;
        col += float3(1.18f, 1.32f, 1.52f) * soft2;
        col += float3(1.30f, 1.40f, 1.54f) * rimBar;
        col += float3(2.40f, 2.52f, 2.75f) * pin1;
        col += float3(2.05f, 2.22f, 2.48f) * pin2;
        col += float3(1.85f, 1.98f, 2.22f) * pin3;
        return col;
    }

    static inline float3 diaSampleExit(
        float3 exitWorldPos,
        float3 rayW,
        texture2d<float> floorTex
    ) {
        if (rayW.z < -0.05f) {
            float tFloor = max(0.0f, -exitWorldPos.z) / (-rayW.z);
            float2 hitXY = exitWorldPos.xy + rayW.xy * tFloor;
            float2 uv = float2(hitXY.x / 6.00f + 0.5f, 0.5f - hitXY.y / 7.32f);
            if (uv.x >= 0.0f && uv.x <= 1.0f && uv.y >= 0.0f && uv.y <= 1.0f) {
                constexpr sampler floorSamp(coord::normalized, filter::linear, address::clamp_to_edge);
                float3 rawFloor = floorTex.sample(floorSamp, uv).rgb;
                float rimSpark = pow(clamp(1.0f + rayW.z, 0.0f, 1.0f), 2.8f) * 0.14f;
                return mix(diaSampleStudio(rayW) * 0.35f, rawFloor * 1.10f, 0.72f)
                    + float3(0.75f, 0.88f, 1.00f) * rimSpark;
            }
        }
        return diaSampleStudio(rayW);
    }

    static inline float3 diaSampleDispersedExit(
        float3 exitWorldPos,
        float3 dOutW,
        float3 dispVecW,
        texture2d<float> floorTex
    ) {
        // White-preserving 5-band spectral sampling (zero green/magenta color cast)
        float3 dFan = clamp(dispVecW, float3(-0.095f), float3(0.095f));
        float3 exitR = normalize(dOutW - dFan * 1.00f);
        float3 exitY = normalize(dOutW - dFan * 0.48f);
        float3 exitC = normalize(dOutW + dFan * 0.48f);
        float3 exitB = normalize(dOutW + dFan * 1.05f);

        float3 cR = diaSampleExit(exitWorldPos, exitR, floorTex);
        float3 cY = diaSampleExit(exitWorldPos, exitY, floorTex);
        float3 cG = diaSampleExit(exitWorldPos, dOutW, floorTex);
        float3 cC = diaSampleExit(exitWorldPos, exitC, floorTex);
        float3 cB = diaSampleExit(exitWorldPos, exitB, floorTex);

        float r = cR.r * 0.55f + cY.r * 0.35f + cG.r * 0.10f;
        float g = cY.g * 0.20f + cG.g * 0.60f + cC.g * 0.20f;
        float b = cG.b * 0.10f + cC.b * 0.35f + cB.b * 0.55f;
        return float3(r, g, b);
    }

    static inline float3 diaTracePrimary(
        float3 startP,
        float3 startDirL,
        float3 localNormal,
        float3 worldPos,
        float3x3 rotMat,
        texture2d<float> floorTex
    ) {
        const float iorG = 2.420f;
        const float iorB = 2.475f;
        float3 nL = normalize(localNormal);
        float3 dIn = refract(startDirL, nL, 1.0f / iorG);
        if (length(dIn) < 0.001f) {
            dIn = reflect(startDirL, nL);
        }
        dIn = normalize(dIn);
        float3 dInB = refract(startDirL, nL, 1.0f / iorB);
        float3 dispL = dot(dInB, dInB) > 0.001f ? (normalize(dInB) - dIn) : float3(0.0f);

        float3 p = startP * 0.985f;
        float3 accum = float3(0.0f);
        float weight = 1.0f;

        for (int bounce = 0; bounce < 3; bounce++) {
            float tHit;
            float3 nHit;
            diaIntersectHull(p, dIn, tHit, nHit);
            p += dIn * tHit;
            weight *= exp(-0.04f * tHit);

            float3 inwardN = -normalize(nHit);
            float cosI = clamp(dot(-dIn, inwardN), 0.0f, 1.0f);
            float sin2T = iorG * iorG * (1.0f - cosI * cosI);

            if (sin2T >= 0.998f || bounce == 2) {
                if (sin2T < 0.998f) {
                    float3 dOutL = normalize(refract(dIn, inwardN, iorG));
                    float3 rOutB = refract(dIn, inwardN, iorB);
                    float3 exitDispL = dot(rOutB, rOutB) > 0.001f
                        ? (normalize(rOutB) - dOutL)
                        : (normalize(reflect(dIn, inwardN)) - dOutL) * 0.22f;
                    float3 dOutW = normalize(rotMat * dOutL);
                    float3 dVecW = rotMat * (dispL * 1.45f + exitDispL * 1.35f);
                    accum += weight * diaSampleDispersedExit(worldPos, dOutW, dVecW, floorTex);
                    break;
                }
                dIn = normalize(reflect(dIn, inwardN));
                dispL = reflect(dispL, inwardN);
                p += inwardN * 0.004f;
                if (bounce == 2) {
                    float3 finalW = normalize(rotMat * dIn);
                    accum += weight * diaSampleDispersedExit(worldPos, finalW, rotMat * (dispL * 1.65f), floorTex);
                }
            } else {
                float fOut = 0.17f + 0.83f * pow(1.0f - cosI, 4.0f);
                float3 dOutL = normalize(refract(dIn, inwardN, iorG));
                float3 rOutB = refract(dIn, inwardN, iorB);
                float3 exitDispL = dot(rOutB, rOutB) > 0.001f ? (normalize(rOutB) - dOutL) : float3(0.0f);
                float3 dOutW = normalize(rotMat * dOutL);
                float3 dVecW = rotMat * (dispL * 1.45f + exitDispL * 1.35f);
                accum += weight * (1.0f - fOut) * diaSampleDispersedExit(worldPos, dOutW, dVecW, floorTex);
                weight *= fOut * 1.15f;
                dIn = normalize(reflect(dIn, inwardN));
                dispL = reflect(dispL, inwardN);
                p += inwardN * 0.004f;
            }
        }
        return accum;
    }

    #pragma body
    float4 worldPos4 = scn_frame.inverseViewTransform * float4(_surface.position, 1.0f);
    float3 worldPos = worldPos4.xyz;
    float3 camWorldPos = scn_frame.inverseViewTransform[3].xyz;
    float3 worldNormal = normalize((scn_frame.inverseViewTransform * float4(_surface.normal, 0.0f)).xyz);

    float3 c0 = scn_node.modelTransform[0].xyz;
    float3 c1 = scn_node.modelTransform[1].xyz;
    float3 c2 = scn_node.modelTransform[2].xyz;
    float s0 = max(0.0001f, length(c0));
    float3x3 rotMat = float3x3(c0 / s0, c1 / s0, c2 / s0);

    float3 rawLocalPos = (scn_node.inverseModelTransform * worldPos4).xyz;
    float3 localPos = rawLocalPos * u_invRadius;

    float3 V_w = normalize(worldPos - camWorldPos);
    if (dot(-V_w, worldNormal) < 0.0f) {
        worldNormal = -worldNormal;
    }

    float3 localNormal = normalize(float3(
        dot(rotMat[0], worldNormal),
        dot(rotMat[1], worldNormal),
        dot(rotMat[2], worldNormal)
    ));
    float3 V_l = normalize(float3(
        dot(rotMat[0], V_w),
        dot(rotMat[1], V_w),
        dot(rotMat[2], V_w)
    ));

    float ndotv = clamp(dot(-V_w, worldNormal), 0.0f, 1.0f);
    float F_front = 0.17f + 0.83f * pow(1.0f - ndotv, 5.0f);

    float3 extSpec = diaSampleStudio(reflect(V_w, worldNormal));
    float3 H_pin = normalize(-V_w + normalize(float3(-0.56f, 0.58f, 0.59f)));
    float pinFlash = pow(max(0.0f, dot(worldNormal, H_pin)), 420.0f) * 0.60f;

    float3 internalColor = diaTracePrimary(localPos, V_l, localNormal, worldPos, rotMat, u_floorTex)
        * float3(0.99f, 1.00f, 1.03f);

    float edgeGlint = pow(1.0f - ndotv, 3.8f) * 0.22f;
    float facetRidge = clamp(length(fwidth(localNormal)) * 0.65f, 0.0f, 1.0f);
    float ridgeSpec = facetRidge * (0.28f + 0.72f * pow(ndotv, 0.5f));

    float3 hdrColor = internalColor * (1.0f - F_front * 0.88f)
        + extSpec * F_front
        + float3(0.86f, 0.95f, 1.00f) * edgeGlint
        + float3(1.35f, 1.50f, 1.72f) * ridgeSpec * 0.26f
        + float3(1.15f, 1.25f, 1.40f) * pinFlash;
    hdrColor *= u_exposure;
    hdrColor = hdrColor / (1.0f + max(float3(0.0f), hdrColor - 2.6f) * 0.34f);

    float3 mapped = (hdrColor * (2.51f * hdrColor + 0.03f))
        / (hdrColor * (2.43f * hdrColor + 0.59f) + 0.14f);
    _output.color = float4(saturate(mapped), 1.0f);
    """

    static func makeDiamondMaterial(radius: Float, floorTexture: CGImage) -> SCNMaterial {
        let mat = SCNMaterial()
        mat.lightingModel = .lambert
        mat.isDoubleSided = false
        mat.writesToDepthBuffer = true
        mat.readsFromDepthBuffer = true
        mat.setValue(NSNumber(value: Float(1.0 / max(radius, 0.01))), forKey: "u_invRadius")
        mat.setValue(NSNumber(value: Float(1.02)), forKey: "u_exposure")
        mat.setValue(SCNMaterialProperty(contents: floorTexture), forKey: "u_floorTex")
        mat.shaderModifiers = [
            .surface: surfaceModifier,
            .fragment: diamondFragmentModifier
        ]
        return mat
    }

    // MARK: - Velvet Cushion Ashikhmin-Charlie Shader

    private static let velvetFragmentModifier: String = """
    #pragma arguments
    float u_exposure;
    float3 u_coreColor;
    float3 u_midColor;
    float3 u_sheenColor;
    float3 u_rimColor;
    float3 u_keyLightPos;
    texture2d<float> u_diffuseTex;
    texture2d<float> u_normalTex;
    texture2d<float> u_dataTex;

    static inline float vHash(float2 p) {
        return fract(sin(dot(p, float2(127.1f, 311.7f))) * 43758.5453123f);
    }

    static inline float vNoise(float2 p) {
        float2 i = floor(p);
        float2 f = fract(p);
        f = f * f * (3.0f - 2.0f * f);
        return mix(
            mix(vHash(i), vHash(i + float2(1.0f, 0.0f)), f.x),
            mix(vHash(i + float2(0.0f, 1.0f)), vHash(i + float2(1.0f, 1.0f)), f.x),
            f.y
        );
    }

    #pragma body
    constexpr sampler vSamp(coord::normalized, filter::linear, address::clamp_to_edge);

    float3 worldPos = (scn_frame.inverseViewTransform * float4(_surface.position, 1.0f)).xyz;
    float3 camWorldPos = scn_frame.inverseViewTransform[3].xyz;
    float3 V = normalize(camWorldPos - worldPos);

    float2 baseUV = float2(worldPos.x / 6.00f + 0.5f, 0.5f - worldPos.y / 7.32f);
    float2 parDir = float2(V.x, -V.y) / max(0.45f, V.z);
    float h0 = u_dataTex.sample(vSamp, baseUV).r;
    float2 uv1 = clamp(baseUV + parDir * (h0 - 0.5f) * 0.022f, float2(0.002f), float2(0.998f));
    float h1 = u_dataTex.sample(vSamp, uv1).r;
    float2 uvP = clamp(baseUV + parDir * (((h0 + h1) * 0.5f) - 0.5f) * 0.028f, float2(0.002f), float2(0.998f));

    float4 dataS = u_dataTex.sample(vSamp, uvP);
    float foldH = dataS.r;
    float2 napDir = normalize(dataS.gb * 2.0f - 1.0f + float2(0.001f));
    float fuzz = dataS.a;

    float2 perpDir = float2(-napDir.y, napDir.x);
    float2 brushedUV = float2(dot(uvP, napDir) * 62.0f, dot(uvP, perpDir) * 185.0f);
    float brushStreak = vNoise(brushedUV);
    float tipA = vNoise(uvP * 235.0f);
    float tipB = vNoise(uvP * 235.0f + float2(31.7f, 17.3f));
    float napCloud = vNoise(uvP * 9.5f + napDir * 0.65f);
    float fiberTooth = mix(tipA, brushStreak, 0.55f) * (0.72f + 0.56f * napCloud);

    float3 rawN = u_normalTex.sample(vSamp, uvP).xyz * 2.0f - 1.0f;
    float2 microPerturb = float2(tipA - 0.5f, tipB - 0.5f) * 0.30f;
    float3 N = normalize(float3(rawN.x * 2.10f + microPerturb.x, rawN.y * 2.10f + microPerturb.y, max(0.24f, rawN.z)));
    float3 N_nap = normalize(float3(N.xy + napDir * 0.34f, max(0.22f, N.z)));

    float foldAO = 0.14f + 0.86f * pow(clamp(foldH, 0.0f, 1.0f), 0.82f);
    float3 diffLin = u_diffuseTex.sample(vSamp, uvP).rgb;
    float3 bodyColor = mix(u_coreColor, u_midColor, foldAO * (0.35f + 0.75f * fuzz * (0.65f + 0.55f * fiberTooth))) + diffLin * 0.14f;

    float3 L1 = normalize(u_keyLightPos - worldPos);
    float3 H1 = normalize(V + L1);
    float ndh1 = clamp(dot(N_nap, H1), 0.0f, 0.999f);
    float cot2H1 = (ndh1 * ndh1) / max(0.0001f, 1.0f - ndh1 * ndh1);
    float ash1 = exp(-cot2H1 / (0.34f * 0.34f)) * pow(1.0f - ndh1, 0.65f);
    float ndl1 = max(0.0f, dot(N, L1));

    float3 L2 = normalize(float3(3.6f, -2.8f, 3.8f) - worldPos);
    float3 H2 = normalize(V + L2);
    float ndh2 = clamp(dot(N_nap, H2), 0.0f, 0.999f);
    float cot2H2 = (ndh2 * ndh2) / max(0.0001f, 1.0f - ndh2 * ndh2);
    float ash2 = exp(-cot2H2 / (0.36f * 0.36f)) * pow(1.0f - ndh2, 0.65f);

    float ndv = clamp(dot(N_nap, V), 0.0f, 1.0f);
    float2 centered = float2(worldPos.x / 4.0f, worldPos.y / 4.88f) * 1.45f;
    float cushionMask = smoothstep(1.18f, 0.42f, length(centered));
    float charlie = pow(1.0f - ndv, 3.4f) * (0.40f + 0.85f * fuzz * fiberTooth) * cushionMask;
    float fuzzMod = 0.55f + 0.85f * fiberTooth;

    float3 sheenLobe = u_sheenColor * (ash1 * 0.68f + charlie * 0.72f) * foldAO * fuzzMod
        + u_rimColor * (ash2 * 0.36f * foldAO * fuzzMod * cushionMask);
    float vig = clamp(1.02f - dot(centered, centered) * 0.62f, 0.14f, 1.0f);

    float3 lit = (bodyColor * (0.14f + 0.95f * ndl1) + sheenLobe) * vig * u_exposure;
    float3 mapped = (lit * (2.51f * lit + 0.03f)) / (lit * (2.43f * lit + 0.59f) + 0.14f);
    _output.color = float4(saturate(mapped), 1.0f);
    """

    static func makeVelvetFloorMaterial(
        pbr: ProceduralTextureGenerator.FloorPBRSet,
        preset: VelvetPreset = .obsidian
    ) -> SCNMaterial {
        let mat = SCNMaterial()
        mat.lightingModel = .lambert
        mat.isDoubleSided = false
        mat.writesToDepthBuffer = true
        mat.readsFromDepthBuffer = true
        updateVelvetFloorMaterial(mat, pbr: pbr, preset: preset, keyLightPos: SCNVector3(-4.4, 4.6, 5.2), exposure: 1.02)
        mat.shaderModifiers = [
            .surface: surfaceModifier,
            .fragment: velvetFragmentModifier
        ]
        return mat
    }

    static func updateVelvetFloorMaterial(
        _ mat: SCNMaterial,
        pbr: ProceduralTextureGenerator.FloorPBRSet,
        preset: VelvetPreset,
        keyLightPos: SCNVector3,
        exposure: Float
    ) {
        let c = preset.coreLinearRGB
        let m = preset.midLinearRGB
        let s = preset.sheenLinearRGB
        let r = preset.rimLinearRGB

        mat.setValue(NSNumber(value: exposure), forKey: "u_exposure")
        mat.setValue(NSValue(scnVector3: SCNVector3(c.0, c.1, c.2)), forKey: "u_coreColor")
        mat.setValue(NSValue(scnVector3: SCNVector3(m.0, m.1, m.2)), forKey: "u_midColor")
        mat.setValue(NSValue(scnVector3: SCNVector3(s.0, s.1, s.2)), forKey: "u_sheenColor")
        mat.setValue(NSValue(scnVector3: SCNVector3(r.0, r.1, r.2)), forKey: "u_rimColor")
        mat.setValue(NSValue(scnVector3: keyLightPos), forKey: "u_keyLightPos")
        mat.setValue(SCNMaterialProperty(contents: pbr.diffuse), forKey: "u_diffuseTex")
        mat.setValue(SCNMaterialProperty(contents: pbr.normal), forKey: "u_normalTex")
        mat.setValue(SCNMaterialProperty(contents: pbr.roughness), forKey: "u_dataTex")
    }

    // MARK: - Tennis Shell Fur Pure-MSL Shader (pristine_v16 optics)

    private static let tennisFuzzFragmentModifier: String = """
    #pragma arguments
    float u_shellLayer;
    float u_exposure;
    float3 u_keyLightPos;
    float3 u_rimLightPos;
    texture2d<float> u_colorTex;
    texture2d<float> u_seamTex;

    static inline float fzHash3(float3 p) {
        p = fract(p * 0.1031f);
        p += dot(p, p.yzx + 33.33f);
        return fract((p.x + p.y) * p.z);
    }

    static inline float fzNoise3(float3 p) {
        float3 i = floor(p);
        float3 f = fract(p);
        f = f * f * (3.0f - 2.0f * f);
        float n000 = fzHash3(i);
        float n100 = fzHash3(i + float3(1.0f, 0.0f, 0.0f));
        float n010 = fzHash3(i + float3(0.0f, 1.0f, 0.0f));
        float n110 = fzHash3(i + float3(1.0f, 1.0f, 0.0f));
        float n001 = fzHash3(i + float3(0.0f, 0.0f, 1.0f));
        float n101 = fzHash3(i + float3(1.0f, 0.0f, 1.0f));
        float n011 = fzHash3(i + float3(0.0f, 1.0f, 1.0f));
        float n111 = fzHash3(i + float3(1.0f, 1.0f, 1.0f));
        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
    }

    #pragma body
    constexpr sampler fSamp(coord::normalized, filter::linear, address::repeat);
    float2 uv = _surface.diffuseTexcoord;
    float seamMask = u_seamTex.sample(fSamp, uv).r;
    if (seamMask < 0.25f) {
        discard_fragment();
    }

    float4 worldPos4 = scn_frame.inverseViewTransform * float4(_surface.position, 1.0f);
    float3 worldPos = worldPos4.xyz;
    float3 camWorldPos = scn_frame.inverseViewTransform[3].xyz;
    float3 worldN = normalize((scn_frame.inverseViewTransform * float4(_surface.normal, 0.0f)).xyz);
    float3 dirL = normalize((scn_node.inverseModelTransform * worldPos4).xyz);

    float tuft = fzNoise3(dirL * 42.0f);
    float strand = fzNoise3(dirL * 92.0f + float3(tuft * 1.35f));
    float strandHeight = clamp(strand * 0.72f + tuft * 0.42f, 0.0f, 1.15f);
    if (strandHeight < u_shellLayer * 0.88f) {
        discard_fragment();
    }

    float3 baseAlb = u_colorTex.sample(fSamp, uv).rgb;
    float tipAO = 0.72f + 0.28f * u_shellLayer;
    float3 V = normalize(camWorldPos - worldPos);
    float3 L_key = normalize(u_keyLightPos - worldPos);
    float3 L_rim = normalize(u_rimLightPos - worldPos);

    float ndl = max(0.0f, (dot(worldN, L_key) + 0.42f) / 1.42f);
    float ndotv = clamp(dot(worldN, V), 0.0f, 1.0f);
    float fuzzHalo = pow(1.0f - ndotv, 2.4f) * u_shellLayer * 0.58f;
    float rimBack = pow(max(0.0f, (dot(worldN, L_rim) + 0.35f) / 1.35f), 1.7f) * u_shellLayer * 0.36f;

    float3 lit = baseAlb * tipAO * (ndl * 1.38f + 0.30f);
    lit += float3(0.76f, 0.90f, 0.20f) * (fuzzHalo * (0.35f + 0.65f * ndl) + rimBack * 0.85f) * tipAO;
    lit *= u_exposure;

    float3 mapped = (lit * (2.51f * lit + 0.03f)) / (lit * (2.43f * lit + 0.59f) + 0.14f);
    _output.color = float4(saturate(mapped), 1.0f);
    """

    static func makeTennisFuzzMaterials(
        colorTexture: CGImage,
        seamTexture: CGImage,
        layers: [Float] = [0.25, 0.50, 0.75, 1.00]
    ) -> [SCNMaterial] {
        let colorProp = SCNMaterialProperty(contents: colorTexture)
        let seamProp = SCNMaterialProperty(contents: seamTexture)

        return layers.map { layer in
            let mat = SCNMaterial()
            mat.lightingModel = .lambert
            mat.isDoubleSided = false
            mat.writesToDepthBuffer = true
            mat.readsFromDepthBuffer = true
            mat.diffuse.contents = colorTexture
            mat.setValue(NSNumber(value: layer), forKey: "u_shellLayer")
            mat.setValue(NSNumber(value: Float(1.04)), forKey: "u_exposure")
            mat.setValue(NSValue(scnVector3: SCNVector3(-4.4, 4.6, 5.2)), forKey: "u_keyLightPos")
            mat.setValue(NSValue(scnVector3: SCNVector3(4.8, -4.0, 1.35)), forKey: "u_rimLightPos")
            mat.setValue(colorProp, forKey: "u_colorTex")
            mat.setValue(seamProp, forKey: "u_seamTex")
            mat.shaderModifiers = [
                .surface: surfaceModifier,
                .fragment: tennisFuzzFragmentModifier
            ]
            return mat
        }
    }

    // MARK: - Interactive 3D Manicured Grass Pure-MSL Shader (12 explicit ball uniforms)

    private static let grassGeometryModifier: String = """
    #pragma arguments
    float u_time;
    float u_ballCount;
    float4 u_ball0;
    float4 u_ball1;
    float4 u_ball2;
    float4 u_ball3;
    float4 u_ball4;
    float4 u_ball5;
    float4 u_ball6;
    float4 u_ball7;
    float4 u_ball8;
    float4 u_ball9;
    float4 u_ball10;
    float4 u_ball11;

    static inline void applyBallParting(
        float4 ball,
        float2 rootXY,
        float t,
        thread float2& pushXY,
        thread float& maxAllowedZ,
        thread float& ballShadow
    ) {
        float2 dXY = rootXY - ball.xy;
        if (abs(dXY.x) > 1.35f || abs(dXY.y) > 1.35f) return;
        float dist2 = dot(dXY, dXY);
        float r = max(0.05f, ball.w);
        float pushR = r * 1.24f;
        if (dist2 < pushR * pushR && ball.z < r * 1.65f) {
            float dist = sqrt(max(0.00001f, dist2));
            float zTouch = clamp(1.0f - max(0.0f, ball.z - r * 1.02f) / (r * 0.65f), 0.0f, 1.0f);
            float radialProx = 1.0f - dist / pushR;
            float pushStr = smoothstep(0.0f, 1.0f, radialProx) * zTouch;
            float2 outDir = dist > 0.002f ? (dXY / dist) : float2(0.0f, 1.0f);
            pushXY += outDir * pushStr * 0.075f * t;
            if (dist < r * 0.99f) {
                float sphereBotZ = ball.z - sqrt(max(0.0f, r * r - dist2));
                maxAllowedZ = min(maxAllowedZ, max(0.006f, sphereBotZ - 0.014f));
            }
            float contactAO = 1.0f - smoothstep(r * 0.40f, r * 1.28f, dist) * zTouch * 0.66f;
            ballShadow = min(ballShadow, contactAO);
        }
    }

    #pragma body
    float t = _geometry.texcoords[0].x;
    float phase = _geometry.texcoords[0].y;
    float2 rootXY = _geometry.position.xy;

    // Gentle stadium air breeze ripple across blade tips
    float windWave = sin(u_time * 1.65f + rootXY.x * 1.85f + rootXY.y * 1.25f + phase * 6.283f);
    float2 windDisp = float2(0.011f, 0.008f) * windWave * t * t;

    float2 pushXY = float2(0.0f);
    float maxAllowedZ = 2.0f;
    float ballShadow = 1.0f;

    int count = int(u_ballCount);
    if (count > 0) applyBallParting(u_ball0, rootXY, t, pushXY, maxAllowedZ, ballShadow);
    if (count > 1) applyBallParting(u_ball1, rootXY, t, pushXY, maxAllowedZ, ballShadow);
    if (count > 2) applyBallParting(u_ball2, rootXY, t, pushXY, maxAllowedZ, ballShadow);
    if (count > 3) applyBallParting(u_ball3, rootXY, t, pushXY, maxAllowedZ, ballShadow);
    if (count > 4) applyBallParting(u_ball4, rootXY, t, pushXY, maxAllowedZ, ballShadow);
    if (count > 5) applyBallParting(u_ball5, rootXY, t, pushXY, maxAllowedZ, ballShadow);
    if (count > 6) applyBallParting(u_ball6, rootXY, t, pushXY, maxAllowedZ, ballShadow);
    if (count > 7) applyBallParting(u_ball7, rootXY, t, pushXY, maxAllowedZ, ballShadow);
    if (count > 8) applyBallParting(u_ball8, rootXY, t, pushXY, maxAllowedZ, ballShadow);
    if (count > 9) applyBallParting(u_ball9, rootXY, t, pushXY, maxAllowedZ, ballShadow);
    if (count > 10) applyBallParting(u_ball10, rootXY, t, pushXY, maxAllowedZ, ballShadow);
    if (count > 11) applyBallParting(u_ball11, rootXY, t, pushXY, maxAllowedZ, ballShadow);

    _geometry.position.xy += windDisp + pushXY;
    _geometry.position.z = min(_geometry.position.z, maxAllowedZ);
    float pushBoost = 1.0f + clamp(length(pushXY) * 10.0f, 0.0f, 0.35f) * t;
    _geometry.color.rgb *= ballShadow * pushBoost;
    """

    static func makeInteractiveGrassMaterial() -> SCNMaterial {
        let mat = SCNMaterial()
        mat.lightingModel = .physicallyBased
        mat.isDoubleSided = true
        mat.diffuse.contents = CGColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0)
        mat.roughness.contents = 0.44
        mat.metalness.contents = 0.0

        mat.setValue(NSNumber(value: Float(0.0)), forKey: "u_time")
        mat.setValue(NSNumber(value: Float(0.0)), forKey: "u_ballCount")
        for i in 0..<12 {
            mat.setValue(NSValue(scnVector4: SCNVector4(0, 0, -10, 0.35)), forKey: "u_ball\(i)")
        }
        mat.shaderModifiers = [.geometry: grassGeometryModifier]
        return mat
    }
}
