/**
 * When enabled, every newly registered user is automatically granted
 * an active membership (Member role) in all existing projects.
 *
 * Set GRANT_ACCESS_TO_ALL_PROJECTS=false to skip the full-project scan
 * on registration (recommended when you have many projects).
 */
export const GRANT_ACCESS_TO_ALL_PROJECTS = process.env.GRANT_ACCESS_TO_ALL_PROJECTS !== "false";
