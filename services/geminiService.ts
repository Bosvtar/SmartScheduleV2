
import { 
  ScheduleItem, 
  normalizePeriodTimings, 
  deduplicateAndMergeSchedules, 
  propagateClassNamesByLocation,
  isRoomCodeFormat 
} from '../types';
import { getSchedules } from './storageService';

const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper to convert file to base64 string
export const fileToBase64 = async (file: File): Promise<string> => {
  // Vercel Functions have a request-body limit. Resize/compress camera photos
  // in the browser before sending base64 JSON to /api/extract-schedule.
  if (!file.type.startsWith('image/')) {
    throw new Error('Tệp tải lên không phải là hình ảnh.');
  }

  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Không thể xử lý hình ảnh trên trình duyệt.');
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('Không thể nén hình ảnh.'));
    }, 'image/jpeg', 0.78);
  });

  // Keep the JSON payload comfortably below typical Vercel request limits.
  if (blob.size > 2_800_000) {
    const smaller = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error('Không thể nén hình ảnh.'));
      }, 'image/jpeg', 0.58);
    });
    return await blobToBase64(smaller);
  }

  return await blobToBase64(blob);
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1] || dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export const extractScheduleFromImage = async (file: File): Promise<ScheduleItem[]> => {
  try {
    const imageBase64 = await fileToBase64(file);
    const mimeType = 'image/jpeg';

    const response = await fetch('/api/extract-schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Lỗi máy chủ (${response.status})`);
    }

    const result = await response.json();
    const rawData = result.data || [];

    // Map to our internal type and add IDs
    const mapped: ScheduleItem[] = rawData.map((item: any) => {
      let rawDate = (item.date || '').trim();
      // If date is in DD/MM format, append /2026
      if (rawDate && /^\d{1,2}\/\d{1,2}$/.test(rawDate)) {
        rawDate = `${rawDate}/2026`;
      } else if (rawDate && (rawDate.endsWith('/2024') || rawDate.endsWith('/2025'))) {
        // Fix any hallucinated legacy year 2024/2025 to 2026
        rawDate = rawDate.replace(/\/(2024|2025)$/, '/2026');
      }

      // Normalize timings and period
      const normalizedTiming = normalizePeriodTimings(item.startTime, item.endTime, item.period);

      let parsedClassName = (item.className || '').trim();
      let parsedLocation = (item.location || '').trim();

      // Check if className is mistakenly set to a room code like 210/H10
      if (isRoomCodeFormat(parsedClassName)) {
        if (!parsedLocation || parsedLocation === 'Chưa cập nhật') {
          parsedLocation = parsedClassName;
        }
        parsedClassName = '';
      }

      return {
        id: generateId(),
        subject: item.subject || 'Chưa rõ môn',
        lessonName: item.lessonName || '',
        period: normalizedTiming.period,
        className: parsedClassName,
        dayOfWeek: item.dayOfWeek || 'Thứ 2',
        date: rawDate,
        startTime: normalizedTiming.startTime,
        endTime: normalizedTiming.endTime,
        location: parsedLocation || 'Chưa cập nhật',
        notes: '',
      };
    });

    // Propagate class names by shared location using both the new extracted items and existing stored items
    const existing = getSchedules();
    const unifiedByLocation = propagateClassNamesByLocation(mapped, existing);

    return deduplicateAndMergeSchedules(unifiedByLocation);
  } catch (error: any) {
    console.error('Gemini Extraction Error:', error);
    throw new Error(error.message || 'Không thể trích xuất lịch từ ảnh. Vui lòng thử lại với ảnh rõ nét hơn.');
  }
};

