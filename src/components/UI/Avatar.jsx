import { getAvatarPalette } from '../../utils/helpers';

/**
 * @param {string}  initials  – 1–2 uppercase chars
 * @param {string}  seed      – uid or username (for consistent colour)
 * @param {number}  size      – 40 | 48 | 56 | 96
 */
export default function Avatar({ initials = '?', seed = '', size = 48, style = {} }) {
  const { bg, fg } = getAvatarPalette(seed || initials);
  return (
    <div
      className={`avatar avatar-${size}`}
      style={{ background: bg, color: fg, ...style }}
    >
      {initials}
    </div>
  );
}
