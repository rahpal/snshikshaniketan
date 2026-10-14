import { z } from 'zod';
import { isAcademicYear, isMonthKey } from './academic-year.js';
import { PAYMENT_MODES, ROLES } from './sheet-schema.js';
import { PASSWORD_MIN_LENGTH } from './password.js';

/**
 * Every request body is parsed through one of these before it reaches the
 * sheet, so nothing untrimmed, overlong or structurally wrong is ever written.
 */

const trimmed = (max, label) =>
  z
    .string({ message: `${label} is required.` })
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`);

export const usernameSchema = trimmed(40, 'Username')
  .min(3, 'Username must be at least 3 characters.')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dot, underscore and hyphen.')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string({ message: 'Password is required.' })
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`)
  .max(128, 'Password must be 128 characters or fewer.');

export const loginSchema = z.object({
  username: trimmed(40, 'Username').min(1, 'Username is required.').transform((v) => v.toLowerCase()),
  password: z.string({ message: 'Password is required.' }).min(1, 'Password is required.'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string({ message: 'Current password is required.' }).min(1, 'Current password is required.'),
  newPassword: passwordSchema,
});

export const createUserSchema = z.object({
  username: usernameSchema,
  full_name: trimmed(80, 'Full name').min(2, 'Full name is required.'),
  role: z.enum([ROLES.ADMIN, ROLES.OPERATOR], { message: 'Role must be admin or operator.' }),
});

export const academicYearSchema = z
  .string({ message: 'Academic year is required.' })
  .refine(isAcademicYear, 'Academic year must look like 2026-27.');

export const monthKeySchema = z
  .string({ message: 'Month is required.' })
  .refine(isMonthKey, 'Month must look like 2026-04.');

export const classNameSchema = trimmed(30, 'Class').min(1, 'Class is required.');

export const paymentSchema = z.object({
  academic_year: academicYearSchema,
  class: classNameSchema,
  section: trimmed(10, 'Section').optional().default(''),
  student_id: trimmed(40, 'Student').optional().default(''),
  student_name: trimmed(80, 'Student name').min(2, 'Student name is required.'),
  parent_name: trimmed(80, 'Parent name').min(2, 'Parent name is required.'),
  months: z
    .array(monthKeySchema)
    .min(1, 'Select at least one month.')
    .max(12, 'A single receipt cannot cover more than 12 months.')
    .refine((months) => new Set(months).size === months.length, 'The same month is selected twice.'),
  amount: z
    .number({ message: 'Amount is required.' })
    .positive('Amount must be more than zero.')
    .max(1000000, 'Amount looks too large. Please check it.'),
  payment_date: z
    .string({ message: 'Payment date is required.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must look like 2026-04-14.'),
  payment_mode: z.enum(PAYMENT_MODES, { message: 'Choose how the fee was paid.' }),
  remarks: trimmed(300, 'Remarks').optional().default(''),
  allow_duplicate: z.boolean().optional().default(false),
});
