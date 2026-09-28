import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/Login';
import { UnauthorizedPage } from './pages/Unauthorized';
import { DashboardPage } from './pages/Dashboard';
import { SoldierListPage } from './pages/Soldiers/SoldierList';
import { SoldierFormPage } from './pages/Soldiers/SoldierForm';
import { SoldierLedgerPage } from './pages/Soldiers/SoldierLedger';
import { CreditCollectionPage } from './pages/Soldiers/CreditCollection';
import { ExpenseListPage } from './pages/Finance/ExpenseList';
import { ProfitLossPage } from './pages/Finance/ProfitLoss';
import { MonthClosingPage } from './pages/Finance/MonthClosing';
import { ReportsHubPage } from './pages/Reports/ReportsHub';
import { StockMovementPage } from './pages/Reports/StockMovement';
import { ProductListPage } from './pages/Inventory/ProductList';
import { ProductFormPage } from './pages/Inventory/ProductForm';
import { ProductDetailPage } from './pages/Inventory/ProductDetail';
import { SupplierListPage } from './pages/Suppliers/SupplierList';
import { SupplierDetailPage } from './pages/Suppliers/SupplierDetail';
import { PurchaseListPage } from './pages/Purchases/PurchaseList';
import { PurchaseFormPage } from './pages/Purchases/PurchaseForm';
import { PurchaseDetailPage } from './pages/Purchases/PurchaseDetail';
import { POSPage } from './pages/POS/POSPage';
import { SaleDetailPage } from './pages/Sales/SaleDetail';
import { SalesListPage } from './pages/Sales/SalesList';
import { AuditLogPage } from './pages/Audit/AuditLog';
import { LoginHistoryPage } from './pages/Audit/LoginHistory';
import { CorrectionEntriesPage } from './pages/Corrections/CorrectionEntries';
import { SecuritySettingsPage } from './pages/Settings/SecuritySettings';
import { SoldierBulkImportPage } from './pages/Soldiers/SoldierBulkImport';
import { PurchaseBulkImportPage } from './pages/Purchases/PurchaseBulkImport';
import { ExpiryAlertsPage } from './pages/Inventory/ExpiryAlerts';
import { ProductLabelsPage } from './pages/Inventory/ProductLabels';
import { ProductPerformancePage } from './pages/Reports/ProductPerformance';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* সৈনিক তালিকা/লেজার — ৩ রোলই দেখতে পারে (Phase01 §৪ ম্যাট্রিক্স) */}
          <Route
            path="/soldiers"
            element={
              <ProtectedRoute>
                <SoldierListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/soldiers/:id"
            element={
              <ProtectedRoute>
                <SoldierLedgerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/soldiers/new"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <SoldierFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/soldiers/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <SoldierFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/soldiers/import"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <SoldierBulkImportPage />
              </ProtectedRoute>
            }
          />

          {/* বকেয়া-আদায় — canteen_admin + sales_operator (Phase01 §৪ রিভিশন৩ সিদ্ধান্ত) */}
          <Route
            path="/credit"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin', 'sales_operator']}>
                <CreditCollectionPage />
              </ProtectedRoute>
            }
          />

          {/* খরচ — সবাই দেখতে পারে, শুধু canteen_admin তৈরি করতে পারে */}
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <ExpenseListPage />
              </ProtectedRoute>
            }
          />

          {/* লাভ-ক্ষতি রিপোর্ট — Phase01 §৪ ম্যাট্রিক্স: canteen_admin + viewer (sales_operator নয়) */}
          <Route
            path="/reports/profit-loss"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin', 'viewer']}>
                <ProfitLossPage />
              </ProtectedRoute>
            }
          />

          {/* মাস-সমাপনী — শুধু canteen_admin (Phase01 §৪ ম্যাট্রিক্স, Month Closing) */}
          <Route
            path="/month-closing"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <MonthClosingPage />
              </ProtectedRoute>
            }
          />

          {/* রিপোর্ট হাব — সবাই দেখতে পারে (প্রতিটা লিংক নিজস্ব রোল-গার্ড অনুসরণ করে) */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/stock-movement"
            element={
              <ProtectedRoute>
                <StockMovementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/product-performance"
            element={
              <ProtectedRoute>
                <ProductPerformancePage />
              </ProtectedRoute>
            }
          />

          {/* ইনভেন্টরি — ৩ রোলই দেখতে পারে, তৈরি/সম্পাদনা/সমন্বয় শুধু canteen_admin */}
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <ProductListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/:id"
            element={
              <ProtectedRoute>
                <ProductDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/new"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <ProductFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <ProductFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/expiry"
            element={
              <ProtectedRoute>
                <ExpiryAlertsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/labels"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <ProductLabelsPage />
              </ProtectedRoute>
            }
          />

          {/* সরবরাহকারী — ৩ রোলই দেখতে পারে, পেমেন্ট-এন্ট্রি শুধু canteen_admin */}
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute>
                <SupplierListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suppliers/:id"
            element={
              <ProtectedRoute>
                <SupplierDetailPage />
              </ProtectedRoute>
            }
          />

          {/* ক্রয় — ৩ রোলই দেখতে পারে, তৈরি শুধু canteen_admin */}
          <Route
            path="/purchases"
            element={
              <ProtectedRoute>
                <PurchaseListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchases/:id"
            element={
              <ProtectedRoute>
                <PurchaseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchases/new"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <PurchaseFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchases/import"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <PurchaseBulkImportPage />
              </ProtectedRoute>
            }
          />

          {/* POS — শুধু canteen_admin + sales_operator (Phase01 §৪ ম্যাট্রিক্স, "Create — বিক্রয়") */}
          <Route
            path="/pos"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin', 'sales_operator']}>
                <POSPage />
              </ProtectedRoute>
            }
          />

          {/* বিক্রয়-তালিকা/রসিদ — ৩ রোলই দেখতে পারে */}
          <Route
            path="/sales"
            element={
              <ProtectedRoute>
                <SalesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales/:id"
            element={
              <ProtectedRoute>
                <SaleDetailPage />
              </ProtectedRoute>
            }
          />

          {/* অডিট লগ ও লগইন-ইতিহাস — শুধু canteen_admin (Phase01 §৪, §১৩; Phase14) */}
          <Route
            path="/audit"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <AuditLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit/logins"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <LoginHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/corrections"
            element={
              <ProtectedRoute allowedRoles={['canteen_admin']}>
                <CorrectionEntriesPage />
              </ProtectedRoute>
            }
          />

          {/* নিজের 2FA ব্যবস্থাপনা — যেকোনো authenticated রোল (নিজের অ্যাকাউন্টের নিরাপত্তা, RBAC-এর বিষয় না) */}
          <Route
            path="/settings/security"
            element={
              <ProtectedRoute>
                <SecuritySettingsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
