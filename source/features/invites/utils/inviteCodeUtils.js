// =============================================================================
// INVITE CODE UTILS — Cryptographically unbiased 8-character invite codes
// =============================================================================

const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const INVITE_CODE_LENGTH = 8;

/**
 * Generate a random invite code using rejection sampling to eliminate modulo bias.
 * @returns {string} 8-character uppercase invite code
 */
export function generateInviteCode() {
  const limit = 256 - (256 % INVITE_CHARS.length);
  let code = '';
  while (code.length < INVITE_CODE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const b of bytes) {
      if (b < limit) code += INVITE_CHARS[b % INVITE_CHARS.length];
      if (code.length === INVITE_CODE_LENGTH) break;
    }
  }
  return code;
}
