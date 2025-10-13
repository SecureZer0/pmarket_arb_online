import { useState, useCallback, useRef } from 'react';
import { MarketMatch } from '../../types/market';

interface UserStatusButtonsProps {
  match: MarketMatch;
  onStatusUpdate: (matchId: number, field: 'user_status' | 'close_condition_user_status', status: 'confirmed' | 'rejected') => Promise<void>;
}

export default function UserStatusButtons({ match, onStatusUpdate }: UserStatusButtonsProps) {
  const [updatingFields, setUpdatingFields] = useState<Set<string>>(new Set());
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateQueueRef = useRef<{ field: 'user_status' | 'close_condition_user_status'; status: 'confirmed' | 'rejected' }[]>([]);

  const processQueue = useCallback(async () => {
    if (updateQueueRef.current.length === 0) return;
    
    const queue = [...updateQueueRef.current];
    updateQueueRef.current = [];
    
    // Mark all fields in the queue as updating
    const fieldsToUpdate = new Set(queue.map(update => update.field));
    setUpdatingFields(fieldsToUpdate);
    
    try {
      // Process all updates in the queue
      for (const update of queue) {
        await onStatusUpdate(match.id, update.field, update.status);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdatingFields(new Set());
    }
  }, [match.id, onStatusUpdate]);

  const debouncedStatusUpdate = useCallback((field: 'user_status' | 'close_condition_user_status', status: 'confirmed' | 'rejected') => {
    // Add to queue
    updateQueueRef.current.push({ field, status });
    
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set new timeout to process the entire queue
    debounceTimeoutRef.current = setTimeout(() => {
      processQueue();
    }, 300); // 300ms debounce
  }, [processQueue]);

  const handleStatusUpdate = (field: 'user_status' | 'close_condition_user_status', status: 'confirmed' | 'rejected', event: React.MouseEvent) => {
    event.stopPropagation();
    debouncedStatusUpdate(field, status);
  };

  const StatusButtonGroup = ({ 
    field, 
    currentStatus, 
    label 
  }: { 
    field: 'user_status' | 'close_condition_user_status'; 
    currentStatus: string; 
    label: string; 
  }) => {
    const isFieldUpdating = updatingFields.has(field);
    
    return (
      <div className="flex flex-col gap-0">
        <div className="flex gap-2">
          <button
            onClick={(e) => handleStatusUpdate(field, 'confirmed', e)}
            disabled={isFieldUpdating}
            className={`
              px-2 py-1 text-xs rounded transition-colors
              ${currentStatus === 'confirmed' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-green-700'
              }
              ${isFieldUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            ✓
          </button>
          <button
            onClick={(e) => handleStatusUpdate(field, 'rejected', e)}
            disabled={isFieldUpdating}
            className={`
              px-2 py-1 text-xs rounded transition-colors
              ${currentStatus === 'rejected' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-red-700'
              }
              ${isFieldUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            ✗
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-[14px]">
      <StatusButtonGroup 
        field="user_status" 
        currentStatus={match.user_status} 
        label="Match" 
      />
      <StatusButtonGroup 
        field="close_condition_user_status" 
        currentStatus={match.close_condition_user_status || 'proposed'} 
        label="Condition" 
      />
    </div>
  );
}
