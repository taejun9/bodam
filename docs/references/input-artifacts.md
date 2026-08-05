# 입력 아티팩트 기록

## 계약조회(장기)_test.xlsx

- 제공자: 사용자
- 제공일: 2026-08-05
- 파일 크기: 8,277 bytes
- SHA-256: 6f55b17726cbe939c138a07f3797309e11ac97ec76c67d597da4328c38ce4210
- 목적: BODAM Excel import/export 기준 양식 분석
- 처리: 읽기 전용
- repository 포함: 금지
- 문서화 범위: sheet명, 사용 범위, header, 열 순서, cell type, number format, 병합과 시각 구조
- 문서화 금지: 실제 행 값, 고객 식별 정보, 연락처, 주소, 메모

구조 분석 결과는 docs/architecture/import-export.md에 기록한다. 구현 test에는 이 파일을 복사하지 않고 동일 계약의 synthetic workbook을 사용한다.

## 구조 확인 결과

- sheet 1개
- sheet명: 계약조회(엑셀변환)_장기
- sample 범위: A1:U19
- header 1행, sample data 18행, 21열
- 병합·수식·chart·Excel Table 없음
- 모든 채워진 cell은 텍스트
- 시각 렌더로 전체 sheet 확인

실제 cell 값은 이 기록에 포함하지 않았다.
