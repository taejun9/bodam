# Agent Harness 구조

## 목적

채팅 밖에서도 계획, 현재 상태, 검증 방법, 금지사항과 완료 기록을 저장소만 보고 알 수 있게 한다.

## 저장 위치

- AGENTS.md: 짧은 저장소 지도
- docs/product/: 제품 범위와 미정 질문
- docs/architecture/: durable 설계와 ADR
- docs/privacy/: 데이터 금지·권한 경계
- docs/quality/: QA·리뷰 기준
- docs/exec_plans/active/: 승인 대기 또는 진행 중 계획
- docs/exec_plans/completed/: 완료된 계획
- docs/reviews/: 완료 계획의 리뷰 mirror
- harness/templates/: 계획·회의·리뷰 템플릿
- harness/scripts/: 반복 가능한 검사

docs/plan은 금지한다.

## 작업 흐름

    main 최신 상태 확인
      → codex/plan-NNN-task 브랜치
      → .worktree/plan-NNN-task
      → active plan 작성
      → 사용자 승인 기록
      → 구현
      → QA
      → 리뷰
      → completed plan과 review mirror
      → 커밋
      → main 병합·푸시
      → 브랜치 삭제와 worktree 제거

범위나 접근이 바뀌면 코드 변경과 동시에 또는 먼저 Decision Log를 갱신한다.

## 현재 검사

    python3 harness/scripts/run_qa.py
    python3 harness/scripts/run_review.py

앱 코드가 생기면 package test, lint, typecheck, build와 Tauri 검증을 run_qa.py에 연결한다.

## QA와 리뷰

QA는 기계적으로 확인 가능한 실패를 찾는다. 리뷰는 QA 통과 이후 요구사항, 설계, 개인정보, 잔여 위험을 판단한다. 동일한 단계를 이름만 바꾸어 두 번 실행하지 않는다.
