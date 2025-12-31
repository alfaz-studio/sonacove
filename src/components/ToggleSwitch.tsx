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
      className={`inline-flex flex-wrap justify-center bg-gray-100 rounded-lg p-2 space-x-1 inset-shadow-sm ${className}`}
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
              relative flex items-center justify-center gap-1.5 rounded-lg px-5 py-1.5 
              text-medium font-medium transition-all duration-200 ease-in-out
              whitespace-nowrap select-none
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300
              ${
                isActive
                  ? 'bg-white text-gray-950 shadow-sm'
                  : 'text-gray-700 hover:text-gray-950'
              }
            `}
          >
            <span>{option.label}</span>
            
            {option.badge && (
              <span className={`text-xs ${isActive ? 'text-gray-700' : 'text-gray-500'}`}>
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
