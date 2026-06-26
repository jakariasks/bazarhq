// src/main.jsx — COMPLETE FILE (replace your existing main.jsx)
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { AuthProvider }         from "@/hooks/use-auth";           // Merchant auth
import { CustomerAuthProvider } from "@/hooks/use-customer-auth";  // Customer auth
import { AdminAuthProvider }    from "@/hooks/use-admin-auth";     // Super Admin auth

import { routeTree } from "@/routeTree";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const router = createRouter({ routeTree });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>

      {/* Merchant auth — for /merchant/* routes */}
      <AuthProvider>

        {/* Customer auth — for /customer/* and /shop, /checkout, /track */}
        <CustomerAuthProvider>

          {/* Super Admin auth — for /superadmin/* routes */}
          <AdminAuthProvider>

            <RouterProvider router={router} />
            <Toaster richColors position="top-right" />

          </AdminAuthProvider>
        </CustomerAuthProvider>
      </AuthProvider>

    </QueryClientProvider>
  </StrictMode>
);
