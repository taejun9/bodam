# Team BODAM Agent Map

이 파일은 저장소 지도입니다. 상세 규칙은 docs/에 둡니다.

## 팀 역할

| id | 별칭 | 책임 |
|---|---|---|
| project_lead | 보담 | 범위 조정, 사용자 보고, 의사결정 |
| plan_keeper | 설계 | 실행 계획, 승인 상태, 완료 이동 |
| repo_cartographer | 지도 | 저장소 구조와 문서 탐색성 |
| harness_builder | 기반 | 검사 스크립트와 로컬 하네스 |
| quality_runner | 검증 | QA 실행, 실패 기록, 재검증 |
| review_judge | 심사 | QA 이후 독립 리뷰 |
| privacy_guard | 수호 | 개인정보·민감정보·권한 경계 |
| doc_gardener | 정리 | 완료 계획, 리뷰, 문서 정합성 |

보고 형식은 별칭: 내용으로 통일합니다.

## 먼저 읽을 문서

- docs/product/product.md
- docs/product/requirements.md
- docs/product/open-questions.md
- docs/architecture/system-overview.md
- docs/quality/rules.md
- docs/privacy/principles.md
- docs/exec_plans/active/

## 절대 규칙

1. No Exec Plan, No Work. 구현 전 docs/exec_plans/active/plan-NNN-task.md를 만들고 사용자 승인 근거를 기록한다.
2. 요구사항을 추측하지 않는다. 미정 사항은 계획의 Open Questions 또는 docs/product/open-questions.md에 남긴다.
3. main에서 구현·커밋·푸시하지 않는다. codex/plan-NNN-task와 .worktree/plan-NNN-task를 사용한다.
4. 순서는 계획·승인 → 구현 → QA → 리뷰 → 완료 계획/리뷰 기록 → 커밋이다.
5. UI에 비즈니스 로직을 두지 않는다. feature 내부 service가 규칙을 소유하고 UI는 application 계약만 호출한다.
6. 소스·문서·migration·생성물은 300줄에 도달하기 전에 책임 단위로 분리한다. 구조적으로 분리할 수 없는 package manager와 Cargo lockfile만 검사에서 제외한다.
7. SQLite 전용 SQL, 하드 삭제, 원격 의존 기능을 임의로 추가하지 않는다. 삭제 가능한 업무 데이터는 deletedAt 기반 soft delete를 기본으로 한다.
8. 실사용 고객 데이터와 첨부 원본의 행 값은 소스, 테스트, 문서, 로그, 스크린샷에 복사하지 않는다.
9. 주민등록번호, 보험사 로그인 정보, 민감 병력, 상세 병력을 저장하지 않는다.
10. QA가 통과하기 전 리뷰하지 않고, 리뷰가 끝나기 전 커밋하지 않는다.

## 완료 수명주기

1. 활성 계획에 QA 증거를 기록한다.
2. 리뷰를 수행하고 findings를 해결하거나 잔여 위험으로 기록한다.
3. 계획을 docs/exec_plans/completed/로 이동한다.
4. docs/reviews/에 동일 plan 번호의 리뷰를 만든다.
5. 작업 브랜치를 커밋하고 main에 병합·푸시한다.
6. 병합된 브랜치를 git branch -d로 삭제하고 worktree를 제거한다.
