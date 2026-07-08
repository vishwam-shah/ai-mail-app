// Registry of the assistant's in-flight human-in-the-loop interactions
// (confirm-send card, contact picker). When the user types a NEW instruction
// while one of these is still waiting for a click, we don't want the input
// dead and the message dropped — the new instruction should cancel whatever
// was pending and take over. Cards register a canceller while they're
// awaiting a response; the chat input cancels them all before sending.

type Canceller = () => void;

const cancellers = new Set<Canceller>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/** Called by a HITL card on mount; returns an unregister cleanup. */
export function registerPendingInteraction(cancel: Canceller): () => void {
  cancellers.add(cancel);
  notify();
  return () => {
    cancellers.delete(cancel);
    notify();
  };
}

export function hasPendingInteraction(): boolean {
  return cancellers.size > 0;
}

export function hasPendingInteractionServerSnapshot(): boolean {
  return false;
}

export function subscribePendingInteraction(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Cancel every pending interaction (each canceller is respond-once guarded). */
export function cancelPendingInteractions(): void {
  for (const cancel of [...cancellers]) cancel();
}
