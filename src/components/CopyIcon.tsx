import React from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  /** A boolean to indicate if the icon should be in the "copied" (checkmark) state. */
  isCopied: boolean;

  /** The size of the icon. */
  size?: number;

  /** Optional additional CSS classes. */
  className?: string;
}

const CopyIcon: React.FC<Props> = ({ isCopied, size = 18, className = '' }) => {
  return (
    <>
      {/* The Check icon - visible when isCopied is true */}
      <Check
        size={size}
        className={`absolute text-green-500 transition-all duration-300 ease-in-out ${
          isCopied ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        } ${className}`}
        aria-hidden={!isCopied}
      />

      {/* The Copy icon - visible when isCopied is false */}
      <Copy
        size={size}
        className={`transition-all duration-300 ease-in-out ${
          isCopied ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
        } ${className}`}
        aria-hidden={isCopied}
      />
    </>
  );
};

export default CopyIcon;
