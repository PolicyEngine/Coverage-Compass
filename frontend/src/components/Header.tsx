import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-gradient-to-br from-[#319795] to-[#2C7A7B] rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" strokeWidth={2} strokeLinecap="round" />
                <polygon
                  points="12,5 14.5,12 12,10.5 9.5,12"
                  fill="currentColor"
                  stroke="none"
                />
                <polygon
                  points="12,19 9.5,12 12,13.5 14.5,12"
                  fill="currentColor"
                  fillOpacity={0.5}
                  stroke="none"
                />
              </svg>
            </div>
            <div>
              <span className="text-lg font-semibold text-gray-900 tracking-tight">
                Coverage Compass
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            <a
              href="https://github.com/PolicyEngine/Coverage-Compass"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source on GitHub"
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
