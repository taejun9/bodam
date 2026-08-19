# BODAM (보담)

보험설계사 한 명이 고객, 가족, 보험계약, 보장, 상담과 일정을 인터넷 없이 관리하는 Windows 우선 개인용 데스크톱 CRM입니다.

현재 고객·가족·보험계약·계약별 보장·고객별 상담·사용자 일정, 보장 기준과 앱 설정 관리가 동작합니다. Tauri 데스크톱 앱에서 각 원본을 생성·수정·soft delete하고, 고객·가족 월보험료와 고객 카테고리별 보장 판정, 오늘의 Dashboard와 월간 Calendar를 확인할 수 있습니다. 승인된 21열 계약조회 `.xlsx`/`.csv`를 검증·미리보기 뒤 로컬 SQLite에 가져오고 같은 계약을 다시 내보낼 수 있으며, SQLite online snapshot 기반 로컬 백업과 검증·재시작 복원을 제공합니다. Dashboard·Calendar read model은 저장 없이 요청 시 다시 계산됩니다.

## 핵심 원칙

- 로컬 우선: 핵심 기능과 SQLite 데이터는 인터넷 연결 없이 동작합니다.
- 단일 사용자: MVP는 보험설계사 한 명의 개인 사용을 대상으로 합니다.
- 계획 우선: 승인된 실행 계획 없이는 구현하지 않습니다.
- 계층 분리: UI는 비즈니스 규칙과 데이터 저장 방식을 직접 알지 않습니다.
- 개인정보 최소화: 주민등록번호, 보험사 로그인 정보, 민감 병력과 상세 병력을 저장하지 않습니다.
- 이식성: SQLite 전용 SQL을 피하고 PostgreSQL 이전 가능성을 서비스·스키마 경계에서 보존합니다.

로컬 저장은 암호화를 뜻하지 않습니다. 현재 데이터 보호는 운영체제 사용자 계정과 디스크 접근 통제에 의존하므로, 공유 PC에서는 사용하지 말고 운영체제 전체 디스크 암호화를 권장합니다.

## 바로 실행하기

필수 환경은 Node.js 24, npm, 최신 stable Rust와 대상 운영체제용 Tauri 2 빌드 도구입니다.

    npm install
    npm run tauri:dev

브라우저에서 UI만 빠르게 확인하려면 다음 명령을 사용합니다.

    npm run dev

브라우저 실행은 Tauri IPC 대신 `localStorage`의 명시적인 합성 미리보기 저장소를 사용합니다. 실제 고객 데이터와 SQLite 지속성 검증은 반드시 Tauri 앱에서 수행합니다.

## 설치 파일 만들기

Node.js, npm, Rust와 Prisma는 설치 파일을 만드는 PC에만 필요합니다. 최종 사용자는 소스나 개발 도구를 받지 않고 아래 DMG 또는 EXE 하나만 받습니다. SQLite는 앱에 포함되고, macOS는 운영체제 WebKit을 사용하며, Windows 설치기는 WebView2 offline installer를 포함합니다.

처음 소스를 받은 제작 PC에서는 lockfile 기준 의존성을 설치합니다.

    npm ci --ignore-scripts

macOS 제작 PC에서는 Apple Silicon과 Intel을 함께 담기 위해 Rust target을 한 번 준비한 뒤 Universal DMG를 만듭니다.

    rustup target add aarch64-apple-darwin x86_64-apple-darwin --toolchain stable
    npm run package:macos

명령은 DMG 무결성, 내부 `BODAM.app`, production identifier, arm64/x86_64 실행 파일과 ad-hoc 서명을 함께 검사합니다. 전달할 파일은 다음 위치에 생깁니다.

    src-tauri/target/universal-apple-darwin/release/bundle/dmg/BODAM_0.1.0_universal.dmg

Windows x64 제작 PC에서는 같은 의존성 설치 뒤 current-user NSIS를 만듭니다.

    npm run package:windows

전달할 파일은 다음 위치에 생깁니다. 약 127MB의 WebView2 offline installer가 포함되어 최종 사용자 PC에 인터넷이 없어도 필요한 WebView runtime을 설치할 수 있습니다.

    src-tauri/target/release/bundle/nsis/BODAM_0.1.0_x64-setup.exe

### 개발 지식 없는 사용자의 설치 순서

