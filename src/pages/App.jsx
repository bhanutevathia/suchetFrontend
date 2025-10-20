import React from "react";

import Dashboard from "./Dashboard";
import Explore from "./Explore";
// import Factors from "./Factors";
import Performance from "./Performance";
import Treatment from "./Treatment";

export default function App() {
  return (
    <div className="min-h-screen">
      {/* StudySprint palette */}
      <style>{`
        :root{
          --ss-orange:#FF9F29;
          --ss-heading:#1A1A1A;
          --ss-body:#4D4D4D;
          --ss-cream-1:#FFF6EC;
          --ss-cream-2:#FFFDF8;
          --ss-white:#FFFFFF;
          --ss-border:#F1E7DA;
        }
        html { scroll-behavior: smooth; }
        .section { padding-top: 3rem; padding-bottom: 3rem; }
        .section + .section { border-top: 1px solid var(--ss-border); }
      `}</style>

      {/* Page background */}
      <div className="bg-gradient-to-b from-[var(--ss-cream-1)] to-[var(--ss-cream-2)] text-[var(--ss-body)]">
        {/* Simple header (no navbar) */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-[var(--ss-border)]">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ss-heading)]">
              StudySprint{" "}
              <span className="text-[var(--ss-orange)]">Insights</span>
            </h1>
          </div>
        </header>

        {/* Single scrollable page with all sections */}
        <main className="mx-auto max-w-7xl px-6">
          {/* Dashboard */}
          <section id="dashboard" className="section">
            <h2 className="text-xl font-semibold mb-4 text-[var(--ss-heading)]">
              Dashboard
            </h2>
            <div className="rounded-2xl bg-[var(--ss-white)] border border-[var(--ss-border)] p-4 shadow-sm">
              <Dashboard />
            </div>
          </section>

          {/* Conditions (Explore) */}
          <section id="explore" className="section">
            <h2 className="text-xl font-semibold mb-4 text-[var(--ss-heading)]">
              Conditions
            </h2>
            <div className="rounded-2xl bg-[var(--ss-white)] border border-[var(--ss-border)] p-4 shadow-sm">
              <Explore />
            </div>
          </section>

          {/* Factors
          <section id="factors" className="section">
            <h2 className="text-xl font-semibold mb-4 text-[var(--ss-heading)]">
              Factors
            </h2>
            <div className="rounded-2xl bg-[var(--ss-white)] border border-[var(--ss-border)] p-4 shadow-sm">
              <Factors />
            </div>
          </section> */}

          {/* Performance */}
          <section id="performance" className="section">
            <h2 className="text-xl font-semibold mb-4 text-[var(--ss-heading)]">
              Performance
            </h2>
            <div className="rounded-2xl bg-[var(--ss-white)] border border-[var(--ss-border)] p-4 shadow-sm">
              <Performance />
            </div>
          </section>

          {/* Treatment */}
          <section id="treatment" className="section">
            <h2 className="text-xl font-semibold mb-4 text-[var(--ss-heading)]">
              Treatment
            </h2>
            <div className="rounded-2xl bg-[var(--ss-white)] border border-[var(--ss-border)] p-4 shadow-sm">
              <Treatment />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
