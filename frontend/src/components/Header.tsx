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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
                Healthcare Crossroads
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
