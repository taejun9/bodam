# BODAM 권장 기본 운영 프로필

## 상태

approved — 2026-08-06, plan-002의 전체 MVP 위임과 승인 기록을 근거로 사용한다.

- 제안일: 2026-08-06
- 승인일: 2026-08-06
- 적용 대상: BODAM 로컬 데스크톱 MVP
- 목적: 기존 open question을 한 번에 승인 가능한 구체 규칙으로 바꿔 후속 Exec Plan을 연속 진행한다.
- 한계: 이 프로필은 법률·의료·금융 적합성 또는 보험 규정의 공식 해석이 아니다.

## 1. 실행, 배포, 계획 운영

- Prisma schema와 Prisma가 생성한 migration SQL을 schema artifact의 단일 source로 사용한다.
- 설치 앱에서는 Tauri Rust adapter가 SQLite에 접근하고 동일 migration SQL을 실행한다.
- Rust executor/history가 Prisma Migrate executor와 같다고 주장하지 않는다.
- schema, migration history, Rust 등록 목록, runtime DB의 동등성을 CI에서 검사한다.
- generic SQL, shell, process, broad filesystem, network capability를 UI에 열지 않는다.
- Windows x64 NSIS와 WebView2 `offlineInstaller`를 사용해 설치와 실행 모두 offline을 목표로 한다.
- GitHub Windows runner에서 release app WebDriver E2E를 실행한다.
- WebView2가 없는 network-blocked Windows VM의 설치와 NSIS wizard/UAC는 별도 수동 acceptance로 남긴다.
- 전체 MVP 업무 규칙은 이 프로필로 승인하되 실제 변경은 작은 후속 Exec Plan으로 분할한다.
- 이 프로필을 벗어나거나 원본 데이터 재해석, 외부 통신, 민감정보 저장이 필요할 때만 재승인한다.

## 2. 공통 데이터 규칙

- date-only 값은 `YYYY-MM-DD`로 저장하고 locale 문자열을 저장하지 않는다.
- timestamp는 UTC로 저장하고 화면에서 OS local timezone으로 표시한다.
- 금액은 KRW 원 단위 정수로 저장하며 부동소수점을 사용하지 않는다.
- 업무 삭제는 `deletedAt` soft delete이며 hard delete와 cascade hard delete를 사용하지 않는다.
- 부모가 soft delete되면 연결 원본은 유지하되 기본 조회, 집계, dashboard, calendar, export에서 숨긴다.
- 부모 복원 시 개별 soft delete되지 않은 자식만 다시 노출한다.
- 실제 고객 데이터 대신 명백한 합성 fixture만 test, screenshot, log에 사용한다.

## 3. Customer와 Consultation

- Customer는 이름만 필수다.
- 생년월일은 date-only이며 성별, 연락처, 주소, 메모, 담당상태는 선택이다.
- 담당상태와 상담결과는 자유 입력으로 시작하고 enum을 고정하지 않는다.
- 계산 대상 구분을 위해 Customer에 `관리대상` boolean을 두고 기본값은 true로 한다.
- Consultation은 customer, 상담일을 필수로 하고 내용, 다음 연락일, 결과는 선택으로 한다.
- 상담 내용 입력에는 민감 병력과 상세 병력을 저장하지 말라는 안내를 표시한다.
- 주민등록번호, 보험사 로그인 정보, 민감 병력, 상세 병력 필드는 만들지 않는다.

## 4. Family

- Family는 이름을 필수로 한다.
- Customer와 Family는 membership을 통한 다대다 관계를 허용한다.
- 같은 가족 안에 같은 고객 membership을 중복 생성하지 않는다.
- 관계명은 선택 자유 입력이며 대표자 개념은 MVP에 두지 않는다.
- 한 고객이 여러 가족에 속하면 각 가족 집계에 표시하되 전체 가족 합산 카드를 만들지 않는다.
- 가족 보험료는 활성 구성원의 집계 대상 계약 월보험료를 요청 시 계산한다.

## 5. InsurancePolicy

- customer, 보험사, 상품명, 월보험료를 필수로 한다.
- 가입일과 만기일은 선택 date-only다.
- 보험기간과 납입기간은 `종신`을 포함할 수 있는 원문 text로 저장한다.
- 월보험료는 사용자가 계약서에서 확인한 총 월납입액 한 개를 KRW 정수로 입력한다.
- 특약 보험료 breakdown은 MVP에서 별도 저장하지 않는다.
- 갱신은 boolean만 저장하고 갱신주기와 다음 갱신일은 후속 기능으로 둔다.
- 계약 상태는 자유 입력이다.
- 합계 포함 여부를 위해 `합계대상` boolean을 두고 기본값은 true로 한다.
- Coverage가 없어도 Policy를 생성할 수 있다.

## 6. Coverage와 Benchmark

- 문서의 암, 유사암, 뇌혈관, 심혈관, 질병수술, 상해수술, 후유장해, 입원, 간병, 운전자를 수정·삭제 가능한 초기 카테고리로 제공한다.
- Coverage는 Policy와 카테고리를 필수로 하고 금액은 KRW 정수로 저장한다.
- 같은 고객·카테고리의 여러 활성 Coverage 금액은 합산한다.
- soft-deleted 고객·계약·보장과 `합계대상=false` 계약은 합계에서 제외한다.
- 보험 권고 금액을 임의 seed하지 않는다.
- Benchmark는 사용자가 카테고리, 성별, 만 나이 시작·끝, 적정하한, 과다하한을 설정한다.
- `금액 < 적정하한`은 부족, `적정하한 ≤ 금액 < 과다하한`은 적정, `금액 ≥ 과다하한`은 과다다.
- 같은 성별·카테고리의 나이 구간이 겹치면 저장을 거부한다.
- 일치하는 Benchmark가 없으면 `기준 미설정`으로 표시하고 부족으로 간주하지 않는다.

