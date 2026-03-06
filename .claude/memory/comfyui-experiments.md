# ComfyUI 치비 파이프라인 실험 기록

> 이 문서는 ComfyUI MCP를 통한 치비 캐릭터 생성 실험의 **정확한 파라미터와 결과**를 기록합니다.
> 새 세션에서 참조하여 동일 실험 반복을 방지합니다.
> **Last Updated: 2026-02-27**

---

## 1. 확정된 워크플로우 (Base Template)

### 노드 구조 (15 nodes)
```
[1] CheckpointLoaderSimple → animagineXL31_v31.safetensors
[2] LoraLoader → flowspace-chibi-v2.safetensors (str_model=0.6, str_clip=0.6)
[3] IPAdapterUnifiedLoader → preset="PLUS (high strength)"
[4] LoadImage → ref image (IP-Adapter input)
[5] IPAdapterAdvanced → (방향별 설정 다름, 아래 참조)
[6] CLIPTextEncode → positive prompt
[7] CLIPTextEncode → negative prompt
[8] ControlNetLoader → controlnet-depth-sdxl-1.0.safetensors
[9] LoadImage → depth map (방향별 다름)
[10] ControlNetApplyAdvanced → str=0.3, start=0, end=0.7
[11] EmptyLatentImage → 1024x1024, batch=1
[12] KSampler → seed=42, steps=28, cfg=7, euler_ancestral, normal, denoise=1
[13] VAEDecode
[14] InspyrenetRembg → torchscript_jit="default"
[15] SaveImage → filename_prefix 방향별
```

### 연결 그래프
```
[1] → [2] (MODEL, CLIP)
[2] → [3] (MODEL) → [5] (via [3] IPADAPTER)
[2] → [6], [7] (CLIP)
[4] → [5] (IMAGE, ref)
[5] → [10] (MODEL, IP-Adapter applied)
[6] → [10] (positive CONDITIONING)
[7] → [12] (negative CONDITIONING, KSampler)
[8] → [10] (CONTROL_NET)
[9] → [10] (IMAGE, depth map)
[10] → [12] (positive CONDITIONING, ControlNet applied)
[11] → [12] (LATENT)
[12] → [13] (LATENT) → [14] (IMAGE) → [15] (IMAGE)
```

---

## 2. 방향별 파라미터 (warm ref 세트, 최종 확정)

### 공통
- ref: `ref_front_warm.png` (seed_front_lb42에서 생성, IP-Adapter 없이)
- KSampler: seed=42, steps=28, cfg=7, euler_ancestral, normal
- ControlNet: str=0.3, endAt=0.7
- LoRA: str=0.6
- 해상도: 1024x1024

### front
| 항목 | 값 |
|------|-----|
| IP-Adapter weight_type | `style and composition` |
| IP-Adapter weight | 1.0 |
| IP-Adapter endAt | 0.5 |
| Depth map | `depth_maps/front.png` |
| Positive | `masterpiece, best quality, very aesthetic, absurdres, flowspace_chibi, 1boy, chibi, facing viewer, front view, short hair, short straight hair, brown hair, white shirt, orange necktie, grey pants, office wear, thick outline, bold lineart, white background, full body, standing` |
| Negative | `1girl, female, skirt, dress, thin lines, long hair, low quality, worst quality, normal quality, lowres, bad anatomy, bad hands, text, error, signature, watermark, blurry` |
| 결과 크기 | 418x933 |
| 머리색 RGB | (178, 146, 128) |

### back
| 항목 | 값 |
|------|-----|
| **노드** | **`IPAdapterStyleComposition`** (IPAdapterAdvanced가 아님!) |
| weight_style | 1.0 |
| weight_composition | **0.3** (크기 힌트, 주황 방지 유지) |
| expand_style | false |
| combine_embeds | average |
| start_at | 0 |
| end_at | 0.5 |
| embeds_scaling | V only |
| Depth map | **`depth_maps/back_shifted.png`** (44px 하향 shift) |
| Positive | `masterpiece, best quality, very aesthetic, absurdres, flowspace_chibi, 1boy, chibi, from behind, short hair, short straight hair, brown hair, white shirt, grey pants, office wear, thick outline, bold lineart, white background, full body, standing` |
| Negative | (front와 동일) |
| 결과 크기 | **412x892** (front 416x863 근접 ✓) |
| 머리색 RGB | (247, 228, 207) |
| 결과 파일 | `output/final/back_testG_00001_.png` |

### left
| 항목 | 값 |
|------|-----|
| IP-Adapter weight_type | `style and composition` |
| IP-Adapter weight | 1.0 |
| IP-Adapter endAt | 0.5 |
| Depth map | `depth_maps/left.png` |
| Positive | `masterpiece, best quality, very aesthetic, absurdres, flowspace_chibi, 1boy, chibi, from side, left side, profile, short hair, short straight hair, brown hair, white shirt, orange necktie, grey pants, office wear, thick outline, bold lineart, white background, full body, standing` |
| Negative | (front와 동일) |
| 결과 크기 | 466x937 |
| 머리색 RGB | (191, 155, 137) |

### right
- left 결과를 `sharp.flop()`으로 좌우반전하여 생성 (별도 ComfyUI 호출 없음)

---

## 3. A/B 테스트 결과 기록

### back 주황 마크 테스트 (Test A~F, 2026-02-24)

> **목적**: back 방향에서 IP-Adapter가 ref의 주황 넥타이를 후면에 삽입하는 문제 해결

| Test | weight_type | weight | endAt | depth map | 주황 | 팔 | 사이즈 | 발위치 | 판정 |
|------|------------|--------|-------|-----------|------|-----|--------|--------|------|
| A | style and composition | 1.0 | 0.5 | back.png (v3) | **남음** | O | O | - | - |
| B | style and composition | 0.9 | 0.4 | back.png (v3) | **약간 축소** | O | O | - | - |
| C | style and composition | 1.0 | 0.3 | back.png (v3) | **남음** | O | O | - | - |
| **D** | **style transfer** | **1.0** | **0.5** | **back.png (v3)** | **없음** | **O** | **O** | **44px 높음** | **최적** |
| E | (없음) | - | - | back.png (v3) | 없음 | O | 비례다름 | - | 일관성 부족 |
| F | style transfer | 1.0 | 0.5 | **back_shifted.png (44px)** | **없음** | O | **5% 큼** | **정렬됨(+3px)** | 비례 약간 떨어짐 |

**핵심 결론:**
1. `style and composition`에서 endAt/weight를 아무리 줄여도 주황 마크 제거 불가 (A/B/C 전부 실패)
2. `style transfer`만이 주황 마크를 완전 제거
3. depth map v3 (팔 확대)는 5개 테스트 전부에서 팔 문제 해결
4. `style transfer`는 composition 정보 손실 → 사이즈 축소 부작용
5. depth map 44px 하향 shift로 발 위치 보정 성공 (front와 3px 이내)

### back IPAdapterStyleComposition 테스트 (Test G~H, 2026-02-25)

> **목적**: style transfer의 사이즈 축소 문제를 IPAdapterStyleComposition으로 해결

| Test | 노드 | style | composition | 주황 | 팔 | 너비 | 높이 | 판정 |
|------|------|-------|-------------|------|-----|------|------|------|
| **G** | StyleComposition | 1.0 | **0.3** | **없음 ✓** | **✓** | **412** | 892 | **채택** |
| H | StyleComposition | 1.0 | 0.5 | 없음 ✓ | ✓ | 414 | **817 (너무 작음)** | 탈락 |
| (참고) warm_back | Advanced (style transfer) | 1.0 | - | 없음 ✓ | ✓ | 372 | 914 | 사이즈 부족 |
| (참고) warm_front | Advanced (style+comp) | 1.0 | - | - | ✓ | 416 | 863 | 기준 |

**핵심 결론:**
- `IPAdapterStyleComposition` style=1.0, composition=0.3이 최적 조합
- composition 가중치가 크기 힌트를 제공하면서도 주황 마크를 억제
- composition 0.5는 높이를 과도하게 줄임 (817px)
- **기존 `style transfer` 대체 확정** → back에 `IPAdapterStyleComposition` 사용

### back depth map shift 테스트 (s30/s35/F44)

| shift | bottom(발) | 높이 | 너비 | 비례 평가 |
|-------|-----------|------|------|----------|
| 0px (TestD) | 955 | 896 | ~378 | 깔끔하지만 발 44px 높음 |
| 30px (s30) | 969 | 917 | 376 | front와 30px 차이 |
| 35px (s35) | 960 | 910 | 376 | front와 39px 차이 |
| **44px (F)** | **1002** | **953** | **378** | **front와 3px 차이, 5% 더 큼** |

### front 머리색 교정 테스트 (front_v2)

| 설정 | 결과 |
|------|------|
| `style transfer` + `dark brown hair` | 머리색 일치했으나 **팔 사라짐 + 크기 변동** (960px, 기존 906px) |
| **결론** | front에 `style transfer` 사용 금지. `style and composition` 필수 |

### seed front 머리색 테스트 (warm ref 생성)

