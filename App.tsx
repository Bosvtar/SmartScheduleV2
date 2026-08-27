import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ScheduleItem, 
  DAYS_ORDER, 
  COMMON_PERIOD_PRESETS, 
  getPeriodLabelFromTime, 
  getDayOfWeekFromDate,
  ClassSummary,
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  getClassColorTheme,
  ClassColorTheme
} from './types';
import { 
  getSchedules, 
  saveSchedule, 
  saveAllSchedules, 
  deleteSchedule,
  deleteSchedulesByClass,
  updateClassName,
  deleteMultipleSchedules,
  getClassSummaries,
  getClassColors,
  saveClassColor,
  getNotificationSettings,
  saveNotificationSettings
} from './services/storageService';
import { extractScheduleFromImage } from './services/geminiService';
import { dispatchNotification } from './services/notificationService';
import { syncPushState } from './services/pushService';
import NavBar, { NavTabType } from './components/NavBar';
import ClassCard from './components/ClassCard';
import ClassManagement from './components/ClassManagement';
import EditSessionModal from './components/EditSessionModal';
import NotificationSettingsModal from './components/NotificationSettingsModal';
import CameraCaptureModal from './components/CameraCaptureModal';
import ScheduleCheckModal from './components/ScheduleCheckModal';
import { 
  Loader2, 
  Upload, 
  Check, 
  Trash2, 
  ChevronLeft, 
  Bell, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  CalendarDays, 
  Users, 
  CalendarRange, 
  CalendarCheck,
  CheckCircle2,
  BookOpen,
  Plus,
  Edit3,
  Filter,
  Sparkles,
  PenLine,
  Camera,
  Image as ImageIcon,
  ScanLine,
  RotateCcw,
  Smartphone,
  AlertCircle
} from 'lucide-react';

// --- HELPER FUNCTIONS FOR DATES ---

const parseDate = (dateStr?: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  // DD/MM/YYYY -> MM/DD/YYYY for Date constructor
  return new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
};

const getWeekRange = (date: Date): { start: Date; end: Date; label: string; key: string } => {
  const day = date.getDay(); // 0 is Sunday
  const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
  
  const start = new Date(date);
  start.setDate(diffToMonday);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  
  return {
    start,
    end,
    label: `Tuần: ${fmt(start)} - ${fmt(end)}`,
    key: start.getTime().toString()
  };
};

// --- SUB-COMPONENTS ---

