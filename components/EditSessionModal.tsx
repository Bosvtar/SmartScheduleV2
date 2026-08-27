import React, { useState, useEffect } from 'react';
import { ScheduleItem, DAYS_ORDER, COMMON_PERIOD_PRESETS, getPeriodLabelFromTime, getDayOfWeekFromDate } from '../types';
import { X, Save, Trash2, Clock, Calendar, BookOpen, Users, MapPin, Plus, Sparkles } from 'lucide-react';

interface EditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: ScheduleItem, repeatWeeks?: number) => void;
  onDelete?: (id: string) => void;
  initialItem?: Partial<ScheduleItem> | null;
  existingClasses?: string[];
  existingSubjects?: string[];
  existingLocations?: string[];
  mode?: 'add' | 'edit';
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const EditSessionModal: React.FC<EditSessionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialItem,
  existingClasses = [],
  existingSubjects = [],
  existingLocations = [],
  mode = 'add',
}) => {
  const [subject, setSubject] = useState('');
  const [lessonName, setLessonName] = useState('');
  const [className, setClassName] = useState('');
  const [date, setDate] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Thứ 2');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('08:35');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('Tiết 1-2');
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialItem) {
        setSubject(initialItem.subject || '');
        setLessonName(initialItem.lessonName || '');
        setClassName(initialItem.className || '');
        setDate(initialItem.date || '');
        setDayOfWeek(initialItem.dayOfWeek || 'Thứ 2');
        setStartTime(initialItem.startTime || '07:00');
        setEndTime(initialItem.endTime || '08:35');
        setLocation(initialItem.location || '');
        setNotes(initialItem.notes || '');

        const preset = getPeriodLabelFromTime(initialItem.startTime || '07:00', initialItem.endTime || '08:35');
        setSelectedPreset(preset || 'custom');
      } else {
        // Reset defaults
        setSubject('');
        setLessonName('');
        setClassName('');
        setDate('');
        setDayOfWeek('Thứ 2');
        setStartTime('07:00');
        setEndTime('08:35');
        setLocation('');
        setNotes('');
        setSelectedPreset('Tiết 1-2');
        setRepeatWeeks(1);
      }
      setError(null);
    }
  }, [isOpen, initialItem]);

  if (!isOpen) return null;

  const handleDateChange = (val: string) => {
    setDate(val);
    const calculatedDay = getDayOfWeekFromDate(val);
    if (calculatedDay) {
      setDayOfWeek(calculatedDay);
    }
  };

  const handlePresetChange = (presetLabel: string) => {
    setSelectedPreset(presetLabel);
    if (presetLabel !== 'custom') {
      const found = COMMON_PERIOD_PRESETS.find(p => p.label === presetLabel);
      if (found) {
        setStartTime(found.start);
        setEndTime(found.end);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError('Vui lòng nhập tên môn học');
      return;
    }

    const calculatedDay = date ? (getDayOfWeekFromDate(date) || dayOfWeek) : dayOfWeek;
    const periodLabel = getPeriodLabelFromTime(startTime, endTime) || '';

    const sessionItem: ScheduleItem = {
      id: initialItem?.id || generateId(),
      subject: subject.trim(),
      lessonName: lessonName.trim() || undefined,
      className: className.trim() || 'Chưa phân lớp',
      date: date.trim() || undefined,
      dayOfWeek: calculatedDay,
      startTime,
      endTime,
      period: periodLabel,
      location: location.trim() || 'Chưa cập nhật',
      notes: notes.trim() || undefined,
    };

    onSave(sessionItem, mode === 'add' ? repeatWeeks : 1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden my-6 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen size={20} />
            <h2 className="font-bold text-lg">
              {mode === 'edit' ? 'Chỉnh Sửa Buổi Dạy' : 'Thêm Buổi Dạy Mới'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
              {error}
            </div>
          )}

          {/* Môn học */}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
              Tên Môn Học <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="VD: Lý thuyết điều khiển tự động, Toán cao cấp..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-semibold text-gray-900 transition-all"
            />
            {existingSubjects.length > 0 && !subject && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[11px] text-gray-400 self-center">Gợi ý:</span>
                {existingSubjects.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubject(s)}
                    className="text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 px-2 py-0.5 rounded-md text-gray-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tên bài học / Nội dung */}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
              Tên Bài Học / Nội Dung (Tùy chọn)
            </label>
            <input
              type="text"
              value={lessonName}
              onChange={(e) => setLessonName(e.target.value)}
              placeholder="VD: Bài 1: Đặc tính hệ thống điều khiển..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium text-indigo-950 bg-indigo-50/40"
            />
          </div>

          {/* Lớp học */}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
              Lớp Dạy
            </label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="VD: KMP18, KNP27, KPT31 hoặc 12A1..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-semibold text-gray-800"
            />
            {existingClasses.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[11px] text-gray-400 self-center">Lớp có sẵn:</span>
                {existingClasses.slice(0, 5).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setClassName(c)}
                    className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-0.5 rounded-md font-medium transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ngày & Thứ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Ngày Cụ Thể (DD/MM/YYYY)
              </label>
              <input
                type="text"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                placeholder="VD: 11/08/2026"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 bg-white text-sm font-medium"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Để trống nếu là lịch cố định hàng tuần
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Thứ Trong Tuần
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 bg-white text-sm font-semibold text-gray-800"
              >
                {DAYS_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-gray-400 mt-1 block">
                {date ? '(Tự động tính từ ngày)' : 'Thứ dạy hàng tuần'}
              </span>
            </div>
          </div>

          {/* Tiết học & Thời gian */}
          <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Chọn Nhanh Tiết Học Chuẩn
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-900 font-bold text-sm"
              >
                <option value="custom">-- Tự chỉnh giờ bắt đầu & kết thúc --</option>
                {COMMON_PERIOD_PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label} ({p.start} - {p.end})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Giờ bắt đầu</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setSelectedPreset('custom');
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Giờ kết thúc</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setSelectedPreset('custom');
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {/* Phòng học */}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
              Phòng Học / Địa Điểm
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="VD: 210/H10, Phòng Lab 3, Hội trường B..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-gray-800"
            />
            {existingLocations.length > 0 && !location && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[11px] text-gray-400 self-center">Phòng có sẵn:</span>
                {existingLocations.slice(0, 4).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className="text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 px-2 py-0.5 rounded-md text-gray-600 transition-colors"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lặp lại nhiều tuần nếu thêm mới */}
          {mode === 'add' && date && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <label className="text-xs font-bold text-amber-900 block mb-1">
                Tạo chuỗi lặp lại theo tuần
              </label>
              <div className="flex items-center space-x-2">
                <select
                  value={repeatWeeks}
                  onChange={(e) => setRepeatWeeks(Number(e.target.value))}
                  className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-semibold text-amber-900"
                >
                  <option value={1}>Chỉ 1 buổi ngày này</option>
                  <option value={2}>Lặp lại 2 tuần liên tiếp</option>
                  <option value={4}>Lặp lại 4 tuần liên tiếp</option>
                  <option value={8}>Lặp lại 8 tuần liên tiếp</option>
                  <option value={15}>Lặp lại 15 tuần (cả học kỳ)</option>
                </select>
                <span className="text-xs text-amber-700 font-medium">
                  {repeatWeeks > 1 && `(+${repeatWeeks - 1} buổi tuần sau)`}
                </span>
              </div>
            </div>
          )}

          {/* Ghi chú */}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
              Ghi Chú (Tùy chọn)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm về kiểm tra, bài tập, chuẩn bị thiết bị..."
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-gray-800 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
            {mode === 'edit' && onDelete && initialItem?.id && (
              <button
                type="button"
                onClick={() => onDelete(initialItem.id!)}
                className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-bold flex items-center transition-colors"
              >
                <Trash2 size={16} className="mr-1.5" />
                Xóa buổi này
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-200 flex items-center transition-all"
              >
                <Save size={16} className="mr-1.5" />
                {mode === 'edit' ? 'Lưu Thay Đổi' : 'Thêm Buổi Dạy'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSessionModal;