| seed | prompt hair tag | 결과 | 판정 |
|------|----------------|------|------|
| 42 | `brown hair` | 쿨 브라운 RGB(141,97,81) | 기존 ref (캐릭터 디자인 고정) |
| 42 | `warm brown hair, light brown hair` | 너무 밝음 (금발 쪽) | 실패 |
| 42 | `light brown hair` | **웜 브라운** (채택 → ref_front_warm.png) | **채택** |
| 100 | `light brown hair` | 밝음 + 캐릭터 디자인 변경 | 실패 |
| 77 | `light brown hair` | 밝음 + 캐릭터 디자인 변경 | 실패 |

**핵심 교훈:**
- `light brown hair` = Animagine XL에서 금발에 가까운 색
- hair tag 변경 → seed 동일해도 캐릭터 디자인 자체가 변함
- warm ref를 IP-Adapter ref로 사용하면 3방향 모두 일관된 웜톤으로 수렴

### warm ref 3방향 결과 (최종)

| 방향 | 머리색 RGB | 크기 | 편차 |
|------|-----------|------|------|
| front | (178, 146, 128) | 418x933 | - |
| back | (195, 164, 145) | **374x916** | **작음** |
| left | (191, 155, 137) | 466x937 | - |
| **3방향 편차** | **17 이내** | - | 머리색 일관 ✓ |

---

## 4. Depth Map 파일 목록

| 파일 | 버전 | 설명 |
|------|------|------|
| `depth_maps/front.png` | v2 | 팔 포함, 얼굴 특징(눈/코) 밝은 점 |
| `depth_maps/back.png` | v3 | 팔 확대 (str=0.3에서도 인식), 얼굴 특징 없음 |
| `depth_maps/back_shifted.png` | v3 + 44px shift | 발 위치 보정용 |
| `depth_maps/back_s30.png` | v3 + 30px shift | 테스트용 |
| `depth_maps/back_s35.png` | v3 + 35px shift | 테스트용 |
| `depth_maps/left.png` | v2 | 팔 포함 |
| `depth_maps/legacy/` | v1 | 팔 없음 (사용 안 함) |

### Depth map 핵심 원리
- **front vs back 구분**: 얼굴 특징(눈/코) 유무가 ControlNet에 정면/후면 신호
- **str=0.3 최적**: 방향 힌트만 제공, 애니메 스타일 보존. 0.7 이상은 3D 점토 인형화
- **팔 표현**: str=0.3에서는 작은 팔 돌출이 무시됨 → v3에서 팔을 크고 밝게 그려야 함
- **shift 보정**: ControlNet str=0.3은 약한 힌트라 캐릭터 위치가 밀림 → depth map 자체를 shift

---

## 5. ref 이미지 파일 목록

| 파일 | 용도 | 생성 조건 |
|------|------|----------|
| `ref_front.png` | 구 ref (cool brown) | seed=42, `brown hair`, IP-Adapter 없이 |
| **`ref_front_warm.png`** | **현재 사용** | seed=42, `light brown hair`, IP-Adapter 없이, Rembg 없음 |

### ref 생성 워크플로우 (seed front, IP-Adapter 없음)
```
노드: 11개 (IP-Adapter 관련 [3][4][5] 없음, Rembg [14] 없음)
[1] CheckpointLoaderSimple → animagineXL31_v31.safetensors
[2] LoraLoader → flowspace-chibi-v2.safetensors (0.6)
[6] CLIPTextEncode → positive (방향: facing viewer, front view)
[7] CLIPTextEncode → negative
[8] ControlNetLoader → depth-sdxl-1.0
[9] LoadImage → depth_maps/front.png
[10] ControlNetApplyAdvanced → str=0.3, endAt=0.7
[11] EmptyLatentImage → 1024x1024
[12] KSampler → seed=42, steps=28, cfg=7, euler_ancestral
[13] VAEDecode
[15] SaveImage
```

---

## 6. IP-Adapter weight_type 비교표

| weight_type | 장점 | 단점 | 사용처 |
|-------------|------|------|--------|
| `style and composition` | 크기/비례/팔 유지, ref 요소 충실 전달 | ref의 주황 넥타이가 back에도 삽입됨 | **front, left** |
| `style transfer` | 주황 마크 완전 제거 | composition 정보 손실 → 크기 축소 | **back only** |
| `linear` | - | identity 약함 | 사용 안 함 |
| `strong style transfer` | - | 과도한 스타일 적용 | 사용 안 함 |

### IPAdapterStyleComposition 노드 (테스트 완료, back에 채택)
- `weight_style`과 `weight_composition`을 **독립 제어** 가능
- **Test G 채택**: style=1.0, composition=0.3 → 주황 방지 + 크기 힌트 유지 (412x892)
- composition=0.5는 높이 과도 축소 (817px, 탈락)
- 상세 결과: 섹션 3 "back IPAdapterStyleComposition 테스트 (Test G~H)" 참조

---

## 7. 미해결 과제

### ~~warm_back 사이즈 조정~~ → **해결 (2026-02-25)**
- **해결법**: `IPAdapterStyleComposition` 노드, style=1.0, composition=0.3
- 결과: 372x914 → **412x892** (front 416x863 근접, 너비 차이 4px)
- 주황 마크 없음 ✓, 팔 보임 ✓, 방향 정확 ✓

### 오피스 캐릭터 배치 생성 (c01~c11) → **back 전부 탈락, front/left만 유효 (2026-02-25)**
- **v1 결과**: 11캐릭터 × 3방향 = 33장 생성. **back 11장 전부 머리스타일 불일치로 탈락** (사용자 판정)
- **v2 결과 (프롬프트 개선)**: back 전용 프롬프트 분리 + 네거티브 보강 → **여전히 전부 탈락**
- **근본 원인**: 프롬프트만으로 back view 머리스타일 제어 불가. 범용 depth map 1종으로는 개별 머리형태 가이드 불가
- **v1 백업**: `ComfyUI/output/batch_backup_v1/` (44장)
- **v2 파일**: `ComfyUI/output/batch/*_back_00002_.png` (11장)
- **프로세스**: seed front(no IP-Adapter) → ref 업로드 → front/back/left(IP-Adapter + Rembg)
- **총 워크플로우**: 44회 (seed 11 + 방향 33), ~23초/장, 총 ~17분
- **배치 스크립트**: `scripts/batch-chibi-directions.py`
- **출력 위치**: `ComfyUI/output/batch/cXX_{seed,front,back,left}_00001_.png`
- **ref 위치**: `ComfyUI/input/ref_cXX.png` (11개)
- **캐릭터별 변경**: 프롬프트(의상/머리색/성별) + 성별별 네거티브
- **고정**: seed=42, depth maps, ControlNet(0.3/0.7), IP-Adapter 설정, Rembg
- **주요 관찰**: 긴머리/망토/지팡이 캐릭터는 bbox 넓음 (예상 범위), c05 front에 Rembg 잔여 반투명 (시각 정상)

### back v2 프롬프트 개선 테스트 (2026-02-25, 전부 탈락)
- **변경**: front/back appearance 분리, back 네거티브에 `face, looking at viewer, frontal view, bangs visible, eyes` 추가
- **캐릭터별**: c05 `flat hair`+neg `fluffy`, c06 `tousled hair`+neg `bald`, c07 `ribbon from behind`, c08 `hair tie, nape`, c09 `tall chef hat, toque blanche`, c10 `back of armor, pauldrons`, c11 `witch hat, pointed hat`
- **방향태그**: `from behind` → `from behind, facing away`
- **결과**: 11개 전부 탈락. c06 텍스처 약간 개선, c10 방향 개선되었으나 전체적으로 "같은 캐릭터의 뒷모습"으로 보이지 않음
- **결론**: **프롬프트 튜닝만으로는 back view 머리스타일 일관성 확보 불가**
- **다음**: Animagine XL 태그별 back view 기준점 테스트 필요

### Animagine XL 태그별 back view 기준점 테스트 (2026-02-25)

> **목적**: 모델이 `from_behind`에서 헤어 태그를 얼마나 정확히 반영하는지 기준점 확인
> **조건**: IP-Adapter 없음 (순수 태그 능력), seed=42, 품질 태그 맨 뒤 배치, Depth ControlNet 0.3

**그룹 A: 머리 길이 (4종) — 전부 정확히 구분됨**
| 파일 | 태그 | 결과 | 판정 |
|------|------|------|------|
| A1_short_hair | `short hair` | 귀~목 위, 물결 끝처리 | ✓ |
| A2_medium_hair | `medium hair` | 어깨선까지, 수평 커트라인 | ✓ |
| A3_long_hair | `long hair` | 허리까지 커튼, 등 덮음 | ✓ |
| A4_very_long_hair | `very long hair` | 엉덩이 이하 | ✓ |

