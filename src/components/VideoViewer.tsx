interface VideoViewerProps {
  file?: File;
  url?: string;
}

export default function VideoViewer({ file, url }: VideoViewerProps) {
  const src = file ? URL.createObjectURL(file) : url;
  return (
    <div className="h-full w-full flex items-center justify-center bg-black p-4">
      {src ? (
        <video src={src} controls className="max-w-full max-h-full rounded" />
      ) : (
        <p className="text-anvil-muted text-sm">No video source</p>
      )}
    </div>
  );
}
