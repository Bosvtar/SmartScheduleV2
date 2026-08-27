import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Clock, 
  Volume2, 
  Smartphone, 
  Calendar, 
  Check, 
  X, 
  Play, 
  AlertCircle,
  Vibrate,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { NotificationSettings } from '../types';
import { 
  playNotificationSound, 
  triggerVibration, 
  requestNotificationPermission, 
  dispatchNotification 
} from '../services/notificationService';
import { getPushStatus, subscribeToPush, syncPushState, sendServerPushTest } from '../services/pushService';
import { getSchedules } from '../services/storageService';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onSave: (newSettings: NotificationSettings) => void;
}

const MINUTE_OPTIONS = [
  { value: 5, label: '5 phút' },
  { value: 10, label: '10 phút' },
  { value: 15, label: '15 phút' },
  { value: 30, label: '30 phút' },
  { value: 45, label: '45 phút' },
  { value: 60, label: '60 phút (1 tiếng)' },
];

const SOUND_TONES: { id: NotificationSettings['soundTone']; label: string; desc: string }[] = [
  { id: 'chime', label: 'Chuông pha lê (Chime)', desc: 'Âm thanh trong trẻo, rõ ràng' },
  { id: 'gentle', label: 'Nhẹ nhàng (Gentle)', desc: 'Âm điệu êm dịu, không giật mình' },
  { id: 'school_bell', label: 'Chuông trường học', desc: 'Tiếng chuông ngân vang báo giờ' },
  { id: 'marimba', label: 'Đàn gõ Marimba', desc: 'Âm sắc ấm áp vui tươi' },
];

