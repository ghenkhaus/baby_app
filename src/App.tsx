import { useState } from "react";
import type { RegistryItem, Person } from "./types";
import { useRegistry } from "./hooks/useRegistry";
import { Layout } from "./components/Layout";
import { HeaderMenu } from "./components/HeaderMenu";
import { FilterBar } from "./components/FilterBar";
import { FilterSidebar } from "./components/FilterSidebar";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { RegistryList } from "./components/RegistryList";
import { ItemForm } from "./components/ItemForm";
import { ItemDetailModal } from "./components/ItemDetailModal";
import { CategoryManager } from "./components/CategoryManager";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AuditLogModal } from "./components/AuditLogModal";
import { PeopleView } from "./components/PeopleView";
import { PersonDetailModal } from "./components/PersonDetailModal";
import { PersonForm } from "./components/PersonForm";
import { BulkAddPeopleModal } from "./components/BulkAddPeopleModal";
import { ThankYousView } from "./components/ThankYousView";
import { ThankYouCardModal } from "./components/ThankYouCardModal";
import { Toast } from "./components/Toast";

function App() {
  const registry = useRegistry();

  const [view, setView] = useState<"items" | "people" | "thankyous">("items");
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<RegistryItem | undefined>();
  const [viewingItem, setViewingItem] = useState<RegistryItem | undefined>();
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewingPersonId, setViewingPersonId] = useState<string | null>(null);
  const [viewingCardId, setViewingCardId] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | undefined>();
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleAddItem = () => {
    setEditingItem(undefined);
    setShowItemForm(true);
  };

  const handleViewItem = (item: RegistryItem) => {
    setViewingItem(item);
  };

  const handleEditItem = (item: RegistryItem) => {
    setViewingItem(undefined);
    setEditingItem(item);
    setShowItemForm(true);
  };

  const handleSaveItem = (
    data: Omit<RegistryItem, "id" | "createdAt" | "updatedAt" | "contributors"> & {
      contributors: { personId: string; amount: number | null }[];
    }
  ) => {
    if (editingItem) {
      registry.updateItem(editingItem.id, data);
    } else {
      registry.addItem({ ...data, contributors: data.contributors });
    }
    setShowItemForm(false);
    setEditingItem(undefined);
  };

  const handleDeleteItem = (id: string) => {
    setDeletingItemId(id);
  };

  const handleQuickRegistryChange = (id: string, newRegistry: string) => {
    registry.updateItem(id, { registry: newRegistry });
  };

  const confirmDelete = () => {
    if (deletingItemId) {
      registry.deleteItem(deletingItemId);
      setDeletingItemId(null);
      setViewingItem(undefined);
    }
  };

  const handleImport = async (file: File) => {
    try {
      await registry.importData(file);
    } catch (e) {
      alert(
        `Import failed: ${e instanceof Error ? e.message : "Unknown error"}`
      );
    }
  };

  const hasFilters =
    registry.filters.stage.length > 0 ||
    registry.filters.status.length > 0 ||
    registry.filters.priority.length > 0 ||
    registry.filters.category.length > 0 ||
    registry.filters.registry.length > 0 ||
    registry.filters.contributor.length > 0 ||
    registry.filters.link !== "All" ||
    registry.filters.price.min !== null ||
    registry.filters.price.max !== null ||
    registry.filters.search !== "";

  const viewingPerson = viewingPersonId
    ? registry.people.find((p) => p.id === viewingPersonId) ?? null
    : null;

  const viewingCard = viewingCardId
    ? registry.thankYouCards.find((c) => c.id === viewingCardId) ?? null
    : null;

  const handleAddPerson = () => {
    setEditingPerson(undefined);
    setShowPersonForm(true);
  };

  const handleEditPerson = (p: Person) => {
    setEditingPerson(p);
    setShowPersonForm(true);
    setViewingPersonId(null);
  };

  const handleSavePerson = async (data: {
    name: string;
    email: string;
    notes: string;
    shareCardWithPersonId?: string;
  }) => {
    if (editingPerson) {
      await registry.updatePerson(editingPerson.id, {
        name: data.name,
        email: data.email,
        notes: data.notes,
      });
    } else {
      const cardId = data.shareCardWithPersonId
        ? registry.people.find((p) => p.id === data.shareCardWithPersonId)?.thankYouCardId
        : undefined;
      await registry.addPerson({
        name: data.name,
        email: data.email,
        notes: data.notes,
        thankYouCardId: cardId,
      });
    }
    setShowPersonForm(false);
    setEditingPerson(undefined);
  };

  const confirmDeletePerson = async () => {
    if (!deletingPersonId) return;
    try {
      await registry.removePerson(deletingPersonId);
      setToast({ message: "Person deleted", type: "success" });
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Failed to delete",
        type: "error",
      });
    }
    setDeletingPersonId(null);
    setViewingPersonId(null);
  };

  const headerActions = (
    <>
      {view === "items" ? (
        <>
          <button
            onClick={() => setShowCategoryManager(true)}
            className="hidden sm:inline-flex items-center px-3 sm:px-3.5 py-1.5 sm:py-2 text-sm font-medium text-slate-700 bg-white/70 backdrop-blur border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all"
          >
            Categories
          </button>
          <button
            onClick={() => setShowCategoryManager(true)}
            className="sm:hidden p-2 text-slate-700 bg-white/70 backdrop-blur border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 transition-all"
            title="Categories"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </button>
          <button
            onClick={handleAddItem}
            className="group inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-xl hover:from-indigo-500 hover:to-indigo-700 transition-all shadow-sm shadow-indigo-600/25 ring-1 ring-inset ring-white/10 active:scale-[0.98]"
          >
            <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">Add Item</span>
            <span className="sm:hidden">Add</span>
          </button>
        </>
      ) : view === "people" ? (
        <>
          <button
            onClick={() => setShowBulkAdd(true)}
            className="hidden sm:inline-flex items-center px-3 sm:px-3.5 py-1.5 sm:py-2 text-sm font-medium text-slate-700 bg-white/70 backdrop-blur border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all"
          >
            Bulk Add
          </button>
          <button
            onClick={handleAddPerson}
            className="group inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-xl hover:from-indigo-500 hover:to-indigo-700 transition-all shadow-sm shadow-indigo-600/25 ring-1 ring-inset ring-white/10 active:scale-[0.98]"
          >
            <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">Add Person</span>
            <span className="sm:hidden">Add</span>
          </button>
        </>
      ) : null}
      <HeaderMenu
        onShowAuditLog={() => setShowAuditLog(true)}
        onExport={registry.exportData}
        onImport={handleImport}
      />
    </>
  );

  const tabStrip = (
    <div className="flex items-center gap-1 mb-4 sm:mb-5">
      <button
        type="button"
        onClick={() => setView("items")}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-xl transition-all ${
          view === "items"
            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
            : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        Items
        <span className="text-[11px] tabular-nums text-slate-400">
          {registry.items.length}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setView("people")}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-xl transition-all ${
          view === "people"
            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
            : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6 5.87v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2m12-12a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        People
        <span className="text-[11px] tabular-nums text-slate-400">
          {registry.people.length}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setView("thankyous")}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-xl transition-all ${
          view === "thankyous"
            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
            : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Thank Yous
        <span className="text-[11px] tabular-nums text-slate-400">
          {registry.thankYouProgress.sent}/{registry.thankYouProgress.total}
        </span>
      </button>
    </div>
  );

  return (
    <Layout headerActions={headerActions} progress={registry.globalProgress}>
      {tabStrip}

      {view === "items" ? (
        <div className="flex gap-4 lg:gap-6">
          <FilterSidebar
            filters={registry.filters}
            categories={registry.categories}
            registries={registry.registries}
            people={registry.people}
            priceBounds={registry.priceBounds}
            attributeCounts={registry.attributeCounts}
            onFilterChange={registry.setFilters}
            onClearFilters={registry.resetFilters}
            isMobileOpen={filtersOpen}
            onCloseMobile={() => setFiltersOpen(false)}
          />

          <div className="flex-1 min-w-0">
            <AnalyticsPanel
              totalItems={registry.filteredItems.length}
              totalPrice={registry.totalPrice}
              priceHistogram={registry.priceHistogram}
              priceByCategory={registry.priceByCategory}
              categoryProgress={registry.categoryProgress}
              onFilterChange={registry.setFilters}
            />

            <FilterBar
              filters={registry.filters}
              onFilterChange={registry.setFilters}
              onOpenSidebar={() => setFiltersOpen(true)}
            />

            <RegistryList
              groupedItems={registry.groupedItems}
              sortedItems={registry.sortedItems}
              categories={registry.categories}
              registries={registry.registries}
              hasFilters={hasFilters}
              viewMode={registry.viewMode}
              sortField={registry.sortField}
              sortDirection={registry.sortDirection}
              onViewModeChange={registry.setViewMode}
              onSortFieldChange={registry.setSortField}
              onSortDirectionChange={registry.setSortDirection}
              onClearFilters={registry.resetFilters}
              onEditItem={handleViewItem}
              onDeleteItem={handleDeleteItem}
              onQuickRegistryChange={handleQuickRegistryChange}
            />
          </div>
        </div>
      ) : view === "people" ? (
        <PeopleView
          people={registry.people}
          onOpenPerson={(id) => setViewingPersonId(id)}
        />
      ) : (
        <ThankYousView
          cards={registry.thankYouCards}
          people={registry.people}
          settings={registry.settings}
          onOpenCard={(id) => setViewingCardId(id)}
          onUpdateCard={registry.updateThankYouCard}
          onUpdateSettings={registry.updateSettings}
          onToast={(message, type) => setToast({ message, type })}
        />
      )}

      {viewingItem && !showItemForm && (
        <ItemDetailModal
          item={registry.items.find((i) => i.id === viewingItem.id) ?? viewingItem}
          people={registry.people}
          onClose={() => setViewingItem(undefined)}
          onEdit={handleEditItem}
          onDelete={handleDeleteItem}
          onOpenPerson={(id) => {
            setViewingItem(undefined);
            setView("people");
            setViewingPersonId(id);
          }}
          onUpdateContributors={async (id, contributors) => {
            await registry.updateItem(id, { contributors });
          }}
          onUpdateStatus={async (id, status) => {
            await registry.updateItem(id, { status });
          }}
          onAddPerson={registry.addPerson}
        />
      )}

      {showItemForm && (
        <ItemForm
          item={editingItem}
          categories={registry.categories}
          people={registry.people}
          onSave={handleSaveItem}
          onAddPerson={registry.addPerson}
          onCancel={() => {
            setShowItemForm(false);
            setEditingItem(undefined);
          }}
        />
      )}

      {showCategoryManager && (
        <CategoryManager
          categories={registry.categories}
          onAddCategory={registry.addCategory}
          onRemoveCategory={registry.removeCategory}
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {showAuditLog && (
        <AuditLogModal onClose={() => setShowAuditLog(false)} />
      )}

      {deletingItemId && (
        <ConfirmDialog
          title="Delete Item"
          message="Are you sure you want to delete this item? This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeletingItemId(null)}
        />
      )}

      {viewingPerson && !showPersonForm && (
        <PersonDetailModal
          person={viewingPerson}
          people={registry.people}
          onClose={() => setViewingPersonId(null)}
          onEdit={handleEditPerson}
          onDelete={(id) => setDeletingPersonId(id)}
          onUpdateCard={registry.updateThankYouCard}
          onShareCard={registry.sharePersonCard}
          onUnlinkCard={registry.unlinkPersonCard}
          onMergePerson={registry.mergePerson}
          onOpenItem={(itemId) => {
            const item = registry.items.find((i) => i.id === itemId);
            if (item) {
              setViewingPersonId(null);
              setView("items");
              setViewingItem(item);
            }
          }}
          onOpenPerson={(id) => setViewingPersonId(id)}
          onOpenCard={(cardId) => {
            setViewingPersonId(null);
            setView("thankyous");
            setViewingCardId(cardId);
          }}
        />
      )}

      {viewingCard && !showPersonForm && (
        <ThankYouCardModal
          card={viewingCard}
          people={registry.people}
          postableProjectUrl={registry.settings.postableProjectUrl}
          onClose={() => setViewingCardId(null)}
          onUpdateCard={registry.updateThankYouCard}
          onOpenPerson={(id) => {
            setViewingCardId(null);
            setViewingPersonId(id);
          }}
          onToast={(message, type) => setToast({ message, type })}
        />
      )}

      {showPersonForm && (
        <PersonForm
          person={editingPerson}
          people={registry.people}
          onSave={handleSavePerson}
          onCancel={() => {
            setShowPersonForm(false);
            setEditingPerson(undefined);
          }}
        />
      )}

      {showBulkAdd && (
        <BulkAddPeopleModal
          onBulkAdd={registry.bulkAddPeople}
          onClose={() => setShowBulkAdd(false)}
          onResult={(message, type) => setToast({ message, type })}
        />
      )}

      {deletingPersonId && (
        <ConfirmDialog
          title="Delete Person"
          message="Are you sure you want to delete this person? Their contributions will be removed from any items."
          onConfirm={confirmDeletePerson}
          onCancel={() => setDeletingPersonId(null)}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </Layout>
  );
}

export default App;
