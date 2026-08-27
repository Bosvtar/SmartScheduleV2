
export interface ScheduleItem {
  id: string;
  subject: string;   // Tên môn học (VD: Lý thuyết điều khiển tự động)
  lessonName?: string; // Tên bài: kết hợp Bài số + Nội dung (VD: Bài 1: Khái niệm mở đầu)
  period?: string;   // Tiết học (VD: 1-1, 1-2, 4-4, 5-5, 6-8)
  className: string; // Tên lớp (VD: KMP18, KNP27, KPT31)
  dayOfWeek: string; // "Thứ 2", "Thứ 3", etc.
  date?: string;     // DD/MM/YYYY (Optional - cho lịch cụ thể/lịch thi)
  startTime: string; // HH:mm (24h format)
  endTime: string;   // HH:mm (24h format)
  location: string;
  notes?: string;
}

export enum DayOfWeek {
  Monday = "Thứ 2",
  Tuesday = "Thứ 3",
  Wednesday = "Thứ 4",
  Thursday = "Thứ 5",
  Friday = "Thứ 6",
  Saturday = "Thứ 7",
  Sunday = "Chủ Nhật"
}

export const DAYS_ORDER = [
  "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"
];

export const PERIOD_TIMINGS: Record<number, { start: string; end: string }> = {
  1: { start: "07:00", end: "07:45" },
  2: { start: "07:50", end: "08:35" },
  3: { start: "08:45", end: "09:30" },
  4: { start: "09:35", end: "10:20" },
  5: { start: "10:30", end: "11:15" },
  6: { start: "14:00", end: "14:45" },
  7: { start: "14:50", end: "15:35" },
  8: { start: "15:45", end: "16:30" },
};

export const COMMON_PERIOD_PRESETS = [
  { label: "Tiết 1-1", start: "07:00", end: "07:45" },
  { label: "Tiết 1-2", start: "07:00", end: "08:35" },
  { label: "Tiết 1-3", start: "07:00", end: "09:30" },
  { label: "Tiết 1-4", start: "07:00", end: "10:20" },
  { label: "Tiết 1-5", start: "07:00", end: "11:15" },
  { label: "Tiết 2-2", start: "07:50", end: "08:35" },
  { label: "Tiết 2-3", start: "07:50", end: "09:30" },
  { label: "Tiết 2-4", start: "07:50", end: "10:20" },
  { label: "Tiết 3-3", start: "08:45", end: "09:30" },
  { label: "Tiết 3-4", start: "08:45", end: "10:20" },
  { label: "Tiết 3-5", start: "08:45", end: "11:15" },
  { label: "Tiết 4-4", start: "09:35", end: "10:20" },
  { label: "Tiết 4-5", start: "09:35", end: "11:15" },
  { label: "Tiết 5-5", start: "10:30", end: "11:15" },
  { label: "Tiết 6-6", start: "14:00", end: "14:45" },
  { label: "Tiết 6-7", start: "14:00", end: "15:35" },
  { label: "Tiết 6-8", start: "14:00", end: "16:30" },
  { label: "Tiết 7-7", start: "14:50", end: "15:35" },
  { label: "Tiết 7-8", start: "14:50", end: "16:30" },
  { label: "Tiết 8-8", start: "15:45", end: "16:30" },
];

