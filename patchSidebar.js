const fs = require('fs')

function patchSidebar() {
  const filePath = 'src/components/layout/Sidebar.tsx'
  let content = fs.readFileSync(filePath, 'utf8')

  if (!content.includes("Bell")) {
    content = content.replace(
      "Receipt,",
      "Receipt, Bell,"
    )
  }

  if (!content.includes("const [unreadCount")) {
    content = content.replace(
      "const isViewer = session?.user?.role === 'VIEWER'",
      `const isViewer = session?.user?.role === 'VIEWER'
  const [unreadCount, setUnreadCount] = React.useState(0)
  
  React.useEffect(() => {
    if (session?.user) {
      fetch('/api/notifications/unread-count')
        .then(res => res.json())
        .then(data => setUnreadCount(data.count || 0))
        .catch(console.error)
    }
  }, [session?.user])`
    )
  }

  if (!content.includes("href: '/notifications'")) {
    content = content.replace(
      "name: 'Budgets',",
      `name: 'Notifications',
        href: '/notifications',
        icon: Bell,
        show: !!session?.user,
        badge: unreadCount > 0 ? unreadCount : undefined,
      },
      {
        name: 'Budgets',`
    )
  }

  // Handle the badge if it's a number instead of just text
  content = content.replace(
    /\{item\.badge && \(\s*<span className="\[[^\]]+\]">\s*\{item\.badge\}\s*<\/span>\s*\)\}/g,
    `{item.badge && (
                  <span className={\`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide \${item.badge === 'Core/Rep' || item.badge === 'Core/Exec' ? 'bg-zinc-800 text-zinc-400' : 'bg-red-500 text-white'}\`}>
                    {item.badge}
                  </span>
                )}`
  )

  fs.writeFileSync(filePath, content)
}

patchSidebar()
