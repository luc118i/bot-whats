export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin ${className}`}
    />
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 rounded-lg animate-pulse ${className}`} />
}
