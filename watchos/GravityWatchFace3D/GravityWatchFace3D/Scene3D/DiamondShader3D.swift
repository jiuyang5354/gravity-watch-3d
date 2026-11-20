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

    private static let fragmentModifier: String = """
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
        float3 col = float3(0.005f, 0.007f, 0.011f)
            + float3(0.016f, 0.022f, 0.032f) * smoothstep(0.0f, 0.95f, d.z);

        float soft1 = pow(max(0.0f, dot(d, normalize(float3(-0.35f, 0.52f, 0.78f)))), 18.0f);
        float soft2 = pow(max(0.0f, dot(d, normalize(float3(0.58f, 0.24f, 0.78f)))), 26.0f);
        float rimBar = smoothstep(0.91f, 0.99f, abs(dot(d, normalize(float3(0.76f, -0.62f, 0.18f)))));
        float pin1 = pow(max(0.0f, dot(d, normalize(float3(-0.18f, 0.68f, 0.71f)))), 140.0f);
        float pin2 = pow(max(0.0f, dot(d, normalize(float3(0.54f, -0.32f, 0.78f)))), 160.0f);
        float pin3 = pow(max(0.0f, dot(d, normalize(float3(-0.68f, -0.22f, 0.70f)))), 120.0f);

        col += float3(1.45f, 1.55f, 1.72f) * soft1;
        col += float3(1.10f, 1.38f, 1.65f) * soft2;
        col += float3(1.35f, 1.48f, 1.62f) * rimBar;
        col += float3(6.50f, 6.80f, 7.20f) * pin1;
        col += float3(5.20f, 5.80f, 6.60f) * pin2;
        col += float3(4.60f, 5.00f, 5.80f) * pin3;
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
                float3 floorCol = pow(max(rawFloor, float3(0.001f)), float3(1.55f));
                float rimSpark = pow(clamp(1.0f + rayW.z, 0.0f, 1.0f), 2.8f) * 0.16f;
                return floorCol * 1.45f + float3(0.55f, 0.72f, 0.95f) * rimSpark;
            }
        }
        return diaSampleStudio(rayW);
    }

    static inline float3 diaTraceChannel(
        float3 startP,
        float3 startDirL,
        float3 localNormal,
        float3 worldPos,
        float3x3 rotMat,
        float ior,
        texture2d<float> floorTex
    ) {
        float3 dIn = refract(startDirL, normalize(localNormal), 1.0f / ior);
        if (length(dIn) < 0.001f) {
            dIn = reflect(startDirL, normalize(localNormal));
        }
        dIn = normalize(dIn);

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
            float sin2T = ior * ior * (1.0f - cosI * cosI);

            if (sin2T >= 0.998f || bounce == 2) {
                if (sin2T < 0.998f) {
                    float3 dOutL = normalize(refract(dIn, inwardN, ior));
                    float3 dOutW = normalize(rotMat * dOutL);
                    accum += weight * diaSampleExit(worldPos, dOutW, floorTex);
                    break;
                }
                dIn = normalize(reflect(dIn, inwardN));
                p += inwardN * 0.004f;
                if (bounce == 2) {
                    float3 finalW = normalize(rotMat * dIn);
                    accum += weight * diaSampleExit(worldPos, finalW, floorTex);
                }
            } else {
                float fOut = 0.17f + 0.83f * pow(1.0f - cosI, 4.0f);
                float3 dOutL = normalize(refract(dIn, inwardN, ior));
                float3 dOutW = normalize(rotMat * dOutL);
                accum += weight * (1.0f - fOut) * diaSampleExit(worldPos, dOutW, floorTex);
                weight *= fOut * 1.15f;
                dIn = normalize(reflect(dIn, inwardN));
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

    float rTrans = diaTraceChannel(localPos, V_l, localNormal, worldPos, rotMat, 2.38f, u_floorTex).r;
    float gTrans = diaTraceChannel(localPos, V_l, localNormal, worldPos, rotMat, 2.42f, u_floorTex).g;
    float bTrans = diaTraceChannel(localPos, V_l, localNormal, worldPos, rotMat, 2.47f, u_floorTex).b;
    float3 internalColor = float3(rTrans, gTrans, bTrans) * float3(0.96f, 0.99f, 1.04f);

    float edgeGlint = pow(1.0f - ndotv, 3.6f) * 0.32f;
    float3 hdrColor = internalColor * (1.0f - F_front * 0.88f)
        + extSpec * F_front
        + float3(0.82f, 0.92f, 1.00f) * edgeGlint;
    hdrColor *= u_exposure;

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
        mat.setValue(NSNumber(value: Float(1.18)), forKey: "u_exposure")
        mat.setValue(SCNMaterialProperty(contents: floorTexture), forKey: "u_floorTex")
        mat.shaderModifiers = [
            .surface: surfaceModifier,
            .fragment: fragmentModifier
        ]
        return mat
    }

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
    float3 diffRaw = u_diffuseTex.sample(vSamp, uvP).rgb;
    float3 diffLin = pow(max(diffRaw, float3(0.0002f)), float3(2.2f));
    float3 bodyColor = mix(u_coreColor, u_midColor, foldAO * (0.35f + 0.75f * fuzz * (0.65f + 0.55f * fiberTooth))) + diffLin * 0.16f;

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
    float2 centered = (uvP - 0.5f) * float2(1.45f, 1.45f);
    float rC = length(centered);
    float cushionMask = smoothstep(1.18f, 0.42f, rC);
    float charlie = pow(1.0f - ndv, 3.4f) * (0.40f + 0.85f * fuzz * fiberTooth) * cushionMask;
    float fuzzMod = 0.55f + 0.85f * fiberTooth;

    float3 hdrColor = bodyColor * (0.48f + 0.62f * ndl1)
        + u_sheenColor * (ash1 * 0.78f + charlie * 0.85f) * foldAO * fuzzMod
        + u_rimColor * (ash2 * 0.42f * foldAO * fuzzMod * cushionMask);

    float vig = clamp(1.02f - dot(centered, centered) * 0.62f, 0.14f, 1.0f);
    hdrColor *= vig * u_exposure;

    float3 mapped = (hdrColor * (2.51f * hdrColor + 0.03f))
        / (hdrColor * (2.43f * hdrColor + 0.59f) + 0.14f);
    _output.color = float4(saturate(mapped), 1.0f);
    """

    static func makeVelvetFloorMaterial(pbr: ProceduralTextureGenerator.FloorPBRSet) -> SCNMaterial {
        let mat = SCNMaterial()
        mat.lightingModel = .lambert
        mat.isDoubleSided = false
        mat.writesToDepthBuffer = true
        mat.readsFromDepthBuffer = true
        mat.setValue(NSNumber(value: Float(1.18)), forKey: "u_exposure")
        mat.setValue(SCNVector3(0.0012, 0.0014, 0.0024), forKey: "u_coreColor")
        mat.setValue(SCNVector3(0.0075, 0.0085, 0.0135), forKey: "u_midColor")
        mat.setValue(SCNVector3(0.095, 0.105, 0.140), forKey: "u_sheenColor")
        mat.setValue(SCNVector3(0.140, 0.155, 0.200), forKey: "u_rimColor")
        mat.setValue(SCNVector3(-2.4, 3.6, 7.6), forKey: "u_keyLightPos")
        mat.setValue(SCNMaterialProperty(contents: pbr.diffuse), forKey: "u_diffuseTex")
        mat.setValue(SCNMaterialProperty(contents: pbr.normal), forKey: "u_normalTex")
        mat.setValue(SCNMaterialProperty(contents: pbr.roughness), forKey: "u_dataTex")
        mat.shaderModifiers = [
            .surface: surfaceModifier,
            .fragment: velvetFragmentModifier
        ]
        return mat
    }
}
