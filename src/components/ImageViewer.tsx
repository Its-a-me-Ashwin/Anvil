interface ImageViewerProps {
  file?: File;
  url?: string;
}

export default function ImageViewer({ file, url }: ImageViewerProps) {
  const src = file ? URL.createObjectURL(file) : url;
  return (
    <div className="h-full w-full flex items-center justify-center bg-anvil-bg p-4 overflow-auto">
      {src ? (
        <img src={src} alt="Dropped" className="max-w-full max-h-full object-contain rounded shadow-lg border border-anvil-border" />
      ) : (
        <p className="text-anvil-muted text-sm">No image source</p>
      )}
    </div>
  );
}
