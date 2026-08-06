# 개인정보와 보안 원칙

## 기본 입장

BODAM은 로컬 전용이어도 고객 보험 정보를 다룬다. 네트워크 전송을 하지 않는 것만으로 안전하다고 간주하지 않으며, 수집 최소화와 파일 접근 제한을 우선한다.

## 저장 금지

- 주민등록번호
- 보험사 로그인 ID, 비밀번호, 인증서, token
- 민감 병력
- 상세 병력
- 상담 메모에 포함된 상세 병력

form, import schema, memo 도움말, test fixture, log에도 위 항목을 위한 필드를 만들지 않는다.

## 최소 수집

- 사용자 요구에 명시된 고객·계약·보장·상담·가족·일정 데이터만 저장한다.
- 새 필드는 목적, 표시 위치, 보존 기간, export/backup 포함 여부가 승인된 계획에 있어야 한다.
- 분석 편의를 이유로 원본 Excel의 미사용 열을 모두 보관하지 않는다.

## 실제 데이터 금지 영역

- Git repository
- example과 seed
- unit/integration/e2e fixture
- 문서와 회의록
- QA 출력과 stack trace
- screenshot과 demo 영상
- issue와 commit message

첨부 workbook은 읽기 전용 reference로만 분석하며 저장소로 복사하지 않는다. 구조 검증용 workbook은 가상 데이터로 새로 만든다.

## Local Storage

- SQLite, export, import 임시파일, backup은 모두 민감 데이터로 취급한다.
- 기본 경로는 OS app data 영역 후보이며 사용자가 선택한 export 경로는 별도다.
- 임시 import 파일은 필요 이상 보관하지 않는다.
- 파일 권한, 암호화, 앱 잠금은 구현 전 threat model과 사용자 승인이 필요하다.

## Schedule

- 일정에는 업무 식별용 제목·날짜와 선택 시간·메모·Customer 연결·완료 상태만 저장한다.
- 제목은 월 Calendar·선택일 agenda·수정·삭제 확인 dialog, 메모는 Calendar·agenda·수정 dialog에서만 표시하며 error·log·fixture 출력에는 복사하지 않는다.
- 일정 메모에는 주민등록번호, 보험사 로그인 정보, 민감 병력·상세 병력이나 진단·치료 상세를 넣지 말라는 입력 안내를 제공한다.
- soft delete된 일정과 soft delete된 Customer에 연결된 일정 원본은 SQLite에 남지만 기본 Calendar에서 숨긴다.
- 현재 Schedule 전용 export는 없다. 전체 DB backup이 구현되면 Schedule도 같은 민감도의 원본으로 포함하며 별도 계획에서 경로·보존·복원 경계를 승인한다.

## Contract Import Source

- 선택한 workbook·CSV bytes와 전체 경로는 영구 저장하거나 log에 남기지 않는다. native dialog로 읽은 뒤 preview 교체·성공·화면 이탈 때 메모리에서 해제한다.
- XLSX는 압축 해제 크기뿐 아니라 shared-string 105,021 item과 대상 sheet decoded UTF-8 text 20 MiB를 소유 preview 생성 전에 제한한다. ZIP 이름 정규화 충돌도 거부해 검사한 entry와 실제 parser entry가 달라지지 않게 한다.
- 21열 source text/null은 재업로드 duplicate 판정과 승인된 같은 열 export를 위해 Policy별 이름 있는 column으로만 저장한다. 검색·분석용 raw JSON이나 원본 파일 사본은 만들지 않는다.
- source는 연결 Policy와 같은 기간 보존한다. Policy 또는 Customer가 soft delete되면 기본 조회·duplicate·향후 export에서 숨고 복원 시 다시 포함된다.
- plan-010은 저장된 source의 별도 조회·수정·삭제 UI를 제공하지 않는다. preview에서만 사용자가 펼쳐 볼 수 있다.
- 향후 export와 SQLite backup에는 원본 DB와 같은 민감도로 포함한다. hard purge·암호화·보존 기간 변경은 별도 승인 계획이 필요하다.

## Tauri Capability

- dialog로 사용자가 선택한 import/export 파일과 필요한 app data 디렉터리만 접근한다.
- broad filesystem scope를 기본값으로 열지 않는다.
- shell, process, sidecar 권한은 Prisma runtime 결정 뒤 최소 command만 허용한다.
- remote URL과 network capability는 MVP 기본값에서 허용하지 않는다.

## Logs

- 고객 이름, 연락처, 주소, 메모, 계약 식별값, workbook row 전체를 기록하지 않는다.
- 오류는 file type, sheet, row number, field name, error code 중심으로 남긴다.
- 진단 log 보존 기간과 삭제 UI는 별도 설정 계획에서 결정한다.

## Backup / Restore

- 최근 30개 보관은 파일 개수 정책이며 안전성 보장을 의미하지 않는다.
- backup 파일도 원본 DB와 동일한 보호 수준으로 안내한다.
- restore 전에 현재 DB 안전 사본과 schema version 검증을 고려한다.
- backup 암호화와 recovery key는 요구사항 확인 없이 구현하지 않는다.

## 외부 통신

MVP에는 telemetry, crash upload, remote AI, cloud sync, 광고, 결제, 알림 서버가 없다. 추가하려면 데이터 흐름, 동의, 실패 모드와 철회 방법을 별도 계획으로 승인받는다.

## 주장 제한

이 문서는 법률, 의료, 금융 또는 규정 준수 결론을 내리지 않는다. 관련 주장이 필요한 경우 관할과 권한을 명시하고 공식 근거를 별도로 기록한다.
