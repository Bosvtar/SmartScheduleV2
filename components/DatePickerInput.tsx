import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Check, RotateCcw } from 'lucide-react';
import { getDayOfWeekFromDate } from '../types';

interface DatePickerInputProps {
  value: string; // DD/MM/YYYY or ''
  onChange: (dateStr: string) => void;
  placeholder?: string;
  compact?: boolean;
}

const WEEKDAYS_HEADER = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const parseDMY = (dateStr?: string): Date | null => {
  if (!dateStr || !dateStr.trim()) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  const d = new Date(year, month, day);
  if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
    return d;
  }
  return null;
};

const formatDMY = (date: Date): string => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  placeholder = 'Chọn ngày trên lịch...',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedDateObj = useMemo(() => parseDMY(value), [value]);

  const [viewMonth, setViewMonth] = useState<number>(() => {
    return selectedDateObj ? selectedDateObj.getMonth() : new Date().getMonth();
  });
  const [viewYear, setViewYear] = useState<number>(() => {
    return selectedDateObj ? selectedDateObj.getFullYear() : new Date().getFullYear();
  });

  useEffect(() => {
    if (isOpen) {
      const parsed = parseDMY(value);
      if (parsed) {
        setViewMonth(parsed.getMonth());
        setViewYear(parsed.getFullYear());
      } else {
        const now = new Date();
        setViewMonth(now.getMonth());
        setViewYear(now.getFullYear());
      }
    }
  }, [isOpen, value]);

  const todayStr = useMemo(() => formatDMY(new Date()), []);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    // Convert JS Sunday=0..Saturday=6 to Monday=0..Sunday=6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: {
      date: Date;
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isSunday: boolean;
    }[] = [];

    // Previous month padding days
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, daysInPrevMonth - i);
      const dStr = formatDMY(d);
      cells.push({
        date: d,
        dateStr: dStr,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === value,
        isSunday: d.getDay() === 0,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewYear, viewMonth, day);
      const dStr = formatDMY(d);
      cells.push({
        date: d,
        dateStr: dStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSelected: dStr === value,
        isSunday: d.getDay() === 0,
      });
    }

    // Next month padding days to complete 42 cells (6 weeks)
    const remaining = 42 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(viewYear, viewMonth + 1, day);
      const dStr = formatDMY(d);
      cells.push({
        date: d,
        dateStr: dStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === value,
        isSunday: d.getDay() === 0,
      });
    }

    return cells;
  }, [viewYear, viewMonth, value, todayStr]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSelectDate = (dStr: string) => {
    onChange(dStr);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const now = new Date();
    onChange(formatDMY(now));
    setIsOpen(false);
  };

  const handleSelectTomorrow = () => {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    onChange(formatDMY(tmr));
    setIsOpen(false);
  };

  const handleClearDate = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  const dayOfWeekPreview = value ? getDayOfWeekFromDate(value) : null;

  const yearOptions = useMemo(() => {
    const currentY = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentY - 2; y <= currentY + 5; y++) {
      years.push(y);
    }
    if (!years.includes(viewYear)) {
      years.push(viewYear);
      years.sort((a, b) => a - b);
    }
    return years;
  }, [viewYear]);

  return (
    <>
      {/* Trigger Field */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className={`w-full rounded-lg border transition-all flex items-center justify-between cursor-pointer select-none ${
          compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2 text-sm'
        } ${
          value
            ? 'border-indigo-300 bg-indigo-50/40 text-indigo-950 font-semibold hover:border-indigo-500'
            : 'border-gray-200 bg-white text-gray-400 font-medium hover:border-indigo-400'
        }`}
      >
        <div className="flex items-center space-x-2 truncate">
          <Calendar
            size={compact ? 14 : 16}
            className={value ? 'text-indigo-600 shrink-0' : 'text-gray-400 shrink-0'}
          />
          <span className="truncate">
            {value ? value : placeholder}
          </span>
        </div>

        <div className="flex items-center space-x-1 shrink-0 ml-1">
          {value ? (
            <button
              type="button"
              onClick={handleClearDate}
              title="Xóa ngày (Đặt làm lịch cố định)"
              className="p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            >
              <X size={compact ? 13 : 15} />
            </button>
          ) : (
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
              Lịch
            </span>
          )}
        </div>
      </div>

      {/* Calendar Picker Popup Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white w-full max-w-xs rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Banner */}
            <div className="bg-indigo-600 px-4 py-3 text-white flex items-center justify-between">
              <div>
                <p className="text-[11px] text-indigo-200 font-semibold uppercase tracking-wider">
                  Chọn Ngày Dạy Cụ Thể
                </p>
                <p className="text-base font-bold mt-0.5 flex items-center space-x-1.5">
                  <Calendar size={16} className="text-indigo-200" />
                  <span>
                    {value
                      ? `${dayOfWeekPreview ? `${dayOfWeekPreview}, ` : ''}${value}`
                      : 'Chưa chọn ngày'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Month & Year Navigation */}
            <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-gray-100">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                title="Tháng trước"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center space-x-1.5">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="text-xs font-bold text-gray-800 bg-gray-100 hover:bg-gray-200/70 rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      Tháng {i + 1}
                    </option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="text-xs font-bold text-gray-800 bg-gray-100 hover:bg-gray-200/70 rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                title="Tháng sau"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-3">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
                {WEEKDAYS_HEADER.map((d, idx) => (
                  <div
                    key={d}
                    className={`text-[11px] font-extrabold py-1 ${
                      idx === 6 ? 'text-rose-500' : idx === 5 ? 'text-indigo-600' : 'text-gray-400'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell) => {
                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => handleSelectDate(cell.dateStr)}
                      className={`h-9 rounded-xl text-xs font-bold flex flex-col items-center justify-center relative transition-all ${
                        cell.isSelected
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105 z-10'
                          : cell.isToday
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-300'
                          : cell.isCurrentMonth
                          ? cell.isSunday
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-gray-800 hover:bg-indigo-50 hover:text-indigo-600'
                          : 'text-gray-300 hover:bg-gray-50 hover:text-gray-500'
                      }`}
                    >
                      <span>{cell.dayNumber}</span>
                      {cell.isToday && !cell.isSelected && (
                        <span className="w-1 h-1 rounded-full bg-indigo-600 absolute bottom-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Select Footer */}
            <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-100 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSelectToday}
                  className="py-1.5 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors text-center"
                >
                  Hôm nay ({todayStr.slice(0, 5)})
                </button>
                <button
                  type="button"
                  onClick={handleSelectTomorrow}
                  className="py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors text-center"
                >
                  Ngày mai
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleClearDate()}
                  className="text-xs font-semibold text-gray-500 hover:text-red-600 flex items-center space-x-1 py-1 px-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <RotateCcw size={12} />
                  <span>Để trống (Lịch cố định)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DatePickerInput;
