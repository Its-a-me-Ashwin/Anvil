interface YouTubeViewerProps {
  url?: string;
}

export default function YouTubeViewer({ url }: YouTubeViewerProps) {
  // For now just embed the URL in an iframe. In the future this can be a custom player with range selection.
  const embedUrl = url?.includes('youtube.com/embed') ? url : url?.includes('watch?v=') ? url.replace('watch?v=', 'embed/') : url;

  return (
    <div className="h-full w-full flex flex-col bg-black">
      <div className="flex-1 flex items-center justify-center">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title="YouTube"
            className="w-full h-full border-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <p className="text-anvil-muted text-sm">No video URL</p>
        )}
      </div>
    </div>
  );
}
