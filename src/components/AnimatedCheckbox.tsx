import React from 'react';

interface AnimatedCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}

const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = ({
  checked,
  onChange,
  label,
  className = '',
}) => {
  return (
    <label
      className={`flex items-center cursor-pointer ${className}`}
      onClick={() => onChange(!checked)}
    >
      <div className="relative">
        <svg width="28" height="28" viewBox="0 0 28 28">
          {/* Border - traces differently based on direction */}
          <rect
            x="3"
            y="3"
            width="22"
            height="22"
            fill="none"
            stroke={checked ? '#8A2BE2' : '#666'}
            strokeWidth="2"
            strokeDasharray="88"
            strokeDashoffset={checked ? '88' : '0'}
            className="transition-all duration-300 ease-out"
            rx="4"
            style={{
              opacity: checked ? 0 : 1,
              transition: checked
                ? 'stroke 0.2s ease-out, stroke-dashoffset 0.3s ease-out, opacity 0.2s ease-out 0.3s'
                : 'opacity 0.2s ease-out 0.2s, stroke-dashoffset 0.3s ease-out 0.2s, stroke 0.2s ease-out 0.5s',
              transform: checked ? 'none' : 'rotate(180deg)',
              transformOrigin: '14px 14px',
            }}
          />

          {/* Checkmark - draws left to right when checking, undraws right to left when unchecking */}
          {(checked || (!checked && 'transitioning')) && (
            <path
              d="M7 14l4 4 10-8"
              fill="none"
              stroke="#8A2BE2"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="20"
              strokeDashoffset="0"
              className="transition-all duration-200 ease-out"
              style={{
                animation: checked
                  ? 'checkmark-draw 0.2s ease-out 0.3s both'
                  : 'checkmark-undraw-reverse 0.2s ease-out both',
              }}
            />
          )}
        </svg>
      </div>
      <span className="ml-3 text-white">{label}</span>

      <style>
        {`
          @keyframes checkmark-draw {
            from {
              stroke-dashoffset: 20;
            }
            to {
              stroke-dashoffset: 0;
            }
          }

          @keyframes checkmark-undraw-reverse {
            from {
              stroke-dashoffset: 0;
            }
            to {
              stroke-dashoffset: 20;
            }
          }
        `}
      </style>
    </label>
  );
};

export default AnimatedCheckbox;
