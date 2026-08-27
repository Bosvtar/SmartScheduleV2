import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  SwitchCamera, 
  X, 
  Check, 
  RotateCcw, 
  AlertCircle, 
  Sparkles,
  Maximize2
} from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);

  // Stop current active stream
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start camera with requested facingMode
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    stopStream();
    setIsStartingCamera(true);
    setErrorMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Trình duyệt hoặc môi trường hiện tại không hỗ trợ truy cập trực tiếp Camera API. Bạn có thể sử dụng nút "Mở máy ảnh thiết bị" bên dưới.');
      setIsStartingCamera(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Quyền truy cập Camera bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt hoặc sử dụng nút máy ảnh mặc định.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('Không tìm thấy thiết bị camera trên máy.');
      } else {
        // Fallback try without ideal resolution
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          setStream(fallbackStream);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play().catch(() => {});
          }
        } catch (fallbackErr: any) {
          setErrorMessage('Không thể khởi động camera. Bạn có thể nhấn nút "Mở máy ảnh thiết bị" bên dưới để chụp ảnh trực tiếp.');
        }
      }
    } finally {
      setIsStartingCamera(false);
    }
  }, [stopStream]);

  // Handle open / close lifecycle
  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, capturedImage]);

  if (!isOpen) return null;

  // Toggle front / back camera
  const handleToggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // Capture frame from live video
  const handleTakePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Visual shutter flash effect
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 180);

    // If front camera, flip horizontally
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `schedule_camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setCapturedImage(dataUrl);
        setCapturedFile(file);
        stopStream();
      }
    }, 'image/jpeg', 0.92);
  };

  // Native input camera fallback
  const handleNativeCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const dataUrl = URL.createObjectURL(file);
      setCapturedImage(dataUrl);
      setCapturedFile(file);
      stopStream();
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedFile(null);
    startCamera(facingMode);
  };

  // Confirm photo and pass to parent
  const handleConfirm = () => {
    if (capturedFile) {
      onCapture(capturedFile);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none">
      {/* Hidden fallback file input with capture="environment" for native phone camera */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        onChange={handleNativeCameraChange} 
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Bar */}
      <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent text-white">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-white/20 rounded-xl backdrop-blur-md">
            <Camera size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Chụp Thời Khóa Biểu</h3>
            <p className="text-[11px] text-white/70">Căn chỉnh bảng lịch vào khung hình</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-md transition-colors"
          title="Đóng máy ảnh"
        >
          <X size={20} />
        </button>
      </div>

      {/* Viewfinder / Camera Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-zinc-950">
        {/* White Shutter Flash Effect */}
        {isFlashActive && (
          <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-200" />
        )}

        {capturedImage ? (
          /* Captured Preview */
          <div className="relative w-full h-full flex items-center justify-center p-2">
            <img 
              src={capturedImage} 
              alt="Captured schedule" 
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/20" 
            />
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full flex items-center space-x-1.5">
              <Sparkles size={14} className="text-amber-400" />
              <span>Ảnh đã chụp sẵn sàng quét</span>
            </div>
          </div>
        ) : errorMessage ? (
          /* Error / Fallback State */
          <div className="p-6 max-w-sm text-center text-white space-y-4">
            <div className="w-14 h-14 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/30">
              <AlertCircle size={28} />
            </div>
            <div>
              <h4 className="font-bold text-base mb-1">Không thể mở camera trực tiếp</h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg transition-all"
            >
              <Camera size={18} />
              <span>Mở máy ảnh thiết bị để chụp</span>
            </button>
          </div>
        ) : (
          /* Live Stream & Framing Guide */
          <div className="relative w-full h-full flex items-center justify-center">
            <video 
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />

            {/* Document / Timetable Scanning Frame Overlay */}
            <div className="absolute inset-x-6 inset-y-16 pointer-events-none border-2 border-indigo-400/80 rounded-3xl flex flex-col justify-between p-3 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Corner brackets */}
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl -mt-1 -ml-1" />
                <div className="w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl -mt-1 -mr-1" />
              </div>
              
              <div className="text-center bg-black/50 backdrop-blur-sm text-white/90 text-[11px] font-medium py-1 px-3 rounded-full self-center">
                Giữ điện thoại thẳng và căn gọn lịch học vào khung
              </div>

              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl -mb-1 -ml-1" />
                <div className="w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl -mb-1 -mr-1" />
              </div>
            </div>

            {isStartingCamera && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white space-y-2">
                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold">Đang kết nối camera...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="relative z-20 p-5 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-around text-white">
        {capturedImage ? (
          /* Confirmation Controls */
          <div className="w-full max-w-sm flex items-center justify-between gap-4">
            <button
              onClick={handleRetake}
              className="flex-1 py-3 px-4 bg-white/20 hover:bg-white/30 text-white rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 backdrop-blur-md transition-all active:scale-95"
            >
              <RotateCcw size={16} />
              <span>Chụp lại</span>
            </button>

            <button
              onClick={handleConfirm}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95"
            >
              <Check size={18} />
              <span>Sử dụng ảnh này</span>
            </button>
          </div>
        ) : (
          /* Shooting Controls */
          <div className="w-full max-w-sm flex items-center justify-between px-4">
            {/* Native device camera fallback */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-white/15 hover:bg-white/25 rounded-full text-white/90 backdrop-blur-md transition-colors"
              title="Dùng camera hệ thống"
            >
              <Maximize2 size={20} />
            </button>

            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleTakePhoto}
              disabled={isStartingCamera || !!errorMessage}
              className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform shadow-xl disabled:opacity-50"
            >
              <div className="w-14 h-14 bg-white rounded-full hover:bg-indigo-100 transition-colors shadow-inner flex items-center justify-center">
                <Camera size={24} className="text-indigo-600" />
              </div>
            </button>

            {/* Switch Camera Button (Front/Back) */}
            <button
              type="button"
              onClick={handleToggleCamera}
              disabled={isStartingCamera || !!errorMessage}
              className="p-3 bg-white/15 hover:bg-white/25 rounded-full text-white/90 backdrop-blur-md transition-colors disabled:opacity-50"
              title="Đổi camera trước / sau"
            >
              <SwitchCamera size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraCaptureModal;
