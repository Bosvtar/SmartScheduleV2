import { 
  ScheduleItem, 
  normalizePeriodTimings, 
  deduplicateAndMergeSchedules, 
  propagateClassNamesByLocation,
  ClassSummary 
} from '../types';

const STORAGE_KEY = 'smart_schedule_data';

export const getSchedules = (): ScheduleItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const schedules: ScheduleItem[] = JSON.parse(data);
    let hasUpdates = false;

    const migrated = schedules.map(item => {
      let updatedItem = { ...item };

      // Year normalization
      if (updatedItem.date && (updatedItem.date.endsWith('/2024') || updatedItem.date.endsWith('/2025'))) {
        hasUpdates = true;
        updatedItem.date = updatedItem.date.replace(/\/(2024|2025)$/, '/2026');
      }

      // Timing normalization (fix 09:20-10:05 -> 09:35-10:20, 10:10-10:55 -> 10:30-11:15, 08:35-09:20 -> 08:45-09:30, etc.)
      const normalized = normalizePeriodTimings(updatedItem.startTime, updatedItem.endTime, updatedItem.period);
      if (normalized.startTime !== updatedItem.startTime || normalized.endTime !== updatedItem.endTime) {
        hasUpdates = true;
        updatedItem.startTime = normalized.startTime;
        updatedItem.endTime = normalized.endTime;
        updatedItem.period = normalized.period;
      }

      return updatedItem;
    });

    // Propagate class names by location & deduplicate
    const propagated = propagateClassNamesByLocation(migrated);
    const deduplicated = deduplicateAndMergeSchedules(propagated);

    if (JSON.stringify(deduplicated) !== JSON.stringify(schedules)) {
      hasUpdates = true;
    }

    if (hasUpdates) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deduplicated));
    }
    return deduplicated;
  } catch (error) {
    console.error("Error reading schedules", error);
    return [];
  }
};

export const saveSchedule = (item: ScheduleItem): void => {
  const schedules = getSchedules();
  // Update if exists, else add
  const index = schedules.findIndex(s => s.id === item.id);
  if (index >= 0) {
    schedules[index] = item;
  } else {
    schedules.push(item);
  }
  const deduplicated = deduplicateAndMergeSchedules(schedules);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deduplicated));
};

export const deleteSchedule = (id: string): void => {
  const schedules = getSchedules();
  const newSchedules = schedules.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newSchedules));
};

export const deleteMultipleSchedules = (ids: string[]): void => {
  const idSet = new Set(ids);
  const schedules = getSchedules();
  const newSchedules = schedules.filter(s => !idSet.has(s.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newSchedules));
};

export const deleteSchedulesByClass = (className: string): void => {
  const schedules = getSchedules();
  const targetClass = className.trim().toLowerCase();
  const newSchedules = schedules.filter(s => (s.className || 'Chưa phân lớp').trim().toLowerCase() !== targetClass);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newSchedules));
};

export const updateClassName = (oldClassName: string, newClassName: string): void => {
  const schedules = getSchedules();
  const targetClass = oldClassName.trim().toLowerCase();
  const trimmedNewName = newClassName.trim();
  const updated = schedules.map(s => {
    const currentClass = (s.className || 'Chưa phân lớp').trim().toLowerCase();
    if (currentClass === targetClass) {
      return { ...s, className: trimmedNewName };
    }
    return s;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const saveAllSchedules = (items: ScheduleItem[]): void => {
  const current = getSchedules();
  const propagated = propagateClassNamesByLocation(items, current);
  const merged = deduplicateAndMergeSchedules([...current, ...propagated]);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
};

export const deleteAllSchedules = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

// --- CLASS COLORS STORAGE ---
const CLASS_COLORS_KEY = 'smart_schedule_class_colors';

export const getClassColors = (): Record<string, string> => {
  try {
    const data = localStorage.getItem(CLASS_COLORS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('Failed to parse class colors', e);
    return {};
  }
};

export const saveClassColor = (className: string, colorId: string): void => {
  try {
    const current = getClassColors();
    current[className.trim()] = colorId;
    localStorage.setItem(CLASS_COLORS_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Failed to save class color', e);
  }
};

// --- NOTIFICATION SETTINGS STORAGE ---
const NOTIFICATION_SETTINGS_KEY = 'smart_schedule_notification_settings';

import { NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS, getClassColorTheme } from '../types';

export const getNotificationSettings = (): NotificationSettings => {
  try {
    const data = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!data) return DEFAULT_NOTIFICATION_SETTINGS;
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...JSON.parse(data),
    };
  } catch (e) {
    console.error('Failed to parse notification settings', e);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

export const saveNotificationSettings = (settings: NotificationSettings): void => {
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save notification settings', e);
  }
};

export const getClassSummaries = (schedules: ScheduleItem[]): ClassSummary[] => {
  const map: Record<string, ScheduleItem[]> = {};
  const classColors = getClassColors();

  schedules.forEach(item => {
    const key = (item.className && item.className.trim()) || 'Chưa phân lớp';
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(item);
  });

  return Object.keys(map).map(className => {
    const sessions = map[className].sort((a, b) => {
      // Sort by date or day
      const dateA = a.date ? a.date.split('/').reverse().join('') : '';
      const dateB = b.date ? b.date.split('/').reverse().join('') : '';
      if (dateA && dateB) return dateA.localeCompare(dateB);
      if (dateA) return -1;
      if (dateB) return 1;
      return a.startTime.localeCompare(b.startTime);
    });

    const subjects = Array.from(new Set(sessions.map(s => s.subject).filter(Boolean)));
    const locations = Array.from(new Set(sessions.map(s => s.location).filter(Boolean)));

    return {
      className,
      totalSessions: sessions.length,
      subjects,
      locations,
      sessions,
      nextSession: sessions[0],
      colorTheme: getClassColorTheme(className, classColors),
    };
  }).sort((a, b) => {
    if (a.className === 'Chưa phân lớp') return 1;
    if (b.className === 'Chưa phân lớp') return -1;
    return a.className.localeCompare(b.className);
  });
};

