# Inventory Dashboard Deployment Guide

이 프로젝트는 Vite 기반 정적 웹앱이며, 모델 결과는 `src/data/modelSnapshot.ts`에 포함된 스냅샷을 사용합니다.

## 1) 로컬 실행

사전 준비:
- Node.js
- Python 3 (모델 스냅샷 재생성 시)

명령:
```bash
npm install
npm run dev
```

## 2) 모델 데이터 갱신 (배포 전 권장)

아래 명령으로 최신 `coverage_inventory_model_results_latest.xlsx`를 읽어
`src/data/modelSnapshot.ts`를 재생성합니다.

```bash
npm run sync:model-data
```

옵션:
- `--input "/path/to/coverage_inventory_model_results_latest.xlsx"`  
  (기본값: `/Users/leesiwon/Desktop/Final Project/coverage_inventory_model_results_latest.xlsx`)
- `--service-level 0.98` (기본값 0.98)
- `--output src/data/modelSnapshot.ts` (기본값 동일)

## 3) 프로덕션 빌드

```bash
npm run build
```

빌드 결과물은 `dist/`에 생성됩니다.

## 4) Vercel 배포

`vercel.json`이 포함되어 있어 바로 배포 가능합니다.

1. Git 저장소에 코드 푸시
2. Vercel에서 해당 저장소 Import
3. Framework: Vite (자동 인식)
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Deploy

## 데이터 연동 방식

- 배포된 사이트는 `src/data/modelSnapshot.ts`의 값을 사용합니다.
- 즉, 데이터 파일이 바뀌면 **배포 전 스냅샷 재생성 + 재배포**가 필요합니다.
