'use client';

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

// スマホで押しやすい大きさ（高さ 40px）にする
export const stepButtonClass = 'flex h-10 w-8 sm:w-9 items-center justify-center text-gray-500 hover:text-blue-500 active:bg-gray-100 disabled:text-gray-300';
// 文字を 16px 以上にすると、iPhone で入力欄を押したときに画面が勝手に拡大されない
const timeInputClass = 'w-14 sm:w-16 h-10 text-center text-base border-0 focus:ring-0 p-0 bg-transparent';

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
        <button type="button" aria-label="開始を15分早める" onClick={() => handleTimeChange('start', -15)} className={stepButtonClass} disabled={!canEdit}>▼</button>
        <input 
            type="text" 
            value={startTime}
            onChange={(e) => onTimeChange('start', e.target.value)}
            className={timeInputClass}
            aria-label="開始時刻"
            disabled={!canEdit}
        />
        <button type="button" aria-label="開始を15分遅らせる" onClick={() => handleTimeChange('start', 15)} className={stepButtonClass} disabled={!canEdit}>▲</button>
      </div>
      <span className="text-gray-400 font-bold">〜</span>
      <div className="flex items-center border border-gray-300 rounded bg-white">
        <button type="button" aria-label="終了を15分早める" onClick={() => handleTimeChange('end', -15)} className={stepButtonClass} disabled={!canEdit}>▼</button>
        <input 
            type="text" 
            value={endTime}
            onChange={(e) => onTimeChange('end', e.target.value)}
            className={timeInputClass}
            aria-label="終了時刻"
            disabled={!canEdit}
        />
        <button type="button" aria-label="終了を15分遅らせる" onClick={() => handleTimeChange('end', 15)} className={stepButtonClass} disabled={!canEdit}>▲</button>
      </div>
    </div>
  );
}