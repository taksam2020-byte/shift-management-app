'use client';

import { } from 'react';

interface ActualsInputProps {
  startTime: string;
  endTime: string;
  canEdit: boolean;
  onTimeChange: (part: 'start' | 'end', newTime: string) => void;
}

// Helper to modify time, assumes HH:mm format
const modifyTime = (time: string, minutes: number): string => {
    if (!time) return '';
    const [hour, minute] = time.split(':').map(Number);
    if (isNaN(hour) || isNaN(minute)) return time; // Return original if format is incorrect
    const date = new Date();
    date.setHours(hour, minute + minutes, 0, 0);
    const newHour = String(date.getHours()).padStart(2, '0');
    const newMinute = String(date.getMinutes()).padStart(2, '0');
    return `${newHour}:${newMinute}`;
};

export default function ActualsInput({ startTime, endTime, canEdit, onTimeChange }: ActualsInputProps) {

  const handleTimeChange = (part: 'start' | 'end', minutes: number) => {
    if (!canEdit) return;
    if (part === 'start') {
      onTimeChange('start', modifyTime(startTime, minutes));
    } else {
      onTimeChange('end', modifyTime(endTime, minutes));
    }
  };

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <div className="flex items-center border border-gray-300 rounded bg-white">
        <button type="button" onClick={() => handleTimeChange('start', -15)} className="text-gray-500 hover:text-blue-500 px-1.5 py-1" disabled={!canEdit}>▼</button>
        <input 
            type="text" 
            value={startTime}
            onChange={(e) => onTimeChange('start', e.target.value)}
            className="w-12 sm:w-16 text-center text-sm border-0 focus:ring-0 p-0 sm:p-1 bg-transparent"
            disabled={!canEdit}
        />
        <button type="button" onClick={() => handleTimeChange('start', 15)} className="text-gray-500 hover:text-blue-500 px-1.5 py-1" disabled={!canEdit}>▲</button>
      </div>
      <span className="text-gray-400 font-bold">-</span>
      <div className="flex items-center border border-gray-300 rounded bg-white">
        <button type="button" onClick={() => handleTimeChange('end', -15)} className="text-gray-500 hover:text-blue-500 px-1.5 py-1" disabled={!canEdit}>▼</button>
        <input 
            type="text" 
            value={endTime}
            onChange={(e) => onTimeChange('end', e.target.value)}
            className="w-12 sm:w-16 text-center text-sm border-0 focus:ring-0 p-0 sm:p-1 bg-transparent"
            disabled={!canEdit}
        />
        <button type="button" onClick={() => handleTimeChange('end', 15)} className="text-gray-500 hover:text-blue-500 px-1.5 py-1" disabled={!canEdit}>▲</button>
      </div>
    </div>
  );
}