import React, { useState, useMemo } from 'react';
import { 
  ScheduleItem, 
  DAYS_ORDER, 
  getPeriodLabelFromTime, 
  getClassColorTheme,
  getDayOfWeekFromDate
} from '../types';
import { 
  X, 
  Calendar, 
  CalendarCheck, 
  CalendarDays, 
  Clock, 
  MapPin, 
  BookOpen, 
  CheckCircle2, 
  Sparkles, 
  ChevronRight, 
  Sun,
  Coffee,
  Check
} from 'lucide-react';

interface ScheduleCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedules: ScheduleItem[];
  customColorMap?: Record<string, string>;
  onSelectScheduleItem?: (item: ScheduleItem) => void;
  onApplyFilter?: (scope: 'all' | 'today' | 'this_week') => void;
  initialTab?: 'today' | 'week';
}

const parseDateObj = (dateStr?: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
};

const getWeekBoundary = (date: Date) => {
  const day = date.getDay(); // 0 is Sunday
  const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
  
  const start = new Date(date);
  start.setDate(diffToMonday);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const formatDateDM = (d: Date) => {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
};

const formatDateFull = (d: Date) => {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const ScheduleCheckModal: React.FC<ScheduleCheckModalProps> = ({
  isOpen,
  onClose,
  schedules,
  customColorMap = {},
  onSelectScheduleItem,
  onApplyFilter,
  initialTab = 'today',
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'week'>(initialTab);
  const [selectedWeekDayFilter, setSelectedWeekDayFilter] = useState<string | null>(null);

  // Sync initialTab when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSelectedWeekDayFilter(null);
    }
  }, [isOpen, initialTab]);

  const today = useMemo(() => new Date(), [isOpen]);
  const todayIndex = today.getDay();
  const jsDayToViDay = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const todayVi = jsDayToViDay[todayIndex];
  const todayDateStr = formatDateFull(today);

  // Week boundaries
  const { start: weekStart, end: weekEnd } = useMemo(() => getWeekBoundary(today), [today]);
  const weekLabel = `${formatDateDM(weekStart)} - ${formatDateDM(weekEnd)}`;

  // 1. TODAY'S SESSIONS
  const todaySessions = useMemo(() => {
    return schedules.filter(item => {
      if (item.date && item.date.trim() !== '') {
        return item.date === todayDateStr;
      }
      return item.dayOfWeek === todayVi;
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedules, todayDateStr, todayVi]);

  // Today's total periods
  const todayTotalPeriods = useMemo(() => {
    return todaySessions.reduce((sum, item) => sum + (item.periodsCount || 1), 0);
  }, [todaySessions]);

  // 2. THIS WEEK'S SESSIONS (Grouped by Day of Week: T2 -> CN)
  const weekDaysInfo = useMemo(() => {
    // Generate dates for Monday..Sunday
    return DAYS_ORDER.map((dayName, idx) => {
      const targetDate = new Date(weekStart);
      targetDate.setDate(weekStart.getDate() + idx);
      const targetDateStr = formatDateFull(targetDate);
      const targetDateDM = formatDateDM(targetDate);
      const isDayToday = dayName === todayVi;

      // Find sessions for this day
      const sessions = schedules.filter(item => {
        if (item.date && item.date.trim() !== '') {
          return item.date === targetDateStr;
        }
        return item.dayOfWeek === dayName;
      }).sort((a, b) => a.startTime.localeCompare(b.startTime));

      return {
        dayName,
        date: targetDate,
        dateStr: targetDateStr,
        dateDM: targetDateDM,
        isToday: isDayToday,
        sessions,
        periodsCount: sessions.reduce((s, i) => s + (i.periodsCount || 1), 0)
      };
    });
  }, [schedules, weekStart, todayVi]);

  const totalWeekSessions = useMemo(() => {
    return weekDaysInfo.reduce((sum, day) => sum + day.sessions.length, 0);
  }, [weekDaysInfo]);

  const totalWeekPeriods = useMemo(() => {
    return weekDaysInfo.reduce((sum, day) => sum + day.periodsCount, 0);
  }, [weekDaysInfo]);

  const activeDaysCount = useMemo(() => {
    return weekDaysInfo.filter(d => d.sessions.length > 0).length;
  }, [weekDaysInfo]);

  if (!isOpen) return null;

  const handleApplyScope = (scope: 'today' | 'this_week') => {
    if (onApplyFilter) {
      onApplyFilter(scope);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-sm">
              <CalendarCheck size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Kiểm Tra Lịch Dạy</h2>
              <p className="text-indigo-100 text-xs font-medium">
                {todayVi}, {todayDateStr}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-full transition-colors"
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Top Scope Tabs */}
        <div className="p-3 bg-gray-50/90 border-b border-gray-200/80 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'today'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                : 'bg-white text-gray-600 border border-gray-200/90 hover:bg-gray-100/70'
            }`}
          >
            <Clock size={15} />
            <span>Hôm nay</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'today' ? 'bg-white/20 text-white' : todaySessions.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {todaySessions.length > 0 ? `${todaySessions.length} buổi` : 'Nghỉ'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('week')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'week'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                : 'bg-white text-gray-600 border border-gray-200/90 hover:bg-gray-100/70'
            }`}
          >
            <CalendarDays size={15} />
            <span>Tuần hiện tại</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'week' ? 'bg-white/20 text-white' : totalWeekSessions > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-500'
            }`}>
              {totalWeekSessions > 0 ? `${totalWeekSessions} buổi` : '0 buổi'}
            </span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* TAB 1: TODAY CHECK */}
          {activeTab === 'today' && (
            <div className="space-y-3.5">
              {/* Today Quick Status Banner */}
              {todaySessions.length > 0 ? (
                <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-emerald-950">
                        Hôm nay có {todaySessions.length} buổi dạy ({todayTotalPeriods} tiết)
                      </h4>
                      <p className="text-xs text-emerald-700">
                        Bắt đầu lúc <span className="font-bold">{todaySessions[0].startTime}</span> ({todaySessions[0].subject})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyScope('today')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl shadow-xs transition-colors shrink-0"
                  >
                    Xem lịch
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center space-x-3 text-amber-900">
                  <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <Coffee size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-amber-950">Hôm nay không có lịch dạy!</h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Bạn không có buổi dạy nào trong ngày hôm nay. Hãy nghỉ ngơi hoặc chuẩn bị giáo án cho các ngày tiếp theo!
                    </p>
                  </div>
                </div>
              )}

              {/* List of Today's Sessions */}
              {todaySessions.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Chi tiết các buổi dạy hôm nay ({todaySessions.length})
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      Tổng {todayTotalPeriods} tiết
                    </span>
                  </div>

                  {todaySessions.map((item, index) => {
                    const theme = getClassColorTheme(item.className, customColorMap);
                    const periodLabel = getPeriodLabelFromTime(item.startTime, item.endTime);

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (onSelectScheduleItem) onSelectScheduleItem(item);
                          onClose();
                        }}
                        className={`p-3.5 rounded-2xl border ${theme.cardBorder} ${theme.cardBg} hover:shadow-xs transition-all cursor-pointer relative overflow-hidden`}
                      >
                        {/* Accent Bar */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1.5" 
                          style={{ backgroundColor: theme.dotColor }}
                        />

                        <div className="pl-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${theme.badgeBg} ${theme.badgeText}`}>
                                  Buổi #{index + 1}
                                </span>
                                {item.className && (
                                  <span className="text-xs font-extrabold text-gray-800">
                                    Lớp {item.className}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-gray-900 mt-1">
                                {item.subject}
                              </h4>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100/80 block">
                                {item.startTime} - {item.endTime}
                              </span>
                              {periodLabel && (
                                <span className="text-[10px] text-gray-400 font-semibold mt-0.5 block">
                                  {periodLabel}
                                </span>
                              )}
                            </div>
                          </div>

                          {item.lessonName && (
                            <div className="mt-2 text-xs font-medium text-gray-700 bg-white/70 p-2 rounded-xl border border-gray-200/50 flex items-start space-x-1.5">
                              <BookOpen size={13} className="text-indigo-600 shrink-0 mt-0.5" />
                              <span className="leading-snug">{item.lessonName}</span>
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-200/40">
                            <span className="flex items-center">
                              <MapPin size={12} className="mr-1 text-gray-400" />
                              {item.location || 'Phòng học mặc định'}
                            </span>
                            <span className="font-semibold text-gray-600">
                              {item.periodsCount || 1} tiết
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6">
                  <Sun className="mx-auto text-amber-500 mb-2" size={32} />
                  <p className="text-xs font-bold text-gray-700">Tận hưởng ngày nghỉ thảnh thơi!</p>
                  <p className="text-[11px] text-gray-400 mt-1 mb-4">
                    Bạn có thể kiểm tra lịch các ngày khác trong tuần bằng cách chọn tab "Tuần hiện tại".
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('week')}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-700 transition-colors"
                  >
                    Xem lịch tuần này
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: THIS WEEK CHECK */}
          {activeTab === 'week' && (
            <div className="space-y-3.5">
              {/* Week Overview Card */}
              <div className="p-3.5 bg-gradient-to-br from-indigo-50 to-blue-50/60 border border-indigo-100 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-xs text-indigo-700 font-bold mb-0.5">
                    <Calendar size={14} />
                    <span>{weekLabel}</span>
                  </div>
                  <h4 className="font-bold text-sm text-indigo-950">
                    {totalWeekSessions > 0 ? (
                      `Tuần này có ${totalWeekSessions} buổi dạy (${totalWeekPeriods} tiết)`
                    ) : (
                      'Tuần này không có lịch dạy nào'
                    )}
                  </h4>
                  <p className="text-[11px] text-indigo-600">
                    {totalWeekSessions > 0 ? `Dạy trong ${activeDaysCount}/7 ngày trong tuần` : 'Chưa có buổi học nào được lên lịch cho tuần này'}
                  </p>
                </div>
                {totalWeekSessions > 0 && (
                  <button
                    type="button"
                    onClick={() => handleApplyScope('this_week')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl shadow-xs transition-colors shrink-0"
                  >
                    Lọc tuần này
                  </button>
                )}
              </div>

              {/* 7-Day Quick Strip Visual Bar */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
                  Tổng quan từng ngày trong tuần
                </span>
                <div className="grid grid-cols-7 gap-1 bg-gray-50 p-1.5 rounded-2xl border border-gray-200/80">
                  {weekDaysInfo.map(d => {
                    const isSelected = selectedWeekDayFilter === d.dayName;
                    const hasClasses = d.sessions.length > 0;

                    return (
                      <button
                        key={d.dayName}
                        type="button"
                        onClick={() => {
                          setSelectedWeekDayFilter(isSelected ? null : d.dayName);
                        }}
                        className={`p-1.5 rounded-xl flex flex-col items-center justify-center transition-all text-center relative ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : d.isToday
                            ? 'bg-white border-2 border-indigo-400 text-indigo-900 shadow-2xs'
                            : hasClasses
                            ? 'bg-white text-gray-800 border border-gray-200/90 hover:bg-indigo-50/50'
                            : 'bg-gray-100/70 text-gray-400 border border-transparent'
                        }`}
                      >
                        <span className="text-[10px] font-bold">
                          {d.dayName.replace('Thứ ', 'T')}
                        </span>
                        <span className="text-[9px] opacity-80">
                          {d.dateDM.split('/')[0]}
                        </span>
                        
                        {/* Session count pill */}
                        <div className="mt-1">
                          {hasClasses ? (
                            <span className={`w-4 h-4 rounded-full text-[9px] font-extrabold flex items-center justify-center ${
                              isSelected ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {d.sessions.length}
                            </span>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mx-auto my-1.5" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedWeekDayFilter && (
                  <div className="flex items-center justify-between px-1 text-xs text-indigo-700 font-semibold">
                    <span>Đang lọc xem riêng: {selectedWeekDayFilter}</span>
                    <button 
                      onClick={() => setSelectedWeekDayFilter(null)} 
                      className="underline text-gray-500 hover:text-gray-800"
                    >
                      Xem tất cả ngày
                    </button>
                  </div>
                )}
              </div>

              {/* Day-by-Day Breakdown */}
              <div className="space-y-3">
                {weekDaysInfo
                  .filter(d => !selectedWeekDayFilter || d.dayName === selectedWeekDayFilter)
                  .map(d => {
                    const hasClasses = d.sessions.length > 0;

                    return (
                      <div 
                        key={d.dayName} 
                        className={`rounded-2xl border transition-all ${
                          d.isToday 
                            ? 'border-indigo-200 bg-indigo-50/30 p-3' 
                            : hasClasses 
                            ? 'border-gray-200/90 bg-white p-3 shadow-2xs' 
                            : 'border-gray-100 bg-gray-50/50 p-2.5 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`font-bold text-xs ${d.isToday ? 'text-indigo-600' : 'text-gray-800'}`}>
                              {d.dayName} ({d.dateDM})
                            </span>
                            {d.isToday && (
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-extrabold">
                                Hôm nay
                              </span>
                            )}
                          </div>
                          <span className={`text-[11px] font-bold ${hasClasses ? 'text-emerald-700' : 'text-gray-400'}`}>
                            {hasClasses ? `${d.sessions.length} buổi (${d.periodsCount} tiết)` : 'Nghỉ'}
                          </span>
                        </div>

                        {hasClasses ? (
                          <div className="space-y-2 pl-2 border-l-2 border-indigo-100">
                            {d.sessions.map(item => {
                              const theme = getClassColorTheme(item.className, customColorMap);
                              return (
                                <div 
                                  key={item.id}
                                  onClick={() => {
                                    if (onSelectScheduleItem) onSelectScheduleItem(item);
                                    onClose();
                                  }}
                                  className="bg-white p-2.5 rounded-xl border border-gray-200/70 hover:border-indigo-300 transition-all cursor-pointer text-xs flex items-center justify-between gap-2 shadow-2xs"
                                >
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <span 
                                      className="w-2 h-2 rounded-full shrink-0" 
                                      style={{ backgroundColor: theme.dotColor }} 
                                    />
                                    <div className="truncate">
                                      <span className="font-bold text-gray-900 mr-1.5">{item.subject}</span>
                                      {item.className && (
                                        <span className="text-gray-500 font-semibold">({item.className})</span>
                                      )}
                                    </div>
                                  </div>
                                  <span className="shrink-0 font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px]">
                                    {item.startTime}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-400 italic">Không có lịch dạy</p>
                        )}
                      </div>
                    );
                  })}
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs border border-gray-200 transition-colors"
          >
            Đóng
          </button>

          <div className="flex items-center gap-2">
            {activeTab === 'today' ? (
              <button
                type="button"
                onClick={() => handleApplyScope('today')}
                className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <span>Xem lịch Hôm nay</span>
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleApplyScope('this_week')}
                className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <span>Xem toàn bộ Tuần này</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ScheduleCheckModal;
