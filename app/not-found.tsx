import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#18181F] border border-[#2E2E3E] flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl text-gray-600">?</span>
        </div>
        <h1 className="font-serif text-4xl text-white mb-2">404</h1>
        <p className="text-gray-500 text-sm mb-6">Cette page n'existe pas.</p>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-medium">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}