**그룹 B: 머리 스타일 (5종)**
| 파일 | 태그 | 결과 | 판정 |
|------|------|------|------|
| B1_ponytail | `ponytail` | ⚠️ 정면 실루엣+얼굴에 머리카락 (방향 깨짐) | FAIL |
| B1_ponytail_v2 | +`back_of_head, facing away` | 묶음 정중앙 상단 (top bun) | 위치 너무 높음 |
| **B1_ponytail_v3** | `low ponytail, hair tie, ponytail hanging down` +`back_of_head, facing away` | **묶음 중앙~하단, 꼬리 아래로** | **채택** |
| B1_ponytail_v4 | `ponytail, hair tie` +`back_of_head` neg `hair bun, low ponytail` | v2와 동일 (top bun) | 탈락 |
| B1_ponytail_v5 | `ponytail, hair tie, ponytail hanging down` +`facing away` (back_of_head 없음) | 묶음 하단~목 사이 | v3보다 약간 아래 |
| B2_bob_cut | `bob cut` | 수평 커트라인+둥근 캡, 정돈됨 | ✓ 우수 |
| B3_hair_ribbon | `hair ribbon, long hair` | 양쪽 리본 보임, 교복 | ✓ 양호 |
| B4_chef_hat | `chef hat, short hair` | ⚠️ 방향 깨짐 — 정면 출력 | FAIL |
| B5_witch_hat | `witch hat, very long hair` | 뾰족 모자+긴 보라 머리 | ✓ 우수 |

**그룹 C: back 전용 태그 (3종)**
| 파일 | 태그 | A1 대비 효과 | 판정 |
|------|------|-------------|------|
| C1_back_of_head | `back_of_head` | 물결→매끈 캡, 볼륨 축소 | ✓ 효과 있음 |
| C2_hair_down | `hair_down` | A3 long_hair와 유사, 큰 차이 없음 | 효과 미미 |
| C3_nape | `nape` | A1과 거의 동일 | 효과 미미 |

**핵심 결론:**
1. 길이 4단계 정확히 구분됨 — 태그 신뢰 가능
2. ponytail/chef_hat은 방향 깨짐 — 보정 태그(`facing away, back_of_head`) 필수
3. ponytail 최적 조합: `low ponytail, hair tie, ponytail hanging down, back_of_head, facing away`
4. `back_of_head` = 볼륨 억제 효과 (c05 백발 과다 볼륨 문제에 유용)
5. `hair_down`/`nape` = 단독 효과 미미
6. 품질 태그 맨 뒤 배치 + `from behind, facing away` 조합이 기본
7. chef_hat 방향 깨짐은 별도 대응 필요 (seed 변경 또는 추가 보정)

### back v3 배치 재생성 (2026-02-25, 태그 기준점 테스트 결과 적용)

> **목적**: 태그 기준점 테스트 결과를 실전 적용 (IP-Adapter + ControlNet + 개선 태그)
> **스크립트**: `scripts/batch-chibi-directions.py` v3
> **변경**: 품질 태그 뒤로, 캐릭터별 back 태그 개선, `from behind, facing away` 기본, neg에 `front side` 추가

**결과 (v3, `_00003_` 접미사):**
| ID | 방향 | 머리색 | 의상 | 머리스타일 | 악세서리 | 비고 |
|---|---|---|---|---|---|---|
| c01 | ✓ 후면 | 일치 | 정장 ✓ | 짧은 머리 | - | 양호 |
| c02 | ✓ 후면 | 일치 | 블라우스+스커트 ✓ | 매우 긴 직모 | - | 양호 |
| c03 | ✓ 후면 | 일치 | 후디 ✓ | 헝클어진 짧은 | 헤드폰 ✓ | 양호 |
| c04 | ✓ 후면 | 일치 | 스웨터 ✓ | bob_cut 커트라인 | - | 양호 |
| c05 | ✓ 후면 | 일치 | 조끼 ✓ | 짧고 매끈 (볼륨 억제됨) | - | back_of_head 효과 ✓ |
| c06 | ✓ 후면 | 일치 | 검은 티+청바지 ✓ | 짧은 금발 | **배낭 없음** | - |
| c07 | ✓ 후면 | 일치 | 가디건+치마 ✓ | 긴 머리 | **리본 2개 ✓** | hair_ribbon 효과 ✓ |
| c08 | ✓ 후면 | 일치 | 앞치마 ✓ | 둥근 캡 | **꼬리 안 보임** | IP-Adapter가 포니테일 뭉갬 |
| c09 | ✓ 후면 | 일치 | 셰프복 ✓ | 짧은 머리 | **모자 없음** | 방향은 해결, 모자 태그 무시 |
| c10 | ✓ 후면 | 일치 | 갑옷+망토 ✓ | 짧은 머리 | 망토 ✓ | 양호 |
| c11 | ✓ 후면 | 일치 | 로브+지팡이 ✓ | 매우 긴 보라 | **모자 없음** | 지팡이는 보임 |

**개선 (vs v1/v2):**
- 11/11 방향 정확 (v1은 일부 방향 깨짐)
- bob_cut(c04), back_of_head 볼륨 억제(c05), hair_ribbon(c07) — 태그 테스트 결과 유효
- c09 방향 깨짐 해결 (기존 정면→후면)

**남은 문제:**
- c08 포니테일: IP-Adapter 경유 시 꼬리 사라짐 (태그 단독 테스트에서는 정상)
- c09/c11 모자: IP-Adapter가 모자 태그를 무시 (ref에 모자 없으므로)
- c06 배낭: back에서 미생성

**다음**: 사용자 시각 검증 후 판정, 문제 캐릭터 별도 대응

### 미해결: 걷기 포즈 24프레임
- back view 품질 해결 후 진행
- 깊이 맵에 걷기 포즈 반영 필요
- 4방향 × 6프레임 = 24프레임
- 최종 목표: 스프라이트시트

---

## 7.5. Back 파이프라인 구조 실험 (2026-02-25)

### 문제 정의
- front↔back 간 머리 질감/색/길이 불일치 (c08 포니테일이 가장 심함)
- 원인: back만 프롬프트/IP-Adapter타입/네거티브 전부 다름 → "A3"이 아니라 "B1"이 나옴

### 테스트 결과

| 테스트 | 조건 | 결과 | 판정 |
|---|---|---|---|
| Test A | 방향 태그 없음 + back depth str=0.3 | 정면 | ❌ depth만으로 방향 전환 불가 |
| Test B | `from behind` + back depth str=0.3 | 정면 | ❌ IP-Adapter style&comp가 정면 구도 강제 |
| Test C | 통일 프롬프트 + 같은 IP-Adapter + depth 0.3 | 정면 | ❌ 동일 |
| Test D | 통일 프롬프트 + 같은 IP-Adapter + depth 0.5 | 점토 인형 | ❌ 방향은 나왔으나 스타일 파괴 |
| Test E | 통일 프롬프트 + 같은 IP-Adapter + depth 0.4 | 정면 | ❌ |
| Fix1 str=0.5 | style transfer + startAt=0.25 + depth 0.5 | 점토 인형 | ❌ |
| Fix1 str=0.6 | style transfer + startAt=0.25 + depth 0.6 | 점토 인형 | ❌ |
| Fix2 multi-CN | Depth 0.3 + 수작업 Scribble 0.7 | 조악한 품질 | ❌ Pillow 스크리블이 너무 조악 |
| **Pass 1** | **IP-Adapter 없음** + depth 0.3 + 프롬프트 | **명확한 후면** | ✅ 방향 확보 |
| **Pass 2** | Pass1 라인추출 → Scribble 0.6 + Depth 0.3 + IP-Adapter style transfer 0.25→0.85 | **사용자 판단 대기** | ⏳ |

### 핵심 발견
1. **IP-Adapter "style and composition"이 정면 구도를 강제** → depth str 올려도 못 이김 (0.3~0.4는 정면, 0.5~0.6은 점토)
2. **IP-Adapter 없이는 depth 0.3만으로 후면 생성 가능** → IP-Adapter가 방향 제어의 주적
3. **Depth str 0.5+ = 점토 인형화** (이전 0.7 확인에 이어 0.5~0.6도 동일 문제)
4. **2-pass 접근이 유망**: Pass1(방향만, IP-Adapter 없음) → 라인추출 → Pass2(IP-Adapter 스타일 입히기)
5. **수작업 스크리블(Pillow)은 비실용적** — 라인 추출이 자동화 가능하고 품질 우수

### 설치한 모델
- `controlnet-scribble-sdxl-1.0.safetensors` (xinsir, SDXL Scribble ControlNet)

### Pass 2 워크플로우 구조
```
Pass 1: model+LoRA + Depth(0.3) + prompt(from behind) → rough back (no IP-Adapter)
         ↓ 결과 이미지
Pass 2: AnimeLineArtPreprocessor → Scribble CN(0.6, end=0.8)
       + Depth CN(0.3, end=0.7) [체인]
       + IP-Adapter Advanced(style transfer, w=0.8, start=0.25, end=0.85)
       + same prompt → refined back
```

### 개선된 2-pass 테스트 (2026-02-25, img2img 방식)

> **목적**: 이전 세션 Pass2(txt2img)가 실패 → img2img 저denoise + HED 라인추출로 개선 시도
> **피드백 적용**: Pass2를 img2img(denoise 0.40~0.55)로 전환, AnimeLineart→HED로 변경