- macOS: DMG를 더블클릭하고 열린 창의 `BODAM`을 `Applications`로 드래그한 뒤 응용 프로그램 폴더에서 실행합니다.
- Windows: `BODAM_0.1.0_x64-setup.exe`를 더블클릭하고 설치 창을 완료한 뒤 BODAM을 실행합니다. Node.js, npm, Rust 또는 Prisma를 따로 설치하지 않습니다.

현재 macOS 산출물은 ad-hoc 서명이고 Apple notarization은 없으며, Windows 산출물도 Authenticode 서명이 없습니다. 따라서 다른 PC에 다운로드해 공개 배포하면 Gatekeeper 또는 SmartScreen이 개발자 확인 경고를 표시할 수 있습니다. 경고 없는 공개 배포에는 Apple Developer ID notarization과 Windows code-signing 인증서가 별도로 필요하며, 현재 파일을 공증·서명된 배포본으로 표현하지 않습니다.

## 현재 기능

- 상담일·다음 연락일·상령일·계약 만기일·사용자 일정을 합친 OS-local 월간 Calendar
- 제목·날짜 필수, 시간·메모·고객 연결 선택, 완료 상태인 사용자 일정 CRUD와 soft delete
- 이전·다음·오늘, URL 월·선택일 복원, 선택일 agenda와 활성 고객 상세 이동
- 오늘 연락·상령·만기·보험료·가족 보험료·보장 부족·최근 상담·미상담을 모은 8개 Dashboard 카드
- 명시적 OS-local 기준일의 0–30/31–60/61–90일 bucket과 카드별 전체 건수·최대 10개 detail
- 고객 목록과 이름·연락처·담당 상태 검색
- 이름 필수 고객 등록과 입력 검증
- 고객 정보 및 관리 대상 여부 수정
- 확인 대화상자를 거친 `deletedAt` soft delete
- 고객 상세의 보험계약 생성·조회·수정·soft delete
- 합계 포함 여부를 반영한 고객별 월보험료 합계
- 가족 그룹 생성·조회·이름 수정·soft delete
- 한 Customer의 복수 가족 소속과 선택 자유입력 관계명 관리
- 활성 구성원의 합계대상 계약을 반영한 가족별 월보험료 합계
- 보험계약별 표준 카테고리 보장 생성·조회·수정·soft delete
- 합계대상 계약의 활성 보장을 카테고리 ID별 금액·건수로 합산
- 합계 제외 계약의 보장 원본은 관리 화면에 유지하고 고객 합계에서만 제외
- 공통 초기 보장 카테고리 10개의 이름 변경과 영향 확인 후 soft delete
- Settings의 사용자 정의 성별·만 나이 구간별 보장 적정하한·과다하한 CRUD
- 고객별 합계와 사용자 기준을 비교한 부족·적정·과다·기준 미설정 판정
- 일치 기준이 있는 Coverage 0건 카테고리의 0원 부족 판정과 계산 근거 표시
- 고객 상세의 상담 이력 생성·조회·수정·soft delete
- UTC로 저장하고 OS local timezone으로 표시하는 상담 일시와 선택 다음 연락일·자유입력 결과
- KRW 원 단위 정수, 가입일·만기일·다음 연락일 date-only와 상담 timestamp 검증
- SQLite migration checksum/history/runtime schema drift 검사
- light/dark 테마, 키보드 접근성, 모바일 반응형 브라우저 화면
- SQLite에 유지되는 테마, 최근·미상담 기간과 Dashboard 카드별 1–10건 설정
- 시작·다시 활성화·날짜 변경의 일일 백업, 변경된 정상 종료 백업과 최근 자동 30개 보존
- 설정된 로컬 폴더의 수동 전체 백업과 checksum·schema·SQLite 무결성 검증
- pathless native 파일 선택, 복원 전 안전 사본과 재시작 전 staging을 거친 전체 DB 복원·rollback
- loading, empty, success, validation, adapter error 상태
- native 파일 선택을 통한 21열 계약조회 `.xlsx`/UTF-8 BOM CSV 검증·미리보기
- 행별 기존/새 Customer 명시 연결과 duplicate 기본 skip·exact update·별도 생성
- 선택한 유효 행의 Customer·Policy·21열 source 단일 transaction 반영과 전체 rollback
- 활성 Customer·Policy의 보존된 21열 source와 현재 7개 mapping 값이 일치하는 계약의 XLSX/CSV 내보내기
- source 없는 수동 계약과 현재 값·source가 충돌하는 계약의 제외 건수, native 저장·취소·덮어쓰기 경계

