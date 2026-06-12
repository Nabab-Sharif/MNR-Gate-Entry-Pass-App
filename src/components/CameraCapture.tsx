import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, RotateCcw, X, Check, SwitchCamera } from 'lucide-react';
import { toast } from 'sonner';

interface CameraCaptureProps {
  onCapture: (imageData: string, file: File) => void;
  onClose?: () => void;
}

const CameraCapture = forwardRef<HTMLDivElement, CameraCaptureProps>(({ onCapture, onClose }, ref) => {
  const [mode, setMode] = useState<'select' | 'camera' | 'preview'>('select');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    try {
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      setStream(newStream);
      setFacingMode(facing);
      setMode('camera');

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Unable to access camera. Please check permissions.');
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const switchCamera = async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(newFacing);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setCapturedImage(imageData);
          setCapturedFile(file);
          setMode('preview');
          stopCamera();
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      setCapturedImage(imageData);
      setCapturedFile(file);
      setMode('preview');
    };
    reader.readAsDataURL(file);
  };

  const confirmCapture = () => {
    if (capturedImage && capturedFile) {
      onCapture(capturedImage, capturedFile);
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setCapturedFile(null);
    setMode('select');
  };

  const handleClose = () => {
    stopCamera();
    onClose?.();
  };

  // Selection mode
  if (mode === 'select') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-24 flex-col gap-2"
            onClick={() => startCamera('environment')}
          >
            <Camera className="h-8 w-8" />
            <span className="text-sm">Back Camera</span>
          </Button>
          <Button
            variant="outline"
            className="h-24 flex-col gap-2"
            onClick={() => startCamera('user')}
          >
            <SwitchCamera className="h-8 w-8" />
            <span className="text-sm">Front Camera</span>
          </Button>
        </div>
        <Button
          variant="outline"
          className="w-full h-16 gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-5 w-5" />
          Upload from Gallery
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
    );
  }

  // Camera mode
  if (mode === 'camera') {
    return (
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full rounded-lg bg-black aspect-video object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            className="h-16 w-16 rounded-full bg-white hover:bg-white/90"
            onClick={capturePhoto}
          >
            <div className="h-12 w-12 rounded-full border-4 border-primary" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={switchCamera}
          >
            <SwitchCamera className="h-5 w-5" />
          </Button>
        </div>

        <div className="absolute top-4 left-4">
          <span className="text-xs bg-black/50 text-white px-2 py-1 rounded">
            {facingMode === 'user' ? 'Front' : 'Back'} Camera
          </span>
        </div>
      </div>
    );
  }

  // Preview mode
  if (mode === 'preview' && capturedImage) {
    return (
      <div className="relative">
        <img
          src={capturedImage}
          alt="Captured"
          className="w-full rounded-lg aspect-video object-cover"
        />
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={retake}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={confirmCapture}
          >
            <Check className="h-6 w-6" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
});

CameraCapture.displayName = 'CameraCapture';

export default CameraCapture;