**Pass 1 테스트 (포니테일 프롬프트 수정):**
| 테스트 | 프롬프트 | IP-Adapter | seed | 결과 |
|---|---|---|---|---|
| p1 s42/100/777 | `ponytail` (단순) | OFF | 42/100/777 | 3장 전부 포니테일 없음 |
| p1v2 s42/100/777 | `low ponytail, hair tie, ponytail hanging down, back_of_head, facing away` | OFF | 42/100/777 | seed42만 low ponytail 보임 (내려묶은 형태) |

**Pass 2 테스트 (img2img):**
| 테스트 | 라인추출 | denoise | 결과 | 판정 |
|---|---|---|---|---|
| p2_hed_d40 | HED | 0.40 | Pass1과 거의 동일, 스타일 전달 미미 | ❌ |
| p2_fakescrib_d40 | FakeScribble | 0.40 | HED와 거의 동일 | ❌ |
| testA_p2_d40 | HED (Pass1에 약한 IP-Adapter) | 0.40 | 의상/체형 여전히 front와 다름 | ❌ |
| testB_p2_d55 | HED (Pass1 IP-Adapter 없음) | 0.55 | testA와 거의 동일 | ❌ |

**2-pass 실패 근본 원인:**
- Pass 1에서 IP-Adapter 없이 생성하면 이미 front와 다른 캐릭터 (의상/체형/머리형태 전부 다름)
- img2img 저denoise(0.40~0.55)로는 그 차이를 메울 수 없음
- 약한 IP-Adapter(w=0.3, startAt=0.3)를 Pass1에 추가해도 효과 미미
- **결론: 2-pass 접근 폐기, 기존 단일 패스(IPAdapterStyleComposition) 복귀**

### v4 back 테스트 (기존 파이프라인 + 의상 프롬프트 강화)

> **변경점**: 기존 IPAdapterStyleComposition 파이프라인에 의상 프롬프트 강화
> - 기존: `apron, cafe uniform`
> - v4: `brown dress, black apron, apron strings, white apron, cafe uniform`
> - 포니테일: `ponytail, hair up, hair tie, back_of_head`

| seed | 올림묶음 | 의상(갈색치마) | 에이프런끈 | 판정 |
|---|---|---|---|---|
| 42 | ✓ | ✓ 갈색 치마 보임 | X자 교차 ✓ | 유망 |
| 100 | ✓ | ✓ 갈색 치마 보임 | 흰색 X자 | 유망 |
| 777 | ✓ | ✓ 갈색 치마 보임 | 흰 리본 매듭 | 유망 |

**핵심 발견**: 의상 프롬프트 구체화가 back 의상 일치도에 효과적. v2보다 front에 확실히 가까워짐.
**사용자 선택**: c08 v4 **seed=100 채택**

### v4 back 전체 배치 (11캐릭터, 2026-02-25)

> **변경점**: 전 캐릭터 back 의상 프롬프트에 구체적 색상+아이템 추가
> **스크립트**: `scripts/batch-chibi-directions.py` v4

**채택 (6캐릭터):**
| ID | 의상 일치 | 머리색 | 비고 |
|---|---|---|---|
| c02 | ✓ 블라우스+스커트 | ✓ 흑발 | 양호 |
| c03 | ✓ 하늘후디+헤드폰 | ✓ | 양호 |
| c04 | ✓ 크림스웨터+밥컷 | ✓ | 양호 |
| c05 | ✓ 다크조끼+백발 | ✓ | 볼륨 억제 |
| c07 | ✓ 가디건+치마+리본 | ✓ | 리본 보임 |
| c08 | ✓ 갈색치마+앞치마끈 | ✓ | seed=100 |

**제외 (5캐릭터, 사용자 판정):**
| ID | 사유 |
|---|---|
| c01 | 뒷머리 길이 불일치 (front=미디엄, back=숏) |
| c06 | 가방 미표시 |
| c09 | 뒷머리 길이 불일치 + 셰프모자 미표시 |
| c10 | 망토가 뒤 전체를 덮지 않음 |
| c11 | 롱헤어→햇스위치 변형 |

**IP-Adapter OFF 테스트 (c01/c09/c10):**
- c01/c09: IP-Adapter 없이 → `medium hair` 정상, 모자도 나옴 → **IP-Adapter가 원인 확정** (모델 한계 아님)
- c10: IP-Adapter 없어도 망토 안 덮음 → 프롬프트/모델 한계

### 걷기 포즈 테스트 (2026-02-25)

> **목적**: 서있는 스프라이트에서 걷기 프레임 생성

**접근 1: 별도 txt2img (walking depth map)**
- 걷기 depth map 생성 (다리 벌림) + `walking` 프롬프트
- 결과: 걷기 포즈 나오지만 얼굴/머리가 standing과 다름 → identity 불일치

**접근 2: img2img (standing → walking)**
- standing 이미지를 img2img 입력, denoise 0.35/0.50
- 결과: **denoise 0.35~0.50 모두 다리 포즈 변화 없음** → Depth ControlNet str=0.3이 img2img latent을 못 이김
- **결론: img2img 방식으로 걷기 포즈 전환 실패**

**다음 접근**: 코드 기반 애니메이션 (standing 스프라이트에서 다리만 프로그래밍으로 이동)

### 파일 위치
- 이번 세션 테스트: `ComfyUI/output/depth_test/c08_p1_*`, `c08_p1v2_*`, `c08_p2_*`, `c08_testA_*`, `c08_testB_*`, `c08_back_v4_*`
- 이전 세션 테스트: `c08_test[A-E]_*`, `c08_fix1_*`, `c08_fix2_*`, `c08_pass1_*`, `c08_pass2_*`
- 스크리블 가이드: `ComfyUI/input/scribble_back_ponytail.png` (수작업, 미사용)
- Pass 1 입력: `ComfyUI/input/pass1_c08_v2.png`, `pass1_testA.png`, `pass1_testB.png`

---

## 8. 절대 규칙 (실험에서 검증됨)

1. **IP-Adapter weight < 0.8 또는 endAt < 0.5 → identity 붕괴** (0.8/0.5 필수)
2. **front에 `style transfer` 사용 금지** → 팔 사라짐 + 크기 변동
3. **ControlNet 제거 금지** → 방향 제어 상실 (2회 검증)
4. **IP-Adapter ref는 Rembg 전 원본(배경 있는) 사용** → 투명 배경 ref는 색감 왜곡
5. **front도 IP-Adapter 경유 필수** → 안 하면 back/left와 머리색 차이
6. **네거티브 프롬프트로 IP-Adapter 특성 억제 불가** → weight_type 변경만 유효
7. **`light brown hair` ≠ `brown hair`** → Animagine XL에서 금발에 가까움, 캐릭터 디자인 자체가 변함
8. **hair tag 변경 시 seed 동일해도 캐릭터 변경됨** → 프롬프트는 캐릭터 디자인의 일부
9. **Depth ControlNet str ≥ 0.5 → 3D 점토 인형화** → 0.3이 최적 (0.5~0.7 전부 점토 확인)
10. **batch_size > 1 + KSampler = identity 붕괴** → seed 자동 증가로 프레임마다 다른 캐릭터
11. **IP-Adapter "style and composition" + 정면 ref = back 전환 불가** → depth 올려도 정면 or 점토
12. **IP-Adapter 없이 depth 0.3 = back 정상 생성** → IP-Adapter가 방향 제어의 주적
13. **2-pass(img2img) back 생성 실패**: Pass1이 front와 다른 캐릭터 → img2img 저denoise로 복구 불가. 약한 IP-Adapter(w=0.3)도 효과 미미
14. **의상 프롬프트 구체화가 back 의상 일치도에 효과적**: `apron, cafe uniform` → `brown dress, black apron, apron strings, white apron` 등 구체적 색+아이템 명시
15. **IP-Adapter가 back 머리길이/악세서리 억제**: ref(정면)에 보이지 않는 요소(미디엄 뒷머리, 모자, 가방)를 IP-Adapter가 무시. 프롬프트 `medium hair` 등으로도 극복 불가
16. **img2img denoise 0.35~0.50으로 걷기 포즈 전환 불가**: Depth ControlNet str=0.3이 img2img latent의 다리 위치를 못 바꿈. 걸을 때 다리만 바꾸려면 코드 기반 접근 필요
17. **~~흰 테두리 원인은 LoRA 스타일~~ → 수정: ref 이미지 + IP-Adapter가 원인**: 단계별 디버그 결과 LoRA만(Stage 2)에서는 흰 아웃라인 없음. IP-Adapter가 흰 아웃라인 포함 ref를 "스타일"로 전파하는 것이 원인. ref 정리가 근본 해결
18. **~~premultiply alpha가 흰 테두리 해법~~ → 수정: 부분 해결만**: Band 1-2 반투명 halo만 해결. Band 4-7 불투명 흰색(전체의 70%)은 처리 불가. 이전 "95%→0%"는 Band 1만 측정한 오해. 근본 해결은 ref 정리
19. **파이프라인 단계별 디버깅 필수**: 출력에 문제 있으면 각 단계(Checkpoint → LoRA → IP-Adapter → ControlNet → Rembg) 산출물을 하나씩 확인. 마지막 출력만 보고 후처리로 해결하려 하면 시간 낭비. 검증 워크플로우: `c02_pipeline_debug.json`
20. **ref 이미지 품질 = 최종 출력 품질**: IP-Adapter ref에 흰 아웃라인/노이즈/아티팩트가 있으면 모든 생성물에 전파됨. ref는 반드시 깨끗한 이미지 사용

