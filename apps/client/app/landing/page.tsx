import Link from "next/link";
import { getAdminPath } from "@/lib/tenant";

const adminLink = getAdminPath();

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center space-y-8">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900">
            PrepareOS
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            Le système de gestion tout-en-un pour votre commerce.
            <br />
            Commandes, préparations, stocks — simplifié.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href={adminLink}
              className="inline-flex items-center px-6 py-3 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
            >
              Accéder au tableau de bord
            </Link>
            <a
              href="mailto:contact@econome.studio"
              className="inline-flex items-center px-6 py-3 rounded-lg border-2 border-gray-900 text-gray-900 font-medium hover:bg-gray-50 transition-colors"
            >
              Nous contacter
            </a>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-gray-100 py-16 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center space-y-3">
            <div className="text-3xl">📦</div>
            <h3 className="font-semibold text-gray-900">Commandes</h3>
            <p className="text-sm text-gray-600">
              Recevez et gérez les commandes de vos clients en temps réel
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="text-3xl">👨‍🍳</div>
            <h3 className="font-semibold text-gray-900">Préparation</h3>
            <p className="text-sm text-gray-600">
              Interface de préparation intuitive pour votre équipe
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="text-3xl">📊</div>
            <h3 className="font-semibold text-gray-900">Statistiques</h3>
            <p className="text-sm text-gray-600">
              Suivez vos ventes et optimisez votre activité
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 px-6 text-center text-sm text-gray-500">
        <p>
          PrepareOS par{" "}
          <a
            href="https://econome.studio"
            className="underline hover:text-gray-900"
          >
            L&apos;Économe
          </a>
        </p>
      </footer>
    </div>
  );
}
