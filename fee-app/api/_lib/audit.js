import { appendObjects } from './table.js';
import { TABS } from './sheet-schema.js';

/**
 * Appends one line to the audit log. Deliberately never throws: a failure to
 * record history must not roll back or hide the action the user just completed.
 * It is logged loudly instead.
 */
export async function audit({ user, action, entity_id = '', before = null, after = null, ip = '' }) {
  try {
    await appendObjects(TABS.AUDIT_LOG, {
      timestamp: new Date().toISOString(),
      user: user ?? 'anonymous',
      action,
      entity_id,
      before: before ? JSON.stringify(before) : '',
      after: after ? JSON.stringify(after) : '',
      ip,
    });
  } catch (error) {
    console.error('Failed to write audit entry', { action, entity_id }, error);
  }
}
