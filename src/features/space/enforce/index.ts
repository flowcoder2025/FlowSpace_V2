// Communication Domain - Enforcement Module (Public API)
//
// dashboard 관리 제재(ban/kick/mute/unmute/changeRole)를 socket.io 서버에 실시간
// 전파하는 크로스프로세스 채널. server/ 측(서명 검증·소켓 처리)은 별도 esbuild 번들이라
// 이 배럴을 거치지 않고 internal/contract 를 상대경로로 직접 COPY/import 한다.
export { dispatchEnforcement } from "./internal/dispatch";
export type { EnforceResult } from "./internal/dispatch";
export type { EnforceRequest, EnforceAction, EnforceRole } from "./internal/contract";
