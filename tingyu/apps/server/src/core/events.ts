// In-process domain events. Owned by the lead. Listeners must not throw (errors are logged).
type Events = {
  'appointment.paid': { appointmentId: string };
  'appointment.completed': { appointmentId: string };
  'appointment.refunded': { appointmentId: string };
  'intake.crisis': { sessionId: string; userId: string | null };
};
type Handler<K extends keyof Events> = (p: Events[K]) => void;
const handlers: { [K in keyof Events]?: Handler<K>[] } = {};

export function on<K extends keyof Events>(name: K, fn: Handler<K>) {
  (handlers[name] ||= [] as any).push(fn);
}
export function emit<K extends keyof Events>(name: K, payload: Events[K]) {
  for (const fn of (handlers[name] || []) as Handler<K>[]) {
    try { fn(payload); } catch (e) { console.error(`[event ${name}]`, e); }
  }
}
export function clearListeners() { for (const k of Object.keys(handlers)) delete (handlers as any)[k]; }
