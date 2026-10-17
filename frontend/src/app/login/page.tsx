'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldAlert,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { fetchApi, setAuthToken, setCurrentUser } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('admin@apex.edu');
  const [password, setPassword] = useState('Admin@123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetchApi<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.success && res.data) {
        setAuthToken(res.data.token);
        setCurrentUser(res.data.user);
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 800);
      } else {
        throw new Error(res.message || 'Login failed');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid email or password credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('admin@apex.edu');
    setPassword('Admin@123456');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-xl mx-auto flex items-center justify-center text-emerald-600 shadow-sm">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            PQ Readiness Platform
          </h1>
          <p className="text-xs text-slate-500">
            Institutional Post-Quantum Cryptographic Assessment
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Authentication verified. Loading dashboard...</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Institutional Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">Password</label>
              <button
                type="button"
                onClick={handleFillDemo}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                Use Demo Login
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600">
              <input
                type="checkbox"
                defaultChecked
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <span>Remember this session</span>
            </label>

            <span className="text-[11px] text-slate-400">NIST FIPS 203/204/205</span>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-2.5 bg-navy-900 hover:bg-navy-850 text-white font-bold text-xs rounded-lg shadow flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                Signing In...
              </>
            ) : (
              <>
                Sign In to Platform <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* 1-Click Demo Shortcut Pill */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Default CISO Admin:</span>
          </div>
          <button
            onClick={handleFillDemo}
            className="text-emerald-700 font-semibold hover:underline"
          >
            admin@apex.edu / Admin@123456
          </button>
        </div>

        {/* Return to Dashboard link */}
        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1"
          >
            Continue as Guest Reviewer &rarr;
          </Link>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="mt-8 text-center text-[11px] text-slate-500 z-10 space-y-1">
        <p>Apex University of Science & Technology • Information Security Division</p>
        <p className="font-mono text-slate-600">Post-Quantum Cryptographic Readiness Standard v1.0</p>
      </footer>
    </div>
  );
}
