# Excel / CSV Import·Export 계약

## 상태

첨부 workbook을 읽기 전용으로 분석한 뒤 plan-010에서 계약 가져오기를, plan-011에서 보존 source 기반 계약 내보내기를 승인·구현한 기준 계약이다. `.xlsx`/`.csv` 가져오기, 영구 field mapping, duplicate·transaction 정책과 source/domain parity export 경계가 확정되었다.

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

## Domain Mapping

| source header | InsurancePolicy field | 규칙 |
|---|---|---|
| 보험사 | insurer | trim+NFC, 필수 1–200자 |
| 상품명 | productName | trim+NFC, 필수 1–200자 |
| 계약일자 | joinedOn | 빈 값 또는 실제 `YYYY-MM-DD` |
| 상태 | status | 빈 값 또는 trim+NFC 1–200자 |
| 납입보험료 | monthlyPremiumWon | ASCII digit, SQLite signed 64-bit 원 단위 정수 |
| 보험종기 | maturesOn | 빈 값 또는 실제 `YYYY-MM-DD` |
| 납기 | paymentTerm | 빈 값 또는 trim+NFC 1–200자 |

새 계약의 나머지 field는 `coverageTerm=null`, `disclosurePlan=null`, `renewable=false`, `isIncluded=true`다. 원본 21열은 raw JSON이 아니라 Policy와 1:1인 `insurance_policy_import_sources`의 이름 있는 nullable text column에 보존한다.

계약자·피보험자는 참고값이다. 이름으로 기존 Customer를 자동 검색·병합하지 않고, 사용자가 활성 Customer 또는 이번 가져오기에 직접 정의한 Customer를 행별로 선택한다.

## Import Pipeline

    파일 선택
      → 확장자·크기·sheet 확인
      → header와 순서 확인
      → text cell 추출
      → trim/normalize 후보 생성
      → Rust file 검증과 Zod row validation
      → domain mapping
      → 행 오류와 duplicate preview
      → Customer·create/skip/update/separate-create 명시 결정
      → Rust 재검증과 단일 transaction commit
      → 결과 요약

원본 파일을 수정하지 않는다. 파일을 복사·보관하지도 않는다. 실제 파일 선택은 Tauri native dialog가 수행하며 UI IPC는 임의 경로를 받지 않는다.

duplicate key는 활성 Customer의 활성 Policy 중 trim+NFC 보험사와 source 증권번호가 모두 같은 경우이며 case-sensitive다. 빈 증권번호, source 없는 수동 계약과 soft-deleted 부모는 제외한다. DB duplicate는 default skip, exact update 또는 separate-create를 사용자가 고른다. 같은 파일 안 뒤쪽 중복 행도 default skip이다.

선택한 유효 행은 `BEGIN IMMEDIATE` 하나에서 모두 반영한다. commit에서 raw→mapped parity, 활성 Customer, 정확한 update target과 duplicate snapshot을 다시 검사하며 어느 한 행이라도 달라지거나 실패하면 새 Customer·Policy·source를 모두 rollback한다.

### 오류 결과

- sheet명 또는 header mismatch
- row number
- field name
- error code와 사용자가 이해할 수 있는 설명
- 정상화 전 실제 고객 값, 전체 경로와 row 전체는 log에 기록하지 않음

file 계약 오류는 commit 전에 전체 파일을 거부한다. row mapping 오류는 preview에서 선택할 수 없고, 사용자가 선택한 유효 행은 전부 성공하거나 전부 rollback한다.

## Export Pipeline

    active Customer·Policy와 1:1 source query
      → source의 G/H/J/K/N/R/T 재해석과 현재 domain exact parity
      → 대상·원본 없음·불일치 건수 분리
      → 계약일자 blank-last, Customer 이름, Policy id 안정 정렬
      → 보존된 21열 text/null 직렬화
      → native save dialog
      → 같은 directory의 임시 파일 생성·flush·reparse 검증
      → 사용자 승인 target에 원자 교체