export const normalizePeriodTimings = (
  rawStart?: string,
  rawEnd?: string,
  rawPeriod?: string
): { startTime: string; endTime: string; period: string } => {
  let period = (rawPeriod || "").trim();
  let startTime = (rawStart || "").trim();
  let endTime = (rawEnd || "").trim();

  // Try to parse period from rawPeriod string (e.g. "Tiết 4-4", "4-4", "4 - 4", "4", "4,5")
  if (period) {
    const match = period.match(/(\d+)(?:\s*[-–,\s]\s*(\d+))?/);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = match[2] ? parseInt(match[2], 10) : p1;
      if (PERIOD_TIMINGS[p1]) {
        const range = getPeriodRangeTime(p1, p2);
        return {
          startTime: range.startTime,
          endTime: range.endTime,
          period: `Tiết ${p1}-${p2}`,
        };
      }
    }
  }

  // Common mistaken hallucinated timings -> correct mapping
  const exactFixes: Record<string, { start: string; end: string; period: string }> = {
    // Tiết 1-1 (07:00 - 07:45)
    "07:00-07:45": { start: "07:00", end: "07:45", period: "Tiết 1-1" },
    "07:00-07:50": { start: "07:00", end: "07:45", period: "Tiết 1-1" },
    // Tiết 1-2 (07:00 - 08:35)
    "07:00-08:30": { start: "07:00", end: "08:35", period: "Tiết 1-2" },
    "07:00-08:35": { start: "07:00", end: "08:35", period: "Tiết 1-2" },
    // Tiết 2-2 (07:50 - 08:35)
    "07:50-08:35": { start: "07:50", end: "08:35", period: "Tiết 2-2" },
    "07:45-08:35": { start: "07:50", end: "08:35", period: "Tiết 2-2" },
    "07:50-08:30": { start: "07:50", end: "08:35", period: "Tiết 2-2" },
    // Tiết 3-3 (08:45 - 09:30) - Fix 08:35-09:20, 08:40-09:25, 08:35-09:30, etc.
    "08:35-09:20": { start: "08:45", end: "09:30", period: "Tiết 3-3" },
    "08:35-09:25": { start: "08:45", end: "09:30", period: "Tiết 3-3" },
    "08:35-09:30": { start: "08:45", end: "09:30", period: "Tiết 3-3" },
    "08:40-09:20": { start: "08:45", end: "09:30", period: "Tiết 3-3" },
    "08:40-09:25": { start: "08:45", end: "09:30", period: "Tiết 3-3" },
    "08:40-09:30": { start: "08:45", end: "09:30", period: "Tiết 3-3" },
    "08:45-09:20": { start: "08:45", end: "09:30", period: "Tiết 3-3" },
    "08:45-09:25": { start: "08:45", end: "09:30", period: "Tiết 3-3" },
    "08:45-09:30": { start: "08:45", end: "09:30", period: "Tiết 3-3" },
    // Tiết 3-4 (08:45 - 10:20)
    "08:35-10:05": { start: "08:45", end: "10:20", period: "Tiết 3-4" },
    "08:45-10:05": { start: "08:45", end: "10:20", period: "Tiết 3-4" },
    "08:45-10:20": { start: "08:45", end: "10:20", period: "Tiết 3-4" },
    // Tiết 4-4 (09:35 - 10:20) - Fix 09:20-10:05, 09:25-10:10, etc.
    "09:20-10:05": { start: "09:35", end: "10:20", period: "Tiết 4-4" },
    "09:25-10:10": { start: "09:35", end: "10:20", period: "Tiết 4-4" },
    "09:30-10:15": { start: "09:35", end: "10:20", period: "Tiết 4-4" },
    "09:30-10:20": { start: "09:35", end: "10:20", period: "Tiết 4-4" },
    "09:20-10:20": { start: "09:35", end: "10:20", period: "Tiết 4-4" },
    "09:35-10:20": { start: "09:35", end: "10:20", period: "Tiết 4-4" },
    // Tiết 5-5 (10:30 - 11:15) - Fix 10:10-10:55, 10:10-11:40, etc.
    "10:10-10:55": { start: "10:30", end: "11:15", period: "Tiết 5-5" },
    "10:15-11:00": { start: "10:30", end: "11:15", period: "Tiết 5-5" },
    "10:20-11:05": { start: "10:30", end: "11:15", period: "Tiết 5-5" },
    "10:10-11:15": { start: "10:30", end: "11:15", period: "Tiết 5-5" },
    "10:10-11:40": { start: "10:30", end: "11:15", period: "Tiết 5-5" },
    "10:30-11:15": { start: "10:30", end: "11:15", period: "Tiết 5-5" },
    // Tiết 6-6 (14:00 - 14:45)
    "14:00-14:45": { start: "14:00", end: "14:45", period: "Tiết 6-6" },
    "12:30-14:00": { start: "14:00", end: "14:45", period: "Tiết 6-6" },
    "13:30-14:15": { start: "14:00", end: "14:45", period: "Tiết 6-6" },
    // Tiết 6-7 (14:00 - 15:35)
    "14:00-15:30": { start: "14:00", end: "15:35", period: "Tiết 6-7" },
    "14:05-15:35": { start: "14:00", end: "15:35", period: "Tiết 6-7" },
    "14:00-15:35": { start: "14:00", end: "15:35", period: "Tiết 6-7" },
    // Tiết 6-8 (14:00 - 16:30)
    "14:00-16:30": { start: "14:00", end: "16:30", period: "Tiết 6-8" },
    // Tiết 7-7 (14:50 - 15:35)
    "14:50-15:35": { start: "14:50", end: "15:35", period: "Tiết 7-7" },
    // Tiết 7-8 (14:50 - 16:30)
    "14:50-16:30": { start: "14:50", end: "16:30", period: "Tiết 7-8" },
    // Tiết 8-8 (15:45 - 16:30)
    "15:35-17:05": { start: "15:45", end: "16:30", period: "Tiết 8-8" },
    "15:40-17:10": { start: "15:45", end: "16:30", period: "Tiết 8-8" },
    "15:45-16:30": { start: "15:45", end: "16:30", period: "Tiết 8-8" },
  };

  const key = `${startTime}-${endTime}`;
  if (exactFixes[key]) {
    const fixed = exactFixes[key];
    return { startTime: fixed.start, endTime: fixed.end, period: fixed.period };
  }

  // Individual start/end point corrections
  if (startTime === "08:35" && (endTime === "09:20" || endTime === "09:30" || endTime === "09:25")) {
    startTime = "08:45";
    endTime = "09:30";
  }
  if (startTime === "09:20") startTime = "09:35";
  if (startTime === "10:10") startTime = "10:30";
  if (startTime === "08:40") startTime = "08:45";
  if (startTime === "14:05") startTime = "14:00";
  if (startTime === "15:40") startTime = "15:45";

  if (endTime === "10:05") endTime = "10:20";
  if (endTime === "10:55") endTime = "11:15";
  if (endTime === "09:20") endTime = "09:30";
  if (endTime === "09:25") endTime = "09:30";
  if (endTime === "08:30") endTime = "08:35";
  if (endTime === "15:30") endTime = "15:35";

  const resolvedLabel = getPeriodLabelFromTime(startTime, endTime) || period || "";
  return {
    startTime: startTime || "07:00",
    endTime: endTime || "07:45",
    period: resolvedLabel,
  };
};

