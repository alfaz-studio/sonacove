import React from 'react';

export interface ToggleOption {
  label: string;
  value: string;
  badge?: string;
}

// Define the types for the component's props
interface ToggleSwitchProps {
  options: ToggleOption[];
  activeOption: string;
  onOptionChange: (option: string) => void;
  className?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  options,
  activeOption,
  onOptionChange,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex flex-wrap justify-center bg-gray-100 rounded-lg p-1 space-x-1 inset-shadow-sm ${className}`}
    >
      {options.map((option) => {
        const isActive = activeOption === option.value;

        return (
          <button
            key={option.value}
            type='button'
            onClick={() => onOptionChange(option.value)}
            aria-pressed={isActive}
            className={`
              relative flex items-center justify-center gap-1.5 rounded-md px-4 py-1.5 
              text-medium font-medium transition-all duration-200 ease-in-out
              whitespace-nowrap select-none
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300
              ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }
            `}
          >
            <span>{option.label}</span>
            
            {option.badge && (
              <span className={`text-xs ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                ({option.badge})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ToggleSwitch;
