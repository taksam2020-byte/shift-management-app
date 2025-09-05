'use client';

import { useState, useEffect } from 'react';

interface ShiftInputProps {
  value: string;
  defaultHours: string;
  isRequested: boolean;
  requestType?: 'holiday' | 'work';
  onChange: (value: string) => void;
  title?: string;
}

const modifyTime = (time: string, minutes: number): string => {
    if (!time) return '';
    const [hour, minute] = time.split(':').map(Number);
    if (isNaN(hour) || isNaN(minute)) return time;
    const date = new Date();
    date.setHours(hour, minute + minutes, 0, 0);
    const newHour = String(date.getHours()).padStart(2, '0');
    const newMinute = String(date.getMinutes()).padStart(2, '0');
    return `${newHour}:${newMinute}`;
};

export default function ShiftInput({ value, defaultHours, isRequested, requestType, onChange, title }: ShiftInputProps) {
  const [isChecked, setIsChecked] = useState(!!value);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    // If it's a work request, ensure it's checked and has default hours
    if (isRequested && requestType === 'work' && !value) {
        onChange(defaultHours || '09:00-17:00');
    }
    setIsChecked(!!value);
    if (value && value.includes('-')) {
      const [start, end] = value.split('-');
      setStartTime(start);
      setEndTime(end);
    } else {
      setStartTime('');
      setEndTime('');
    }
  }, [value, isRequested, requestType, defaultHours, onChange]);

  const handleCheck = (checked: boolean) => {
    if (isRequested && requestType === 'holiday') return; // Don't allow unchecking a holiday request
    setIsChecked(checked);
    if (checked) {
      onChange(defaultHours || '09:00-17:00');
    } else {
      onChange('');
    }
  };

  const handleTimeChange = (part: 'start' | 'end', minutes: number) => {
    let newTime;
    if (part === 'start') {
      newTime = modifyTime(startTime, minutes);
      onChange(`${newTime}-${endTime}`);
    } else {
      newTime = modifyTime(endTime, minutes);
      onChange(`${startTime}-${newTime}`);
    }
  };

  // Render based on request type
  if (isRequested) {
      if (requestType === 'holiday') {
        return <div className="text-center text-orange-500 font-bold p-2">休</div>;
      }
      // For work requests, we show the full input but with a special background/indicator
  }

  return (
    <div className={`flex flex-col items-center justify-center h-full p-1 ${isRequested && requestType === 'work' ? 'bg-green-100' : ''}`} title={title}>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => handleCheck(e.target.checked)}
        className="form-checkbox h-4 w-4 mb-1"
      />
      {isChecked && (
        <div className="flex items-center gap-1 text-xs">
          <div className="flex flex-col items-center">
            <button onClick={() => handleTimeChange('start', 15)} className="h-4 w-4 leading-none">▲</button>
            <span>{startTime}</span>
            <button onClick={() => handleTimeChange('start', -15)} className="h-4 w-4 leading-none">▼</button>
          </div>
          <span>-</span>
          <div className="flex flex-col items-center">
            <button onClick={() => handleTimeChange('end', 15)} className="h-4 w-4 leading-none">▲</button>
            <span>{endTime}</span>
            <button onClick={() => handleTimeChange('end', -15)} className="h-4 w-4 leading-none">▼</button>
          </div>
        </div>
      )}
    </div>
  );
}