export const getPeriodRangeTime = (startPeriod: number, endPeriod: number) => {
  const start = PERIOD_TIMINGS[startPeriod]?.start || "07:00";
  const end = PERIOD_TIMINGS[endPeriod]?.end || PERIOD_TIMINGS[startPeriod]?.end || "07:45";
  return { startTime: start, endTime: end };
};

export const getPeriodLabelFromTime = (startTime: string, endTime: string): string | null => {
  const match = COMMON_PERIOD_PRESETS.find(p => p.start === startTime && p.end === endTime);
  return match ? match.label : null;
};

export const getDayOfWeekFromDate = (dateStr?: string): string | null => {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      const days = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
      return days[d.getDay()];
    }
  }
  return null;
};

export const isRoomCodeFormat = (str?: string): boolean => {
  if (!str) return false;
  const s = str.trim();
  return /^\d{2,4}\/[A-Z0-9]+$/i.test(s) || /^P\.?\s*\d+/i.test(s);
};

export const propagateClassNamesByLocation = (
  items: ScheduleItem[],
  fallbackExisting: ScheduleItem[] = []
): ScheduleItem[] => {
  const locationMap = new Map<string, string>();

  // Known location defaults
  locationMap.set('210/h10', 'KMP18, KNP27, KPT31');

  const allItems = [...fallbackExisting, ...items];

  // 1st Pass: Discover first valid class name for each location
  for (const item of allItems) {
    let loc = (item.location || '').trim();
    let cls = (item.className || '').trim();

    // If className is mistakenly formatted as a room code
    if (isRoomCodeFormat(cls)) {
      if (!loc || loc === 'Chưa cập nhật') {
        loc = cls;
      }
      cls = '';
    }

    if (loc && loc !== 'Chưa cập nhật') {
      const locKey = loc.toLowerCase();
      // If we don't have a mapped class for this location yet, and this item has a valid class name
      if (!locationMap.has(locKey) && cls && cls !== 'Chưa phân lớp' && !isRoomCodeFormat(cls)) {
        locationMap.set(locKey, cls);
      }
    }
  }

  // 2nd Pass: Assign the unified class name to all items sharing the location
  return items.map(item => {
    let loc = (item.location || '').trim();
    let cls = (item.className || '').trim();

    if (isRoomCodeFormat(cls)) {
      if (!loc || loc === 'Chưa cập nhật') {
        loc = cls;
      }
      cls = '';
    }

    if (loc && loc !== 'Chưa cập nhật') {
      const locKey = loc.toLowerCase();
      const mappedClass = locationMap.get(locKey);
      if (mappedClass) {
        cls = mappedClass;
      } else if (!cls || cls === 'Chưa phân lớp') {
        // If no named class exists in the document, use the room as a consistent group
        cls = `Lớp ${loc}`;
        locationMap.set(locKey, cls);
      }
    }

    return {
      ...item,
      className: cls || 'Chưa phân lớp',
      location: loc || 'Chưa cập nhật',
    };
  });
};