## 7. 상령, Dashboard, Calendar, Notification

- 상령 계산은 만나이를 기준으로 생일 6개월이 되는 local date부터 한 살 증가하는 규칙을 사용한다.
- 월 더하기로 존재하지 않는 날짜가 되면 해당 월의 마지막 날로 맞춘다.
- 날짜 service는 항상 명시적 기준일과 local timezone을 입력받는다.
- 상령 규칙 변경은 계산 결과만 다시 만들며 원본 생년월일을 바꾸지 않는다.
- Dashboard 카드의 기본 최대 건수는 10건이다.
- 안정 정렬은 날짜, 이름, id 순서다.
- 오늘 연락은 `다음 연락일 ≤ 오늘`인 관리대상 고객이며 연체 대상을 포함한다.
- 최근 상담은 최근 30일, 미상담은 90일 이상 상담이 없었던 관리대상 고객이다.
- 만기·상령 bucket은 `0–30`, `31–60`, `61–90`일의 비중복 구간이다.
- Calendar는 월 보기를 우선 제공한다.
- 사용자 일정은 제목과 날짜를 필수, 시간·메모·고객 연결을 선택, 완료 여부를 boolean으로 둔다.
- 반복, 우선순위, drag and drop, 주·일 보기는 후속 기능이다.
- 앱 시작, resume, local date 변경 시 dashboard·calendar·notification read model을 재계산한다.
- background push나 원격 알림을 사용하지 않고 앱 안에서 사유 chip으로 표시한다.

## 8. Excel과 CSV Import·Export

- 문서화된 21열 header, sheet명, text cell, style 계약을 Excel 기준으로 사용한다.
- 입력 원본을 수정하지 않고 parse, normalize, validate, preview, commit을 분리한다.
- 21개 source column은 이름 있는 typed staging column으로 보존하며 raw JSON 하나에 넣거나 조용히 버리지 않는다.
- 기본 domain mapping은 G 보험사, H 상품명, J 계약일자→가입일, K 상태, N 납입보험료→월보험료, R 보험종기→만기일, T 납기→납입기간이다.
- 계약자와 피보험자를 이름만으로 기존 Customer에 자동 병합하지 않는다.
- preview에서 기존 Customer를 고르거나 새 Customer 생성을 명시적으로 선택한다.
- 보험사와 증권번호가 모두 같은 행만 duplicate 후보로 본다.
- duplicate 기본 동작은 skip이며 사용자가 update 또는 별도 create를 선택할 수 있다.
- formula cell은 오류로 처리하고 blank는 null로 유지한다.
- 사용자가 선택한 valid 행 전체를 한 transaction으로 commit하며 실패하면 전부 rollback한다.
- CSV는 같은 21열, UTF-8 BOM, comma, CRLF, RFC 4180 quoting을 사용한다.
- Excel export는 문서화된 header, 열 순서, text cell, 빈 cell, 열 너비, 행 높이, border를 재현한다.
- 인쇄·페이지 설정은 export 범위에서 제외한다.

## 9. Backup, Restore, Settings

- SQLite 원본은 Tauri app-data에 저장한다.
- 자동 backup 기본 경로는 app-data의 `backups`이며 사용자가 다른 로컬 폴더를 선택할 수 있다.
- backup은 SQLite의 일관된 snapshot과 schema version, app version, timestamp, checksum manifest로 구성한다.
- 앱 시작, resume, local date 변경 때 daily backup 필요 여부를 확인한다.
- 정상 종료 시 마지막 성공 backup 이후 DB가 변경되었을 때만 backup을 만든다.
- 검증된 자동 backup 최근 30개를 보관하며 수동 backup은 retention에서 제외한다.
- 종료 backup 실패 시 재시도 또는 경고 후 종료를 사용자가 선택한다.
- restore 전에 현재 DB 안전 사본과 대상 무결성·schema version을 확인한다.
- restore 실패 시 현재 DB를 보존하고 성공 후 앱을 재시작한다.
- MVP에는 backup 암호화와 app lock을 넣지 않고 OS 계정 권한에 의존한다.
- 같은 디스크 backup의 한계와 export·backup 파일의 민감도를 UI에 안내한다.
- Settings는 theme, dashboard 기간·건수, Benchmark, backup 경로를 제공한다.

## 10. 후속 범위와 잔여 위험

- 가족 대표·관계 enum, 갱신주기, 보험료 breakdown, 주·일 calendar, 반복 일정은 후속 기능이다.
- Benchmark 초기 금액, 원격 backup, cloud sync, multi-user는 MVP에서 제외한다.
- code signing과 실제 배포 채널은 별도 release 계획에서 결정한다.
- 상령 산식, 총 월보험료 의미, 가족 다대다, Benchmark 경계, Excel mapping은 사용자 승인값이지 공식 보험 규칙이라고 주장하지 않는다.
- 무암호화 local DB와 backup은 공유 PC·기기 탈취 위험이 남는다.
- Windows hosted CI는 WebView2 미설치 PC와 native installer wizard를 완전히 대체하지 않는다.

## 승인 문구

다음 문구로 승인한다.

> BODAM 권장 기본 운영 프로필 2026-08-06 전체를 승인합니다. 이를 전체 MVP 후속 Exec Plan의 승인된 기본값으로 사용하고, 프로필을 벗어나거나 데이터 재해석·외부 통신·민감정보 저장이 필요한 경우에만 다시 확인해 주세요.