// 1. HOME PAGE (LỊCH DẠY)
const HomePage: React.FC<{ 
  schedules: ScheduleItem[]; 
  customColorMap?: Record<string, string>;
  notificationSettings?: NotificationSettings;
  onItemClick: (item: ScheduleItem) => void;
  onQuickAdd: () => void;
  onOpenNotificationSettings: () => void;
}> = ({ 
  schedules, 
  customColorMap = {}, 
  notificationSettings,
  onItemClick, 
  onQuickAdd,
  onOpenNotificationSettings 
}) => {
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [timeScope, setTimeScope] = useState<'all' | 'today' | 'this_week'>('all');
  const [isCheckModalOpen, setIsCheckModalOpen] = useState<boolean>(false);
  const [checkModalTab, setCheckModalTab] = useState<'today' | 'week'>('today');
  
  const today = new Date();
  const todayIndex = today.getDay(); 
  const jsDayToViDay = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const todayStr = jsDayToViDay[todayIndex];
  const todayDateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

  // Current week boundaries
  const currentWeekRange = useMemo(() => getWeekRange(today), [today]);

  // Check counts for badges across ALL schedules
  const todayAllCount = useMemo(() => {
    return schedules.filter(item => {
      if (item.date && item.date.trim() !== '') {
        return item.date === todayDateStr;
      }
      return item.dayOfWeek === todayStr;
    }).length;
  }, [schedules, todayDateStr, todayStr]);

  const thisWeekAllCount = useMemo(() => {
    let count = 0;
    schedules.forEach(item => {
      if (item.date && item.date.trim() !== '') {
        const dObj = parseDate(item.date);
        if (dObj && dObj >= currentWeekRange.start && dObj <= currentWeekRange.end) {
          count++;
        }
      } else {
        // Recurring items count for their day in current week
        count++;
      }
    });
    return count;
  }, [schedules, currentWeekRange]);

  // Unique classes for filter chips
  const classList = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach(s => {
      if (s.className && s.className.trim()) {
        set.add(s.className.trim());
      }
    });
    return Array.from(set).sort();
  }, [schedules]);

  // Filtered schedules by class
  const classFilteredSchedules = useMemo(() => {
    if (selectedClassFilter === 'ALL') return schedules;
    return schedules.filter(s => (s.className || '').trim() === selectedClassFilter);
  }, [schedules, selectedClassFilter]);

  // Filtered schedules by time scope ('all' | 'today' | 'this_week')
  const displayedSchedules = useMemo(() => {
    if (timeScope === 'today') {
      return classFilteredSchedules.filter(item => {
        if (item.date && item.date.trim() !== '') {
          return item.date === todayDateStr;
        }
        return item.dayOfWeek === todayStr;
      });
    }

    if (timeScope === 'this_week') {
      return classFilteredSchedules.filter(item => {
        if (item.date && item.date.trim() !== '') {
          const dObj = parseDate(item.date);
          return dObj && dObj >= currentWeekRange.start && dObj <= currentWeekRange.end;
        }
        // Recurring items belong to every week
        return true;
      });
    }

    return classFilteredSchedules;
  }, [classFilteredSchedules, timeScope, todayDateStr, todayStr, currentWeekRange]);

  // Today specific items for today view
  const todaySessionsSorted = useMemo(() => {
    if (timeScope !== 'today') return [];
    return [...displayedSchedules].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [displayedSchedules, timeScope]);

  // Separate items into Recurring (no date) and Specific (has date) for general & week view
  const recurringItems: ScheduleItem[] = [];
  const specificItems: ScheduleItem[] = [];

  displayedSchedules.forEach(item => {
    if (item.date && item.date.trim() !== "") {
      specificItems.push(item);
    } else {
      recurringItems.push(item);
    }
  });

  // Group Specific Items by Week
  const weekGroups: Record<string, { label: string, startTime: number, items: ScheduleItem[] }> = {};

  specificItems.forEach(item => {
    const dateObj = parseDate(item.date);
    if (dateObj) {
      const { key, label, start } = getWeekRange(dateObj);
      if (!weekGroups[key]) {
        weekGroups[key] = { label, startTime: start.getTime(), items: [] };
      }
      weekGroups[key].items.push(item);
    } else {
      // Fallback if date is invalid, treat as recurring
      recurringItems.push(item);
    }
  });

  // Sort weeks
  const sortedWeekKeys = Object.keys(weekGroups).sort((a, b) => {
    return weekGroups[a].startTime - weekGroups[b].startTime;
  });

  // Helper to group items by Day inside recurring schedule
  const renderDayGroups = (items: ScheduleItem[]) => {
    const groupedByDay = DAYS_ORDER.reduce((acc, day) => {
      acc[day] = items
        .filter(s => s.dayOfWeek === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      return acc;
    }, {} as Record<string, ScheduleItem[]>);

    return (
      <div className="space-y-4">
        {DAYS_ORDER.map(day => {
          const classes = groupedByDay[day];
          if (classes.length === 0) return null;
          
          const isTodayDayOfWeek = day === todayStr;
          
          return (
            <div key={day}>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ml-1 flex items-center ${isTodayDayOfWeek ? 'text-indigo-600' : 'text-gray-400'}`}>
                {day}
                {isTodayDayOfWeek && <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px]">Hôm nay</span>}
              </h3>
              <div className="pl-2 border-l-2 border-gray-200 space-y-3">
                {classes.map(item => {
                   const isItemToday = item.date ? item.date === todayDateStr : isTodayDayOfWeek;
                   return (
                     <ClassCard 
                       key={item.id} 
                       item={item} 
                       onClick={() => onItemClick(item)} 
                       isToday={isItemToday} 
                       customColorMap={customColorMap}
                     />
                   );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Helper to group items by Date strictly inside a dated week container
  const renderDatedDayGroups = (items: ScheduleItem[]) => {
    const dateMap: Record<string, { dateStr: string; dayOfWeek: string; dateObj: Date | null; items: ScheduleItem[] }> = {};

    items.forEach(item => {
      const dStr = (item.date || '').trim();
      const dObj = dStr ? parseDate(dStr) : null;
      const dDayOfWeek = (dStr ? getDayOfWeekFromDate(dStr) : null) || item.dayOfWeek || 'Thứ 2';
      const dKey = dStr || dDayOfWeek;

      if (!dateMap[dKey]) {
        dateMap[dKey] = {
          dateStr: dStr,
          dayOfWeek: dDayOfWeek,
          dateObj: dObj,
          items: [],
        };
      }
      dateMap[dKey].items.push(item);
    });

    const sortedDateKeys = Object.keys(dateMap).sort((a, b) => {
      const tA = dateMap[a].dateObj?.getTime() || 0;
      const tB = dateMap[b].dateObj?.getTime() || 0;
      if (tA !== tB) return tA - tB;
      return a.localeCompare(b);
    });

    return (
      <div className="space-y-4">
        {sortedDateKeys.map(key => {
          const group = dateMap[key];
          const sortedClasses = group.items.sort((a, b) => a.startTime.localeCompare(b.startTime));
          const isTodayDate = group.dateStr ? group.dateStr === todayDateStr : group.dayOfWeek === todayStr;

          return (
            <div key={key}>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ml-1 flex items-center ${isTodayDate ? 'text-indigo-600' : 'text-gray-500'}`}>
                <span>{group.dayOfWeek} {group.dateStr ? `• ${group.dateStr}` : ''}</span>
                {isTodayDate && <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px]">Hôm nay</span>}
              </h3>
              <div className="pl-2 border-l-2 border-indigo-100 space-y-3">
                {sortedClasses.map(item => {
                  const isItemToday = item.date ? item.date === todayDateStr : item.dayOfWeek === todayStr;
                  return (
                    <ClassCard 
                      key={item.id} 
                      item={item} 
                      onClick={() => onItemClick(item)} 
                      isToday={isItemToday} 
                      customColorMap={customColorMap}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleOpenQuickCheck = (tab: 'today' | 'week') => {
    setCheckModalTab(tab);
    setIsCheckModalOpen(true);
  };

  return (
    <div className="pb-28 pt-4 px-4">
      {/* Header */}
      <header className="mb-3 flex justify-between items-center sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 py-2">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Lịch Dạy</h1>
           <p className="text-gray-500 text-xs">{todayStr}, {todayDateStr}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleOpenQuickCheck('today')}
            className="p-2 bg-white text-indigo-600 rounded-full shadow-xs hover:bg-indigo-50 border border-indigo-100 active:scale-95 transition-all"
            title="Kiểm tra chi tiết lịch dạy hôm nay và tuần này"
          >
            <CalendarCheck size={18} />
          </button>
          <button
            onClick={onQuickAdd}
            className="p-2 bg-indigo-600 text-white rounded-full shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
            title="Thêm buổi dạy mới"
          >
            <Plus size={18} />
          </button>
          <button 
             onClick={onOpenNotificationSettings} 
             className="relative p-2 bg-white rounded-full shadow-xs text-gray-600 hover:text-indigo-600 active:bg-gray-100 border border-gray-200/80 transition-all"
             title="Cài đặt thông báo lịch dạy"
          >
            <Bell size={18} />
            {notificationSettings?.enabled && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
            )}
          </button>
        </div>
      </header>

      {/* QUICK CHECK & TIME SCOPE BUTTONS */}
      <div className="mb-3 bg-white p-2 rounded-2xl border border-gray-200/90 shadow-2xs">
        <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 mb-1.5 px-1">
          <span className="flex items-center">
            <CalendarCheck size={13} className="mr-1 text-indigo-600" />
            Kiểm tra lịch:
          </span>
          <button
            onClick={() => handleOpenQuickCheck('today')}
            className="text-indigo-600 hover:text-indigo-700 flex items-center font-semibold text-[11px]"
          >
            <span>Xem chi tiết</span>
            <Sparkles size={11} className="ml-1 text-amber-500" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {/* Button 1: Hôm nay */}
          <button
            onClick={() => setTimeScope('today')}
            className={`p-2 rounded-xl text-left transition-all relative overflow-hidden flex flex-col justify-between ${
              timeScope === 'today'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-50/90 text-gray-700 hover:bg-indigo-50/50 border border-gray-200/60'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold">Hôm nay</span>
              <span 
                className={`w-2 h-2 rounded-full ${
                  todayAllCount > 0 
                    ? timeScope === 'today' ? 'bg-emerald-300' : 'bg-emerald-500' 
                    : timeScope === 'today' ? 'bg-indigo-300' : 'bg-gray-300'
                }`}
              />
            </div>
            <div className="mt-1">
              <span className={`text-[12px] font-extrabold ${
                timeScope === 'today' ? 'text-white' : todayAllCount > 0 ? 'text-emerald-700' : 'text-gray-400'
              }`}>
                {todayAllCount > 0 ? `${todayAllCount} buổi` : 'Nghỉ'}
              </span>
            </div>
          </button>

          {/* Button 2: Tuần hiện tại */}
          <button
            onClick={() => setTimeScope('this_week')}
            className={`p-2 rounded-xl text-left transition-all relative overflow-hidden flex flex-col justify-between ${
              timeScope === 'this_week'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-50/90 text-gray-700 hover:bg-indigo-50/50 border border-gray-200/60'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold">Tuần này</span>
              <CalendarDays size={12} className={timeScope === 'this_week' ? 'text-indigo-200' : 'text-gray-400'} />
            </div>
            <div className="mt-1">
              <span className={`text-[12px] font-extrabold ${
                timeScope === 'this_week' ? 'text-white' : thisWeekAllCount > 0 ? 'text-indigo-700' : 'text-gray-400'
              }`}>
                {thisWeekAllCount > 0 ? `${thisWeekAllCount} buổi` : '0 buổi'}
              </span>
            </div>
          </button>

          {/* Button 3: Toàn bộ lịch */}
          <button
            onClick={() => setTimeScope('all')}
            className={`p-2 rounded-xl text-left transition-all relative overflow-hidden flex flex-col justify-between ${
              timeScope === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-50/90 text-gray-700 hover:bg-indigo-50/50 border border-gray-200/60'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold">Tất cả</span>
              <CalendarRange size={12} className={timeScope === 'all' ? 'text-indigo-200' : 'text-gray-400'} />
            </div>
            <div className="mt-1">
              <span className={`text-[12px] font-extrabold ${timeScope === 'all' ? 'text-white' : 'text-gray-700'}`}>
                {schedules.length} buổi
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Class Filter Chips with Color Badges */}
      {classList.length > 0 && (
        <div className="mb-4 overflow-x-auto pb-1 no-scrollbar flex items-center space-x-1.5">
          <div className="flex items-center text-xs text-gray-400 mr-1 shrink-0 font-medium">
            <Filter size={13} className="mr-1" />
            Lớp:
          </div>
          <button
            onClick={() => setSelectedClassFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
              selectedClassFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tất cả ({schedules.length})
          </button>
          {classList.map(cls => {
            const theme = getClassColorTheme(cls, customColorMap);
            const isSelected = selectedClassFilter === cls;
            return (
              <button
                key={cls}
                onClick={() => setSelectedClassFilter(cls)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center space-x-1.5 ${
                  isSelected
                    ? `${theme.badgeBg} ${theme.badgeText} border ${theme.cardBorder} shadow-xs`
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: theme.dotColor }} 
                />
                <span>{cls}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* TIME SCOPE STATUS BANNER */}
      {timeScope === 'today' && (
        <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-indigo-100/60 border border-indigo-200/80 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock size={16} className="text-indigo-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-indigo-950">
                Lịch Dạy Hôm Nay ({todayStr} • {todayDateStr})
              </p>
              <p className="text-[11px] text-indigo-700">
                {displayedSchedules.length > 0 
                  ? `Có ${displayedSchedules.length} buổi dạy${selectedClassFilter !== 'ALL' ? ` (Lớp ${selectedClassFilter})` : ''}` 
                  : 'Hôm nay không có lịch dạy'}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenQuickCheck('today')}
            className="px-2.5 py-1 bg-white text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-colors"
          >
            Chi tiết
          </button>
        </div>
      )}

      {timeScope === 'this_week' && (
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CalendarDays size={16} className="text-indigo-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-indigo-950">
                Lịch Dạy Tuần Này ({currentWeekRange.label})
              </p>
              <p className="text-[11px] text-indigo-700">
                {displayedSchedules.length > 0 
                  ? `Tổng ${displayedSchedules.length} buổi dạy trong tuần` 
                  : 'Không có lịch dạy trong tuần này'}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenQuickCheck('week')}
            className="px-2.5 py-1 bg-white text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-colors"
          >
            Chi tiết
          </button>
        </div>
      )}

      {/* SCHEDULES CONTENT */}
      {displayedSchedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mt-2">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-3">
            <Calendar size={30} />
          </div>
          <p className="text-gray-800 font-bold">
            {timeScope === 'today' 
              ? 'Hôm nay không có lịch dạy nào.' 
              : timeScope === 'this_week' 
              ? 'Tuần này không có lịch dạy nào.' 
              : selectedClassFilter !== 'ALL' 
              ? `Không có lịch dạy cho lớp ${selectedClassFilter}` 
              : 'Chưa có lịch dạy nào.'}
          </p>
          <p className="text-gray-400 text-xs mt-1 mb-4">
            {timeScope !== 'all' 
              ? 'Bạn có thể chuyển sang "Tất cả" hoặc kiểm tra các ngày khác.' 
              : 'Nhấn "Thêm buổi" hoặc quét ảnh thời khóa biểu.'}
          </p>
          <div className="flex items-center space-x-2">
            {timeScope !== 'all' && (
              <button
                onClick={() => setTimeScope('all')}
                className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
              >
                Xem tất cả lịch
              </button>
            )}
            <button
              onClick={onQuickAdd}
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow hover:bg-indigo-700 transition-all flex items-center"
            >
              <Plus size={14} className="mr-1" />
              Thêm buổi dạy
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SPECIAL VIEW FOR TODAY ONLY */}
          {timeScope === 'today' ? (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4 text-indigo-900 border-b border-gray-100 pb-2">
                <div className="flex items-center">
                  <Clock size={18} className="mr-2 text-emerald-600" />
                  <h2 className="font-bold text-base">Danh sách buổi dạy hôm nay</h2>
                </div>
                <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                  {todaySessionsSorted.length} buổi
                </span>
              </div>
              <div className="space-y-3">
                {todaySessionsSorted.map(item => (
                  <ClassCard 
                    key={item.id} 
                    item={item} 
                    onClick={() => onItemClick(item)} 
                    isToday={true} 
                    customColorMap={customColorMap}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* SECTION 1: RECURRING SCHEDULE (Lịch cố định) */}
              {recurringItems.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4 text-indigo-900 border-b border-gray-100 pb-2">
                    <div className="flex items-center">
                      <CalendarRange size={18} className="mr-2 text-indigo-600" />
                      <h2 className="font-bold text-base">
                        {timeScope === 'this_week' ? 'Lịch dạy trong tuần' : 'Lịch cố định hàng tuần'}
                      </h2>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                      {recurringItems.length} buổi
                    </span>
                  </div>
                  {renderDayGroups(recurringItems)}
                </div>
              )}

              {/* SECTION 2: WEEKLY SCHEDULES */}
              {sortedWeekKeys.map(key => {
                const group = weekGroups[key];
                return (
                  <div key={key} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                     <div className="flex items-center justify-between mb-4 text-gray-800 border-b border-gray-100 pb-2">
                        <div className="flex items-center">
                          <CalendarDays size={18} className="mr-2 text-orange-500" />
                          <h2 className="font-bold text-base">{group.label}</h2>
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                          {group.items.length} buổi
                        </span>
                     </div>
                     {renderDatedDayGroups(group.items)}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* SCHEDULE CHECK MODAL */}
      <ScheduleCheckModal
        isOpen={isCheckModalOpen}
        onClose={() => setIsCheckModalOpen(false)}
        schedules={schedules}
        customColorMap={customColorMap}
        initialTab={checkModalTab}
        onSelectScheduleItem={(item) => onItemClick(item)}
        onApplyFilter={(scope) => {
          setTimeScope(scope);
        }}
      />
    </div>
  );
};

// 2. ADD SCHEDULE PAGE (QUÉT ẢNH AI & NHẬP THỦ CÔNG)
const AddPage: React.FC<{ 
  onSaveComplete: () => void;
  onOpenManualModal: () => void;
}> = ({ onSaveComplete, onOpenManualModal }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileSource, setFileSource] = useState<'camera' | 'upload' | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ScheduleItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, source: 'camera' | 'upload') => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFileSource(source);
      setError(null);
    }
  };

  const handleCameraCapture = (capturedFile: File) => {
    setFile(capturedFile);
    setFileSource('camera');
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setFileSource('upload');
      setError(null);
    }
  };

  const processFile = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const data = await extractScheduleFromImage(file);
      setExtractedData(data);
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (extractedData) {
      saveAllSchedules(extractedData);
      onSaveComplete();
    }
  };

  const handleEditItem = (index: number, field: keyof ScheduleItem, value: string) => {
    if (!extractedData) return;
    const newData = [...extractedData];
    newData[index] = { ...newData[index], [field]: value };
    setExtractedData(newData);
  };

  const handleDeleteItem = (index: number) => {
    if (!extractedData) return;
    const newData = extractedData.filter((_, i) => i !== index);
    setExtractedData(newData);
  };

  const handleResetImage = () => {
    setFile(null);
    setFileSource(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = '';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-sm">
            <Sparkles className="text-indigo-600 animate-pulse" size={32} />
          </div>
          <Loader2 className="animate-spin text-indigo-600 absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm" size={24} />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Gemini AI Đang Phân Tích...</h3>
        <p className="text-gray-500 text-xs mt-2 max-w-xs leading-relaxed">
          Đang nhận diện các môn học, lớp dạy, phòng học, thứ/ngày và tự động chuẩn hóa các tiết học.
        </p>
      </div>
    );
  }

  if (extractedData) {
    return (
      <div className="pb-28 pt-4 px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Xác nhận lịch học</h2>
            <p className="text-xs text-gray-500">AI đã trích xuất {extractedData.length} buổi dạy</p>
          </div>
          <button 
            onClick={() => setExtractedData(null)}
            className="text-xs text-red-500 font-bold px-2.5 py-1 bg-red-50 rounded-lg hover:bg-red-100"
          >
            Hủy bỏ
          </button>
        </div>
        
        <p className="mb-4 text-xs text-indigo-800 bg-indigo-50 p-3 rounded-xl border border-indigo-100 leading-relaxed">
          ✨ Bạn có thể chỉnh sửa trực tiếp tên môn, tên bài, lớp, ngày hoặc chọn tiết học trước khi lưu.
        </p>

        <div className="space-y-4">
          {extractedData.map((item, index) => (
            <div key={index} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex justify-between mb-2">
                 <input 
                    value={item.subject}
                    onChange={(e) => handleEditItem(index, 'subject', e.target.value)}
                    placeholder="Tên môn học"
                    className="font-bold text-gray-900 w-full bg-transparent border-b border-dashed border-gray-300 focus:border-indigo-500 focus:outline-none pb-1 text-sm"
                 />
                 <button 
                    onClick={() => handleDeleteItem(index)} 
                    title="Xóa buổi này"
                    className="text-gray-400 hover:text-red-500 ml-2 p-1"
                  >
                    <Trash2 size={16} />
                 </button>
              </div>

              <div className="mb-2">
                 <label className="text-[11px] font-bold text-gray-400 block mb-1">Tên bài (Bài số & Nội dung)</label>
                 <input 
                    value={item.lessonName || ''}
                    onChange={(e) => handleEditItem(index, 'lessonName', e.target.value)}
                    placeholder="VD: Bài 1: Khái niệm mở đầu"
                    className="w-full text-xs bg-indigo-50/60 rounded-lg p-2 border border-indigo-100 font-semibold text-indigo-950"
                 />
              </div>
              
              <div className="grid grid-cols-2 gap-2.5 mt-3">
                 <div>
                    <label className="text-[11px] font-bold text-gray-400 block mb-1">Thứ</label>
                    <select 
                        value={item.dayOfWeek}
                        onChange={(e) => handleEditItem(index, 'dayOfWeek', e.target.value)}
                        className="w-full text-xs bg-gray-50 rounded-lg p-2 border border-gray-200 font-medium text-gray-800"
                    >
                        {DAYS_ORDER.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-[11px] font-bold text-gray-400 block mb-1">Ngày (DD/MM/YYYY)</label>
                    <input 
                        value={item.date || ''}
                        placeholder="VD: 11/08/2026"
                        onChange={(e) => {
                          handleEditItem(index, 'date', e.target.value);
                          const calcDay = getDayOfWeekFromDate(e.target.value);
                          if (calcDay) {
                            handleEditItem(index, 'dayOfWeek', calcDay);
                          }
                        }}
                        className="w-full text-xs bg-gray-50 rounded-lg p-2 border border-gray-200 font-medium text-gray-800"
                    />
                 </div>
                 
                 <div className="col-span-2">
                    <label className="text-[11px] font-bold text-gray-400 block mb-1">Lớp</label>
                    <input 
                        value={item.className || ''}
                        onChange={(e) => handleEditItem(index, 'className', e.target.value)}
                        placeholder="Tên lớp (VD: KMP18, KNP27, KPT31)"
                        className="w-full text-xs bg-gray-50 rounded-lg p-2 border border-gray-200 font-semibold text-gray-800"
                    />
                 </div>

                 <div className="col-span-2">
                    <label className="text-[11px] font-bold text-gray-400 block mb-1">Chọn nhanh tiết học</label>
                    <select
                        value={getPeriodLabelFromTime(item.startTime, item.endTime) || "custom"}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== "custom") {
                            const found = COMMON_PERIOD_PRESETS.find(p => p.label === val);
                            if (found) {
                              handleEditItem(index, 'startTime', found.start);
                              handleEditItem(index, 'endTime', found.end);
                            }
                          }
                        }}
                        className="w-full text-xs bg-indigo-50 text-indigo-900 font-bold rounded-lg p-2 border border-indigo-200"
                    >
                        <option value="custom">-- Tùy chỉnh giờ hoặc chọn tiết --</option>
                        {COMMON_PERIOD_PRESETS.map(p => (
                          <option key={p.label} value={p.label}>
                            {p.label} ({p.start} - {p.end})
                          </option>
                        ))}
                    </select>
                 </div>

                 <div>
                    <label className="text-[11px] font-bold text-gray-400 block mb-1">Bắt đầu</label>
                    <input 
                        type="time"
                        value={item.startTime}
                        onChange={(e) => handleEditItem(index, 'startTime', e.target.value)}
                        className="w-full text-xs bg-gray-50 rounded-lg p-2 border border-gray-200 font-medium"
                    />
                 </div>
                 <div>
                    <label className="text-[11px] font-bold text-gray-400 block mb-1">Kết thúc</label>
                    <input 
                        type="time"
                        value={item.endTime}
                        onChange={(e) => handleEditItem(index, 'endTime', e.target.value)}
                        className="w-full text-xs bg-gray-50 rounded-lg p-2 border border-gray-200 font-medium"
                    />
                 </div>
                 <div className="col-span-2">
                    <label className="text-[11px] font-bold text-gray-400 block mb-1">Phòng học</label>
                    <input 
                        value={item.location}
                        onChange={(e) => handleEditItem(index, 'location', e.target.value)}
                        placeholder="Phòng học (VD: 210/H10)"
                        className="w-full text-xs bg-gray-50 rounded-lg p-2 border border-gray-200 font-medium"
                    />
                 </div>
              </div>
            </div>
          ))}
        </div>

        <button 
            onClick={handleSave}
            className="fixed bottom-20 left-4 right-4 bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg active:bg-indigo-700 flex justify-center items-center text-sm z-30"
        >
            <Check size={18} className="mr-2" />
            Lưu {extractedData.length} Buổi Vào Lịch Dạy
        </button>
      </div>
    );
  }

  return (
    <div className="pb-28 pt-4 px-4 flex flex-col">
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden" 
        accept="image/*" 
        onChange={(e) => handleFileChange(e, 'upload')} 
      />
      <input 
        type="file" 
        ref={nativeCameraInputRef}
        className="hidden" 
        accept="image/*" 
        capture="environment"
        onChange={(e) => handleFileChange(e, 'camera')} 
      />

      {/* Live Camera Viewfinder Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Thêm Lịch Dạy</h1>
      <p className="text-gray-500 text-xs mb-5">
        Chụp ảnh từ camera điện thoại, tải ảnh lên để AI trích xuất tự động hoặc nhập thủ công.
      </p>

      {/* Manual Add Quick Banner */}
      <div 
        onClick={onOpenManualModal}
        className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md mb-5 cursor-pointer hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-between"
      >
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shrink-0">
            <PenLine size={22} />
          </div>
          <div>
            <h3 className="font-bold text-sm">Nhập Thủ Công Theo Lớp</h3>
            <p className="text-xs text-indigo-100 mt-0.5">
              Thêm 1 buổi hoặc tạo chuỗi nhiều tuần cho lớp
            </p>
          </div>
        </div>
        <Plus size={20} className="text-white/90 shrink-0" />
      </div>

      <div className="flex items-center my-2 mb-4">
        <div className="flex-1 border-t border-gray-200"></div>
        <span className="px-3 text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center space-x-1.5">
          <Sparkles size={13} className="text-indigo-600" />
          <span>Quét Bằng Gemini AI</span>
        </span>
        <div className="flex-1 border-t border-gray-200"></div>
      </div>

      {/* Mode A: When an image is ready (Captured or Uploaded) */}
      {file ? (
        <div className="bg-white rounded-2xl border border-indigo-100 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 flex items-center space-x-1.5">
              {fileSource === 'camera' ? (
                <>
                  <Camera size={15} className="text-indigo-600" />
                  <span>Ảnh chụp từ Camera</span>
                </>
              ) : (
                <>
                  <ImageIcon size={15} className="text-emerald-600" />
                  <span>Ảnh tải từ thiết bị</span>
                </>
              )}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">
              {(file.size / 1024).toFixed(0)} KB
            </span>
          </div>

          {/* Image Preview Container */}
          <div className="relative w-full h-56 bg-zinc-900 rounded-xl overflow-hidden flex items-center justify-center border border-gray-200">
            <img 
              src={URL.createObjectURL(file)} 
              alt="Schedule Preview" 
              className="max-w-full max-h-full object-contain" 
            />
            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg">
              Sẵn sàng phân tích
            </div>
          </div>

          {/* Action Buttons for Previewed Image */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleResetImage}
              className="py-3 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
            >
              <RotateCcw size={15} />
              <span>Chụp/Chọn ảnh khác</span>
            </button>

            <button 
              type="button"
              onClick={processFile}
              className="py-3 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-indigo-200 active:scale-98 transition-all"
            >
              <Sparkles size={16} />
              <span>Quét Lịch Ngay</span>
            </button>
          </div>

          <p className="text-center text-[11px] text-gray-400 flex items-center justify-center">
            <AlertTriangle size={12} className="mr-1 text-amber-500 shrink-0" />
            AI sẽ tự động đọc môn, lớp, ngày giờ và các tiết học
          </p>
        </div>
      ) : (
        /* Mode B: Dual Capture Selection Cards (Camera & Upload) */
        <div className="space-y-3.5">
          {/* Dual Action Options Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Option 1: Live Camera Button */}
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="bg-white p-4 rounded-2xl border-2 border-indigo-200 hover:border-indigo-500 hover:shadow-md transition-all flex flex-col items-center text-center group active:scale-[0.98]"
            >
              <div className="w-13 h-13 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-2xs">
                <Camera size={24} />
              </div>
              <span className="font-bold text-xs text-gray-900">Dùng Camera</span>
              <span className="text-[10px] text-gray-500 mt-1 leading-tight">
                Chụp trực tiếp thời khóa biểu giấy/màn hình
              </span>
            </button>

            {/* Option 2: Upload File / Gallery Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-white p-4 rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 hover:shadow-md transition-all flex flex-col items-center text-center group active:scale-[0.98]"
            >
              <div className="w-13 h-13 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-2xs">
                <ImageIcon size={24} />
              </div>
              <span className="font-bold text-xs text-gray-900">Tải Ảnh Lên</span>
              <span className="text-[10px] text-gray-500 mt-1 leading-tight">
                Chọn từ thư viện ảnh hoặc chụp màn hình
              </span>
            </button>
          </div>

          {/* Drag and Drop / Tap Dropzone Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
              isDragging 
                ? 'border-indigo-500 bg-indigo-50' 
                : 'border-gray-200 hover:border-indigo-300 bg-white/60 hover:bg-indigo-50/40'
            }`}
          >
            <div className="flex flex-col items-center space-y-1.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Upload size={18} />
              </div>
              <p className="text-xs font-bold text-gray-700">Kéo thả ảnh vào đây hoặc bấm để chọn tệp</p>
              <p className="text-[11px] text-gray-400">Hỗ trợ định dạng JPG, PNG, WEBP, ảnh chụp màn hình</p>
            </div>
          </div>

          {/* Quick Mobile Native Camera Shortcut */}
          <button
            type="button"
            onClick={() => nativeCameraInputRef.current?.click()}
            className="w-full py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Smartphone size={14} className="text-gray-500" />
            <span>Mở trực tiếp máy ảnh hệ thống điện thoại</span>
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs font-medium rounded-xl text-center border border-red-100 flex items-center justify-center space-x-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

// 3. DETAIL PAGE OVERLAY (XEM CHI TIẾT & SỬA / XÓA)
const DetailView: React.FC<{ 
  item: ScheduleItem; 
  onClose: () => void; 
  onDelete: () => void;
  onEdit: () => void;
}> = ({ item, onClose, onDelete, onEdit }) => {
    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-10 duration-200">
            <div className="p-4 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center">
                  <button onClick={onClose} className="p-1.5 -ml-1 text-gray-600 hover:bg-gray-100 rounded-lg">
                      <ChevronLeft size={24} />
                  </button>
                  <span className="font-bold text-base ml-2">Chi tiết buổi dạy</span>
                </div>
                <button
                  onClick={onEdit}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center transition-colors"
                >
                  <Edit3 size={14} className="mr-1.5" />
                  Sửa buổi này
                </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto">
                <div className="bg-indigo-50/90 p-5 rounded-2xl mb-6 flex flex-col items-center text-center border border-indigo-100">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-3 text-indigo-600 text-xl font-bold">
                        {item.subject.charAt(0)}
                    </div>
                    <h2 className="text-xl font-bold text-indigo-950 mb-1">{item.subject}</h2>
                    {item.className && (
                        <p className="text-sm font-bold text-indigo-700 bg-white/80 px-3 py-1 rounded-xl mt-1.5 shadow-2xs">
                           Lớp: {item.className}
                        </p>
                    )}
                    <p className="text-indigo-600 text-xs font-medium mt-1">{item.location}</p>
                </div>

                <div className="space-y-4">
                    {item.lessonName && (
                        <div className="flex items-start">
                            <BookOpen className="text-indigo-600 mt-1 mr-3.5 shrink-0" size={18} />
                            <div className="flex-1">
                                <p className="text-xs text-gray-400 font-medium">Tên bài học</p>
                                <p className="text-sm font-bold text-indigo-950 bg-indigo-50/70 p-2.5 rounded-xl mt-1 border border-indigo-100">
                                    {item.lessonName}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-start">
                        <Calendar className="text-gray-400 mt-1 mr-3.5 shrink-0" size={18} />
                        <div>
                            <p className="text-xs text-gray-400 font-medium">Ngày dạy</p>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">
                                {item.dayOfWeek}
                                {item.date && <span className="text-indigo-600 ml-2">({item.date})</span>}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-start">
                        <Clock className="text-gray-400 mt-1 mr-3.5 shrink-0" size={18} />
                        <div>
                            <p className="text-xs text-gray-400 font-medium">Thời gian & Tiết</p>
                            <p className="text-sm font-bold text-gray-800 flex items-center flex-wrap gap-2 mt-0.5">
                                <span>{item.startTime} - {item.endTime}</span>
                                {getPeriodLabelFromTime(item.startTime, item.endTime) && (
                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-md">
                                        {getPeriodLabelFromTime(item.startTime, item.endTime)}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {item.notes && (
                      <div className="flex items-start">
                          <PenLine className="text-gray-400 mt-1 mr-3.5 shrink-0" size={18} />
                          <div>
                              <p className="text-xs text-gray-400 font-medium">Ghi chú</p>
                              <p className="text-xs text-gray-700 mt-0.5 bg-gray-50 p-2 rounded-lg whitespace-pre-wrap">
                                  {item.notes}
                              </p>
                          </div>
                      </div>
                    )}

                    <div className="flex items-start">
                        <Bell className="text-gray-400 mt-1 mr-3.5 shrink-0" size={18} />
                        <div>
                            <p className="text-xs text-gray-400 font-medium">Thông báo tự động</p>
                            <p className="text-xs font-medium text-gray-700 mt-0.5">
                                • Trước 1 ngày<br/>
                                • Trước 10 phút vào tiết
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center space-x-3">
                <button 
                    onClick={onDelete}
                    className="flex-1 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-bold py-3 rounded-xl flex justify-center items-center text-xs transition-colors"
                >
                    <Trash2 size={16} className="mr-1.5" />
                    Xóa buổi này
                </button>
                <button 
                    onClick={onEdit}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex justify-center items-center text-xs shadow-sm transition-colors"
                >
                    <Edit3 size={16} className="mr-1.5" />
                    Chỉnh sửa
                </button>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
function App() {
  const [activeTab, setActiveTab] = useState<NavTabType>('home');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [classColors, setClassColors] = useState<Record<string, string>>({});
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  // Edit / Add modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<ScheduleItem> | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  // Load data on mount
  useEffect(() => {
    setSchedules(getSchedules());
    setClassColors(getClassColors());
    setNotificationSettings(getNotificationSettings());
  }, []);

  const refreshData = () => {
    setSchedules(getSchedules());
    setClassColors(getClassColors());
  };

  const classSummaries = useMemo(() => {
    return getClassSummaries(schedules);
  }, [schedules]);

  // Existing unique classes, subjects, locations for modal autocomplete
  const existingClasses = useMemo(() => {
    return classSummaries.map(c => c.className).filter(c => c !== 'Chưa phân lớp');
  }, [classSummaries]);

  const existingSubjects = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach(s => s.subject && set.add(s.subject));
    return Array.from(set);
  }, [schedules]);

  const existingLocations = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach(s => s.location && s.location !== 'Chưa cập nhật' && set.add(s.location));
    return Array.from(set);
  }, [schedules]);

  // Color & Notification settings handlers
  const handleUpdateClassColor = (className: string, colorId: string) => {
    saveClassColor(className, colorId);
    setClassColors(getClassColors());
    refreshData();
  };

  const handleSaveNotificationSettings = (newSettings: NotificationSettings) => {
    saveNotificationSettings(newSettings);
    setNotificationSettings(newSettings);
  };

  // Session & Class Actions
  const handleOpenAddSession = (prefilledClassName?: string) => {
    setEditingItem({
      className: prefilledClassName || '',
      subject: '',
      lessonName: '',
      dayOfWeek: 'Thứ 2',
      startTime: '07:00',
      endTime: '08:35',
      location: '',
      notes: '',
    });
    setModalMode('add');
    setIsEditModalOpen(true);
  };

  const handleOpenEditSession = (item: ScheduleItem) => {
    setEditingItem(item);
    setModalMode('edit');
    setIsEditModalOpen(true);
  };

  const handleSaveModalSession = (item: ScheduleItem, repeatWeeks = 1) => {
    if (repeatWeeks > 1 && item.date) {
      // Generate multiple weeks
      const parts = item.date.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const baseDate = new Date(year, month, day);

        const itemsToAdd: ScheduleItem[] = [];
        for (let i = 0; i < repeatWeeks; i++) {
          const nextDate = new Date(baseDate);
          nextDate.setDate(baseDate.getDate() + i * 7);

          const dStr = `${nextDate.getDate().toString().padStart(2, '0')}/${(nextDate.getMonth() + 1).toString().padStart(2, '0')}/${nextDate.getFullYear()}`;
          const calcDay = getDayOfWeekFromDate(dStr) || item.dayOfWeek;

          itemsToAdd.push({
            ...item,
            id: i === 0 ? item.id : Math.random().toString(36).substring(2, 15),
            date: dStr,
            dayOfWeek: calcDay,
            lessonName: item.lessonName ? (i === 0 ? item.lessonName : `${item.lessonName} (Tuần ${i + 1})`) : undefined,
          });
        }
        saveAllSchedules(itemsToAdd);
      } else {
        saveSchedule(item);
      }
    } else {
      saveSchedule(item);
    }

    refreshData();
    if (selectedItem?.id === item.id) {
      setSelectedItem(item);
    }
  };

  const handleDeleteSession = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa buổi dạy này?")) {
      deleteSchedule(id);
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
      setIsEditModalOpen(false);
      refreshData();
    }
  };

  const handleDeleteClass = (className: string) => {
    deleteSchedulesByClass(className);
    refreshData();
  };

  const handleRenameClass = (oldName: string, newName: string) => {
    updateClassName(oldName, newName);
    refreshData();
  };

  const handleDeleteMultipleSessions = (ids: string[]) => {
    deleteMultipleSchedules(ids);
    refreshData();
  };

  // Đồng bộ lịch + cài đặt lên server khi thiết bị đã đăng ký Web Push.
  // Phần này không thay đổi giao diện/logic "Kiểm tra lịch" ở đầu trang.
  useEffect(() => {
    if (typeof window === 'undefined' || Notification.permission !== 'granted') return;
    const timer = window.setTimeout(() => {
      syncPushState(schedules, notificationSettings).catch((error) => {
        console.warn('Không thể đồng bộ Web Push:', error);
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [schedules, notificationSettings]);

  // Notification Engine Logic
  useEffect(() => {
    const checkNotifications = () => {
      if (!notificationSettings.enabled) return;

      const now = new Date();
      const currentDayIndex = now.getDay(); 
      const jsDayToViDay = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
      const todayVi = jsDayToViDay[currentDayIndex];
      const todayDateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;
      const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

      // 1. Check Before-Class Reminders (Multi-minute offsets: 5, 10, 15, 30, 45, 60)
      schedules.forEach(item => {
        const isToday = item.date ? item.date === todayDateStr : item.dayOfWeek === todayVi;

        if (isToday && item.startTime) {
          const [h, m] = item.startTime.split(':').map(Number);
          const classTime = h * 60 + m;
          const diffMinutes = classTime - currentTime;

          (notificationSettings.notifyMinutesBefore || [15]).forEach(minOffset => {
            if (diffMinutes <= minOffset && diffMinutes > minOffset - 1) {
              const notifyKey = `${todayDateStr}_${item.id}_offset_${minOffset}`;
              if (!notifiedKeysRef.current.has(notifyKey)) {
                notifiedKeysRef.current.add(notifyKey);
                const classTitle = item.className ? `Lớp ${item.className}` : 'Buổi dạy';
                dispatchNotification(
                  `🔔 Nhắc lịch dạy (${minOffset} phút nữa): ${item.subject}`,
                  `${classTitle} tại ${item.location} • Giờ học: ${item.startTime}${item.lessonName ? ` • ${item.lessonName}` : ''}`,
                  notificationSettings
                );
              }
            }
          });
        }
      });

      // 2. Check Day-Before Reminder
      if (notificationSettings.dayBeforeReminder && notificationSettings.dayBeforeReminderTime === currentTimeStr) {
        const dayBeforeKey = `day_before_${todayDateStr}`;
        if (!notifiedKeysRef.current.has(dayBeforeKey)) {
          notifiedKeysRef.current.add(dayBeforeKey);

          const tomorrow = new Date(now);
          tomorrow.setDate(now.getDate() + 1);
          const tomorrowDayIndex = tomorrow.getDay();
          const tomorrowVi = jsDayToViDay[tomorrowDayIndex];
          const tomorrowDateStr = `${tomorrow.getDate().toString().padStart(2, '0')}/${(tomorrow.getMonth() + 1).toString().padStart(2, '0')}/${tomorrow.getFullYear()}`;

          const tomorrowSessions = schedules.filter(item => {
            return item.date ? item.date === tomorrowDateStr : item.dayOfWeek === tomorrowVi;
          }).sort((a, b) => a.startTime.localeCompare(b.startTime));

          if (tomorrowSessions.length > 0) {
            const firstFew = tomorrowSessions.slice(0, 2).map(s => `${s.subject} (${s.startTime})`).join(', ');
            const moreCount = tomorrowSessions.length > 2 ? ` và ${tomorrowSessions.length - 2} buổi khác` : '';
            dispatchNotification(
              `📅 Lịch dạy ngày mai (${tomorrowVi} - ${tomorrowDateStr})`,
              `Bạn có ${tomorrowSessions.length} buổi dạy: ${firstFew}${moreCount}. Chúc bạn có buổi giảng dạy thành công!`,
              notificationSettings
            );
          }
        }
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 30000);
    return () => clearInterval(interval);
  }, [schedules, notificationSettings]);

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto shadow-2xl relative overflow-hidden">
      {/* View Switcher */}
      {activeTab === 'home' && (
        <HomePage 
          schedules={schedules} 
          customColorMap={classColors}
          notificationSettings={notificationSettings}
          onItemClick={setSelectedItem}
          onQuickAdd={() => handleOpenAddSession()}
          onOpenNotificationSettings={() => setIsNotificationModalOpen(true)}
        />
      )}

      {activeTab === 'classes' && (
        <ClassManagement 
          schedules={schedules}
          classSummaries={classSummaries}
          customColorMap={classColors}
          onAddSessionForClass={(cls) => handleOpenAddSession(cls)}
          onEditSession={(item) => handleOpenEditSession(item)}
          onDeleteSession={(id) => handleDeleteSession(id)}
          onDeleteClass={(cls) => handleDeleteClass(cls)}
          onRenameClass={(oldName, newName) => handleRenameClass(oldName, newName)}
          onDeleteMultipleSessions={(ids) => handleDeleteMultipleSessions(ids)}
          onUpdateClassColor={handleUpdateClassColor}
        />
      )}

      {activeTab === 'add' && (
        <AddPage 
          onSaveComplete={() => {
            refreshData();
            setActiveTab('home');
          }}
          onOpenManualModal={() => handleOpenAddSession()}
        />
      )}
      
      {/* Bottom Navigation */}
      <NavBar 
        currentTab={activeTab} 
        onTabChange={setActiveTab}
        classesCount={classSummaries.length}
      />

      {/* Session Details Modal */}
      {selectedItem && (
        <DetailView 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
          onDelete={() => handleDeleteSession(selectedItem.id)}
          onEdit={() => {
            handleOpenEditSession(selectedItem);
          }}
        />
      )}

      {/* Edit / Add Session Modal */}
      <EditSessionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveModalSession}
        onDelete={handleDeleteSession}
        initialItem={editingItem}
        existingClasses={existingClasses}
        existingSubjects={existingSubjects}
        existingLocations={existingLocations}
        mode={modalMode}
      />

      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        settings={notificationSettings}
        onSave={handleSaveNotificationSettings}
      />
    </div>
  );
}

export default App;
