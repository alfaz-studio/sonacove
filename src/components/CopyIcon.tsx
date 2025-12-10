import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import clsx from 'clsx';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The text that will be copied to the clipboard when the button is clicked. */
  textToCopy: string;

  /** The size of the icon. Defaults to 18. */
  size?: number;
}

const CopyIcon: React.FC<Props> = ({ textToCopy, size = 18, className = '', ...rest }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('copying')
    e.preventDefault();
    e.stopPropagation();

    if (isCopied) {
      return;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    });
  };

  return (
    <button
      onClick={handleCopyClick}
      className={clsx('relative', className)}
      {...rest}
    >
      {/* The Check icon - visible when isCopied is true */}
      <Check
        size={size}
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green-500 transition-all duration-300 ease-in-out ${
          isCopied ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
        aria-hidden={!isCopied}
      />

      {/* The Copy icon - visible when isCopied is false */}
      <Copy
        size={size}
        className={`transition-all duration-300 ease-in-out ${
          isCopied ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
        }`}
        aria-hidden={isCopied}
      />
    </button>
  );
};

export default CopyIcon;
