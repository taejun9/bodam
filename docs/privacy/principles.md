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
- plan-011 export와 향후 SQLite backup에는 원본 DB와 같은 민감도로 포함한다. hard purge·암호화·보존 기간 변경은 별도 승인 계획이 필요하다.

## Contract Export

- active Customer·Policy에 연결된 1:1 source와 현재 domain mapping이 일치하는 행만 내보낸다. source 없는 수동 계약이나 충돌 행을 추측해 합성하지 않고 제외 건수만 표시한다.
- native save dialog가 반환한 path만 사용하고 UI command나 성공 결과에 전체 path를 노출하지 않는다. 결과와 log에는 format, basename, 단계와 건수만 둔다.
- 생성 중간 파일은 선택 target과 같은 directory에서 예측 불가능한 이름으로 만들고 flush·재parse 검증 뒤 원자 교체한다. 취소·실패 뒤 임시 파일을 남기지 않고 기존 target을 보존한다.
- CSV formula trigger는 원문에 escape 문자를 삽입하지 않고 전체 CSV 저장을 거부한다. XLSX cell은 formula가 아닌 string으로 기록한다.
- export 파일은 암호화하지 않은 평문이며 DB와 같은 민감도로 안내한다. 공유·동기화 폴더를 기본값으로 권하지 않고 보관 위치의 OS 계정·디스크 보호 책임을 설명한다.

## Tauri Capability

- dialog로 사용자가 선택한 import/export 파일과 필요한 app data 디렉터리만 접근한다.
- broad filesystem scope를 기본값으로 열지 않는다.
- shell, process, sidecar 권한은 Prisma runtime 결정 뒤 최소 command만 허용한다.
- remote URL과 network capability는 MVP 기본값에서 허용하지 않는다.

## Windows Release Evidence

- Production과 E2E installer는 product identifier, install directory, registry key와 Cargo feature를 분리한다. Production package에는 WebDriver, E2E environment override와 synthetic fixture를 포함하지 않는다.
- Hosted artifact는 successful non-pull-request run의 unsigned production NSIS, 그 SHA-256과 sanitized evidence JSON 세 파일만 허용한다. Pull request는 artifact를 upload하지 않고 E2E installer, SQLite, `.bodam-backup`, import/export 결과, screenshot과 raw log는 어떤 run에서도 upload하지 않는다.
- Evidence는 product/version/architecture, basename, byte size, SHA-256, 상태 code와 count만 기록한다. 전체 임시 path, 환경 변수 dump, 업무 row, credential을 기록하지 않는다.
- Code-signing credential이 제공되지 않은 artifact는 `NotSigned`로 기록하고 signed·trusted·public distribution으로 표현하지 않는다.
- Uninstaller는 user app-data와 shared WebView2 runtime을 삭제하지 않는다. Production install 직후 Microsoft x64 탐지 위치에서 관찰한 WebView2 `pv` logical record와 version이 uninstall·cleanup 뒤에도 exact-equal인지 대사하며, `sharedWebViewPreserved`가 true일 때만 release evidence를 만든다.
- Hosted 검증이 끝난 뒤에만 일회용 synthetic E2E runtime·app-data를 exact resolved allowlist로 별도 정리한다. 재귀 삭제 전에 모든 descendant를 검사해 nested reparse point를 거부하고, Windows safety negative control은 cleanup tree 밖 external sentinel이 그대로인지 확인한다.
- Hosted Windows pass는 WebView2 미설치·network-blocked clean VM, interactive wizard/UAC, Authenticode·SmartScreen을 증명하지 않는다. 실행하지 못한 항목은 `NOT RUN`으로 남긴다.

## Logs

- 고객 이름, 연락처, 주소, 메모, 계약 식별값, workbook row 전체를 기록하지 않는다.
- 오류는 file type, sheet, row number, field name, error code 중심으로 남긴다.
- 진단 log 보존 기간과 삭제 UI는 별도 설정 계획에서 결정한다.

## Backup / Restore

- 최근 30개 보관은 파일 개수 정책이며 안전성 보장을 의미하지 않는다.
- backup 파일도 원본 DB와 동일한 보호 수준으로 안내한다.
- 자동 backup 기본 위치는 app-data의 `backups`이고 custom local 위치는 native folder dialog로만 선택한다. 전체 path는 IPC result와 log에 반환하지 않는다.
- backup에는 soft-deleted 원본, 상담·일정 memo, 21열 import source와 Settings를 포함한 전체 SQLite snapshot이 들어간다.
- custom backup directory는 다른 장치로 전달하면 안 되는 host-local capability다. restore working DB에서 이 값만 제거하고 기본 위치로 돌아가며, 사용자가 현재 장치에서 다시 선택한다.
- macOS/Linux custom 위치는 component별 nofollow-open으로 고정한 directory FD에 상대해 create/open/rename/unlink/fsync하고, 작업 시작·최종 sync 뒤 현재 path의 device/inode identity를 대사한다. rename·symlink retarget 또는 위치 소실은 오류로 보고하며 replacement path로 따라가지 않는다.
- macOS/Linux restore 선택 파일은 final-component `O_NOFOLLOW|O_CLOEXEC`, descriptor `fstat`와 bounded copy를 사용한다. app-owned restore staging root/file은 각각 `0700`/`0600`으로 제한한다.
- Windows Plan-013은 local fixed NTFS에서 directory/archive/restore source를 열린 HANDLE identity에 결속하고 junction/reparse 교체를 fail closed하는 경계만 검증한다. UNC/network/removable filesystem의 atomicity와 운영 지원은 미결정이며 local NTFS pass로 증명되지 않는다.
- `.bodam-backup`은 암호화하지 않은 평문이다. 같은 디스크 backup은 기기 손상·분실에 대한 별도 복구 수단이 아니며 OS 계정·전체 디스크 보호에 의존한다.
- restore 전에 checksum·schema·SQLite integrity와 현재 DB 안전 사본을 검증한다. 실패하면 현재 DB를 보존하고 staging/temp 삭제 실패도 숨기지 않고 다음 startup 정리 대상으로 남긴다.
- process 중단으로 남을 수 있는 state atomic-write와 backup directory write-probe는 exact app-owned canonical v4 이름과 regular-file 조건일 때만 다음 startup/작업에서 삭제한다. 유사 이름, symlink와 directory는 지우지 않으며 삭제·parent sync 실패는 재시도 가능한 오류로 남긴다.
- manual·pre-restore artifact는 자동 retention에서 제외되므로 사용자가 보호 위치와 외부 삭제를 관리한다.
- backup 암호화, recovery key와 app lock은 별도 threat model·승인 전에는 구현하지 않는다.

## 외부 통신

MVP에는 telemetry, crash upload, remote AI, cloud sync, 광고, 결제, 알림 서버가 없다. 추가하려면 데이터 흐름, 동의, 실패 모드와 철회 방법을 별도 계획으로 승인받는다.

## 주장 제한

이 문서는 법률, 의료, 금융 또는 규정 준수 결론을 내리지 않는다. 관련 주장이 필요한 경우 관할과 권한을 명시하고 공식 근거를 별도로 기록한다.
