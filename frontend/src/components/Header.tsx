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
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
                Coverage Compass
              </h1>
              <p className="text-xs text-gray-500 -mt-0.5">coverage scenarios by PolicyEngine</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            <a
              href="https://policyengine.org"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              PolicyEngine
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
