export default function Home() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#18181F] border border-yellow-600/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">+</span>
        </div>
        <h1 className="font-serif text-4xl text-white mb-2">CalTrack</h1>
        <p className="text-sm text-gray-500 tracking-widest">nutrition · performance · résultats</p>
      </div>
    </div>
  )
}