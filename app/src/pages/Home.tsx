import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { api } from '../services/api';

type Sistema = 'guloseimas' | 'loja' | 'cafe';

const SISTEMAS: { id: Sistema; label: string; emoji: string }[] = [
  { id: 'guloseimas', label: 'Guloseimas', emoji: '🍬' },
  { id: 'loja', label: 'Loja Militar', emoji: '🎽' },
  { id: 'cafe', label: 'Caixinha do Café', emoji: '☕' },
];

export function Home() {
  const [sistema, setSistema] = useState<Sistema>('guloseimas');
  const [nomes, setNomes] = useState({ nome_sala_oficiais: 'Sala dos Oficiais', nome_sala_graduados: 'Sala dos Graduados' });

  useEffect(() => {
    api.get<Record<string, string>>('/api/config').then((c) => setNomes((n) => ({ ...n, ...c }))).catch(() => {});
  }, []);

  return (
    <PublicLayout>
      <div className="py-6 animate-fade-in">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="1/10 GpAv" className="w-28 h-28 mx-auto mb-5 object-contain" />
          <h1 className="font-display text-3xl sm:text-4xl text-azul tracking-wider">SENTA PUA</h1>
          <div className="w-16 h-[2px] bg-azul mx-auto mt-4" />
        </div>

        {/* Abas dos sistemas */}
        <div className="flex gap-1 bg-white rounded-2xl p-1.5 border border-borda shadow-sm mb-8 max-w-sm mx-auto">
          {SISTEMAS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSistema(s.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-medium transition-all ${
                sistema === s.id
                  ? 'bg-azul text-white shadow-md'
                  : 'text-texto-fraco hover:bg-fundo'
              }`}
            >
              <span className="text-lg">{s.emoji}</span>
              <span className="leading-tight">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Conteúdo do sistema selecionado */}
        {sistema === 'guloseimas' && (
          <div className="space-y-4 max-w-sm mx-auto animate-fade-in">
            <p className="text-texto-fraco text-sm text-center mb-2">Escolha sua sala</p>
            <Link
              to="/catalogo/oficiais"
              className="group block bg-white rounded-2xl p-5 border border-borda hover:border-azul shadow-sm transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-azul/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🎖️
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg sm:text-xl text-azul tracking-wide uppercase">{nomes.nome_sala_oficiais}</h2>
                </div>
                <span className="text-texto-fraco group-hover:text-azul group-hover:translate-x-1 transition-all">&rarr;</span>
              </div>
            </Link>

            <Link
              to="/catalogo/graduados"
              className="group block bg-white rounded-2xl p-5 border border-borda hover:border-vermelho shadow-sm transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-vermelho/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  ⭐
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg sm:text-xl text-vermelho tracking-wide uppercase">{nomes.nome_sala_graduados}</h2>
                </div>
                <span className="text-texto-fraco group-hover:text-vermelho group-hover:translate-x-1 transition-all">&rarr;</span>
              </div>
            </Link>
          </div>
        )}

        {sistema === 'loja' && (
          <div className="text-center max-w-sm mx-auto animate-fade-in">
            <div className="bg-white rounded-2xl p-8 border border-borda shadow-sm">
              <div className="w-20 h-20 mx-auto rounded-full bg-azul/10 flex items-center justify-center text-4xl mb-4">🎽</div>
              <h2 className="font-display text-xl text-azul tracking-wider mb-2">LOJA MILITAR</h2>
              <p className="text-texto-fraco text-sm">Camisas, canecas, abridores, facas e mais artigos do esquadrão.</p>
              <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-amber-800 text-xs font-medium">Em breve disponível!</p>
              </div>
            </div>
          </div>
        )}

        {sistema === 'cafe' && (
          <div className="text-center max-w-sm mx-auto animate-fade-in">
            <div className="bg-white rounded-2xl p-8 border border-borda shadow-sm">
              <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-4xl mb-4">☕</div>
              <h2 className="font-display text-xl text-azul tracking-wider mb-2">CAIXINHA DO CAFÉ</h2>
              <p className="text-texto-fraco text-sm">Controle de mensalidade do café para oficiais e graduados.</p>
              <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-amber-800 text-xs font-medium">Em breve disponível!</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
