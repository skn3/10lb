import { InviteCode } from '../../../constants.js';

// =============================================================================
// INVITE CODE UTILS — Cryptographically unbiased 8-character invite codes
// =============================================================================

/**
 * Generate a random invite code using rejection sampling to eliminate modulo bias.
 * @returns {string} 8-character uppercase invite code
 */
export function generateInviteCode() {
  const limit = 256 - (256 % InviteCode.CHARS.length);
  let code = '';
  while (code.length < InviteCode.LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const b of bytes) {
      if (b < limit) code += InviteCode.CHARS[b % InviteCode.CHARS.length];
      if (code.length === InviteCode.LENGTH) break;
    }
  }
  return code;
}
