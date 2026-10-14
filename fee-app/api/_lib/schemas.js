import { z } from 'zod';
import { isAcademicYear, isMonthKey } from '../../shared/academic-year.js';
import { PAYMENT_MODES, ROLES } from './sheet-schema.js';
import { PASSWORD_MIN_LENGTH } from './password.js';
import { CLASSES, isKnownClass } from '../../shared/school.js';

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

/**
 * Validated against the school's actual class list rather than accepted as free
 * text, so a typo cannot create a class that the class-wise view will then
 * report on as if it were real.
 */
export const classNameSchema = trimmed(30, 'Class')
  .min(1, 'Class is required.')
  .transform((value) => value.toUpperCase())
  .refine(isKnownClass, `Class must be one of: ${CLASSES.join(', ')}.`);

/**
 * One month and what was paid against it.
 *
 * The amount belongs to the month rather than to the receipt, because months
 * genuinely differ - an exam month costs more, a part payment covers less. A
 * single receipt total divided by the number of months would invent per-month
 * figures that nobody entered, and those figures are exactly what the
 * class-wise view reports.
 */
export const paidMonthSchema = z.object({
  month: monthKeySchema,
  amount: z
    .number({ message: 'Enter an amount for every month.' })
    .positive('Each amount must be more than zero.')
    .max(100000, 'That amount looks too large. Please check it.'),
});

export const paymentSchema = z.object({
  academic_year: academicYearSchema,
  class: classNameSchema,
  section: trimmed(10, 'Section').optional().default(''),
  student_id: trimmed(40, 'Student').optional().default(''),
  student_name: trimmed(80, 'Student name').min(2, 'Student name is required.'),
  parent_name: trimmed(80, 'Parent name').min(2, 'Parent name is required.'),
  months: z
    .array(paidMonthSchema)
    .min(1, 'Select at least one month.')
    .max(12, 'A single receipt cannot cover more than 12 months.')
    .refine(
      (months) => new Set(months.map((entry) => entry.month)).size === months.length,
      'The same month appears twice.'
    )
    .refine(
      (months) => months.reduce((sum, entry) => sum + entry.amount, 0) <= 1000000,
      'The total looks too large. Please check the amounts.'
    ),
  payment_date: z
    .string({ message: 'Payment date is required.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must look like 2026-04-14.'),
  payment_mode: z.enum(PAYMENT_MODES, { message: 'Choose how the fee was paid.' }),
  remarks: trimmed(300, 'Remarks').optional().default(''),
  allow_duplicate: z.boolean().optional().default(false),
});

export const studentNameSchema = trimmed(80, 'Student name')
  .min(2, 'Student name is required.')
  .transform((value) => value.replace(/\s+/g, ' '));

export const createStudentSchema = z.object({
  academic_year: academicYearSchema,
  class: classNameSchema,
  student_name: studentNameSchema,
  parent_name: trimmed(80, 'Parent name').optional().default(''),
  contact: trimmed(20, 'Contact number').optional().default(''),
  admission_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Admission date must look like 2026-04-14.')
    .optional()
    .or(z.literal('')),
  notes: trimmed(200, 'Notes').optional().default(''),
});

export const importStudentsSchema = z.object({
  academic_year: academicYearSchema,
  students: z
    .array(
      z.object({
        student_name: studentNameSchema,
        class: classNameSchema,
        parent_name: trimmed(80, 'Parent name').optional().default(''),
        contact: trimmed(20, 'Contact number').optional().default(''),
        admission_date: z.string().optional().default(''),
        notes: trimmed(200, 'Notes').optional().default(''),
      })
    )
    .min(1, 'There are no students to import.')
    .max(2000, 'Import at most 2000 students at a time.'),
});

export const listQuerySchema = z.object({
  academic_year: academicYearSchema.optional(),
  class: classNameSchema.optional(),
  student_id: trimmed(40, 'Student').optional(),
});