### 계약 파일 가져오기 사용 흐름

1. 왼쪽 `데이터 관리`에서 승인된 `.xlsx` 또는 UTF-8 BOM·CRLF CSV를 선택합니다. 원본 파일은 읽기만 하며 수정하거나 앱 데이터에 복사하지 않습니다.
2. 유효·오류·중복 행과 21열 원본을 확인합니다. 새 계약은 활성 고객을 고르거나 새 고객 이름을 직접 정의해야 하며 계약자·피보험자 이름으로 자동 병합하지 않습니다.
3. 보험사+증권번호가 같은 활성 계약은 기본 `건너뛰기`입니다. 정확한 기존 계약 갱신이나 별도 계약 생성을 의도한 경우에만 행 결정을 바꿉니다.
4. 확인 dialog에서 모두 반영하면 선택한 유효 행을 한 transaction으로 처리합니다. 중복 상태나 부모가 바뀌었거나 어느 한 행이 실패하면 전체를 취소하고 새 미리보기를 요구합니다.

파일에는 민감한 고객·계약 정보가 포함될 수 있습니다. 주민등록번호, 보험사 로그인 정보, 민감 병력·상세 병력이 든 파일은 가져오지 마세요. 저장된 21열 source는 재업로드 duplicate와 향후 같은 열 export를 위한 값이며 별도 source 수정 UI는 아직 없습니다.

### 계약 파일 내보내기 사용 흐름

1. 왼쪽 `데이터 관리`에서 XLSX 또는 CSV 내보내기를 선택합니다. 활성 Customer의 활성 계약 중 가져오기에서 보존한 21열 source가 있고, source를 다시 해석한 7개 값이 현재 계약과 정확히 같은 행만 대상입니다.
2. source 없는 수동 계약과 가져오기 뒤 현재 계약 값이 달라진 행은 각각 `원본 없음`, `현재 값과 원본 불일치`로 집계하고 파일에서 제외합니다. 앱은 어느 쪽 값도 조용히 우선하거나 21열을 추측해 만들지 않습니다.
3. native 저장 창에서 위치와 파일명을 결정합니다. 취소하면 파일과 DB를 바꾸지 않으며, 기존 파일 교체는 저장 창에서 사용자가 승인한 경우에만 수행합니다.
4. XLSX는 `계약조회(엑셀변환)_장기` sheet와 A:U text/blank/style 계약을, CSV는 UTF-8 BOM·CRLF·RFC 4180·정확히 21개 field 계약을 사용합니다. CSV cell이 spreadsheet formula로 해석될 수 있는 문자로 시작하면 원본을 바꾸지 않고 CSV 전체 저장을 거부하며 XLSX 사용을 안내합니다.

내보낸 파일은 평문이며 SQLite와 같은 민감도의 고객·계약 정보를 포함할 수 있습니다. 공유 폴더·동기화 폴더를 피하고 운영체제 계정·디스크 접근 통제가 적용된 위치에 보관하세요. 성공 화면과 log에는 전체 경로나 행 값을 남기지 않고 파일명과 건수만 표시합니다.

### 보장 사용 흐름

1. 고객 상세의 보험계약 행이나 카드에서 `보장 관리`를 열고 카테고리와 가입금액을 등록합니다.
2. 같은 계약의 보장 목록에서 금액·카테고리를 수정하거나 확인 후 삭제합니다. 합계 제외 계약도 여기서는 계속 관리할 수 있습니다.
3. 고객 상세의 `고객 보장 합계`에서 합계대상 계약만 반영한 카테고리별 금액과 건수를 확인합니다.
4. `카테고리 관리`에서 공통 이름을 바꾸거나 연결 보장 영향 건수를 확인한 뒤 삭제합니다. 삭제된 카테고리의 연결 행은 보존되지만 목록과 합계에서 숨겨집니다.

### 보장 기준 사용 흐름

