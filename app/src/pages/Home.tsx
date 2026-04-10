import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { api } from '../services/api';

type Sistema = 'guloseimas' | 'loja' | 'cafe';

const SISTEMAS: { id: Sistema; label: string }[] = [
  { id: 'guloseimas', label: 'Guloseimas' },
  { id: 'loja', label: 'Loja Militar' },
  { id: 'cafe', label: 'Caixinha do Café' },
];

export function Home() {
  const [sistema, setSistema] = useState<Sistema>('guloseimas');
  const [nomes, setNomes] = useState({ nome_sala_oficiais: 'Sala dos Oficiais', nome_sala_graduados: 'Sala dos Graduados' });
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Record<string, string>>('/api/config').then((c) => setNomes((n) => ({ ...n, ...c }))).catch(() => {});
  }, []);

  const selecionarSistema = (s: Sistema) => {
    if (s === 'loja') { navigate('/loja'); return; }
    setSistema(s);
  };

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
              onClick={() => selecionarSistema(s.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-medium transition-all ${
                sistema === s.id
                  ? 'bg-azul text-white shadow-md'
                  : 'text-texto-fraco hover:bg-fundo'
              }`}
            >
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

        {sistema === 'cafe' && (
          <div className="space-y-4 max-w-sm mx-auto animate-fade-in">
            <p className="text-texto-fraco text-sm text-center mb-2">Escolha sua sala</p>
            <Link
              to="/cafe?sala=oficial"
              className="group block bg-white rounded-2xl p-5 border border-borda hover:border-azul shadow-sm transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-azul/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-azul" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg sm:text-xl text-azul tracking-wide">SALA DOS OFICIAIS</h2>
                </div>
                <span className="text-texto-fraco group-hover:text-azul group-hover:translate-x-1 transition-all">&rarr;</span>
              </div>
            </Link>

            <Link
              to="/cafe?sala=graduado"
              className="group block bg-white rounded-2xl p-5 border border-borda hover:border-vermelho shadow-sm transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-vermelho/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-vermelho" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg sm:text-xl text-vermelho tracking-wide">SALA SO LANGE</h2>
                </div>
                <span className="text-texto-fraco group-hover:text-vermelho group-hover:translate-x-1 transition-all">&rarr;</span>
              </div>
            </Link>
          </div>
        )}

      </div>
    </PublicLayout>
  );
}