export const deduplicateAndMergeSchedules = (items: ScheduleItem[]): ScheduleItem[] => {
  // First normalize and propagate class names by location
  const unifiedItems = propagateClassNamesByLocation(items);
  const map = new Map<string, ScheduleItem>();

  for (const rawItem of unifiedItems) {
    const norm = normalizePeriodTimings(rawItem.startTime, rawItem.endTime, rawItem.period);
    const calculatedDayOfWeek = rawItem.date ? getDayOfWeekFromDate(rawItem.date) : null;
    const resolvedDayOfWeek = calculatedDayOfWeek || rawItem.dayOfWeek || 'Thứ 2';

    const item: ScheduleItem = {
      ...rawItem,
      className: rawItem.className || 'Chưa phân lớp',
      location: rawItem.location || 'Chưa cập nhật',
      dayOfWeek: resolvedDayOfWeek,
      startTime: norm.startTime,
      endTime: norm.endTime,
      period: norm.period,
    };

    // Primary key for identifying the same teaching slot:
    // Either by explicit date (e.g. 04/08/2026) or dayOfWeek (e.g. Thứ 3)
    const dayKey = (item.date && item.date.trim()) 
      ? item.date.trim() 
      : (item.dayOfWeek || '').trim();
    
    // Time slot key
    const timeKey = item.startTime || norm.period || '07:00';
    
    // Unique key per session
    const key = `${dayKey}___${timeKey}`.toLowerCase();

    if (!map.has(key)) {
      map.set(key, item);
    } else {
      const existing = map.get(key)!;
      // Merge properties, prioritizing richer/more specific info:
      const mergedLessonName = (item.lessonName && item.lessonName.trim()) 
        ? item.lessonName.trim() 
        : (existing.lessonName || '');
      
      const mergedSubject = (!existing.subject || existing.subject === 'Chưa rõ môn')
        ? item.subject
        : (item.subject && item.subject !== 'Chưa rõ môn' && item.subject.length > existing.subject.length ? item.subject : existing.subject);

      const mergedClass = (item.className && item.className.length > (existing.className || '').length)
        ? item.className
        : (existing.className || item.className || '');

      const mergedLocation = (item.location && item.location !== 'Chưa cập nhật')
        ? item.location
        : (existing.location || item.location || 'Chưa cập nhật');

      const mergedDate = item.date || existing.date || '';
      const finalDayOfWeek = (mergedDate ? getDayOfWeekFromDate(mergedDate) : null) || item.dayOfWeek || existing.dayOfWeek || 'Thứ 2';
      const mergedPeriod = item.period || existing.period || norm.period;

      const mergedNotes = [existing.notes, item.notes].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('\n');

      map.set(key, {
        id: existing.id || item.id,
        subject: mergedSubject,
        lessonName: mergedLessonName,
        className: mergedClass,
        location: mergedLocation,
        date: mergedDate,
        dayOfWeek: finalDayOfWeek,
        startTime: norm.startTime,
        endTime: norm.endTime,
        period: mergedPeriod,
        notes: mergedNotes,
      });
    }
  }

  return Array.from(map.values());
};

export interface ClassColorTheme {
  id: string;
  name: string;
  dotColor: string;
  cardBg: string;
  cardBorder: string;
  badgeBg: string;
  badgeText: string;
  tagBg: string;
  tagText: string;
  accentBar: string;
  ring: string;
}

