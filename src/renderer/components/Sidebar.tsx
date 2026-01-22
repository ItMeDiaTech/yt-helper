type Page = 'download' | 'history' | 'settings'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  backendReady: boolean
}

function Sidebar({ currentPage, onNavigate, backendReady }: SidebarProps) {
  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: 'download', label: 'Download', icon: '↓' },
    { id: 'history', label: 'History', icon: '☰' },
    { id: 'settings', label: 'Settings', icon: '⚙' }
  ]

  return (
    <aside className="w-48 bg-dark-800 border-r border-dark-700 flex flex-col">
      <div className="p-4 border-b border-dark-700">
        <h1 className="text-lg font-bold text-primary-500">YT Helper</h1>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            disabled={!backendReady && item.id === 'download'}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
              currentPage === item.id
                ? 'bg-primary-600 text-white'
                : 'text-dark-300 hover:bg-dark-700 hover:text-white'
            } ${!backendReady && item.id === 'download' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-dark-700">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              backendReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
            }`}
          />
          <span className="text-dark-400">
            {backendReady ? 'Backend Ready' : 'Starting...'}
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
