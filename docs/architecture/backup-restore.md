# 백업과 복원 계약

## 상태

plan-012에서 구현·검증하는 SQLite backup, restore와 Settings 수명주기 계약이다.

## 사용자 요구

- 프로그램 종료 시 백업
- 하루 1회 자동 백업
- 최근 30개 보관
- 복원 기능
- 별도 서버 없이 로컬에서 동작

## 기본 원칙

- backup은 SQLite 파일을 다루는 infrastructure use case이며 UI가 파일을 직접 복사하지 않는다.
- 열려 있는 DB 파일을 무조건 byte copy해 일관된 backup이라고 가정하지 않는다.
- 선택한 SQLite adapter와 transaction 방식에 맞는 안전한 snapshot 절차를 검증한다.
- 성공한 새 backup을 검증한 뒤에만 retention 정리를 수행한다.
- backup, export, 원본 DB를 같은 민감도로 취급한다.

## Settings

- v9 `app_settings` singleton은 light/dark theme, 최근 상담 일수, 미상담 기준 일수, Dashboard 공통 표시 건수와 nullable custom backup directory를 가진다.
- 기본값은 light, 30일, 90일, 10건과 app-data `backups`다.
- 최근 상담은 오늘 포함 1–365일, 미상담은 1–3,650일이고 미상담 기준은 최근 상담 기간 이상이다.
- 카드 표시 건수는 1–10이며 상령·만기의 0–30/31–60/61–90 bucket은 설정으로 바꾸지 않는다.
- custom backup directory는 장치별 로컬 권한이므로 artifact에는 포함되지만 restore working DB에서 `NULL`로 정화한다. 복원 뒤에는 기본 app-data `backups`를 쓰며 사용자가 native dialog로 다시 선택해야 한다.
- sidebar collapse 같은 일시적 UI 상태는 backup하지 않는다. Benchmark는 이미 SQLite에 있어 전체 snapshot에 포함된다.

## Trigger

### 프로그램 종료

- 정상 종료 요청에서 새 online snapshot checksum이 마지막 성공 backup과 다를 때만 exit backup을 만든다.
- backup 실패 시 종료를 막고 사용자가 재시도 또는 경고 확인 뒤 backup 없이 종료를 고른다.
- OS 강제 종료, crash, 전원 차단에서는 실행을 보장하지 않는다.

### 하루 1회

- 앱 시작, desktop resume에 해당하는 focus/visibility 복귀와 local date 변경에서 해당 local date의 성공 automatic backup을 확인한다.
- 같은 local date에 `daily|exit` 성공본이 없을 때만 daily를 만들고, 이후 DB가 바뀌면 정상 종료 exit backup은 별도로 만들 수 있다.
- manager mutex가 daily, exit, manual과 restore 작업을 한 번에 하나만 실행한다.

## Backup artifact

- 확장자는 `.bodam-backup`이고 ZIP root에 정확히 `manifest.json`, `database.sqlite3`만 둔다.
- manifest v1은 UTC timestamp, local date, `daily|exit|manual|pre_restore` reason, app version, migration 수/마지막 이름, DB byte size와 SHA-256을 가진 strict JSON이다.
- SQLite online backup API가 WAL을 포함한 일관된 logical snapshot을 destination DB에 만든다. source DB 파일과 `-wal`, `-shm`을 raw copy하지 않는다.
- destination DB는 `integrity_check`, `foreign_key_check`, 등록 migration prefix와 runtime schema를 검사한다.
- archive entry 수·이름과 compressed/uncompressed size를 제한하고 선택 원본을 migration으로 수정하지 않는다.
- same-directory random temp에 archive를 만들고 flush·sync·reopen 검증 뒤 atomic replace한다.
- macOS/Linux의 custom backup directory는 canonical 선택 뒤 절대경로 component를 `O_DIRECTORY|O_NOFOLLOW`로 열어 directory FD capability로 고정한다. archive create/open/fstat/rename, retention unlink와 directory fsync는 모두 이 FD에 상대 수행한다.
- 각 작업 시작과 최종 directory sync 뒤 설정 경로를 다시 nofollow-open하고 cached FD와 device/inode identity를 대사한다. 위치가 사라지거나 다른 directory로 바뀌면 성공으로 보고하지 않으며 새 경로에 쓰지 않는다.
- 이 보장은 macOS/Linux 로컬 filesystem 경계다. Windows는 현재 canonical/path validation fallback이며 junction/reparse point를 막는 directory HANDLE 고정과 실제 local NTFS·installer E2E는 plan-013에서 검증한다.

cache, log, import/export 파일, E2E runtime과 sidebar UI cache는 backup 대상이 아니다.

## Retention

- 최근 30개는 성공하고 검증된 backup을 기준으로 한다.
- 정렬 key는 strict manifest timestamp와 basename 동점이다.
- `daily|exit` automatic만 최근 30개를 남기고 `manual|pre_restore`는 제외한다.
- 31번째 성공 automatic 뒤 가장 오래된 대상부터 제거한다.
- 삭제 실패가 새 backup 성공을 무효화하지 않도록 별도 상태로 보고한다.

