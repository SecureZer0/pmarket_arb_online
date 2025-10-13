import { ReactNode, useState, useRef, useEffect } from 'react';

interface StatusTooltipProps {
  children: ReactNode;
  title: string;
  status: string;
  score?: number | null;
  className?: string;
  position?: 'top' | 'bottom';
}

export default function StatusTooltip({ 
  children, 
  title, 
  status, 
  score, 
  className = "",
  position
}: StatusTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  const containerRef = useRef<HTMLDivElement>(null);

  const getStatusDisplay = () => {
    const baseStatus = status.toLowerCase();
    let statusText = '';
    
    switch (baseStatus) {
      case 'confirmed':
        statusText = 'Confirmed';
        break;
      case 'rejected':
        statusText = 'Rejected';
        break;
      case 'proposed':
        statusText = 'Undecided';
        break;
      default:
        statusText = 'Undecided';
    }

    // Add score in parentheses if score exists
    if (score !== null && score !== undefined && !isNaN(Number(score))) {
      statusText += ` (${Number(score).toFixed(2)})`;
    }

    return statusText;
  };

  const updateTooltipPosition = () => {
    if (position) {
      setTooltipPosition(position);
      return;
    }
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const tooltipHeight = 60; // Approximate tooltip height
      
      // If there's not enough space above, show below
      if (rect.top < tooltipHeight + 10) {
        setTooltipPosition('bottom');
      } else {
        setTooltipPosition('top');
      }
    }
  };

  useEffect(() => {
    if (isHovered) {
      updateTooltipPosition();
    }
  }, [isHovered, position]);

  return (
    <div 
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      
      {isHovered && (
        <div className={`absolute left-1/2 transform -translate-x-1/2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg z-50 whitespace-nowrap ${
          tooltipPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          <div className="font-medium">{title}</div>
          <div className="text-gray-300">{getStatusDisplay()}</div>
          
          {/* Arrow pointing in the correct direction */}
          <div className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent ${
            tooltipPosition === 'top' 
              ? 'top-full border-t-4 border-t-gray-800' 
              : 'bottom-full border-b-4 border-b-gray-800'
          }`}></div>
        </div>
      )}
    </div>
  );
}