---

## 9. 흰 테두리 해결 실험 (2026-02-25)

### ⚠️ 근본 원인 재확정 (2026-02-25 저녁)

> **이전 결론 ("LoRA 스타일이 원인, premultiply가 해법")은 부정확했음**

**단계별 디버깅으로 실제 원인 확정:**
```
Stage 1 (Checkpoint만):  흰 아웃라인 없음
Stage 2 (+ LoRA 0.6):   흰 아웃라인 없음 ← LoRA가 범인이 아님!
Stage 3 (+ IP-Adapter):  흰 아웃라인 등장! ← 원인 확정
Stage 4 (+ ControlNet):  그대로 유지
Stage 5 (+ Rembg):       배경 제거 후 흰 테두리 확정
```

**실제 원인: ref 이미지(ref_c02.png 등)에 이미 흰 스티커 아웃라인이 포함 → IP-Adapter가 "스타일"로 인식하여 전파**

**피드백 루프:**
```
최초 생성(LoRA+프롬프트 thick outline) → 흰 아웃라인 포함 이미지 → ref로 저장
→ IP-Adapter가 ref의 흰 아웃라인을 스타일로 학습 → 출력에 흰 아웃라인 강화
```

**검증 워크플로우**: `c02_pipeline_debug.json` (ComfyUI user/default/workflows/)

### 후처리 비교 테스트 정량 결과 (2026-02-25)

> **테스트 대상**: `front_00001_.png` (RGBA 1024x1024, c02 front)
> **측정 기준**: Edge 5px 이내 픽셀, 어두운 배경 합성 + 게임 해상도(48x64) 비교

| # | 접근 | 불투명흰(%) | 반투명흰(%) | avg_rgb | 비고 |
|---|------|-----------|-----------|---------|------|
| A | 기존 파이프라인 원본 | 42.3 | 57.7 | (252,250,248) | 전체가 흰색 |
| B | premultiply만 | 42.3 | 12.6 | (162,161,160) | 반투명만 해결, 불투명 그대로 |
| C | color replace만 | 0.0 | 0.0 | (3,3,3) | 수치 완벽 but 흰 셔츠 edge 변화 없음 |
| D | replace + premultiply | 0.0 | 0.0 | (3,3,3) | C와 동일 |
| E | LoRA 0.6 (IP 없이) | 26.9 | 62.6 | (226,224,221) | IP-Adapter 제거 효과 |
| F | LoRA 0.4 (IP 없이) | 18.3 | 48.3 | (185,182,178) | LoRA str 감소 효과 |
| G | LoRA 0.4 + replace + premul | 0.0 | 0.0 | (76,75,74) | 가장 깔끔 |

**시각적 관찰 (솔직 평가):**
- B(premultiply만): 머리카락 주변 halo 제거, 흰 셔츠 주변 **불투명 흰색 그대로**
- D(replace+premul): 머리 쪽만 개선, 흰→흰 전파라 셔츠 주변 변화 없음
- F(LoRA 0.4): 아웃라인 얇아짐, 게임 해상도에서 눈에 띄는 개선
- G(LoRA 0.4+combo): 거의 없음 — **단, 이 테스트는 root cause 발견 전이라 IP-Adapter ref 오염 상태**

**color replace 맹점**: 흰 셔츠 edge → 내부 색도 흰색 → 전파해도 흰색. 흰 의상에는 효과 없음

### LoRA 0.4 vs 0.6 실제 파이프라인 비교 (미완, 2026-02-25)

> c02 front를 LoRA 0.4 / 0.6으로 실제 파이프라인(IP-Adapter + ControlNet) 생성
> 치비 비율 유지 확인됨. 수치 비교 직전에 사용자가 단계별 디버깅으로 전환 → **root cause 발견으로 이 테스트는 중단**
> 결론: 깨끗한 ref로 재테스트 필요 (오염된 ref 상태에서의 비교는 무의미)

### 이전 분석 (부분적으로만 정확)

#### 후처리 시도 (전부 증상 치료, 근본 해결 아님)
| 접근 | 결과 | 실패 이유 |
|------|------|----------|
| GrowMask erode (-2~-6) | edge white 여전 | RGB가 흰색이라 깎아도 다음 층도 흰색 |
| ThresholdMask + erode | hard edge 되지만 white 남음 | 동일 |
| 프롬프트 `thick outline` 제거 | 95%→94% | ref가 원인이라 프롬프트 무관 |
| 배경색 변경 (simple/green) | 99~100% | ref가 원인이라 배경 무관 |
| premultiply alpha | Band 1-2만 개선 | **반투명 halo만 해결, 불투명 흰 아웃라인(Band 4-7, 70%)은 건드리지 못함** |
| smart color replace | 수치상 0%지만 시각적 변화 미미 | 흰 셔츠 edge → 내부색도 흰색 → 전파해도 흰색 |

#### Edge 실체 분석 (front, 외곽 10px)
```
Band 1-2 (외곽 2px):  100% 반투명 흰색, avg alpha 4~79  ← Rembg halo
Band 3   (3px):       77% 반투명 + 23% 불투명 흰색      ← 전이 구간
Band 4-7 (4~7px):     86~99% 불투명 흰색 (alpha 249+)  ← IP-Adapter 전파 스티커 아웃라인
비흰색 edge 픽셀: 0개 (!)
```
- **이전 "95%→0%" 주장**: Band 1만 측정한 수치. 실제 가시적 문제는 Band 4-7의 불투명 흰색

#### premultiply alpha (부분 해결만)
```python
def premultiply_edge(arr, alpha_threshold=230):
    result = arr.copy().astype(np.float32)
    alpha = result[:,:,3]
    mask = (alpha > 0) & (alpha < alpha_threshold)
    for c in range(3):
        result[:,:,c][mask] = result[:,:,c][mask] * (alpha[mask] / 255.0)
    return result.astype(np.uint8)
```
- Band 1-2 (반투명 halo)만 해결
- Band 4-7 (불투명 흰색, alpha=255)은 대상이 아님

### 올바른 해결 → v5 파이프라인으로 확정 (2026-02-25)

**해결법**: clean ref (IP-Adapter 없이 생성) + 프롬프트 `thick outline, bold lineart` 제거

**v5 배치 결과 (6캐릭터 × 3방향 = 18장)**:
```
                    불투명흰   반투명흰   비흰색    Avg RGB
OLD front:          37.4%    62.6%    0.0%    (252,249,247)
CLEAN front:         0.0%     0.0%  100.0%    (55,45,41)
OLD back:           36.8%    63.2%    0.1%    (249,246,242)
CLEAN back:          0.0%     0.0%  100.0%    (51,43,39)
CLEAN left:          0.0%     0.0%  100.0%    (32,30,27)
```
- **전원 흰 아웃라인 0%** — premultiply/erode/color-replace 전부 불필요
- 악세서리 문제도 개선: c03 헤드폰 back ✅, c07 리본 back ✅, c08 앞치마끈 ✅

**v5 파이프라인 구조**:
- Phase 1: `--gen-refs` → clean ref 생성 (IP-Adapter 없이, Rembg 없이)
- Phase 2: clean ref를 IP-Adapter input으로 → front/back/left 생성
- 출력: `ComfyUI/output/v5/refs/` + `v5/final/`
- ComfyUI 저장: `v5_clean_ref_pipeline.json`, `v5_front_left_pipeline.json`, `v5_back_pipeline.json`
- 배치 스크립트: `scripts/batch-chibi-directions.py` v5

---

## 9. 오피스 타일셋 AI 생성 탐색 (2026-02-26)

**목표**: 2D 메타버스 오피스 맵의 가구/바닥/벽 타일셋을 ComfyUI로 생성
**참조**: ZEP 실제 오피스맵 (세미 탑다운, 일러스트 스타일, 웜 베이지/그레이 톤)

### 테스트 결과

| 모델 | 오브젝트 품질 | 캐릭터 매칭 | 판정 |
|------|------------|-----------|------|
| Animagine XL (첫 시도) | 실패 (추상/줄무늬) | - | "floor texture" 프롬프트 이해 못함 |
| DreamShaper 8 (isometric) | 좋음 (책상/소파/커피테이블) | 스타일 다름 (사실적) | 의자/프린터는 사진 느낌 |
| DreamShaper 8 (top-down) | 변화 미미 | 스타일 다름 | "top-down view" 잘 안 먹힘 |
| CartoonStyleClassic v1 | 좋음 (셀셰이딩, 플랫컬러) | 서양 카툰 ≠ 애니메 치비 | 오브젝트 단독은 우수하나 스타일 불일치 |
| Animagine XL (no humans) | 실패 (클로즈업/추상) | 완벽 (같은 모델) | 오브젝트 단독 생성 능력 없음 |

