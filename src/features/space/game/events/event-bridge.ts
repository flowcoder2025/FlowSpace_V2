/**
 * EventBridge - React ↔ Phaser 통신 브릿지
 *
 * flow_metaverse의 events.ts를 기반으로 타입 안전성을 강화한 버전
 */

type EventCallback = (...args: unknown[]) => void;

class EventBridge {
  private events: Map<string, Set<EventCallback>> = new Map();

  /** 이벤트 구독 */
  on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  /** 이벤트 구독 해제 */
  off(event: string, callback: EventCallback): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /** 이벤트 발행 */
  emit(event: string, ...args: unknown[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(...args));
    }
  }

  /** 특정 이벤트 또는 전체 리스너 제거 */
  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  /** 등록된 리스너 수 확인 (디버그용) */
  listenerCount(event: string): number {
    return this.events.get(event)?.size ?? 0;
  }
}

/** Singleton EventBridge 인스턴스 */
export const eventBridge = new EventBridge();
