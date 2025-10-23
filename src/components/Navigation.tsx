interface NavigationProps {
  currentView: 'feed' | 'myposts' | 'favorites' | 'settings' | 'none';
  onViewChange: (view: 'feed' | 'myposts' | 'favorites' | 'settings') => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

export const Navigation = ({ currentView, onViewChange, showBackButton, onBack }: NavigationProps) => {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {showBackButton ? (
            <button
              onClick={() => onBack?.()}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Back"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
          ) : (
            <h1 className="text-xl font-bold text-gray-900">PostViewer</h1>
          )}
          <div className="flex gap-3 sm:gap-6">
            {/* Home (Feed) */}
            <button
              onClick={() => onViewChange('feed')}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Home"
            >
              <svg
                className={`w-[30px] h-[30px] ${currentView === 'feed' ? 'text-red-600' : 'text-gray-900'}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </button>

            {/* My Posts */}
            <button
              onClick={() => onViewChange('myposts')}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="My Posts"
            >
              <svg
                className={`w-[30px] h-[30px] ${currentView === 'myposts' ? 'text-red-600' : 'text-gray-900'}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </button>

            {/* Favorites */}
            <button
              onClick={() => onViewChange('favorites')}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Favorites"
            >
              <svg
                className={`w-[30px] h-[30px] ${currentView === 'favorites' ? 'text-red-600' : 'text-gray-900'}`}
                fill={currentView === 'favorites' ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>

            {/* Settings */}
            <button
              onClick={() => onViewChange('settings')}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Settings"
            >
              <svg
                className={`w-[30px] h-[30px] ${currentView === 'settings' ? 'text-red-600' : 'text-gray-900'}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