1. 왼쪽 `설정`의 `보장 기준 설정`에서 카테고리, Customer 성별과 정확히 같은 자유입력 성별, 포함 만 나이 시작·끝, 적정하한·과다하한을 입력합니다.
2. 같은 카테고리·성별의 활성 나이 구간은 겹칠 수 없습니다. 기준금액은 원 단위 정수이며 적정하한이 과다하한보다 작아야 합니다.
3. 고객 상세의 보장 합계에서 `부족`, `적정`, `과다`, `기준 미설정`과 적용 구간·두 하한을 확인합니다. 기준이 있고 보장이 없으면 0원으로 판정합니다.
4. 기준을 삭제하면 기본 Settings 목록과 고객 판정에서 숨겨지지만 원본 행은 로컬 DB에 남습니다. 카테고리를 삭제해도 연결 기준 원본은 함께 수정되지 않습니다.

이 기준은 사용자가 정한 관리용 비교값이며 공식 보험 권고나 적합성 판단이 아닙니다. 초기 권고금액은 제공하지 않습니다.

### 가족 사용 흐름

1. 왼쪽 `가족`에서 이름만으로 가족을 등록합니다. 같은 이름도 별도 ID로 유지되며 자동 병합하지 않습니다.
2. `구성원 관리`에서 기존 활성 Customer를 선택하고, 필요하면 가족 안에서만 표시할 관계명을 입력합니다. 관계명은 법적 관계나 대표자 의미로 해석하지 않습니다.
3. 가족 목록과 구성원 dialog에서 활성 구성원의 합계대상 계약 월보험료를 확인합니다. `관리대상`과 자유 입력 상태는 가족 합계 제외 조건이 아닙니다.
4. 구성원을 제외해도 Customer·계약과 다른 가족 소속은 남습니다. 같은 Customer를 다시 추가하면 삭제했던 membership을 명시적으로 재활성화합니다.

가족 이름과 관계명에는 주민등록번호, 보험사 로그인 정보, 병력·진단·치료 내용을 입력하지 마세요. 삭제된 Family와 membership 원본은 로컬 DB에 남으며 현재 별도 purge·범용 복원 UI는 제공하지 않습니다.

### 상담 사용 흐름

1. 고객 목록에서 `상세`를 열고 `상담 기록`에서 상담 일시를 입력합니다. 내용·다음 연락일·결과는 선택입니다.
2. 화면에는 OS local 상담 일시가 표시되고 SQLite에는 같은 instant의 UTC timestamp가 저장됩니다. 다음 연락일은 시각 없는 `YYYY-MM-DD` 날짜로 저장됩니다.
3. 상담은 최신 일시 우선으로 표시됩니다. 같은 instant의 상담도 별도 ID로 유지되어 각각 수정하거나 삭제할 수 있습니다.
4. 상담을 삭제하면 기본 목록에서 숨겨지지만 원본은 로컬 DB에 남습니다. Customer를 제외해도 연결 상담 원본은 유지되고 기본 상세 조회에서 숨겨집니다.

상담 내용에는 주민등록번호, 보험사 로그인 정보, 민감 병력·상세 병력이나 진단·치료 상세를 입력하지 마세요. 이 안내는 저장 금지 정보를 기술적으로 탐지하거나 제거한다는 뜻이 아닙니다.

### Dashboard 사용 흐름

1. 앱 시작 화면이나 왼쪽 `대시보드`에서 관리대상 고객의 오늘 연락, 상령·만기 예정과 최근·미상담 대상을 확인합니다.
2. 고객·가족 보험료와 보장 부족 카드는 기존 합계대상 계약·가족 summary·사용자 Benchmark 판정을 요청 시 조합합니다. 공식 보험 권고가 아닙니다.
3. 각 카드의 전체 건수와 설정된 우선순위 detail을 보고 고객 이름을 눌러 상세로 이동합니다. 가족 항목은 가족 관리로 이동합니다.
4. 앱 진입, 다시 활성화, local 날짜 변경 시 현재 원본으로 다시 계산합니다. Dashboard 결과 자체는 SQLite나 Browser 저장소에 보관하지 않습니다.

### 설정·백업·복원 사용 흐름

