import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUserAuth } from '../hooks/useUserAuth';
import { dataLocal } from '../services/periodo';
import type { Usuario } from '../types';
import { Icon } from './ui/Icon';

// O que falta no cadastro do usuário (visitante não tem SARAM)
export function pendenciasCadastro(u: Usuario | null): string[] {
  if (!u) return [];
  const faltam: string[] = [];
  if (!u.is_visitante && !u.saram?.trim()) faltam.push('SARAM');
  if (!u.foto_url) faltam.push('foto');
  if (!u.data_nascimento) faltam.push('data de aniversário');
  if (!u.whatsapp?.trim()) faltam.push('WhatsApp');
  return faltam;
}

const juntar = (itens: string[]) =>
  itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;

// "Lembrar depois" vale até o fim do dia (horário de Brasília), por usuário
const chave = (id: number) => `aviso_cadastro_${id}`;

export function AvisoCadastro() {
  const { user } = useUserAuth();
  const { pathname } = useLocation();
  const [adiado, setAdiado] = useState(() => {
    if (!user) return false;
    try { return localStorage.getItem(chave(user.id)) === dataLocal(new Date()); } catch { return false; }
  });

  const faltam = pendenciasCadastro(user);
  if (!user || faltam.length === 0 || adiado || pathname.startsWith('/perfil')) return null;

  const adiar = () => {
    try { localStorage.setItem(chave(user.id), dataLocal(new Date())); } catch { /* sem storage: some só nesta tela */ }
    setAdiado(true);
  };

  return (
    <div role="status" className="mb-5 bg-white border border-borda rounded-2xl shadow-sm overflow-hidden flex">
      <span className="w-1.5 shrink-0 bg-escarlate" aria-hidden="true" />
      <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-red-50 text-escarlate flex items-center justify-center">
            <Icon name="user" size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-texto">Complete seu cadastro</p>
            <p className="text-sm text-texto-fraco mt-0.5">
              Falta {juntar(faltam)}. Com o cadastro completo o RP encontra você mais rápido, e no seu aniversário tem surpresa.
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <button
            onClick={adiar}
            className="min-h-[40px] px-3.5 rounded-xl text-sm font-medium text-texto-fraco hover:text-texto hover:bg-fundo outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
          >
            Lembrar depois
          </button>
          <Link
            to="/perfil"
            className="min-h-[40px] px-4 rounded-xl text-sm font-semibold bg-azul text-white hover:bg-azul-claro inline-flex items-center justify-center flex-1 sm:flex-none outline-none focus-visible:ring-2 focus-visible:ring-azul/40 focus-visible:ring-offset-2"
          >
            Completar agora
          </Link>
        </div>
      </div>
    </div>
  );
}
