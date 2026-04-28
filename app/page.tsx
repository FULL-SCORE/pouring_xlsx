import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-gray-800/70 rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-8">
          管理メニュー
        </h1>

        <div className="space-y-4">
          <Link
            href="/upload"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 transition rounded-lg py-4 font-bold"
          >
            アップロード画面へ
          </Link>

          <Link
            href="/checker"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 transition rounded-lg py-4 font-bold"
          >
            キーワードチェック画面へ
          </Link>
        </div>
      </div>
    </main>
  );
}