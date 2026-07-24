/** Cookie names shared by Edge middleware and server code. Keep this module
 *  dependency-free so it is safe to import from the Edge runtime. */
export const SESSION_COOKIE = 'ameya_session';
export const DEVICE_COOKIE = 'ameya_device';
export const MFA_TICKET_COOKIE = 'ameya_mfa';
