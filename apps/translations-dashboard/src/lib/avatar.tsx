function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const AVATAR_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#0891b2', // cyan
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#7c3aed', // purple
  '#2563eb', // blue
]

export function getAvatarColor(name: string): string {
  return AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length]
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

export function InitialsAvatar({name, profileImage}: {name: string; profileImage?: null | string}) {
  if (profileImage) {
    return <img alt="" className="size-7 shrink-0 rounded-full object-cover" src={profileImage} />
  }

  const initials = getInitials(name)
  const color = getAvatarColor(name)

  return (
    <div
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none text-white"
      style={{background: color}}
    >
      {initials}
    </div>
  )
}
