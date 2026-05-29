# CLAUDE.md — STARDRIFT (우주선 협동 게임)

> 이 파일은 Claude Code가 매 세션 항상 읽는 프로젝트 규칙이다. "항상 참인 것"만 적는다.
> (가끔 쓰는 절차는 `.claude/skills/`, 자동 실행은 hooks로 분리한다.)

## 프로젝트
지구 멸망 후 새 자원을 찾아 항해하는 우주선 협동 게임. **현재 1인 플레이. 단, 코드는 3인 협동 구조로 짓고 플레이어만 1명인 상태.** 1→3인 전환은 입력 라우팅 + 역할 배정 UI 수준이어야 한다.

## 절대 불변식 (위반 금지)
1. 게임 로직은 "player"가 아니라 **Station(역할)** 단위로 입력을 읽는다.
2. 권위 GameState는 **단일 소스**(Colyseus Room / 로컬 룸)에만 존재. 클라이언트는 구독·렌더만.
3. `InputRouter`가 `{ playerId -> Station[] }` 매핑을 단독 관리. 게임 로직은 이 매핑을 모른다.
4. 모든 이벤트는 공통 인터페이스(`onEnter/update/onExit/isComplete`)를 가진 독립 모듈. `EventManager`가 PILOTING↔IN_EVENT 상태머신으로 전환.
5. 위 구조를 깨야 하면 먼저 사용자에게 이유를 설명하고 승인받는다.

## 기술 스택
Vite + TypeScript / Three.js / Colyseus(권위 상태) / Vitest / Playwright(E2E·시각검증). 물리는 필요 시 cannon-es 또는 Rapier. 스택 변경은 사용자 승인 필요.

## 디렉터리(예시)
- `src/state/` — GameState 타입과 권위 상태
- `src/stations/` — Station 정의와 입력 처리
- `src/input/` — InputRouter
- `src/events/` — 이벤트 모듈 (asteroid, alien, repair, docking, subship, blackhole, eva)
- `src/render/` — Three.js 씬·렌더
- `server/` — Colyseus 룸

## 명령어
- 개발 실행: `npm run dev`
- 타입체크: `npm run typecheck`
- 테스트: `npm run test`
- 빌드: `npm run build`

## 완료 정의 (Definition of Done)
"끝났다"고 말하기 전에 항상:
1. `npm run typecheck` 통과
2. 관련 `npm run test` 통과
3. `npm run dev`에서 실제 동작 확인 (가능하면 Playwright로 화면 확인)

## 작업 규칙
- 기능마다 코드 전에 짧은 계획 제시(작은 단위로).
- 한 커밋 = 한 가지. 커밋 메시지 명확히.
- 라이브러리 API가 의심되면 추측하지 말고 Context7로 현재 버전 문서 확인.
- 큰 결정은 추측하지 말고 선택지를 제시해 사용자에게 묻는다.

## 서브에이전트 사용 규칙
- 리서치/리뷰/QA용 서브에이전트는 **읽기 전용 도구**로 제한(Edit/Write 제외)한다.
- 실제 파일 수정은 메인(부모) 에이전트가 한다.