const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<NotificationSettings>(settings);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [testSent, setTestSent] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [pushSubscribed, setPushSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
    setFormData(settings);
    if (isOpen) getPushStatus().then(s => setPushSubscribed(s.subscribed)).catch(() => {});
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const status = await requestNotificationPermission();
    setPermissionStatus(status);
    if (status === 'granted') {
      setFormData(prev => ({ ...prev, enabled: true }));
    }
  };

  const toggleMinuteOption = (min: number) => {
    setFormData(prev => {
      const current = prev.notifyMinutesBefore || [];
      if (current.includes(min)) {
        // Keep at least one option if enabled
        if (current.length === 1) return prev;
        return { ...prev, notifyMinutesBefore: current.filter(m => m !== min) };
      } else {
        return { ...prev, notifyMinutesBefore: [...current, min].sort((a, b) => a - b) };
      }
    });
  };

  const handlePlayTone = (tone: NotificationSettings['soundTone']) => {
    playNotificationSound(tone);
  };

  const handleTestVibrate = () => {
    const ok = triggerVibration();
    if (!ok) {
      alert('Thiết bị hoặc trình duyệt hiện tại không hỗ trợ rung phần cứng.');
    }
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushMessage('');
    try {
      await subscribeToPush();
      const next = { ...formData, enabled: true };
      setFormData(next);
      await syncPushState(getSchedules(), next);
      setPushSubscribed(true);
      setPermissionStatus('granted');
      setPushMessage('✓ Đã đăng ký Web Push và đồng bộ lịch với máy chủ.');
    } catch (error: any) {
      setPushMessage(`✕ ${error?.message || 'Không thể bật Web Push'}`);
    } finally { setPushBusy(false); }
  };

  const handleSendTestNotification = async () => {
    setPushBusy(true);
    setPushMessage('');
    try {
      if (!pushSubscribed) await handleEnablePush();
      await syncPushState(getSchedules(), { ...formData, enabled: true });
      await sendServerPushTest();
      setTestSent(true);
      setPushMessage('✓ Máy chủ đã gửi thông báo thử. Hãy kiểm tra thanh thông báo.');
      setTimeout(() => setTestSent(false), 3000);
    } catch (error: any) {
      // fallback local notification vẫn hữu ích khi đang mở app
      dispatchNotification('🔔 SmartSchedule - Thông báo thử', 'Thông báo cục bộ đang hoạt động, nhưng Web Push server chưa gửi được.', { ...formData, enabled: true });
      setPushMessage(`✕ ${error?.message || 'Web Push chưa hoạt động. Đã thử thông báo cục bộ.'}`);
    } finally { setPushBusy(false); }
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-md">
              <Bell size={22} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Cài Đặt Thông Báo</h2>
              <p className="text-xs text-indigo-100">Tùy chỉnh thời gian, chuông và rung</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-gray-800">
          
          {/* Permission Status Banner */}
          {permissionStatus !== 'granted' && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-3">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-amber-900 mb-1">Chưa bật quyền thông báo hệ thống</p>
                <p className="text-amber-700 leading-relaxed mb-2">
                  Để nhận được thông báo đẩy khi đóng tab hoặc làm việc khác, vui lòng cho phép quyền thông báo.
                </p>
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center space-x-1 shadow-xs"
                >
                  <ShieldCheck size={14} />
                  <span>Cho phép thông báo</span>
                </button>
              </div>
            </div>
          )}

          {/* Master Enable/Disable Switch */}
          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-xl ${formData.enabled ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-400'}`}>
                <Bell size={20} />
              </div>
              <div>
                <span className="font-bold text-sm text-gray-900 block">Bật thông báo lịch dạy</span>
                <span className="text-xs text-gray-500">Tự động nhắc nhở các buổi lên lớp</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Section: Minutes Before Class */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center">
              <Clock size={14} className="mr-1.5 text-indigo-600" />
              Thông báo trước giờ vào lớp
            </label>
            <p className="text-xs text-gray-500">
              Chọn một hoặc nhiều mốc thời gian bạn muốn nhận thông báo:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {MINUTE_OPTIONS.map(opt => {
                const isSelected = formData.notifyMinutesBefore.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!formData.enabled}
                    onClick={() => toggleMinuteOption(opt.value)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-2xs'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    } ${!formData.enabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={15} className="text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Day-Before Reminder */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Calendar size={18} className="text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold text-xs text-gray-900 block">Nhắc lịch dạy ngày hôm trước</span>
                  <span className="text-[11px] text-gray-500">Tóm tắt các lớp sẽ dạy vào ngày mai</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!formData.enabled}
                  checked={formData.dayBeforeReminder}
                  onChange={(e) => setFormData(prev => ({ ...prev, dayBeforeReminder: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-40"></div>
              </label>
            </div>

            {formData.dayBeforeReminder && (
              <div className="pt-2 border-t border-gray-200/70 flex items-center justify-between">
                <span className="text-xs text-gray-600 font-medium">Giờ nhắc nhở buổi tối:</span>
                <input
                  type="time"
                  disabled={!formData.enabled}
                  value={formData.dayBeforeReminderTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, dayBeforeReminderTime: e.target.value }))}
                  className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            )}
          </div>

          {/* Section: Sound & Chime Tone */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Volume2 size={18} className="text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold text-xs text-gray-900 block">Chuông âm thanh thông báo</span>
                  <span className="text-[11px] text-gray-500">Phát âm thanh nhẹ nhàng khi báo giờ</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!formData.enabled}
                  checked={formData.soundEnabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, soundEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-40"></div>
              </label>
            </div>

            {formData.soundEnabled && (
              <div className="pt-2 border-t border-gray-200/70 space-y-2">
                <span className="text-xs text-gray-600 font-semibold block mb-1.5">Chọn kiểu chuông:</span>
                <div className="space-y-1.5">
                  {SOUND_TONES.map(tone => {
                    const isSelected = formData.soundTone === tone.id;
                    return (
                      <div
                        key={tone.id}
                        onClick={() => setFormData(prev => ({ ...prev, soundTone: tone.id }))}
                        className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs">
                          <span className="block font-bold">{tone.label}</span>
                          <span className="text-[10px] text-gray-500 font-normal">{tone.desc}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayTone(tone.id);
                          }}
                          className="px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-bold rounded-lg flex items-center space-x-1 transition-colors"
                        >
                          <Play size={12} fill="currentColor" />
                          <span>Nghe</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section: Vibration */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Smartphone size={18} className="text-indigo-600 shrink-0" />
              <div>
                <span className="font-bold text-xs text-gray-900 block">Rung thiết bị (Điện thoại)</span>
                <span className="text-[11px] text-gray-500">Rung báo hiệu khi đến giờ</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTestVibrate}
                className="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-[11px] font-bold rounded-lg flex items-center space-x-1"
              >
                <Vibrate size={12} />
                <span>Thử rung</span>
              </button>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!formData.enabled}
                  checked={formData.vibrationEnabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, vibrationEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-40"></div>
              </label>
            </div>
          </div>

          {/* Web Push Server */}
          <div className="p-3.5 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-xs text-indigo-950 block">Thông báo nền Web Push</span>
                <span className="text-[11px] text-indigo-700">Đồng bộ lịch lên máy chủ để nhận nhắc khi đóng PWA.</span>
              </div>
              <button type="button" onClick={handleEnablePush} disabled={pushBusy} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-bold disabled:opacity-50">
                {pushBusy ? 'Đang xử lý...' : pushSubscribed ? 'Đã kết nối ✓' : 'Bật Web Push'}
              </button>
            </div>
            {pushMessage && <div className="text-[11px] font-medium text-indigo-800 break-words">{pushMessage}</div>}
          </div>

          {/* Test Notification Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSendTestNotification}
              disabled={pushBusy}
              className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-2xs"
            >
              <Sparkles size={15} />
              <span>{testSent ? '✓ Đã phát thông báo thử nghiệm!' : 'Gửi thử thông báo mẫu ngay'}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end space-x-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all"
          >
            Lưu Cài Đặt
          </button>
        </div>

      </div>
    </div>
  );
};

export default NotificationSettingsModal;
