export const ROLES = ["admin", "coach", "client"] as const;
export type Role = (typeof ROLES)[number];

/** Roles allowed to create/update/delete the content (meals, recipes, goals, ...). */
export const STAFF_ROLES: readonly Role[] = ["admin", "coach"];

export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);
export const isStaff = (role: unknown): boolean => STAFF_ROLES.includes(role as Role);