## Restore

    native 파일 선택
      → exact archive·manifest·checksum·schema·SQLite 검사
      → app-data 내부 staging과 pathless preview
      → 사용자 확인
      → 현재 DB의 검증된 pre_restore artifact
      → durable pending marker
      → 앱 재시작
      → repository 연결 전 working DB migration·대사
      → host-local custom backup directory 정화·재검증
      → same-directory atomic replace
      → 성공 또는 pre_restore rollback

- current 또는 등록된 과거 migration prefix만 허용하고 working copy에서 current로 migration한다. future, unregistered, reordered와 checksum drift는 거부한다.
- 선택 원본 archive를 수정하지 않고 현재 DB를 덮어쓰기 전에 pre_restore artifact와 fully validated working DB를 모두 준비한다.
- macOS/Linux에서 native dialog가 고른 restore 원본은 final component를 `O_NOFOLLOW|O_CLOEXEC`로 열고 `fstat` regular-file·size를 확인한 같은 descriptor에서 private app-data staging으로 bounded copy한다. Windows reparse/HANDLE 경계는 plan-013 잔여다.
- restore staging root는 현재 OS 계정 전용 `0700`, staged copy는 `0600`으로 유지하고 원본 path나 bytes를 log·IPC에 남기지 않는다.
- pending restore는 다음 startup에서 어떤 feature repository connection도 열기 전에만 적용한다.
- 공식 single-instance plugin을 첫 plugin으로 등록해 pending restore보다 먼저 두 번째 process를 차단한다. 두 번째 실행은 args·cwd를 log·IPC에 남기지 않고 기존 main window focus만 요청한다.
- 교체 뒤 migration/schema/logical 대사가 실패하면 pre_restore DB로 rollback하고 현재 데이터로 앱을 연다.
- 성공·실패 status를 내구 저장한 뒤 pending marker를 먼저 확인 삭제·directory sync하고 staging operand를 정리한다. marker 삭제가 실패하면 재시도를 위해 staged archive와 safety DB를 보존한다.
- startup status는 repository/runtime 초기화 전에 삭제 없이 읽고, 첫 성공한 `load_backup_status` 응답을 만든 뒤에만 디스크 값 대사·파일 삭제·parent sync로 acknowledge한다. 초기화·응답·acknowledge 실패 시 디스크와 메모리 상태를 유지해 다음 요청이나 재실행에서 재시도한다.
- marker가 없는 startup은 restore root와 DB parent 바로 아래에서 정확한 app-owned prefix·v4 UUID·확장자·regular-file 조건을 모두 만족하는 preview/safety/working/replacement orphan만 제거한다. 읽기·삭제·sync 실패는 성공으로 숨기지 않는다.
- process 중단 뒤에는 restore root의 `.bodam-state-<v4>.tmp.json`과 default/custom backup directory의 `.bodam-write-check-<v4>.tmp`를 startup 또는 다음 directory 획득 때 회수한다. 기존 `SecureFile`의 `random_sibling` 조합이 실제로 만드는 `.bodam-write-check-<v4>.tmp.tmp`도 호환 회수하되, canonical lowercase v4와 exact suffix인 regular file만 nofollow 검사 뒤 삭제하고 directory sync 실패를 보고한다.
- backup 암호화와 recovery key는 승인 없이 도입하지 않는다.

## 오류와 로그

- 단계, safe error code, schema version과 count처럼 진단에 필요한 최소 정보만 기록한다.
- 고객 row, 상담 메모, 증권번호를 log에 남기지 않는다.
- 전체 path는 IPC result와 log에 넣지 않고 UI에는 기본/custom 여부와 basename만 표시한다.
- 취소, 디스크 부족·권한·파일 잠금, 손상·checksum·schema, retention warning을 구분한다.

## QA

- 빈 DB와 populated synthetic DB
- write transaction 직전·직후
- 같은 날 여러 번 종료
- 날짜 변경과 Windows sleep/resume
- 29, 30, 31개 retention
- 디스크 부족과 읽기 전용 경로
- cached directory FD를 잡은 뒤 ancestor rename/symlink retarget, final sync 직후 retarget과 반복 directory scan
- restore source의 open 직전 symlink 교체, private staging root/file 권한
- state/write-probe process-abort orphan의 exact v4, near-miss·symlink·nonregular 보존과 삭제/directory-sync fault 재시도
- 손상 backup, 오래된 schema, future schema
- restore 전후 schema version, table row count, 핵심 checksum 대사
- restore 실패 시 현재 DB 보존

- Browser는 theme·Dashboard setting과 기존 Benchmark만 synthetic port로 동작하고 native backup/restore 버튼은 이유와 함께 비활성화한다.
- release E2E는 canonical OS temp의 합성 DB와 backup directory만 사용하고 production bundle marker 0을 확인한다.
- release E2E는 첫 앱이 열린 상태에서 같은 binary를 다시 실행해 두 번째 process가 DB setup 전 종료되고 첫 window가 계속 응답하는지 확인한다.

## 잔여 질문

- Windows junction/reparse point·UNC/network share·removable volume의 HANDLE-relative atomicity와 실제 local NTFS 지원 범위는 plan-013에서 검증한다.
- automatic backup을 앱 안에서 열람·개별 삭제·외부 복사할 관리 UI
- 별도 threat model 뒤 encryption, recovery key와 app lock 필요 여부