### 핵심 발견
1. **Animagine XL은 캐릭터 극도 특화 → 오브젝트/배경 생성 불가**
2. **DreamShaper 8은 범용이지만 사실적 경향 → 애니메 치비 캐릭터와 스타일 불일치**
3. **CartoonStyleClassic은 서양 카툰 → 일본 애니메 치비와 어울리지 않음**
4. **캐릭터와 환경이 같은 스타일인 모델이 존재하지 않음** (현재 설치 모델 기준)
5. **"isometric"은 45도 측면, ZEP은 3/4 탑다운** — 프롬프트에 "isometric" 사용 금지

### 최종 결론
- AI로 타일맵(바닥/벽) 생성은 불필요 → **프로시저럴 코드 색상 교체**로 해결 (ZEP 스타일 웜 팔레트)
- 가구/오브젝트는 미해결 — DreamShaper 축소 시 차이 줄어들 수 있음, 추후 검토
- CartoonStyleClassic 체크포인트 설치됨: `CartoonStyleClassic_v1.safetensors`

## 10. Flux 2 Klein 4B 오피스 오브젝트 생성 (2026-02-27)

**목표**: 섹션 9에서 미해결된 가구/오브젝트 생성 — Flux 2 Klein 4B로 재시도
**배경**: Animagine XL/DreamShaper/CartoonStyleClassic 전부 스타일 매칭 실패

### 모델 스택
| 모델 | 용도 | 파일 | 위치 |
|------|------|------|------|
| Flux 2 Klein 4B FP8 | 디퓨전 모델 | `flux-2-klein-4b-fp8.safetensors` | `diffusion_models/` |
| Qwen 3 4B | 텍스트 인코더 | `qwen_3_4b.safetensors` | `text_encoders/` |
| Flux 2 VAE | VAE | `flux2-vae.safetensors` | `vae/` |

### 워크플로우 구성 (API 포맷)
```
UNETLoader(flux-2-klein-4b-fp8, default) → MODEL
CLIPLoader(qwen_3_4b, type=flux2) → CLIP
VAELoader(flux2-vae) → VAE
CLIPTextEncode(prompt) → CONDITIONING
FluxGuidance(guidance=3.5) → CONDITIONING
CLIPTextEncode("") → NEG CONDITIONING
EmptyLatentImage(512x512) → LATENT
KSampler(steps=4, cfg=1, euler, simple) → SAMPLES
VAEDecode → IMAGE
SaveImage
```

**주의사항**:
- `CheckpointLoaderSimple`로 로드하면 CLIP=None 에러 (FP8에 텍스트 인코더 미포함)
- Flux 1용 T5-XXL(4096d) 사용 시 차원 불일치 에러 (Klein 4B는 Qwen 3 4B 필요)
- Mistral 인코더(15360d)는 9B용, 4B는 Qwen(7680d) 사용
- 모델은 반드시 `diffusion_models/` 폴더에서 `UNETLoader`로 로드

### 테스트 결과 (7종 오브젝트)

| 오브젝트 | 프롬프트 핵심 | 결과 | 판정 |
|---------|------------|------|------|
| 책상+모니터 | wooden office desk with computer monitor, keyboard | 깔끔한 아이소메트릭, 웜 베이지 | 채택 |
| 의자 | rolling office chair with orange cushion | 주황 오피스 체어, 정확한 형태 | 채택 |
| 책장 | tall wooden bookshelf filled with colorful books | 플랫 일러스트, 컬러풀 책 | 채택 |
| 소파 | modern gray sofa couch with cushions | 깔끔한 라인, 그레이 톤 | 채택 |
| 화분 | green potted plant, monstera, brown ceramic pot | 몬스테라, 테라코타 화분 | 채택 |
| 정수기 | water cooler dispenser, office | 형태 정확, 아이소메트릭 | 채택 (이전 DreamShaper 실패 → 성공) |
| 화이트보드 | office whiteboard on a stand with diagrams | 다이어그램 포함, 스탠드 | 채택 |

### 공통 프롬프트 구조
```
[오브젝트 설명], 2d flat illustration, top-down 3/4 view, clean lines, soft shadows, warm tones, game asset, white background, no people
```

### 핵심 발견
1. **Flux 2 Klein 4B가 오피스 오브젝트에 최적** — 7/7 전부 채택
2. **일관된 플랫 일러스트 스타일** — 오브젝트 간 톤/시점 통일됨
3. **4 steps, ~7초/장** — distilled 모델이라 초고속
4. **ZEP 레퍼런스에 가장 근접** — DreamShaper(사실적)/CartoonStyleClassic(서양카툰)과 차원이 다른 프롬프트 준수율
5. **다음 단계**: 방향(시점 각도) 제어 + Rembg 배경 제거 → 게임 오브젝트로 배치

---

## 11. Flux 2 Klein 4B 정면 시점 오브젝트 생성 (2026-02-27)

**목표**: 섹션 10의 아이소메트릭(3/4 view) → 정면(front view) 시점 전환
**배경**: ZEP 스타일은 정면 약간 위 시점 (앞면 주체, 윗면 살짝)

### 프롬프트 변경
```
이전: [오브젝트], 2d flat illustration, top-down 3/4 view, clean lines, ...
변경: [오브젝트], straight front view, no perspective, no angle, flat 2d game sprite, facing viewer directly, 2d flat illustration, clean lines, soft shadows, warm beige tones, muted colors, game asset, white background, no people
```

### 핵심 변경 키워드
- `top-down 3/4 view` → `straight front view, no perspective, no angle, facing viewer directly`
- `warm tones` → `warm beige tones, muted colors` (아이소메트릭 버전 색감 매칭)

### 테스트 결과 (7종, seed=42)

| 오브젝트 | 시점 | 톤 | 판정 |
|---------|------|-----|------|
| 책상+모니터 | 정면 | 베이지 | 채택 |
| 의자 | 정면 | 주황+베이지 | 채택 |
| 책장 | 정면 | 베이지+컬러풀 책 | 채택 |
| 소파 | 정면 | 그레이+베이지 쿠션 | 채택 |
| 화분 | 정면 | 그린+테라코타 | 채택 |
| 정수기 | 정면 | 베이지 | 채택 |
| 화이트보드 | 정면 | 베이지+다이어그램 | 채택 |

### 핵심 발견
1. **프롬프트만으로 시점 제어 가능** — ControlNet 불필요, Flux 2 Klein 프롬프트 준수율 우수
2. **7/7 채택** — 정면 시점에서도 일관된 플랫 일러스트 스타일 유지
3. **출력 위치**: `ComfyUI/output/front_beige_desk_00001_.png` 등 `front_*` prefix

---

## 12. Flux 2 Klein 타일맵 타일 생성 + Rembg 배경 제거 (2026-02-27)

**목표**: 바닥 타일(나무/카펫) + 벽 타일 생성, 오브젝트 7종 배경 제거

### 타일 생성 결과 (3종)

| 타일 | 프롬프트 핵심 | 결과 | 판정 |
|------|------------|------|------|
| 나무 바닥 | wooden office floor tile, light oak wood planks, top-down view, bird eye view, seamless tileable | 밝은 오크 플랭크, 탑다운 | 채택 (사실적 텍스처, 오브젝트와 스타일 차이 있을 수 있음) |
| 카펫 바닥 | office carpet floor tile, light gray carpet texture, top-down view | 라이트 그레이 미세 질감, 거의 단색 | 채택 |
| 벽 | office wall, beige wall with white baseboard, straight front view | 베이지 벽 + 하단 걸레받이 | 채택 |

### Rembg 배경 제거 (7종)
- 모든 오브젝트 InspyrenetRembg 처리 → 투명 배경 PNG
- 출력: `ComfyUI/output/rembg_*_00001_.png`
- 결과: `public/assets/objects/` 에 복사 완료
- 품질: 깔끔한 배경 제거, 별도 후처리 불필요

### 게임 적용 (코드)
- `tileset-generator.ts`: AI 타일을 프로시저럴 타일셋 캔버스에 32x32 스케일 오버레이
- `main-scene.ts`: preload()에서 타일+가구 이미지 로드, initFurniture()로 Phaser Image 배치
- `map-data.ts`: 영역별 바닥(나무/카펫) + 벽(상단/좌우/파티션)

### Y-sorting 시도 → 롤백
- depth=Y 기반 깊이 정렬 시도했으나 잘못된 이해로 구현 실패
- 사용자 피드백: ZEP 레퍼런스와 다름 → 전부 롤백
- **미해결**: 가구-캐릭터 간 올바른 전후 관계(앉은 느낌) 구현 필요

---

## 13. 4방향 오브젝트 에셋 생성 시도 (2026-02-27)

**목표**: 7종 오브젝트의 front+back(+left/right) 에셋 생성
**결정**: front + back만 사용 (left/right 폐기)

### 방향별 프롬프트
```
front: [오브젝트], straight front view, no perspective, no angle, facing viewer directly, 2d flat illustration, clean lines, soft shadows, warm beige tones, muted colors, game asset, white background, no people
back: [오브젝트], back view, rear view, seen from behind, 2d flat illustration, clean lines, soft shadows, warm beige tones, muted colors, game asset, white background, no people
```

### 1차 배치 결과 (21장: 7종 × back/left/right)

