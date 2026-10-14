/**
 * The single source of truth for the spreadsheet's shape. The bootstrap script
 * creates tabs from this, and the data layer addresses columns by these header
 * names, so inserting or reordering a column in the sheet does not break the app.
 *
 * Only ever append to a headers array. Renaming or removing a header orphans
 * existing data.
 */

export const TABS = {
  USERS: 'Users',
  STUDENTS: 'Students',
  PAYMENTS: 'Payments',
  FEE_STRUCTURE: 'FeeStructure',
  AUDIT_LOG: 'AuditLog',
};

export const HEADERS = {
  [TABS.USERS]: [
    'user_id',
    'username',
    'password_hash',
    'role',
    'full_name',
    'active',
    'must_change_password',
    'failed_attempts',
    'locked_until',
    'password_changed_at',
    'last_login_at',
    'created_at',
    'created_by',
  ],
  [TABS.STUDENTS]: [
    'student_id',
    'academic_year',
    'class',
    'section',
    'student_name',
    'parent_name',
    'contact',
    'admission_date',
    'active',
    'concession_pct',
    'notes',
    'created_at',
    'created_by',
  ],
  [TABS.PAYMENTS]: [
    'row_id',
    'receipt_no',
    'academic_year',
    'class',
    'section',
    'student_id',
    'student_name',
    'parent_name',
    'month',
    'amount',
    'receipt_total',
    'payment_date',
    'payment_mode',
    'remarks',
    'entered_by',
    'entered_at',
    'status',
    'voided_by',
    'voided_at',
    'void_reason',
  ],
  [TABS.FEE_STRUCTURE]: ['academic_year', 'class', 'monthly_fee', 'effective_from', 'notes'],
  [TABS.AUDIT_LOG]: ['timestamp', 'user', 'action', 'entity_id', 'before', 'after', 'ip'],
};

export const ROLES = { ADMIN: 'admin', OPERATOR: 'operator' };
export const PAYMENT_STATUS = { ACTIVE: 'active', VOID: 'void' };
export const PAYMENT_MODES = ['cash', 'upi', 'cheque', 'bank'];