1. 왼쪽 `설정`에서 light/dark 테마, 오늘 포함 최근 상담 기간, 미상담 기준과 카드별 표시 건수를 저장합니다. 미상담 기준은 최근 상담 기간 이상이어야 하며 상령·만기 30/60/90일 구간은 바뀌지 않습니다.
2. 데스크톱 앱은 기본 app-data `backups`에 local date당 자동 성공본이 없을 때 daily backup을 만들고, 정상 종료에는 마지막 성공본 이후 DB가 바뀐 경우만 exit backup을 추가합니다. `daily|exit` 최근 30개만 자동 정리합니다.
3. `백업 폴더 변경`은 native folder dialog로 로컬 폴더를 정하며 앱에는 기본/custom 여부와 폴더명만 표시합니다. 사용할 수 없어진 custom 위치를 기본 폴더로 조용히 바꾸지 않습니다.
4. `지금 백업`은 설정된 폴더에 retention에서 제외되는 manual `.bodam-backup`을 만듭니다. 파일은 strict manifest와 `database.sqlite3`만 가진 검증된 ZIP이지만 암호화되지 않은 평문입니다.
5. `백업에서 복원`은 native 파일 선택 뒤 시각·앱/schema 버전만 미리 보여 줍니다. 확인하면 현재 DB의 `pre_restore` 안전 사본과 pending marker를 만든 뒤 앱을 재시작하고, repository를 열기 전에 migration·무결성 검사를 거쳐 교체합니다. 실패하면 안전 사본으로 rollback합니다.

백업에는 고객·계약·상담·일정과 soft delete 원본이 모두 포함됩니다. 같은 디스크의 백업은 기기 손상·분실에 대한 별도 복구 수단이 아니므로 접근 통제된 별도 로컬 매체로 폴더를 정하고, 공유·동기화·네트워크 폴더는 현재 지원 범위로 가정하지 마세요.

### Calendar와 일정 사용 흐름

1. 왼쪽 `달력`에서 월을 이동하거나 `오늘`로 돌아오고 날짜를 선택해 상담·다음 연락·상령·계약 만기와 직접 등록한 일정을 확인합니다.
2. 상담 시각만 OS local timezone의 날짜·시간으로 변환합니다. 다음 연락일·만기일·일정 날짜와 선택 시간은 입력한 local date·wall time 의미를 유지합니다.
3. `일정 등록`에서 제목·날짜를 입력하고 필요하면 분 단위 시간, 메모, 활성 고객 연결과 완료 여부를 선택합니다. 완료 일정도 숨기지 않고 상태로 표시합니다.
4. 일정은 수정·완료/되돌리기하거나 확인 뒤 soft delete할 수 있습니다. 연결 Customer를 제외하면 일정 원본은 남지만 Calendar에서 숨고, 연결 없는 일정은 계속 보입니다.

일정 제목과 메모에는 주민등록번호, 보험사 로그인 정보, 민감 병력·상세 병력이나 진단·치료 상세를 입력하지 마세요. Calendar는 원본 계약·상담을 복제하지 않고 요청 시 5종 event read model로 다시 계산합니다.

SQLite 파일은 Tauri가 결정한 운영체제별 app-data 디렉터리의 `bodam.sqlite3`에 저장됩니다. 앱을 제거하거나 사용자 프로필을 정리하기 전에는 Settings에서 검증된 수동 백업을 만들고, 그 파일을 앱 데이터와 별도로 보관하세요.

## 현재 제한

- 보장 카테고리는 암, 유사암, 뇌혈관, 심혈관, 질병수술, 상해수술, 후유장해, 입원, 간병, 운전자 10개를 최초 migration에서 한 번만 제공합니다.
- 카테고리 신규 생성과 삭제 복원은 제공하지 않습니다. 이름을 바꾸거나 삭제해도 앱 시작 시 초기값으로 자동 복원하지 않습니다.
- 보장 Benchmark는 Customer 성별의 정확 일치만 지원하며 성별 enum·별칭·전체 wildcard, 자동 권고·추천과 전체 카테고리를 합친 단일 보장 총액은 제공하지 않습니다.
- 보장에는 카테고리와 가입금액만 저장하며 특약명, 피보험자, 보장기간, 메모, 병력·청구 정보는 저장하지 않습니다.
- 가족 대표, 관계 enum·방향성 그래프, 모든 가족을 합친 보험료와 가족 보장 합계는 제공하지 않습니다.
- Dashboard의 오늘 연락은 고객별 최신 상담의 다음 연락일을 현재 상태로 사용합니다. 완료 task, 오래된 연락 일정의 별도 이력 보기와 전역 상담 검색은 제공하지 않습니다.
- Dashboard chart와 OS notification은 아직 제공하지 않습니다.
- Calendar의 주·일 보기, 반복·우선순위·drag and drop, 완료 일정 자동 숨김과 일정 복원은 제공하지 않습니다.
- 상담 복원·purge, 상담 유형·채널·태그·첨부와 외부 전화·메시지 연동은 제공하지 않습니다.
- source 없는 수동 계약의 21열 합성, 현재 계약 값과 source가 충돌할 때의 자동 우선순위, 선택 고객·기간 export는 제공하지 않습니다. source 수정·purge, 여러 파일 동시 처리와 background import/export도 제공하지 않습니다.

