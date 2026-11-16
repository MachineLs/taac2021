// Write an in-app notification. Owned by the lead; any module may call it.
import { run } from './db';
import { id, nowIso } from './util';
export function notify(userId: string, type: string, title: string, body: string, link: string | null = null) {
  run('INSERT INTO notifications (id, user_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)',
    id('n'), userId, type, title, body, link, nowIso());
}
