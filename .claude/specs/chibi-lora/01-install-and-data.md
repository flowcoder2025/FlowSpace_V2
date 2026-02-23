# Phase 1~2: kohya_ss 설치 + 학습 데이터 준비

> Epic: [치비 LoRA 학습](./README.md)
> 상태: 완료 | 업데이트: 2026-02-22

## Phase 1: kohya_ss 설치

### 환경
- **위치**: `C:\Users\User\sd-scripts\`
- **Python**: 3.12.10 (venv)
- **PyTorch**: 2.6.0+cu124
- **xformers**: 0.0.29.post3
- **accelerate**: fp16 설정
- **GPU**: RTX 4070 12GB, CUDA: True

### 주의사항
- xformers는 반드시 `--index-url cu124`에서 설치 (기본 PyPI는 CPU torch 끌고옴)
- `PYTHONUTF8=1` 환경변수 필수 (Windows cp949 인코딩 오류 방지)

## Phase 2: 학습 데이터

### 학습 데이터 (35장)
- **소스**: ComfyUI 261개 치비 프레임에서 품질 점수 기반 선별
- **방향별 분포**: down 9, left 8, right 9, up 9
- **해상도**: 1024x1024
- **캡셔닝**: WD14 Tagger (SmilingWolf/wd-swinv2-tagger-v3) + 트리거워드 `flowspace_chibi`
- **위치**: `train_data/chibi_sprites/10_flowspace_chibi/` (10 repeats)

### 정규화 데이터 (140장)
- **소스**: Animagine XL 3.1 순수 생성 (LoRA 없이)
- **해상도**: 1024x1024
- **캡셔닝**: 15종 프롬프트 순환 (chibi + 다양한 복장/포즈)
- **위치**: `ComfyUI/output/reg/1_chibi/` (1 repeat)

## 변경된 파일
없음 (sd-scripts 디렉토리는 프로젝트 외부)