| 오브젝트 | back | left | right | 판정 |
|---------|------|------|-------|------|
| 책상 | 모니터 정면 보임 (후면 아님) | 모니터 2개 (비정상) | 측면 OK | back 실패 |
| 의자 | 후면 OK | 측면 OK | - | 채택 |
| 책장 | 책 보임 (정면) | - | - | back 실패 |
| 소파 | 등받이 뒷면 OK | 정면으로 나옴 | - | back 채택 |
| 화분 | 약간 다른 각도 | 측면 OK | - | back 채택 |
| 정수기 | 뒷판 OK | - | - | back 채택 |
| 화이트보드 | 내용 보임 | 약간 각도 | - | back 실패 |

### left/right 폐기 결정
- 사용자: "오브젝트는 정면과 후면만 사용하도록 해"
- 게임에서 오브젝트 배치 시 front/back 선택으로 충분

### 2차: Rembg + 저장

**채택 (5종):**
| 오브젝트 | front | back | 비고 |
|---------|-------|------|------|
| 의자 | 신규 세트 (chair_front.png) | 신규 세트 (chair_back.png) | 매칭 세트 |
| 소파 | 기존 (sofa.png) | 신규 (sofa_back.png) | OK |
| 화이트보드 | 기존 (whiteboard.png) | 신규 (whiteboard_back.png) | 프롬프트 보강: "plain back panel, no writing visible" |
| 화분 | 기존 (plant.png) | 신규 (plant_back.png) | 대칭이라 차이 미미 |
| 정수기 | 기존 (watercooler.png) | 신규 (watercooler_back.png) | OK |

**기각 (2종):**
| 오브젝트 | 문제 | 비고 |
|---------|------|------|
| 책상 | back 각도가 기존 front와 불일치 | 프롬프트 보강했으나 여전히 미스매치 |
| 책장 | 동일 | 재생성 필요 |

### 핵심 발견
1. **Flux 2 Klein back view 프롬프트**: `back view, rear view, seen from behind` + 구체적 설명 (`no screen visible`, `plain back panel`) 필요
2. **같은 seed라도 프롬프트 다르면 디자인 달라짐**: front/back 매칭 시 기존 front와 스타일/각도 불일치 발생
3. **매칭 세트로 뽑는 게 안전**: 의자처럼 front+back을 같은 배치에서 생성하면 일관성 보장
4. **기존 front에 back만 추가할 때**: 각도/비율/디테일 차이 주의 — 신규 세트가 더 나을 수 있음

---

## 14. 책상+책장 매칭 세트 재생성 (2026-02-27)

**목표**: 섹션 13에서 기각된 책상/책장의 front+back 매칭 세트 재생성
**배경**: 기존 front와 back 각도/스타일 불일치 → front+back 동시 생성으로 해결

### 워크플로우 (섹션 10과 동일, 수정사항 포함)
```
UNETLoader(flux-2-klein-4b-fp8, default) → MODEL
CLIPLoader(qwen_3_4b, type=flux2) → CLIP
VAELoader(flux2-vae) → VAE
CLIPTextEncode(prompt) → CONDITIONING
FluxGuidance(guidance=3.5) → CONDITIONING  ← 이전 시도에서 누락했던 노드
CLIPTextEncode("") → NEG CONDITIONING
EmptyLatentImage(512x512) → LATENT
KSampler(steps=4, cfg=1, euler, simple) → SAMPLES  ← steps=4 (distilled)
VAEDecode → IMAGE
InspyrenetRembg → IMAGE (투명 배경)
SaveImage
```

**저장된 워크플로우**: `flux2-klein-object-generator.json` (ComfyUI user library)

### 1차 시도 실패 (v1, v2)
| 버전 | 문제 | 출력 위치 |
|------|------|----------|
| v1 (set_*) | FluxGuidance 누락 + steps=20 | `output/objects/v1_wrong_params/` |
| v2 (set_desk_back_v2*) | FluxGuidance 누락 + steps=20 | `output/objects/v2_wrong_steps/` |

### 2차 시도 성공 (v3) — 올바른 파라미터 복원
프롬프트:
```
front: [오브젝트], straight front view, no perspective, no angle, flat 2d game sprite, facing viewer directly, 2d flat illustration, clean lines, soft shadows, warm beige tones, muted colors, game asset, white background, no people
back: back of [오브젝트], [구체적 후면 설명], back view, rear view, seen from behind, 2d flat illustration, clean lines, soft shadows, warm beige tones, muted colors, game asset, white background, no people
```

### 책상 결과 (seed 42/100/777)
| seed | front | back | Rembg | 판정 |
|------|-------|------|-------|------|
| 42 | 깔끔 | **책상 본체 Rembg 제거됨** (옅은 색 → 배경 혼동) | 실패 | 탈락 |
| 100 | 깔끔 | **책상 본체 Rembg 제거됨** | 실패 | 탈락 |
| **777** | 깔끔 | **책상+모니터 뒷면 전체 보존** | 성공 | **채택** |

### 책장 결과 (seed 42/100/777)
| seed | front | back | Rembg | 판정 |
|------|-------|------|-------|------|
| 42 | 4단 컬러풀 | 나무 뒷판 | 깔끔 | 양호 |
| 100 | 5단 | 나무 뒷판 (테두리 돌출) | 깔끔 | 양호 |
| **777** | 5단 라인 뚜렷 | 나무 뒷판 깔끔 | 깔끔 | **채택** |

### 최종 저장
```
public/assets/objects/
├── desk.png (v3 s777 front) / desk_back.png (v3 s777 back)
└── bookshelf.png (v3 s777 front) / bookshelf_back.png (v3 s777 back)
```

파일명 규칙: `{name}.png` = front, `{name}_back.png` = back

### 핵심 발견
1. **FluxGuidance 노드 필수**: 없으면 steps=20에서도 품질/스타일 차이 발생
2. **Rembg가 옅은 색 오브젝트를 배경으로 오인**: 책상 back의 옅은 나무 상판이 seed 42/100에서 제거됨. seed 777은 더 진한 톤으로 생성되어 생존
3. **seed 777이 Rembg 호환 최적**: 3 seed 테스트에서 유일하게 desk back 전체 보존
4. **ComfyUI output 폴더 관리**: `output/objects/{version}/{object}/` 구조로 정리 필수

---

## 15. Flux 2 Klein ReferenceLatent 시점 전환 테스트 (2026-03-01)

**목표**: front 이미지를 ReferenceLatent에 넣고 back 프롬프트로 생성 → 시점 전환 가능 여부 확인
**배경**: Klein은 Redux/Fill/Kontext를 단일 모델에 통합, `ReferenceLatent` 노드로 이미지 조건부 생성 네이티브 지원

### 워크플로우
```
UNETLoader(flux-2-klein-4b-fp8) → MODEL
CLIPLoader(qwen_3_4b, flux2) → CLIP
VAELoader(flux2-vae) → VAE
LoadImage(desk_front_ref.png) → IMAGE
VAEEncode(IMAGE, VAE) → LATENT(ref)
CLIPTextEncode(back prompt) → CONDITIONING
FluxGuidance(3.5) → CONDITIONING
ReferenceLatent(CONDITIONING, LATENT(ref)) → CONDITIONING(with ref)
CLIPTextEncode("") → NEG
EmptyLatentImage(512x512) → LATENT(noise)
KSampler(steps=4, cfg=1, euler, simple) → SAMPLES
VAEDecode → InspyrenetRembg → SaveImage
```

### 테스트 1: 기본 back 프롬프트 (seed=777)
- **프롬프트**: `back view of this wooden office desk with computer monitor, rear view, seen from behind, showing monitor back panel with cables, wooden desk back panel, ...`
- **결과**: 모니터 뒷면 디테일 OK, 책상도 살아있음. **스타일/색감/비율이 front와 일치**
- **문제점**: 모니터 케이블 선이 불필요, 책상 본체가 front 구도 그대로 (하단부가 뚫린 평면이어야 하는데 전면 그대로)
- **판정**: 부분 성공 — 스타일 전달은 됐으나 구조적 시점 전환 불충분

### 테스트 2: 프롬프트 보강 — 케이블 제거 + 책상 후면 구조 명시 (seed 42/100/777)
- **프롬프트**: `...no cables, no wires, desk back is a flat wooden panel with open bottom legs, simple clean back...`
- **결과**: **3장 모두 front 모습 그대로** — 프롬프트 무시됨
- **판정**: **실패** — ReferenceLatent이 front 구도를 너무 강하게 보존, back 프롬프트가 씹힘

### 결론
- **ReferenceLatent은 시점 전환(front→back) 불가** — 구도 보존이 본질이라 방향 변경을 저항
- 치비 캐릭터의 IP-Adapter 한계와 동일 패턴: 참조 이미지 조건부 시스템은 구도를 잠금
- **스타일/색감 전달에는 유효** — 첫 테스트에서 front와 동일한 톤/비율 확인
- **추가 조사 (2026-03-02)**: 소스코드 확인 결과 **ReferenceLatent는 튜닝 파라미터 자체가 없음**
  - `nodes_edit_model.py`: reference_latents를 conditioning dict에 append하는 것이 전부
  - `flux/model.py`: noisy latent과 직접 concatenation (gating/weighting 없음)
  - FluxGuidance는 텍스트 프롬프트에만 영향, reference latent과 독립
  - Klein Enhancer는 **9B 전용** (Qwen3 8B 텐서 형태 의존, 4B 호환 불가)
  - 대안 평가: Kontext Dev GGUF Q4 (~10GB VRAM, 스타일 불일치 리스크), MV-Adapter I2MV (14GB VRAM 초과), Zero123++ (SD 2.1 품질 저하)
  - **결론**: Klein 프롬프트-only 방식이 12GB VRAM 환경에서 최선. 이 방향 조사 종결

