'use client';

import { useEffect, useMemo, useState } from 'react';

type TargetEnv = 'test' | 'live';

type StripeProduct = {
  id: number;
  product_id: string;
  name: string;
  active: boolean;
  meta_vid: string | null;
  cut: string | null;
  day: string | null;
  created: string | null;
};

export default function StripeProductsPage() {
  const [targetEnv, setTargetEnv] = useState<TargetEnv>('test');
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [nameSearch, setNameSearch] = useState('');
  const [productIdSearch, setProductIdSearch] = useState('');
  const [vidSearch, setVidSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const filteredProducts = useMemo(() => {
    const nameKeyword = nameSearch.trim().toLowerCase();
    const productIdKeyword = productIdSearch.trim().toLowerCase();
    const vidKeyword = vidSearch.trim().toLowerCase();

    return products.filter((product) => {
      const matchName =
        !nameKeyword || product.name?.toLowerCase().includes(nameKeyword);

      const matchProductId =
        !productIdKeyword ||
        product.product_id?.toLowerCase().includes(productIdKeyword);

      const matchVid =
        !vidKeyword || product.meta_vid?.toLowerCase().includes(vidKeyword);

      return matchName && matchProductId && matchVid;
    });
  }, [products, nameSearch, productIdSearch, vidSearch]);

  const fetchProducts = async () => {
    setLoading(true);

    try {
      const res = await fetch(`/api/stripe-products?targetEnv=${targetEnv}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '取得に失敗しました。');
      }

      setProducts(data.products || []);
    } catch (error) {
      setLogs((prev) => [`取得失敗: ${(error as Error).message}`, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (product: StripeProduct) => {
    const nextActive = !product.active;

    const message = nextActive
      ? `${product.name} を有効化しますか？`
      : `${product.name} をアーカイブしますか？`;

    if (!window.confirm(message)) return;

    setUpdatingId(product.product_id);

    try {
      const res = await fetch('/api/stripe-products/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetEnv,
          product_id: product.product_id,
          active: nextActive,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '更新に失敗しました。');
      }

      setProducts((prev) =>
        prev.map((item) =>
          item.product_id === product.product_id
            ? { ...item, active: data.active }
            : item
        )
      );

      setLogs((prev) => [data.message, ...prev]);
    } catch (error) {
      setLogs((prev) => [`更新失敗: ${(error as Error).message}`, ...prev]);
    } finally {
      setUpdatingId(null);
    }
  };

  const clearSearch = () => {
    setNameSearch('');
    setProductIdSearch('');
    setVidSearch('');
  };

  useEffect(() => {
    fetchProducts();
  }, [targetEnv]);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Stripe商品 管理</h1>
          <p className="text-gray-400 mt-2">
            商品名・product_id・vidを個別に検索し、Stripe商品とSupabaseのactiveを切り替えます。
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="font-semibold">対象環境</label>

            <select
              value={targetEnv}
              onChange={(e) => setTargetEnv(e.target.value as TargetEnv)}
              className={`px-4 py-2 rounded-lg border ${
                targetEnv === 'live'
                  ? 'bg-red-950 border-red-500 text-red-100'
                  : 'bg-gray-800 border-gray-700 text-white'
              }`}
            >
              <option value="test">テスト環境</option>
              <option value="live">本番環境</option>
            </select>

            <button
              onClick={fetchProducts}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600"
            >
              {loading ? '読み込み中...' : '再読み込み'}
            </button>

            <button
              onClick={clearSearch}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600"
            >
              検索クリア
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold mb-2">商品名で検索</label>
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder="例: 富士山"
                className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold mb-2">product_idで検索</label>
              <input
                type="text"
                value={productIdSearch}
                onChange={(e) => setProductIdSearch(e.target.value)}
                placeholder="例: prod_xxx"
                className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold mb-2">vidで検索</label>
              <input
                type="text"
                value={vidSearch}
                onChange={(e) => setVidSearch(e.target.value)}
                placeholder="例: 1222005202001"
                className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <p className="text-sm text-gray-400">
            表示件数: {filteredProducts.length} / {products.length}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="p-3 text-left">商品名</th>
                <th className="p-3 text-left">product_id</th>
                <th className="p-3 text-left">vid</th>
                <th className="p-3 text-left">状態</th>
                <th className="p-3 text-left">操作</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product) => (
                <tr
                  key={product.product_id}
                  className="border-t border-gray-800"
                >
                  <td className="p-3">{product.name}</td>
                  <td className="p-3 text-gray-400">{product.product_id}</td>
                  <td className="p-3 text-gray-400">{product.meta_vid || '-'}</td>
                  <td className="p-3">
                    {product.active ? (
                      <span className="px-2 py-1 rounded bg-green-700 text-green-100">
                        有効
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded bg-gray-700 text-gray-300">
                        アーカイブ
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleActive(product)}
                      disabled={updatingId === product.product_id}
                      className={`px-4 py-2 rounded-lg font-semibold disabled:bg-gray-600 ${
                        product.active
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {updatingId === product.product_id
                        ? '更新中...'
                        : product.active
                          ? 'アーカイブ'
                          : '有効化'}
                    </button>
                  </td>
                </tr>
              ))}

              {filteredProducts.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    該当する商品がありません。
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    読み込み中...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {logs.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="font-bold mb-2">ログ</h2>
            <ul className="space-y-1 text-sm text-gray-300">
              {logs.map((log, index) => (
                <li key={index}>{log}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}