## 시작 위치

- 제품 범위: docs/product/product.md
- 상세 요구사항: docs/product/requirements.md
- 미결정 질문: docs/product/open-questions.md
- 시스템 구조: docs/architecture/system-overview.md
- 데이터 원칙: docs/architecture/data-model.md
- Excel/CSV 계약: docs/architecture/import-export.md
- 달력·알림 계약: docs/architecture/calendar-notification.md
- 품질 규칙: docs/quality/rules.md
- 개인정보 규칙: docs/privacy/principles.md
- 공식 자료: docs/references/official-sources.md
- 현재 계획: docs/exec_plans/active/

## 현재 실행 가능한 검증

전체 제품 QA와 동일 검증의 최종 재실행:

    npm run qa
    npm run verify

`qa`는 일상적으로 실행 가능한 비-GUI 검사입니다. `verify`는 `qa` 다음에 release-mode Tauri 앱을 실제로 실행하는 WebdriverIO E2E까지 수행합니다. E2E는 분리된 합성 고객·XLSX·CSV·rollback 임시 SQLite만 사용하며 종료 시 DB, 내보낸 파일과 runtime fixture를 삭제합니다.

네이티브 앱의 고객·가족·보험계약·보장·Benchmark 판정·상담·일정, Dashboard 8개 카드, Calendar 5종 event와 XLSX/CSV 계약 가져오기·내보내기·원자 rollback·프로세스 재시작 지속성을 다시 확인하려면 다음 명령을 사용합니다. 내보내기 E2E는 생성 파일의 21열 값을 독립적으로 재해석하고 앱 import preview로 다시 열며, 전후 SQLite 논리 스냅샷이 같은지도 확인합니다.

    npm run test:e2e

Windows hosted runner도 같은 embedded WebDriver 방식을 사용합니다. 다만 hosted 성공은 WebView2가 없는 offline VM의 installer 실행을 대신 증명하지 않으므로 증거 범위는 [Windows E2E 증거 기준](docs/quality/windows-e2e-evidence.md)을 따릅니다.

개별 검증:

    npm run lint
    npm run typecheck
    npm run test:unit
    npm run prisma:validate
    npm run test:db
    npm run build
    npm run tauri:check

저장소 구조·계획·개인정보·아키텍처 하네스:

    python3 harness/scripts/run_qa.py
    python3 harness/scripts/run_review.py

## 기술 스택

- Frontend: Vue 3, Vite, strict TypeScript, Pinia, Vue Router
- Desktop: Tauri 2 + Rust
- Database runtime: bundled SQLite via `rusqlite`
- Schema/migration artifact source: Prisma
- Validation: Zod와 Rust command validation
- Test/quality: Vitest, WebdriverIO embedded Tauri WebDriver, ESLint, vue-tsc, Cargo test/clippy, Python harness

Prisma는 schema와 migration artifact의 source이며 runtime ORM으로 사용하지 않습니다. Tauri의 Rust adapter가 같은 migration SQL을 적용하고 SQLite를 접근합니다. 결정과 검증 경계는 `docs/architecture/decisions/adr-001-prisma-tauri-runtime.md`에 기록되어 있습니다.

## 작업 흐름

모든 구현 작업은 다음 순서를 지킵니다.

    계획 작성 및 승인
    → 구현
    → 테스트/QA
    → 리뷰
    → 계획 완료 처리
    → 커밋

main에서 직접 작업하지 않습니다. 작업 브랜치는 codex/plan-NNN-task, worktree는 .worktree/plan-NNN-task 형식을 사용합니다.
