import React, { useState, useMemo } from 'react';
import { ScheduleItem, ClassSummary, CLASS_COLOR_PALETTES, ClassColorTheme, getClassColorTheme } from '../types';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  BookOpen, 
  Calendar, 
  Clock, 
  MapPin, 
  Search, 
  ChevronRight, 
  Layers, 
  AlertCircle,
  CalendarDays,
  ArrowUpDown,
  CheckSquare,
  Square,
  X,
  Palette,
  Check
} from 'lucide-react';

interface ClassManagementProps {
  schedules: ScheduleItem[];
  classSummaries: ClassSummary[];
  customColorMap?: Record<string, string>;
  onAddSessionForClass: (className?: string) => void;
  onEditSession: (item: ScheduleItem) => void;
  onDeleteSession: (id: string) => void;
  onDeleteClass: (className: string) => void;
  onRenameClass: (oldName: string, newName: string) => void;
  onDeleteMultipleSessions: (ids: string[]) => void;
  onUpdateClassColor: (className: string, colorId: string) => void;
}

const ClassManagement: React.FC<ClassManagementProps> = ({
  schedules,
  classSummaries,
  customColorMap = {},
  onAddSessionForClass,
  onEditSession,
  onDeleteSession,
  onDeleteClass,
  onRenameClass,
  onDeleteMultipleSessions,
  onUpdateClassColor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassSummary | null>(null);
  const [renamingClass, setRenamingClass] = useState<string | null>(null);
  const [newClassNameInput, setNewClassNameInput] = useState('');
  const [confirmDeleteClass, setConfirmDeleteClass] = useState<ClassSummary | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [confirmDeleteSessions, setConfirmDeleteSessions] = useState<string[] | null>(null);
  const [colorPickerTargetClass, setColorPickerTargetClass] = useState<string | null>(null);

  // Keep selectedClass updated if schedules change
  const currentSelectedSummary = useMemo(() => {
    if (!selectedClass) return null;
    return classSummaries.find(c => c.className === selectedClass.className) || null;
  }, [classSummaries, selectedClass]);

  // Filter classes based on search
  const filteredSummaries = useMemo(() => {
    if (!searchTerm.trim()) return classSummaries;
    const term = searchTerm.toLowerCase();
    return classSummaries.filter(c => 
      c.className.toLowerCase().includes(term) ||
      c.subjects.some(s => s.toLowerCase().includes(term)) ||
      c.locations.some(l => l.toLowerCase().includes(term))
    );
  }, [classSummaries, searchTerm]);

  // Total stats
  const totalClasses = classSummaries.length;
  const totalSessions = schedules.length;

  const handleStartRename = (className: string) => {
    setRenamingClass(className);
    setNewClassNameInput(className);
  };

  const handleConfirmRename = () => {
    if (renamingClass && newClassNameInput.trim() && newClassNameInput.trim() !== renamingClass) {
      onRenameClass(renamingClass, newClassNameInput.trim());
      if (selectedClass?.className === renamingClass) {
        setSelectedClass(prev => prev ? { ...prev, className: newClassNameInput.trim() } : null);
      }
    }
    setRenamingClass(null);
  };

  const toggleSelectSession = (id: string) => {
    setSelectedSessionIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllInClass = (sessions: ScheduleItem[]) => {
    if (selectedSessionIds.length === sessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(sessions.map(s => s.id));
    }
  };

  const handleDeleteSelectedSessions = () => {
    if (selectedSessionIds.length > 0) {
      onDeleteMultipleSessions(selectedSessionIds);
      setSelectedSessionIds([]);
      setConfirmDeleteSessions(null);
    }
  };

  return (
    <div className="pb-28 pt-4 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Users className="mr-2.5 text-indigo-600" size={26} />
            Quản Lý Lớp Dạy
          </h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Quản lý {totalClasses} lớp học • Tổng {totalSessions} buổi dạy
          </p>
        </div>
        <button
          onClick={() => onAddSessionForClass()}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm flex items-center transition-all"
        >
          <Plus size={16} className="mr-1" />
          Thêm lớp/buổi
        </button>
      </div>

      {/* Search and Stats bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm theo tên lớp, môn học, phòng..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 shadow-sm"
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')} 
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Class List */}
      {filteredSummaries.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users size={28} />
          </div>
          <h3 className="font-bold text-gray-800 text-base mb-1">
            {searchTerm ? 'Không tìm thấy lớp phù hợp' : 'Chưa có lớp dạy nào'}
          </h3>
          <p className="text-gray-400 text-xs mb-4">
            {searchTerm ? 'Thử tìm kiếm với từ khóa khác' : 'Bắt đầu bằng cách quét ảnh thời khóa biểu hoặc thêm buổi dạy thủ công.'}
          </p>
          <button
            onClick={() => onAddSessionForClass()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow hover:bg-indigo-700"
          >
            + Thêm buổi dạy mới
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSummaries.map((summary) => {
            const theme = summary.colorTheme || getClassColorTheme(summary.className, customColorMap);

            return (
              <div
                key={summary.className}
                className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs hover:border-gray-300 transition-all relative overflow-hidden"
              >
                {/* Left accent color bar */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: theme.dotColor }}
                />

                <div className="flex items-start justify-between pl-1.5">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      setSelectedClass(summary);
                      setSelectedSessionIds([]);
                    }}
                  >
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: theme.dotColor }} 
                      />
                      <span className="font-bold text-base text-gray-900 hover:text-indigo-600 transition-colors">
                        Lớp: {summary.className}
                      </span>
                      <span 
                        className={`px-2 py-0.5 ${theme.badgeBg} ${theme.badgeText} text-[11px] font-bold rounded-full`}
                      >
                        {summary.totalSessions} buổi
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium ml-1">
                        ({theme.name})
                      </span>
                    </div>

                    {/* Subjects list */}
                    <div className="flex items-center text-xs text-gray-600 font-medium mt-1.5 flex-wrap gap-1">
                      <BookOpen size={14} className="text-indigo-500 shrink-0" />
                      <span>{summary.subjects.join(', ') || 'Chưa rõ môn'}</span>
                    </div>

                    {/* Locations list */}
                    {summary.locations.length > 0 && (
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <MapPin size={14} className="text-gray-400 mr-1 shrink-0" />
                        <span>{summary.locations.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick actions for class */}
                  <div className="flex items-center space-x-1 ml-2 shrink-0">
                    <button
                      onClick={() => setColorPickerTargetClass(summary.className)}
                      title="Đổi màu lớp này"
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      style={{ color: theme.dotColor }}
                    >
                      <Palette size={17} />
                    </button>
                    <button
                      onClick={() => onAddSessionForClass(summary.className)}
                      title="Thêm buổi dạy cho lớp này"
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                    <button
                      onClick={() => handleStartRename(summary.className)}
                      title="Đổi tên lớp"
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteClass(summary)}
                      title="Xóa toàn bộ lớp này"
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* View sessions button */}
                <div 
                  onClick={() => {
                    setSelectedClass(summary);
                    setSelectedSessionIds([]);
                  }}
                  className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-indigo-600 font-semibold cursor-pointer hover:text-indigo-800 pl-1.5"
                >
                  <span>Xem và quản lý {summary.totalSessions} buổi dạy</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL FOR A SINGLE CLASS (VIEW/DELETE/EDIT SESSIONS) */}
      {currentSelectedSummary && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            {(() => {
              const currentTheme = currentSelectedSummary.colorTheme || getClassColorTheme(currentSelectedSummary.className, customColorMap);
              return (
                <div 
                  className="p-4 text-white flex items-center justify-between shadow-xs transition-colors"
                  style={{ backgroundColor: currentTheme.dotColor }}
                >
                  <div className="flex-1 pr-2">
                    <div className="flex items-center space-x-2">
                      <Users size={20} />
                      <h2 className="font-bold text-lg truncate">Lớp: {currentSelectedSummary.className}</h2>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-white/90 mt-0.5">
                      <span>Tổng cộng {currentSelectedSummary.totalSessions} buổi dạy</span>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setColorPickerTargetClass(currentSelectedSummary.className)}
                        className="underline hover:text-white flex items-center space-x-1"
                      >
                        <Palette size={12} />
                        <span>Đổi màu ({currentTheme.name})</span>
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedClass(null)}
                    className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
                  >
                    <X size={20} />
                  </button>
                </div>
              );
            })()}

            {/* Sub-toolbar */}
            <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => toggleSelectAllInClass(currentSelectedSummary.sessions)}
                  className="flex items-center font-medium text-gray-700 hover:text-indigo-600"
                >
                  {selectedSessionIds.length === currentSelectedSummary.sessions.length ? (
                    <CheckSquare size={16} className="mr-1 text-indigo-600" />
                  ) : (
                    <Square size={16} className="mr-1 text-gray-400" />
                  )}
                  <span>Chọn tất cả</span>
                </button>
                {selectedSessionIds.length > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                    Đã chọn {selectedSessionIds.length}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {selectedSessionIds.length > 0 && (
                  <button
                    onClick={() => setConfirmDeleteSessions(selectedSessionIds)}
                    className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold flex items-center"
                  >
                    <Trash2 size={13} className="mr-1" />
                    Xóa ({selectedSessionIds.length})
                  </button>
                )}
                <button
                  onClick={() => onAddSessionForClass(currentSelectedSummary.className)}
                  className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold flex items-center hover:bg-indigo-700"
                >
                  <Plus size={13} className="mr-1" />
                  Thêm buổi
                </button>
              </div>
            </div>

            {/* Sessions list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {currentSelectedSummary.sessions.map((item, idx) => {
                const isSelected = selectedSessionIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-300 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleSelectSession(item.id)}
                          className="mt-0.5 text-gray-400 hover:text-indigo-600 shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-indigo-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                        <div className="flex-1 pr-2">
                          <span className="font-bold text-sm text-gray-900 block">
                            {item.subject}
                          </span>

                          {/* Lesson Name */}
                          {item.lessonName && (
                            <div className="text-xs font-semibold text-indigo-900 bg-indigo-50/90 px-2 py-1 rounded-md mt-1 border border-indigo-100">
                              {item.lessonName}
                            </div>
                          )}

                          {/* Date and Day */}
                          <div className="flex items-center text-xs text-gray-600 mt-1.5">
                            <CalendarDays size={13} className="mr-1 text-indigo-500" />
                            <span className="font-medium">
                              {item.dayOfWeek} {item.date ? `• ${item.date}` : '(Hàng tuần)'}
                            </span>
                          </div>

                          {/* Time & Period */}
                          <div className="flex items-center text-xs text-gray-500 mt-1 flex-wrap gap-1">
                            <Clock size={13} className="mr-1 text-gray-400" />
                            <span>{item.startTime} - {item.endTime}</span>
                            {item.period && (
                              <span className="px-1.5 py-0.2 bg-gray-100 text-gray-700 font-semibold rounded text-[10px]">
                                {item.period}
                              </span>
                            )}
                          </div>

                          {/* Location */}
                          {item.location && (
                            <div className="flex items-center text-xs text-gray-500 mt-1">
                              <MapPin size={13} className="mr-1 text-gray-400" />
                              <span>{item.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => onEditSession(item)}
                          title="Sửa buổi học"
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => onDeleteSession(item.id)}
                          title="Xóa buổi học này"
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => setConfirmDeleteClass(currentSelectedSummary)}
                className="px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors flex items-center"
              >
                <Trash2 size={14} className="mr-1" />
                Xóa cả lớp ({currentSelectedSummary.totalSessions} buổi)
              </button>

              <button
                onClick={() => onAddSessionForClass(currentSelectedSummary.className)}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl shadow hover:bg-indigo-700 transition-colors flex items-center"
              >
                <Plus size={14} className="mr-1" />
                Thêm buổi mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME CLASS MODAL */}
      {renamingClass && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl border border-gray-100">
            <h3 className="font-bold text-base text-gray-900 mb-2 flex items-center">
              <Edit3 size={18} className="mr-2 text-indigo-600" />
              Đổi Tên Lớp Dạy
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Tên mới sẽ tự động được cập nhật cho tất cả các buổi dạy thuộc lớp này.
            </p>
            <input
              type="text"
              value={newClassNameInput}
              onChange={(e) => setNewClassNameInput(e.target.value)}
              placeholder="Nhập tên lớp mới..."
              className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-semibold text-gray-900 outline-none mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setRenamingClass(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmRename}
                disabled={!newClassNameInput.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Lưu Tên Mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CLASS MODAL */}
      {confirmDeleteClass && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <AlertCircle size={24} />
            </div>
            <h3 className="font-bold text-base text-gray-900 mb-1">
              Xác nhận xóa lớp: {confirmDeleteClass.className}?
            </h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Hành động này sẽ xóa vĩnh viễn <span className="font-bold text-red-600">{confirmDeleteClass.totalSessions} buổi dạy</span> thuộc lớp này khỏi thời khóa biểu.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setConfirmDeleteClass(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  onDeleteClass(confirmDeleteClass.className);
                  setConfirmDeleteClass(null);
                  if (selectedClass?.className === confirmDeleteClass.className) {
                    setSelectedClass(null);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 shadow-sm"
              >
                Xác nhận Xóa Lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MULTIPLE SESSIONS */}
      {confirmDeleteSessions && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="font-bold text-base text-gray-900 mb-1">
              Xóa {confirmDeleteSessions.length} buổi dạy đã chọn?
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Các buổi dạy đã chọn sẽ bị xóa vĩnh viễn.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setConfirmDeleteSessions(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteSelectedSessions}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 shadow-sm"
              >
                Xác nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COLOR PICKER MODAL */}
      {colorPickerTargetClass && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Palette size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Chọn màu cho lớp</h3>
                  <p className="text-xs text-gray-500 font-semibold truncate max-w-[180px]">
                    Lớp: {colorPickerTargetClass}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setColorPickerTargetClass(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Màu sắc giúp bạn dễ dàng phân biệt các lớp dạy trên giao diện lịch:
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1">
              {CLASS_COLOR_PALETTES.map((palette) => {
                const currentTheme = getClassColorTheme(colorPickerTargetClass, customColorMap);
                const isSelected = currentTheme.id === palette.id;

                return (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() => {
                      onUpdateClassColor(colorPickerTargetClass, palette.id);
                      setColorPickerTargetClass(null);
                    }}
                    className={`p-2.5 rounded-xl border flex items-center space-x-2 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-200 bg-indigo-50/40'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <span 
                      className="w-4 h-4 rounded-full shrink-0 shadow-2xs" 
                      style={{ backgroundColor: palette.dotColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-gray-800 block truncate">
                        {palette.name}
                      </span>
                    </div>
                    {isSelected && <Check size={14} className="text-indigo-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setColorPickerTargetClass(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassManagement;
