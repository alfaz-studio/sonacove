import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

/** A predefined array of colors for the generated initials avatars. */
const avatarColors = [
  '#6A50D3',
  '#FF9B42',
  '#DF486F',
  '#73348C',
  '#B23683',
  '#F96E57',
  '#4380E2',
  '#238561',
  '#00A8B3',
];

/**
 * Creates a data URI for an SVG avatar with the user's initials.
 * @param {string} name - The user's name, used to generate initials and select a color.
 * @returns {string} A data URI string representing the SVG avatar.
 */
export function createInitialsAvatar(name: string): string {
  if (!name) return '';
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const charCodeSum = name
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const backgroundColor = avatarColors[charCodeSum % avatarColors.length];

  const fontFamily =
    typeof window !== 'undefined'
      ? getComputedStyle(document.body).fontFamily
      : 'sans-serif';

  const svg = `
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${backgroundColor}" />
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
            font-family='${fontFamily}' font-size="80" font-weight="700" letter-spacing="4" fill="#ffffff">
        ${initials}
      </text>
    </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Props for the Avatar component.
 */
interface AvatarProps {
  /** The source URL for the avatar image. */
  src?: string;

  /** The alt text for the avatar, also used to generate initials for the fallback. */
  alt?: string;

  /** Additional CSS classes to apply to the main container. */
  className?: string;

  /** If true, shows an edit icon on hover that links to Gravatar. Defaults to false. */
  editable?: boolean;

  /** The user's email address, used to pre-fill the Gravatar edit page. */
  email?: string;
}

/**
 * Renders a user avatar that falls back to initials and shows an edit icon on hover.
 * @param {AvatarProps} props - The props for the component.
 * @returns {React.ReactElement} The rendered avatar component.
 */
const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  className = '',
  editable = false, // Destructure the new prop, default to false
  email,
}) => {
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    setImgSrc(src);
  }, [src]);

  /**
   * Handles image loading errors by replacing the source with a generated initials avatar.
   */
  const handleLoadError = () => {
    const initialsAvatar = createInitialsAvatar(alt || '');
    if (imgSrc !== initialsAvatar) {
      setImgSrc(initialsAvatar);
    }
  };

  const gravatarEditUrl = `https://gravatar.com/profile/edit${email ? `?email=${encodeURIComponent(email)}` : ''}`;

  return (
    <div
      className={twMerge(
        'relative flex-shrink-0',
        editable ? 'group/avatar' : '',
        className,
      )}
    >
      <img
        src={imgSrc || createInitialsAvatar(alt || '')}
        alt={alt || 'User avatar'}
        className='w-full h-full rounded-full object-cover'
        onError={handleLoadError}
      />

      {/* The overlay and icon are now only rendered if `editable` is true. */}
      {editable && (
        <a
          href={gravatarEditUrl}
          target='_blank'
          rel='noopener noreferrer'
          aria-label='Edit Gravatar profile'
          onClick={(e) => e.stopPropagation()}
          className='absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200'
        >
          <Pencil className='w-1/3 h-1/3 text-white' />
        </a>
      )}
    </div>
  );
};

export default Avatar;
