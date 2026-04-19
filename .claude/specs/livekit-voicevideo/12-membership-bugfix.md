# Ad-hoc: LiveKit 멤버십 자동 생성 버그 수정

> Epic: [livekit-voicevideo](./README.md)
> 상태: 완료 | 완료일: 2026-04-19
> 커밋: `2a994e0`, `091c524`

## 개요
PUBLIC 스페이스 직접 URL 입장 시 `spaceMember` 레코드가 없으면
LiveKit 토큰 API가 "You are not a member" 에러를 반환하던 버그 수정.
`page.tsx`에서 입장 시 멤버십 자동 생성으로 해결.

## 변경 파일
| 파일 | 변경 유형 |
|------|-----------|
| `src/app/space/[id]/page.tsx` | 수정 — 멤버십 자동 생성 로직 추가 |

## 장애 흐름

```
브라우저 → /space/{id} 접속 (직접 URL, 초대 없이)
  → page.tsx: spaceMember 레코드 없음 (생성 안 함)
  → SpaceClient 마운트 → LiveKitRoomProvider 토큰 요청
  → /api/livekit/token: spaceMember 조회 → 없음
  → "You are not a member" 에러 반환
  → UI: 연결 실패 표시
```

## 주요 구현

### src/app/space/[id]/page.tsx — 멤버십 자동 생성

```typescript
// 멤버십 자동 생성 (PUBLIC 스페이스 + 비오너 + 미가입자만)
const isOwner = space.ownerId === session.user.id;

if (!isOwner) {
  const existingMember = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: id, userId: user.id } },
    select: { id: true },
  });

  if (!existingMember) {
    if (space.accessType === "PUBLIC") {
      await prisma.spaceMember.create({
        data: {
          spaceId: id,
          userId: user.id,
          displayName: user.name,
          role: "PARTICIPANT",
        },
      });
    } else {
      // PRIVATE/PASSWORD 스페이스는 초대 코드로만 가입 가능
      redirect("/my-spaces");
    }
  }
}
```

**설계 결정**:
- 오너는 멤버십 체크 대상 아님 — `isOwner` 분기로 건너뜀
- `findUnique` 선행으로 중복 생성 방지 (이미 멤버이면 그대로 통과)
- PRIVATE/PASSWORD 스페이스는 `/my-spaces`로 redirect — 초대 없는 직접 입장 불가
- `displayName: user.name` — 초기 표시명으로 설정

## 비고
- 오너는 SpaceMember 레코드가 없어도 LiveKit 토큰 발급 시 별도 처리됨 (토큰 API 내부 로직)
- 본 수정으로 PUBLIC 스페이스 공유 링크 시나리오(비가입자 직접 입장)가 정상 동작
