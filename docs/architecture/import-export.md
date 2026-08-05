# Excel / CSV Import·Export 계약

## 상태

첨부 workbook을 읽기 전용으로 분석한 기준 계약이다. 라이브러리, 영구 field mapping, duplicate와 partial success 정책은 아직 승인되지 않았다.

## 기준 workbook

- 파일 표기명: 계약조회(장기)_test.xlsx
- 원본 처리: 수정·덮어쓰기·repository 복사 금지
- sheet: 계약조회(엑셀변환)_장기
- sample 사용 범위: A1:U19
- 구성: header 1행 + sample data 18행
- column 수: 21

sample row 수를 export 고정 크기로 해석하지 않는다.

## Header 계약

열 순서와 표기를 그대로 유지한다.

| 열 | header |
|---|---|
| A | No |
| B | 수금반영일 |
| C | 소속 |
| D | 담당자 |
| E | 수금인코드 |
| F | 계약 |
| G | 보험사 |
| H | 상품명 |
| I | 증권번호 |
| J | 계약일자 |
| K | 상태 |
| L | 최종납월 |
| M | 납입회차 |
| N | 납입보험료 |
| O | 계약자 |
| P | 피보험자 |
| Q | 보험시기 |
| R | 보험종기 |
| S | 수금방법 |
| T | 납기 |
| U | 원모집자명 |

## 관찰된 cell 계약

- 채워진 cell은 모두 OOXML shared string, 즉 텍스트다.
- sample의 채워진 cell 수는 374개다.
- 값은 비어 있지만 style이 적용된 cell은 25개다.
- 수식은 없다.
- 수금반영일, 계약일자, 보험시기, 보험종기는 YYYY-MM-DD 모양의 텍스트다.
- 최종납월은 YYYYMM 모양의 텍스트다.
- 납입회차와 납입보험료도 숫자 cell이 아니라 텍스트다.
- 수금인코드와 증권번호는 숫자·영숫자·하이픈이 가능하므로 숫자로 변환하지 않는다.
- 빈 피보험자와 빈 보험종기가 관찰되었다.
- sample의 수금방법 열은 비어 있지만 이를 항상 비어 있는 필드로 단정하지 않는다.

import parser는 원본 text를 먼저 보존하고, 내부 typed value는 field mapping 단계에서 별도로 만든다. export는 식별자의 앞자리 0, 긴 문자열, 하이픈과 빈칸을 보존해야 한다.

macOS와 Windows 사이 한글 조합 차이 때문에 sheet명과 header를 비교할 때 Unicode NFC로 정규화하되, export 표기는 기준 header를 그대로 사용한다.

## 관찰된 표시 형식

- 기본 font: Calibri 11
- 모든 열 너비: 약 8.85156
- sheet 기본 행 높이: 15
- 사용 행 1:19 높이: 약 13.55
- 배경: 흰색
- header: 중앙 정렬, 얇은 검정 테두리
- 첫 data row: General 정렬, 줄바꿈 없음, 상단 검정 테두리와 나머지 얇은 빨강 테두리
- 나머지 body: General 정렬, 줄바꿈 없음, 얇은 빨강 테두리
- 병합 cell 없음
- filter와 freeze pane 없음
- chart, shape, conditional formatting 없음
- Excel Table object 없음

동일 형식 export의 기본 의미는 sheet명, 21개 header와 순서, text cell 계약, 빈 cell, 위 표시 형식을 재현하는 것이다. OOXML byte-for-byte 동일성은 목표가 아니다.

## Domain Mapping 상태

확정과 후보를 구분한다.

