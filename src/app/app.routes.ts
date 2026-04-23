import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/landing/landing').then(m => m.LandingComponent) },
  { path: 'login', loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register/register').then(m => m.Register) },
  { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent) },
  { path: 'admin/pagos', loadComponent: () => import('./features/admin/payments-admin').then(m => m.PaymentsAdminComponent) },
  { path: 'admin/usuarios', loadComponent: () => import('./features/admin/admin-users').then(m => m.AdminUsersComponent) },
  { path: 'admin/comisiones', loadComponent: () => import('./features/admin/admin-commissions').then(m => m.AdminCommissionsComponent) },
  { path: '**', redirectTo: '', pathMatch: 'full' }
];
