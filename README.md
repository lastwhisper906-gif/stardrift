# STARDRIFT

지구가 멸망한 후, 새 자원을 찾아 우주를 항해하는 우주선 조종 게임.  
현재 1인 플레이. 코드는 처음부터 3인 협동 구조로 설계됨.

## 실행 방법

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:3000)
npm run typecheck  # 타입 검사
npm run test       # 단위 테스트
npm run build      # 프로덕션 빌드
```

## 조작법

| 키 | 동작 |
|---|---|
| A / D (또는 ←/→) | 좌우 회전 (Yaw) |
| W / S (또는 ↑/↓) | 상하 기울기 (Pitch) |
| Q / E | 롤 (Roll) |
| Shift | 가속 |
| Space | 감속 |
| R / F | 상승 / 하강 |

## 아키텍처

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ KeyboardInput│───▶│ InputRouter  │───▶│ StationHandlers │
└─────────────┘    │(playerId→    │    │ Helm/Throttle/  │
                   │ Station[])   │    │ Vertical ...    │
                   └──────────────┘    └────────┬────────┘
                                                │ Partial<GameState>
                   ┌──────────────┐    ┌────────▼────────┐
                   │ SceneManager │◀───│   LocalRoom     │
                   │ (Three.js)   │    │ (IStateRoom)    │
                   └──────────────┘    └────────┬────────┘
                                                │
                   ┌──────────────┐    ┌────────▼────────┐
                   │ EventManager │    │ PhysicsSystem   │
                   │ PILOTING ↔  │    │ (Euler integr.) │
                   │ IN_EVENT    │    └─────────────────┘
                   └──────────────┘
```

### 핵심 불변식

1. **게임 로직은 Station 단위** — `player`를 직접 읽지 않음
2. **단일 권위 상태** — `LocalRoom`(→ 추후 Colyseus Room)만이 GameState를 소유
3. **InputRouter 단독 매핑** — `{ playerId → Station[] }` 매핑은 InputRouter만 관리
4. **이벤트 독립 모듈** — `IEvent` 인터페이스(`onEnter/update/onExit/isComplete`)로 통일

### 1인 → 3인 전환

`InputRouter.assignStations()` 호출과 역할 배정 UI만 추가하면 됨.  
게임 로직 변경 불필요.

## 기술 스택

- **Vite + TypeScript** — 빌드 및 개발환경
- **Three.js** — 3D 렌더링
- **Colyseus** — 권위 상태 (추후 연동, 현재 LocalRoom으로 대체)
- **Vitest** — 단위 테스트
- **Playwright** — E2E · 시각 검증
