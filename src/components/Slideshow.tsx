import { useState, useEffect, useRef } from 'react';
import { CivitaiImage } from '../lib/civitai';
import { Play, Square, Settings, Plus, Minus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSwipeable } from 'react-swipeable';

interface SlideshowProps {
  images: CivitaiImage[];
  startIndex: number;
  onClose: () => void;
  onNavigateNext: () => void; // Navigate to next post
  onNavigatePrevious?: () => void; // Navigate to previous post
}

export const Slideshow = ({ images, startIndex, onClose, onNavigateNext, onNavigatePrevious }: SlideshowProps) => {
  console.log(`🎬 Slideshow initialized - has onNavigatePrevious: ${!!onNavigatePrevious}`);

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [displayIndex, setDisplayIndex] = useState(startIndex);
  const [actualDimensions, setActualDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [tapTimeout, setTapTimeout] = useState<NodeJS.Timeout | null>(null);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [playInterval, setPlayInterval] = useState(3000); // Default 3 seconds
  const [showUI, setShowUI] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [loopPost, setLoopPost] = useState(true); // true = loop post, false = advance to next post
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);
  const uiTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load user preferences on mount
  useEffect(() => {
    loadUserPreferences();
  }, []);

  async function loadUserPreferences() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_settings')
        .select('slideshow_duration, slideshow_loop_post')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        if (data.slideshow_duration) setPlayInterval(data.slideshow_duration);
        if (data.slideshow_loop_post !== null) setLoopPost(data.slideshow_loop_post);
      }
    } catch (err) {
      console.error('Error loading slideshow preferences:', err);
    }
  }

  async function saveUserPreferences(duration: number, loopPost: boolean) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          slideshow_duration: duration,
          slideshow_loop_post: loopPost,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving slideshow preferences:', err);
    }
  }

  // Reset to startIndex when images change (new post loaded)
  useEffect(() => {
    setCurrentIndex(startIndex);
    setDisplayIndex(startIndex);
    setActualDimensions(null);
    setIsZoomed(false);
    setPanPosition({ x: 0, y: 0 });
  }, [images, startIndex]);

  // Autoplay effect
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setTimeout(() => {
        goToNext();
      }, playInterval);
    }

    return () => {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
    };
  }, [isPlaying, currentIndex, playInterval, images]);

  // UI fade effect when playing
  useEffect(() => {
    if (isPlaying && showUI) {
      // Fade out UI after 3 seconds
      uiTimerRef.current = setTimeout(() => {
        setShowUI(false);
      }, 3000);
    }

    return () => {
      if (uiTimerRef.current) {
        clearTimeout(uiTimerRef.current);
      }
    };
  }, [isPlaying, showUI]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && !isPlaying) {
        goToPrevious();
      } else if (e.key === 'ArrowRight' && !isPlaying) {
        goToNext();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isPlaying]);

  const goToNext = () => {
    if (isTransitioning) return;

    // Check if we're at the last image and should advance to next post
    if (!loopPost && currentIndex === images.length - 1) {
      onNavigateNext();
      return;
    }

    const nextIndex = (currentIndex + 1) % images.length;
    setDisplayIndex(nextIndex);
    setActualDimensions(null); // Reset dimensions for new image
    setShowInfo(false); // Hide info when changing images
    setIsZoomed(false); // Reset zoom when changing images
    setPanPosition({ x: 0, y: 0 }); // Reset pan position

    // Start transition
    setIsTransitioning(true);
    setFadeOut(false);

    // Trigger fade out after a brief delay to allow render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFadeOut(true);
      });
    });

    // After fade completes, update current index
    setTimeout(() => {
      setCurrentIndex(nextIndex);
      setIsTransitioning(false);
      setFadeOut(false);
    }, 200);
  };

  const goToPrevious = () => {
    console.log(`⬅️ goToPrevious called - currentIndex: ${currentIndex}, loopPost: ${loopPost}, isTransitioning: ${isTransitioning}`);
    if (isTransitioning) return;

    // Check if we're at the first image and should navigate to previous post
    if (!loopPost && currentIndex === 0) {
      console.log(`⬅️ At first image with advance mode - calling onNavigatePrevious: ${!!onNavigatePrevious}`);
      if (onNavigatePrevious) {
        onNavigatePrevious();
      }
      return;
    }

    const prevIndex = (currentIndex - 1 + images.length) % images.length;
    setDisplayIndex(prevIndex);
    setActualDimensions(null); // Reset dimensions for new image
    setShowInfo(false); // Hide info when changing images
    setIsZoomed(false); // Reset zoom when changing images
    setPanPosition({ x: 0, y: 0 }); // Reset pan position

    // Start transition
    setIsTransitioning(true);
    setFadeOut(false);

    // Trigger fade out after a brief delay to allow render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFadeOut(true);
      });
    });

    // After fade completes, update current index
    setTimeout(() => {
      setCurrentIndex(prevIndex);
      setIsTransitioning(false);
      setFadeOut(false);
    }, 200);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      // Starting to play - show UI initially
      setShowUI(true);
    } else {
      // Stopping - always show UI
      setShowUI(true);
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    setShowUI(true);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    // If playing, just show UI temporarily
    if (isPlaying) {
      setShowUI(true);
      return;
    }

    // If zoomed and dragging, don't process taps
    if (isZoomed && isDragging) {
      return;
    }

    if (tapTimeout) {
      // Double tap detected - only works when not playing
      clearTimeout(tapTimeout);
      setTapTimeout(null);
      setIsZoomed(!isZoomed);
      if (isZoomed) {
        setPanPosition({ x: 0, y: 0 }); // Reset pan when zooming out
      }
    } else {
      // Single tap - wait to see if there's a second tap
      const timeout = setTimeout(() => {
        // Single tap confirmed - only advance if not zoomed and not playing
        if (!isZoomed && !isPlaying) {
          goToNext();
        }
        setTapTimeout(null);
      }, 300);
      setTapTimeout(timeout);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isZoomed && actualDimensions) {
      e.preventDefault();
      setIsDragging(true);
      // Store where we started dragging, accounting for current pan position
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const constrainPan = (screenX: number, screenY: number) => {
    if (!imageRef.current || !actualDimensions) return { x: 0, y: 0 };

    const container = imageRef.current.parentElement;
    if (!container) return { x: 0, y: 0 };

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Calculate the actual displayed size of the image content with object-contain
    const naturalWidth = actualDimensions.width;
    const naturalHeight = actualDimensions.height;
    const naturalAspect = naturalWidth / naturalHeight;
    const containerAspect = containerWidth / containerHeight;

    let contentWidth: number;
    let contentHeight: number;

    if (naturalAspect > containerAspect) {
      // Image is wider than container - width constrained
      contentWidth = containerWidth;
      contentHeight = containerWidth / naturalAspect;
    } else {
      // Image is taller than container - height constrained
      contentHeight = containerHeight;
      contentWidth = containerHeight * naturalAspect;
    }

    // Zoom scale constant (must match the transform scale)
    const zoomScale = 3;

    // After zooming, the content dimensions are:
    const zoomedWidth = contentWidth * zoomScale;
    const zoomedHeight = contentHeight * zoomScale;

    // How much the zoomed image extends beyond the container on each side
    const excessWidth = Math.max(0, zoomedWidth - containerWidth);
    const excessHeight = Math.max(0, zoomedHeight - containerHeight);

    // Maximum pan distance in screen pixels (half the excess on each side)
    const maxPanX = excessWidth / 2;
    const maxPanY = excessHeight / 2;

    // Clamp the values strictly within bounds
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, screenX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, screenY))
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isZoomed && isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      const constrained = constrainPan(newX, newY);
      setPanPosition(constrained);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      // Apply constraints one final time when releasing to ensure image is in bounds
      const constrained = constrainPan(panPosition.x, panPosition.y);
      setPanPosition(constrained);
    }
  };

  // Safety check: if indices are out of bounds, use first image as fallback
  const currentImage = images[currentIndex] || images[0];
  const displayImage = images[displayIndex] || images[0];

  // If no images at all, don't render
  if (!currentImage || !displayImage) {
    return null;
  }

  // Check if the current item is a video
  const isVideo = (url: string) => url.toLowerCase().endsWith('.mp4') || url.toLowerCase().includes('.mp4?');
  const isCurrentVideo = isVideo(displayImage.url);

  // Swipe handlers for image navigation
  const ENABLE_SWIPE = false; // Temporary flag to disable swipe for testing
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (ENABLE_SWIPE && !isZoomed) {
        console.log(`👈 Swiped left - going to next image`);
        goToNext();
      }
    },
    onSwipedRight: () => {
      if (ENABLE_SWIPE && !isZoomed) {
        console.log(`👉 Swiped right - going to previous image`);
        goToPrevious();
      }
    },
    trackMouse: false,
    preventScrollOnSwipe: ENABLE_SWIPE,
    delta: 50, // minimum swipe distance
  });

  return (
    <div
      {...swipeHandlers}
      className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Bottom layer: shows next image/video (fades in from 0 to 100) */}
      {isCurrentVideo ? (
        <video
          ref={imageRef as any}
          src={displayImage.url}
          className="w-full h-full cursor-pointer select-none object-contain"
          style={{
            ...(isZoomed
              ? {
                  cursor: isDragging ? 'grabbing' : 'grab',
                  transform: `scale(3) translate(${panPosition.x / 3}px, ${panPosition.y / 3}px)`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.2s'
                }
              : {
                  transform: 'scale(1)',
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s'
                })
          }}
          onClick={handleImageClick}
          onMouseDown={handleMouseDown}
          onLoadedMetadata={(e) => {
            const video = e.target as HTMLVideoElement;
            setActualDimensions({ width: video.videoWidth, height: video.videoHeight });
          }}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img
          ref={imageRef}
          src={displayImage.url}
          alt={`Image ${displayIndex + 1} of ${images.length}`}
          className="w-full h-full cursor-pointer select-none object-contain"
          style={{
            ...(isZoomed
              ? {
                  cursor: isDragging ? 'grabbing' : 'grab',
                  transform: `scale(3) translate(${panPosition.x / 3}px, ${panPosition.y / 3}px)`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.2s'
                }
              : {
                  transform: 'scale(1)',
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s'
                })
          }}
          onClick={handleImageClick}
          onMouseDown={handleMouseDown}
          onLoad={(e) => {
            const img = e.target as HTMLImageElement;
            setActualDimensions({ width: img.naturalWidth, height: img.naturalHeight });
          }}
          draggable={false}
        />
      )}

      {/* Top layer: shows current image/video during transition (fades out from 100 to 0) */}
      {isTransitioning && currentIndex !== displayIndex && (
        isVideo(currentImage.url) ? (
          <video
            src={currentImage.url}
            className="absolute inset-0 w-full h-full select-none object-contain transition-opacity duration-200"
            style={{
              pointerEvents: 'none',
              opacity: fadeOut ? 0 : 1
            }}
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img
            src={currentImage.url}
            alt={`Image ${currentIndex + 1} of ${images.length}`}
            className="absolute inset-0 w-full h-full select-none object-contain transition-opacity duration-200"
            style={{
              pointerEvents: 'none',
              opacity: fadeOut ? 0 : 1
            }}
            draggable={false}
          />
        )
      )}

      {/* UI Overlay */}
      {/* Close button - Top right */}
      <button
        onClick={onClose}
        className={`absolute top-8 right-8 w-12 h-12 flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-all duration-300 z-10 ${
          showUI ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Close"
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Previous button */}
      {(images.length > 1 || !loopPost) && (
        <button
          onClick={goToPrevious}
          className={`absolute left-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-all duration-300 z-10 ${
            showUI ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Previous"
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}

      {/* Next button */}
      {(images.length > 1 || !loopPost) && (
        <button
          onClick={goToNext}
          className={`absolute right-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-all duration-300 z-10 ${
            showUI ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Next"
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {/* Image counter */}
      <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 h-12 flex items-center text-white text-sm bg-black bg-opacity-50 px-4 rounded-full transition-opacity duration-300 ${
        isPlaying || showUI ? 'opacity-100' : 'opacity-0'
      }`}>
        {currentIndex + 1} / {images.length}
      </div>

      {/* Bottom Left Buttons */}
      <div className={`absolute bottom-8 left-8 flex items-center gap-2 z-10 transition-opacity duration-300 ${
        showUI ? 'opacity-100' : 'opacity-0'
      }`}>
        {/* Play/Stop button */}
        <button
          onClick={togglePlay}
          className="w-12 h-12 flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-colors"
          aria-label={isPlaying ? "Stop slideshow" : "Play slideshow"}
        >
          {isPlaying ? (
            <Square className="w-5 h-5 text-white" strokeWidth={1.5} />
          ) : (
            <Play className="w-5 h-5 text-white" strokeWidth={1.5} />
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={() => {
            stopPlayback();
            setShowSettings(true);
          }}
          className="w-12 h-12 flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 text-white" strokeWidth={1.5} />
        </button>
      </div>

      {/* Bottom Right Buttons */}
      <div className={`absolute bottom-8 right-8 flex items-center gap-2 z-10 transition-opacity duration-300 ${
        showUI ? 'opacity-100' : 'opacity-0'
      }`}>
        {/* Civitai link */}
        <a
          href={`https://civitai.com/images/${currentImage.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            stopPlayback();
          }}
          title="View on Civitai"
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>

        {/* Info button */}
        <button
          onClick={() => {
            stopPlayback();
            setShowInfo(true);
          }}
          className="w-12 h-12 flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-colors"
          aria-label="Image info"
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
        </button>
      </div>

      {/* Info overlay */}
      {showInfo && (
        <div
          onClick={() => setShowInfo(false)}
          className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-20 flex items-center justify-center"
        >
          <div className="text-white rounded-lg p-8 max-w-2xl w-full mx-8">
            <h2 className="text-2xl font-semibold mb-6">Image Information</h2>

            <div className="space-y-4">
              {/* Creator */}
              {currentImage.username && (
                <div className="flex justify-between items-center border-b border-gray-700 pb-3">
                  <span className="text-gray-400">Creator</span>
                  <span className="font-medium">@{currentImage.username}</span>
                </div>
              )}

              {/* Post ID */}
              <div className="flex justify-between items-center border-b border-gray-700 pb-3">
                <span className="text-gray-400">Post ID</span>
                <span className="font-medium">{currentImage.postId}</span>
              </div>

              {/* Image ID */}
              <div className="flex justify-between items-center border-b border-gray-700 pb-3">
                <span className="text-gray-400">Image ID</span>
                <span className="font-medium">{currentImage.id}</span>
              </div>

              {/* Dimensions */}
              <div className="flex justify-between items-center border-b border-gray-700 pb-3">
                <span className="text-gray-400">Dimensions</span>
                <span className="font-medium">
                  {actualDimensions
                    ? `${actualDimensions.width} × ${actualDimensions.height}`
                    : `${currentImage.width} × ${currentImage.height}`
                  }
                </span>
              </div>

              {/* Created At */}
              {currentImage.createdAt && (
                <div className="flex justify-between items-center border-b border-gray-700 pb-3">
                  <span className="text-gray-400">Created</span>
                  <span className="font-medium">
                    {new Date(currentImage.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}

              {/* NSFW */}
              <div className="flex justify-between items-center border-b border-gray-700 pb-3">
                <span className="text-gray-400">NSFW</span>
                <span className="font-medium">{currentImage.nsfw ? 'Yes' : 'No'}</span>
              </div>

              {/* Hash */}
              <div className="flex justify-between items-start border-b border-gray-700 pb-3">
                <span className="text-gray-400">Hash</span>
                <span className="font-mono text-sm break-all text-right max-w-md">{currentImage.hash}</span>
              </div>

              {/* Image in Set */}
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Image in Set</span>
                <span className="font-medium">{currentIndex + 1} of {images.length}</span>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-gray-500">
              Tap anywhere to close
            </div>
          </div>
        </div>
      )}

      {/* Settings overlay */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-20 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="text-white rounded-lg p-8 max-w-2xl w-full mx-8"
          >
            <h2 className="text-2xl font-semibold mb-6">Slideshow Settings</h2>

            <div className="space-y-6">
              {/* Duration Control */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Duration per image</span>
                  <span className="font-medium">{playInterval / 1000}s</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const newInterval = Math.max(1000, playInterval - 1000);
                      setPlayInterval(newInterval);
                      saveUserPreferences(newInterval, loopPost);
                    }}
                    className="w-10 h-10 flex items-center justify-center bg-white bg-opacity-10 hover:bg-opacity-20 rounded-full transition-colors"
                    aria-label="Decrease duration"
                  >
                    <Minus className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </button>
                  <div className="flex-1 h-2 bg-white bg-opacity-10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-200"
                      style={{ width: `${Math.min(100, ((playInterval - 1000) / 9000) * 100)}%` }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const newInterval = Math.min(10000, playInterval + 1000);
                      setPlayInterval(newInterval);
                      saveUserPreferences(newInterval, loopPost);
                    }}
                    className="w-10 h-10 flex items-center justify-center bg-white bg-opacity-10 hover:bg-opacity-20 rounded-full transition-colors"
                    aria-label="Increase duration"
                  >
                    <Plus className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1s</span>
                  <span>10s</span>
                </div>
              </div>

              {/* Loop/Next Post Toggle */}
              <div className="border-t border-gray-700 pt-6">
                <div className="space-y-3">
                  <span className="text-gray-400 block">Playback behavior</span>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setLoopPost(true);
                        saveUserPreferences(playInterval, true);
                      }}
                      className={`w-full flex items-start gap-3 p-4 rounded-lg transition-colors ${
                        loopPost
                          ? 'bg-white bg-opacity-20 border border-white border-opacity-30'
                          : 'bg-white bg-opacity-5 hover:bg-opacity-10'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                        loopPost ? 'border-white' : 'border-gray-500'
                      }`}>
                        {loopPost && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">Loop current post</div>
                        <div className="text-sm text-gray-400 mt-1">
                          Slideshow will loop through images in this post only
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setLoopPost(false);
                        saveUserPreferences(playInterval, false);
                      }}
                      className={`w-full flex items-start gap-3 p-4 rounded-lg transition-colors ${
                        !loopPost
                          ? 'bg-white bg-opacity-20 border border-white border-opacity-30'
                          : 'bg-white bg-opacity-5 hover:bg-opacity-10'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                        !loopPost ? 'border-white' : 'border-gray-500'
                      }`}>
                        {!loopPost && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">Advance to next post</div>
                        <div className="text-sm text-gray-400 mt-1">
                          After the last image, advance to the next post
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-gray-500">
              Tap anywhere to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