- `isManaged`와 `isIncluded`는 export 대상 여부를 바꾸지 않는다. soft-deleted Customer·Policy에 연결된 source는 기본 export에서 숨긴다.
- source 없는 수동 Policy와 source를 현재 mapping 규칙으로 해석한 값이 현재 Policy와 다른 행은 각각 제외 건수로 표시한다. 21열을 domain에서 합성하거나 과거 source를 현재값처럼 내보내지 않는다.
- 식별자·날짜·금액·회차를 포함한 source cell은 모두 보존 text로 쓰고 null은 빈 cell/field로 둔다. 임의의 0, 공백 문자열, N/A로 치환하지 않는다.
- 대상 0건, 5,000행 초과 또는 생성 파일 10 MiB 초과는 저장 dialog 전에 거부한다.
- 기본 basename은 local timestamp가 포함된 `BODAM-contracts-YYYYMMDD-HHmmss`이며 사용자가 native dialog에서 최종 위치와 이름을 정한다.
- 취소는 파일과 DB를 바꾸지 않는다. 기존 target 교체는 native dialog에서 사용자가 승인한 경우에만 진행한다.
- 같은 directory의 예측 불가능한 임시 파일에 기록하고 close·flush·같은 parser 재검증 뒤 원자 교체한다. 실패하면 기존 target을 보존하고 임시 파일을 정리한다.
- 성공 결과는 format, basename, 내보낸 건수, source 없음 건수와 source/domain 불일치 건수만 반환한다. 전체 경로와 row 값은 반환·기록하지 않는다.

## CSV

- Excel과 같은 21개 header와 열 순서를 사용한다.
- UTF-8 BOM, comma delimiter, CRLF record ending, RFC 4180 quoting과 행마다 정확히 21개 field를 요구한다.
- 잘못된 UTF-8, LF-only, 중복 BOM과 field count mismatch는 file error다.
- CSV에는 sheet명과 style이 없으므로 Excel 동일 형식이라는 표현을 적용하지 않는다.
- trim 전후 첫 문자가 `=`, `+`, `-`, `@`, tab 또는 CR인 nonblank source cell이 하나라도 있으면 값을 escape하거나 변경하지 않고 전체 CSV export를 거부한다. XLSX는 formula가 아닌 string cell로 기록한다.

## 가져오기 한도

- 파일 10 MiB, data row 5,000개, source cell 4,000 Unicode scalar
- XLSX archive entry 1,000개, 단일 uncompressed entry 20 MiB, 합계 50 MiB
- XLSX shared-string item 105,021개, 대상 sheet의 header 포함 decoded UTF-8 text 출현 합계 20 MiB
- Calamine 기준으로 정규화한 ZIP entry 이름이 충돌하거나 shared-string 예약·논리 text 상한을 소유 preview 생성 전에 넘으면 거부한다.
- 모든 worksheet의 `sheetData`에서 raw cell type과 payload 조합을 검사한다. shared index·implicit numeric·inline string·formula string을 Calamine이 임의 문자열로 보정하거나 복수 값으로 덮어쓸 수 있는 malformed 구조는 대상 sheet 여부와 무관하게 거부한다.
- 대상 sheet는 NFC 비교로 정확히 `계약조회(엑셀변환)_장기` 하나여야 한다.
- header는 A:U에 정확한 표기·순서로 있어야 하고 A:U 밖 data는 허용하지 않는다.
- Excel의 채워진 source cell은 string만 허용하며 formula·number·boolean·date/error cell은 거부한다. blank는 null이다.

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

- source 없는 수동 Policy의 21열 합성과 각 미매핑 열의 값
- domain/source 충돌의 source 반영, domain 우선 또는 사용자 해결 UI
- 고객·기간·계약 선택 filter와 사용자 지정 정렬
