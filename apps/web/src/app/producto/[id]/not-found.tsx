import Link from 'next/link'
import { PackageRemoveIcon } from '@hugeicons/core-free-icons'

import { EmptyState } from '@/components/empty-state'

export default function ProductNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
      <EmptyState
        icon={PackageRemoveIcon}
        title="No encontramos ese producto"
        description="El link puede estar mal escrito o el producto ya no está en nuestro catálogo."
      />
      <Link href="/" className="mt-6 text-sm font-medium text-primary hover:underline">
        Volver al catálogo
      </Link>
    </div>
  )
}