| Excel header | BODAM 후보 | 상태 |
|---|---|---|
| 보험사 | Insurance.보험사 | 명시 요구와 일치 |
| 상품명 | Insurance.상품명 | 명시 요구와 일치 |
| 계약일자 | Insurance.가입일 후보 | 용어 차이 승인 필요 |
| 보험시기 | Insurance.가입일 후보 | 계약일자와 우선순위 승인 필요 |
| 납입보험료 | Insurance.월 보험료 후보 | 금액 의미 승인 필요 |
| 보험종기 | Insurance.만기일 후보 | 빈 값·종신 처리 승인 필요 |
| 납기 | Insurance.납입기간 후보 | 단위와 표현 승인 필요 |
| 상태 | 계약 상태 후보 | 허용 값 승인 필요 |
| 계약자 | Customer 관계 후보 | 계약자 model 미정 |
| 피보험자 | Customer 관계 후보 | 빈 값과 복수 관계 미정 |
| No | export 순번 후보 | 저장 여부 미정 |
| 나머지 열 | 현재 명시 model에 직접 대응 없음 | 보관·파생·제외 결정 필요 |

현재 model에 없는 열을 raw JSON으로 전부 저장하거나 조용히 버리지 않는다. 동일 형식 다운로드에 필요한 값의 source를 mapping plan에서 열별로 승인해야 한다.

계약자·피보험자를 이름만으로 기존 Customer와 자동 병합하지 않는다. 동명이인을 구분할 승인된 matching key 또는 사용자의 명시적 선택이 필요하다.

## Import Pipeline 후보

아래는 원본 보호와 검증을 위한 권고 흐름이다. preview 화면, 사용자 확인 단계, transaction 범위는 승인 전 구현하지 않는다.

    파일 선택
      → 확장자·크기·sheet 확인
      → header와 순서 확인
      → text cell 추출
      → trim/normalize 후보 생성
      → Zod row validation
      → domain mapping
      → 오류/경고 전달 후보
      → 사용자 확인 후보
      → 승인된 범위로 commit
      → 결과 요약

원본 파일을 수정하지 않는다.

### 오류 결과

- sheet명 또는 header mismatch
- row number
- field name
- error code와 사용자가 이해할 수 있는 설명
- 정상화 전 실제 고객 값은 log에 기록하지 않음

전체 rollback과 정상 행만 반영 중 어느 정책을 사용할지는 승인 전 정하지 않는다.

## Export Pipeline

    export 대상 query
      → domain DTO
      → 승인된 21열 mapping
      → text serialization
      → 기준 sheet와 style 생성
      → 임시 파일 validation
      → native save dialog
      → 선택한 경로에 저장

- 날짜는 내부 typed value에서 승인된 text format으로 직렬화한다.
- 금액·회차는 내부 계산 type과 Excel 표시 text를 분리한다.
- 식별자는 항상 text로 쓴다.
- 빈 값은 임의의 0, 공백 문자열, N/A로 치환하지 않는다.
- export 중 기존 파일 덮어쓰기 확인은 native dialog 동작과 함께 검증한다.

## CSV

- 동일한 21열 계약을 지원할지 feature별 CSV를 지원할지 미정이다.
- encoding, delimiter, quote, line ending은 Windows와 Excel 호환성을 test한 뒤 승인한다.
- CSV에는 sheet명과 style이 없으므로 Excel 동일 형식이라는 표현을 적용하지 않는다.

## Synthetic Test Contract

실제 첨부 workbook을 test fixture로 커밋하지 않는다. synthetic fixture인 가상 데이터 workbook에 다음 case를 포함한다.

- 숫자로만 보이지만 앞자리 0이 있는 식별자
- 영숫자와 하이픈 식별자
- 긴 증권번호
- 빈 피보험자·보험종기·수금방법
- 잘못된 날짜와 존재하지 않는 날짜
- YYYYMM 경계
- 0, 큰 금액, 숫자가 아닌 보험료
- header 누락·추가·순서 변경
- 빈 workbook과 대량 row

## Visual QA

- 모든 sheet 렌더
- A:U header clipping
- 긴 식별자가 과학 표기 또는 잘림으로 오해되지 않는지 확인
- header와 body border 색
- 열 너비와 행 높이
- 빈 cell 유지
- formula error scan

## 미결정

- Excel 처리 라이브러리와 Tauri 실행 위치
- 파일 최대 크기와 row 상한
- duplicate key와 재업로드
- partial success
- 21개 열의 최종 저장·파생·제외 mapping
- 같은 format의 보존 수준에 인쇄 설정·페이지 설정 포함 여부
