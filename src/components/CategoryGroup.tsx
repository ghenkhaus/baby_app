import { useState } from "react";
import type { RegistryItem } from "../types";
import { ItemCard } from "./ItemCard";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

interface CategoryGroupProps {
  category: string;
  items: RegistryItem[];
  registries: string[];
  onEditItem: (item: RegistryItem) => void;
  onDeleteItem: (id: string) => void;
  onQuickRegistryChange?: (id: string, registry: string) => void;
}

export function CategoryGroup({
  category,
  items,
  registries,
  onEditItem,
  onDeleteItem,
  onQuickRegistryChange,
}: CategoryGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="mb-6 sm:mb-8">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between mb-3 sm:mb-4 pb-2.5 border-b border-slate-200/70 cursor-pointer hover:bg-slate-50/60 -mx-2 px-2 py-1.5 rounded-xl transition-colors group"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-all ${collapsed ? "" : "rotate-90"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="text-base sm:text-lg font-semibold text-slate-800 tracking-tight">
            {category}{" "}
            <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full align-middle">
              {items.length}
            </span>
          </h2>
        </div>
        <span className="text-xs sm:text-sm font-semibold text-slate-600 tabular-nums">
          {formatPrice(subtotal)}
        </span>
      </button>
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              registries={registries}
              onEdit={onEditItem}
              onDelete={onDeleteItem}
              onQuickRegistryChange={onQuickRegistryChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
