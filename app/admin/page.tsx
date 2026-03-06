"use client";
import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/webhook") 
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch data");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setOrders(data);
          const total = data.reduce((acc: number, curr: any) => acc + parseFloat(curr.totalAmount), 0);
          setStats({ total, count: data.length });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch Error:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg font-medium text-gray-600 animate-pulse">Loading Delivery Details...</div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Delivery & Order Dashboard 🚚</h1>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
          >
            Refresh Orders
          </button>
        </div>

        {/* Analytics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Total Sales</p>
            <h2 className="text-4xl font-black text-emerald-600 mt-1">LKR {stats.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Orders for Delivery</p>
            <h2 className="text-4xl font-black text-blue-600 mt-1">{stats.count}</h2>
          </div>
        </div>

        {/* Orders Table with Delivery Info */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">ID</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Customer & Contact</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Delivery Address</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Order Items</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Total</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-400 italic">No delivery records found.</td>
                  </tr>
                ) : (
                  orders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-4 font-mono text-xs text-gray-400">#{order.id}</td>
                      <td className="p-4">
                        <div className="font-extrabold text-gray-800">{order.user?.name || "No Name Provided"}</div>
                        <div className="text-sm text-blue-600 font-medium">+{order.user?.phoneNumber}</div>
                      </td>
                      <td className="p-4 max-w-xs">
                        <div className="bg-yellow-50 text-yellow-800 p-2 rounded-lg border border-yellow-100 text-sm italic shadow-sm">
                          📍 {order.user?.address || "Address not specified"}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {order.items?.map((it: any) => (
                            <div key={it.id} className="text-[11px] font-bold text-gray-600 uppercase flex items-center">
                              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                              {it.product?.name} <span className="ml-1 text-blue-500">(x{it.quantity})</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 font-bold text-gray-900">Rs. {parseFloat(order.totalAmount).toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                          order.status === 'CONFIRMED' ? 'bg-green-600 text-white' : 'bg-amber-400 text-white'
                        }`}>
                          {order.status}
                        </span>
                        <div className="text-[9px] text-gray-400 mt-1 uppercase font-semibold">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}