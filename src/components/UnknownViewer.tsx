interface UnknownViewerProps {
  title?: string;
}

export default function UnknownViewer({ title }: UnknownViewerProps) {
  return (
    <div className="h-full w-full flex items-center justify-center bg-anvil-bg text-anvil-muted">
      <div className="text-center">
        <p className="text-sm font-medium text-white">Unsupported file type</p>
        <p className="text-xs mt-1">{title || 'This file cannot be previewed yet.'}</p>
      </div>
    </div>
  );
}