### 출력 위치
- `output/reftest_desk_back_00001_.png` (테스트 1)
- `output/reftest_desk_back_v2_00001_.png`, `v2s42`, `v2s100` (테스트 2)

---

## 16. 3D 복원을 통한 front→back 시점 전환 (2026-03-03)

> **목표**: 2D front 이미지 → 3D 메시 복원 → back view 렌더. 깊이 일관성 확보.

### 테스트 1: Hunyuan3D v2 native (ComfyUI 내장)
- **워크플로우**: LoadImage → ImageOnlyCheckpointLoader(hunyuan3d-dit-v2-0-fp16) → CLIPVisionEncode → Hunyuan3Dv2Conditioning → KSampler(steps=30, cfg=1, euler, simple) → VAEDecodeHunyuan3D → VoxelToMesh → SaveGLB
- **입력**: desk_front.png (Rembg 처리된 투명 배경)
- **결과**: 388K vertices, 900K triangles. 형태 인식 가능 (책상+모니터)
- **문제**: **텍스처 완전히 없음** (회색 크롬 덩어리). geometry-only 모델
- **판정**: 형상 OK, 텍스처 없어서 게임용 불가
- **출력**: `output/mesh/desk_3d_00001_.glb` (15MB)

### 테스트 2: SV3D (sv3d_p.safetensors, 이미 설치됨)
- **워크플로우**: LoadImage → ImageOnlyCheckpointLoader(sv3d_p) → SV3D_BatchSchedule(batch=21, 0°→180°→360°) → KSampler(steps=25, cfg=3) → VAEDecode → SaveImage
- **결과**: 21프레임 orbital view 생성, 색감 유지됨 (베이지 책상)
- **문제**: back view(프레임 #10, 180°)에서 **모니터가 여전히 화면 보임** — 뒤로 안 돌아감. 전체적으로 흐릿. 사용자 지적: 앞면과 뒷면이 동일하게 파여있어 깊이 모순
- **판정**: 2D flat illustration 입력에서 3D 시점 전환 불충분
- **출력**: `output/sv3d_desk_00001_~00021_.png`

### 테스트 3: Kijai ComfyUI-Hunyuan3DWrapper (신규 설치)
- **설치**: `custom_nodes/ComfyUI-Hunyuan3DWrapper` + pymeshlab + custom_rasterizer wheel
- **워크플로우**: Hy3DModelLoader → Hy3DGenerateMesh(guidance=5.5, steps=30, seed=42) → Hy3DVAEDecode(octree=384) → Hy3DPostprocessMesh(max_facenum=50000) → Hy3DExportMesh(glb)
- **결과**: 25K vertices, 50K triangles. **형상 매우 우수**
  - 정면: 모니터 화면 + 키보드 + 다리 사이 빈 공간 (오목)
  - **후면: 모니터 뒷판(평면) + 책상 뒷판(막혀있음, 볼록) — 깊이 모순 해결!**
- **문제**: 텍스처 없음 (vertex color만, 거의 흰색/회색). 렌더 노드(Hy3DRenderSingleView/NvdiffrastRenderer)는 custom_rasterizer DLL 호환 불가 + nvdiffrast 미설치로 실패
- **우회**: Open3D Visualizer(visible=False)로 Python 렌더 성공 (`scripts/render-back-view.py`)
- **판정**: **3D 기하학은 성공** — 다음 단계는 텍스처 추가 (Hy3DPaintModel 또는 Klein depth guide)
- **출력**: `output/3D/desk_kijai_00001_.glb` (900KB), `output/3D/desk_kijai_front.png`, `output/3D/desk_kijai_back.png`

### 핵심 발견
- **깊이 일관성은 진짜 3D 복원만 보장**: 2D 모델(Klein/SV3D)은 앞뒷면 깊이 모순 발생. Hunyuan3D는 물리적으로 일관된 3D 볼륨 생성
- **Kijai wrapper >> ComfyUI native**: 동일 모델이지만 postprocessing (floater 제거, face 축소, degenerate 정리)으로 품질 차이 큼
- **렌더러 의존성 문제**: custom_rasterizer(PyTorch 2.10 헤더 std 충돌 C2872) + nvdiffrast(**빌드 성공, 동작 확인**)
- **nvdiffrast 설치 과정**: CUDA Toolkit 13.1(winget) + VS Build Tools 2022 + `--allow-unsupported-compiler` + `DISTUTILS_USE_SDK=1`. utils3d는 GitHub 최신(1.6) + Kijai utils.py 패치 필요 (`utils3d.torch.extrinsics_look_at` → `utils3d.extrinsics_look_at(eye=, look_at=, up=)`, `intrinsics_from_fov_xy` → `intrinsics_from_fov(fov_x=, fov_y=)`)
- **Hy3DNvdiffrastRenderer 동작 확인**: vertex_colors front/back 렌더 성공 (`output/nvdiffrast_front_00001_.png`, `nvdiffrast_back_00001_.png`)
- **Hy3DRenderMultiView는 custom_rasterizer 의존**: paint 파이프라인(멀티뷰 렌더→텍스처 생성→베이킹) 차단

### custom_rasterizer 빌드 성공 (2026-03-04)
- **원인**: PyTorch 2.10 `compiled_autograd.h:1135`의 `std` 충돌 — CUDAExtension 컴파일 시 `USE_CUDA` 매크로 미정의로 Windows 가드 비활성화
- **해결**: `setup.py`에 `define_macros=[('USE_CUDA', None)]` 추가 → Windows 가드 활성화 → 문제 헤더 스킵
- **빌드 bat**: `C:\Users\User\build_custom_rasterizer_vs2022.bat` (VS 2022 + CUDA 13.1)

### 테스트 4: Paint 모델 전체 파이프라인 (2026-03-04)
- **워크플로우**: LoadMesh → UVWrap → RenderMultiView(1024, camera 6뷰) → PaintModel(turbo) → SampleMultiView(512, steps=15) → BakeFromMultiview → ApplyTexture → ExportGLB
- **입력**: `desk_kijai_00001_.glb` (geometry-only) + `desk_front.png` (ref)
- **Paint 모델**: `hunyuan3d-paint-v2-0-turbo` (HuggingFace 자동 다운로드)
- **핵심 발견**: UV 없는 메시 → `Hy3DMeshUVWrap` 필수 (없으면 BakeFromMultiview에서 `vtx_uv is None` 에러)
- **멀티뷰 결과**: 6장 (`hy3d_paint_multiview_00001~06_.png`), front/back/side/top 모두 일관된 텍스처
- **베이킹 결과**: UV 텍스처 맵 성공 (`hy3d_baked_texture_00001_.png`, 447KB)
- **최종 렌더**: front=모니터+키보드+책상, back=모니터 뒷판+책상 뒤 — **깊이 일관성 완벽**
- **출력**: `output/3D/desk_textured_00001_.glb` (1.6MB)
- **판정**: **기술적 PoC 성공, 게임용 품질 미달**
  - 파이프라인은 end-to-end 동작 확인
  - 그러나 3D 메시 품질이 부실 (다리 뭉뚱, 박스형 단순화) → paint가 아무리 좋아도 디테일 한계
  - Rembg가 옅은 나무색을 배경으로 오인 → 오브젝트 반투명화
  - turbo(512/15steps) > v2(1024/30steps) — 비직관적이나 turbo가 색감 유지에 우수
  - Klein 직접 생성 대비 모든 면에서 열세 (디테일, 스타일 일관성, 생성 속도, Rembg 호환)
  - **결론**: 현재 Klein 파이프라인 유지. 3D 파이프라인은 참고용 PoC로만 보존

### 참고: Hunyuan3D Paint 파이프라인 (PoC)
```
[1] Hy3DLoadMesh → GLB 경로
[1b] Hy3DMeshUVWrap → UV 생성 (필수!)
[9] Hy3DCameraConfig → 기본 6뷰 (0/90/180/270/top/bottom)
[2] Hy3DRenderMultiView → normal/position maps + renderer (1024x1024)
[3] DownloadAndLoadHy3DPaintModel → turbo (15 steps)
[4] LoadImage → ref (front 이미지)
[5] Hy3DSampleMultiView → 6뷰 텍스처 이미지 (512, seed=42)
[6] Hy3DBakeFromMultiview → UV 텍스처 맵
[7] Hy3DApplyTexture → 텍스처 적용 (renderer from [6])
[8] Hy3DExportMesh → GLB 내보내기
```
연결: 1→1b→2, 9→2/5/6, 3→5, 4→5, 2(normals)→5, 2(positions)→5, 5→6, 2(renderer)→6, 6(texture)→7, 6(renderer)→7, 7→8