export const CLASS_COLOR_PALETTES: ClassColorTheme[] = [
  {
    id: 'indigo',
    name: 'Xanh chàm',
    dotColor: '#6366f1',
    cardBg: 'bg-indigo-50/50',
    cardBorder: 'border-indigo-200',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-700',
    tagBg: 'bg-indigo-50',
    tagText: 'text-indigo-800',
    accentBar: 'bg-indigo-500',
    ring: 'focus:ring-indigo-300',
  },
  {
    id: 'emerald',
    name: 'Xanh ngọc',
    dotColor: '#10b981',
    cardBg: 'bg-emerald-50/50',
    cardBorder: 'border-emerald-200',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    tagBg: 'bg-emerald-50',
    tagText: 'text-emerald-800',
    accentBar: 'bg-emerald-500',
    ring: 'focus:ring-emerald-300',
  },
  {
    id: 'blue',
    name: 'Xanh biển',
    dotColor: '#3b82f6',
    cardBg: 'bg-blue-50/50',
    cardBorder: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    tagBg: 'bg-blue-50',
    tagText: 'text-blue-800',
    accentBar: 'bg-blue-500',
    ring: 'focus:ring-blue-300',
  },
  {
    id: 'violet',
    name: 'Tím tím',
    dotColor: '#8b5cf6',
    cardBg: 'bg-violet-50/50',
    cardBorder: 'border-violet-200',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    tagBg: 'bg-violet-50',
    tagText: 'text-violet-800',
    accentBar: 'bg-violet-500',
    ring: 'focus:ring-violet-300',
  },
  {
    id: 'amber',
    name: 'Cam vàng',
    dotColor: '#f59e0b',
    cardBg: 'bg-amber-50/50',
    cardBorder: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    tagBg: 'bg-amber-50',
    tagText: 'text-amber-800',
    accentBar: 'bg-amber-500',
    ring: 'focus:ring-amber-300',
  },
  {
    id: 'rose',
    name: 'Hồng san hô',
    dotColor: '#f43f5e',
    cardBg: 'bg-rose-50/50',
    cardBorder: 'border-rose-200',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
    tagBg: 'bg-rose-50',
    tagText: 'text-rose-800',
    accentBar: 'bg-rose-500',
    ring: 'focus:ring-rose-300',
  },
  {
    id: 'teal',
    name: 'Xanh mòng két',
    dotColor: '#14b8a6',
    cardBg: 'bg-teal-50/50',
    cardBorder: 'border-teal-200',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-700',
    tagBg: 'bg-teal-50',
    tagText: 'text-teal-800',
    accentBar: 'bg-teal-500',
    ring: 'focus:ring-teal-300',
  },
  {
    id: 'cyan',
    name: 'Xanh dương lơ',
    dotColor: '#06b6d4',
    cardBg: 'bg-cyan-50/50',
    cardBorder: 'border-cyan-200',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-700',
    tagBg: 'bg-cyan-50',
    tagText: 'text-cyan-800',
    accentBar: 'bg-cyan-500',
    ring: 'focus:ring-cyan-300',
  },
  {
    id: 'orange',
    name: 'Cam cháy',
    dotColor: '#f97316',
    cardBg: 'bg-orange-50/50',
    cardBorder: 'border-orange-200',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
    tagBg: 'bg-orange-50',
    tagText: 'text-orange-800',
    accentBar: 'bg-orange-500',
    ring: 'focus:ring-orange-300',
  },
  {
    id: 'fuchsia',
    name: 'Hồng tím quyến rũ',
    dotColor: '#d946ef',
    cardBg: 'bg-fuchsia-50/50',
    cardBorder: 'border-fuchsia-200',
    badgeBg: 'bg-fuchsia-100',
    badgeText: 'text-fuchsia-700',
    tagBg: 'bg-fuchsia-50',
    tagText: 'text-fuchsia-800',
    accentBar: 'bg-fuchsia-500',
    ring: 'focus:ring-fuchsia-300',
  },
];

export const getClassColorTheme = (
  className?: string,
  customColorMap: Record<string, string> = {}
): ClassColorTheme => {
  const cleanName = (className || 'Chưa phân lớp').trim();

  // If user set custom color
  if (customColorMap[cleanName]) {
    const found = CLASS_COLOR_PALETTES.find(p => p.id === customColorMap[cleanName]);
    if (found) return found;
  }

  // Deterministic hash based on class name
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = (hash << 5) - hash + cleanName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CLASS_COLOR_PALETTES.length;
  return CLASS_COLOR_PALETTES[index];
};

export interface NotificationSettings {
  enabled: boolean;
  notifyMinutesBefore: number[]; // e.g. [5, 10, 15, 30, 45, 60]
  dayBeforeReminder: boolean;
  dayBeforeReminderTime: string; // e.g. "20:00"
  soundEnabled: boolean;
  soundTone: 'gentle' | 'chime' | 'school_bell' | 'marimba';
  vibrationEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  notifyMinutesBefore: [15],
  dayBeforeReminder: true,
  dayBeforeReminderTime: "20:00",
  soundEnabled: true,
  soundTone: 'chime',
  vibrationEnabled: true,
};

export interface ClassSummary {
  className: string;
  totalSessions: number;
  subjects: string[];
  locations: string[];
  nextSession?: ScheduleItem;
  sessions: ScheduleItem[];
  colorTheme?: ClassColorTheme;
}

