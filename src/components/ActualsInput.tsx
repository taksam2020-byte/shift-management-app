'use client';

import { useState, useEffect } from 'react';

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
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center">
        <button type="button" onClick={() => handleTimeChange('start', 15)} className="h-5 w-5 leading-none disabled:opacity-50" disabled={!canEdit}>▲</button>
        <input 
            type="text" 
            value={startTime}
            onChange={(e) => onTimeChange('start', e.target.value)}
            className="form-input w-20 text-center bg-transparent border-0 focus:ring-0"
            placeholder="開始"
            disabled={!canEdit}
        />
        <button type="button" onClick={() => handleTimeChange('start', -15)} className="h-5 w-5 leading-none disabled:opacity-50" disabled={!canEdit}>▼</button>
      </div>
      <span>-</span>
      <div className="flex flex-col items-center">
        <button type="button" onClick={() => handleTimeChange('end', 15)} className="h-5 w-5 leading-none disabled:opacity-50" disabled={!canEdit}>▲</button>
        <input 
            type="text" 
            value={endTime}
            onChange={(e) => onTimeChange('end', e.target.value)}
            className="form-input w-20 text-center bg-transparent border-0 focus:ring-0"
            placeholder="終了"
            disabled={!canEdit}
        />
        <button type="button" onClick={() => handleTimeChange('end', -15)} className="h-5 w-5 leading-none disabled:opacity-50" disabled={!canEdit}>▼</button>
      </div>
    </div>
  );
}